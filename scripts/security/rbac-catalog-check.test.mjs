// Prove del controllo "ogni permesso usato esiste davvero nel catalogo".
//
// Girano con `npm run test:scripts` (node:test, niente Vitest: qui e' backend). Non
// leggono il progetto vero: costruiscono sorgenti finti, cosi' la prova dice se il
// CONTROLLO funziona e non se il CRM di oggi e' a posto — che e' un'altra domanda, e
// cambia ogni settimana.

import assert from 'node:assert/strict';
import test from 'node:test';
import { findUnknownPermissions, formatProblem, CATALOG_PATH } from './rbac-catalog-check.mjs';
import {
  collectConstantObjects,
  extractCatalogPermissions,
  extractPermissionUsages,
  extractRoutePermissions,
  stripNonCode,
} from './rbac-usage.mjs';

const CATALOGO = `
export const CLIENTS_PERMISSIONS = {
  view: 'clients.view',
  edit: 'clients.edit',
} as const;

// Un permesso dichiarato come costante ma MAI messo a catalogo non vale.
export const ORPHAN_PERMISSIONS = {
  view: 'orfano.view',
} as const;

export const SYSTEM_PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = [
  { key: 'audit.view', moduleKey: 'audit', description: "Consultare il registro" },
  { key: CLIENTS_PERMISSIONS.view, moduleKey: 'clients', description: 'Vedere i clienti' },
  { key: CLIENTS_PERMISSIONS.edit, moduleKey: 'clients', description: 'Modificare l\\'anagrafica' },
];
`;

test('il catalogo si legge risolvendo anche le chiavi scritte come COSTANTE.proprieta', () => {
  const chiavi = extractCatalogPermissions(CATALOGO);

  assert.deepEqual([...chiavi].sort(), ['audit.view', 'clients.edit', 'clients.view']);
});

test('un permesso dichiarato come costante ma non messo a catalogo non conta come dichiarato', () => {
  // E' il difetto che il controllo esiste per prendere: la costante c'e', il codice la
  // usa, e nella pagina "Ruoli e permessi" non compare niente da concedere.
  assert.equal(extractCatalogPermissions(CATALOGO).has('orfano.view'), false);
});

test('le quadre vuote del tipo non vengono scambiate per l inizio dell array', () => {
  // `readonly PermissionCatalogEntry[] = [` : prendendo il primo '[' il catalogo
  // risultava vuoto e OGNI permesso del backend usciva come sconosciuto.
  assert.ok(extractCatalogPermissions(CATALOGO).size > 0);
});

test('i commenti italiani con apostrofo non fanno perdere il codice che li segue', () => {
  // Senza stripNonCode, l'apostrofo di "l'utente" apre una stringa che si chiude solo
  // alla virgoletta successiva, e tutto cio' che sta in mezzo sparisce dalla ricerca.
  const sorgente = [
    "// Solo l'utente che ha cio' che serve passa di qui.",
    "await requirePermission(userId, workspaceId, 'projects.view_all');",
  ].join('\n');

  const usi = extractPermissionUsages(sorgente);

  assert.deepEqual(usi.map((uso) => uso.key), ['projects.view_all']);
  assert.equal(usi[0].line, 2);
});

test('le quattro forme d uso vengono tutte riconosciute, con la riga giusta', () => {
  const sorgente = [
    "export const QUOTES_PERMISSIONS = {",
    "  view: 'quotes.view',",
    "} as const;",
    "await requirePermission(user.id, workspace.id, 'quotes.send');",
    "const { workspace } = await ensureQuotesAccess(request, 'quotes.accept');",
    "export const AREE = [{ permission: 'quotes.export_pdf' }];",
  ].join('\n');

  assert.deepEqual(
    extractPermissionUsages(sorgente).map((uso) => [uso.key, uso.line]).sort(),
    [
      ['quotes.accept', 5],
      ['quotes.export_pdf', 6],
      ['quotes.send', 4],
      ['quotes.view', 2],
    ],
  );
});

test('le stringhe col punto che permessi non sono restano fuori', () => {
  // Nel backend ce ne sono a decine: nomi di evento del registro attivita', file, host.
  // Se finissero dentro, il controllo direbbe sempre di no e verrebbe spento.
  const sorgente = [
    "await audit.record('team.invite_accepted', payload);",
    "const nome = 'foto.png';",
    "const host = 'example.com';",
  ].join('\n');

  assert.deepEqual(extractPermissionUsages(sorgente), []);
});

test('un permesso scritto a mano e sbagliato fa fallire il controllo nominando file e chiave', () => {
  const { problems } = findUnknownPermissions({
    catalogSource: CATALOGO,
    files: [{
      path: 'server/modules/clients/policies.ts',
      source: "export const CLIENTS_PERMISSIONS = {\n  archive: 'clients.archivia',\n} as const;",
    }],
  });

  assert.equal(problems.length, 1);
  assert.equal(problems[0].file, 'server/modules/clients/policies.ts');
  assert.equal(problems[0].key, 'clients.archivia');
  assert.equal(problems[0].line, 2);

  const riga = formatProblem(problems[0]);
  assert.ok(riga.includes('server/modules/clients/policies.ts:2'), riga);
  assert.ok(riga.includes("'clients.archivia'"), riga);
  assert.ok(riga.includes(CATALOG_PATH), riga);
});

test('sul codice in regola il controllo non ha niente da dire', () => {
  const { problems, catalogSize } = findUnknownPermissions({
    catalogSource: CATALOGO,
    files: [{
      path: 'server/modules/clients/policies.ts',
      source: "export const CLIENTS_PERMISSIONS = {\n  view: 'clients.view',\n} as const;",
    }],
  });

  assert.deepEqual(problems, []);
  assert.equal(catalogSize, 3);
});

test('le rotte si leggono col permesso che chiedono, e quelle senza cancello lo dichiarano', () => {
  const costanti = collectConstantObjects(stripNonCode(`
    const AI_PRODUCTION_PERMISSIONS = { view: 'ai_production.view' } as const;
  `));

  const rotte = extractRoutePermissions(`
    app.get('/agency/projects', async (request, reply) => {
      const { workspace } = await ensureAiProductionAccess(request, AI_PRODUCTION_PERMISSIONS.view);
    });
    app.get('/agency/ping', async (request, reply) => {
      reply.send({ ok: true });
    });
  `, costanti);

  assert.deepEqual(rotte, [
    {
      method: 'GET',
      path: '/agency/projects',
      guard: 'ensureAiProductionAccess',
      permission: 'ai_production.view',
    },
    { method: 'GET', path: '/agency/ping', guard: null, permission: null },
  ]);
});
