// Prove del controllo "ogni permesso usato esiste davvero nel catalogo".
//
// Girano con `npm run test:scripts` (node:test, niente Vitest: qui e' backend). Non
// leggono il progetto vero: costruiscono sorgenti finti, cosi' la prova dice se il
// CONTROLLO funziona e non se il CRM di oggi e' a posto — che e' un'altra domanda, e
// cambia ogni settimana.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findUnknownPermissions,
  formatProblem,
  CATALOG_PATH,
  UNCOVERED_NOTICE,
} from './rbac-catalog-check.mjs';
import {
  collectConstantObjects,
  collectGuardAliases,
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

test('le cinque forme d uso vengono tutte riconosciute, con la riga giusta', () => {
  const sorgente = [
    "export const QUOTES_PERMISSIONS = {",
    "  view: 'quotes.view',",
    "} as const;",
    "await requirePermission(user.id, workspace.id, 'quotes.send');",
    "const { workspace } = await ensureQuotesAccess(request, 'quotes.accept');",
    "export const AREE = [{ permission: 'quotes.export_pdf' }];",
    "const ARCHIVE_PERMISSION = 'quotes.archive';",
  ].join('\n');

  assert.deepEqual(
    extractPermissionUsages(sorgente).map((uso) => [uso.key, uso.line]).sort(),
    [
      ['quotes.accept', 5],
      ['quotes.archive', 7],
      ['quotes.export_pdf', 6],
      ['quotes.send', 4],
      ['quotes.view', 2],
    ],
  );
});

// La formattazione normale del progetto spezza le chiamate su piu' righe, e li' la virgola
// finale prima della parentesi c'e' sempre. Finche' il controllo pretendeva la parentesi
// attaccata alla chiave, era cieco proprio sulla forma piu' diffusa: la stessa chiamata
// dava [] con la virgola e la chiave giusta senza. Il caso di prova tiene tutte e due le
// scritture accanto, cosi' il prossimo ritocco della regex non puo' riperdere il pezzo.
test('una chiamata multiriga viene letta con la virgola finale come senza', () => {
  const conVirgola = [
    'await requirePermission(',
    '  user.id,',
    '  workspace.id,',
    "  'quotes.send',",
    ');',
  ].join('\n');
  const senzaVirgola = conVirgola.replace("'quotes.send',", "'quotes.send'");

  assert.deepEqual(
    extractPermissionUsages(conVirgola).map((uso) => [uso.key, uso.line]),
    [['quotes.send', 1]],
  );
  assert.deepEqual(
    extractPermissionUsages(senzaVirgola).map((uso) => [uso.key, uso.line]),
    [['quotes.send', 1]],
  );
});

// Una chiamata su una riga sola con la virgola finale e' rara ma legale, e la stessa
// modifica la copre: se un domani sparisse, sparirebbe anche il caso multiriga.
test('la virgola finale non disturba nemmeno su una riga sola', () => {
  assert.deepEqual(
    extractPermissionUsages("await requirePermission(user.id, workspace.id, 'quotes.send',);")
      .map((uso) => uso.key),
    ['quotes.send'],
  );
});

// Un cancello non arriva sempre col suo nome. La Dashboard riceve requirePermission per
// iniezione, come `requirePermissionFn`, e lo chiama con la chiave scritta li': finche' la
// regex pretendeva il nome esatto, erano due chiamate-cancello vere (team.view e
// checklists.view in routes/workspace-dashboard.route.ts) che il controllo non vedeva — e il
// limite noto non le nominava, quindi nessuno sapeva di doverle guardare a mano. Il caso di
// prova sta qui per la stessa ragione di quello sulla virgola: il prossimo ritocco della
// regex non deve poterle riperdere in silenzio.
test('un cancello iniettato sotto un altro nome viene letto come quello vero', () => {
  const iniettato = [
    'await requirePermissionFn(',
    '  user.id,',
    '  workspace.id,',
    "  'quotes.send',",
    ');',
  ].join('\n');

  assert.deepEqual(
    extractPermissionUsages(iniettato).map((uso) => [uso.key, uso.line]),
    [['quotes.send', 1]],
  );
  assert.deepEqual(
    extractPermissionUsages("await requirePermissionFn(user.id, workspace.id, 'quotes.send');")
      .map((uso) => uso.key),
    ['quotes.send'],
  );
});

// Il rovescio della stessa modifica, ed e' la parte che tiene onesto il limite noto: il
// suffisso libero sui nomi NON deve tirare dentro `hasPermissionKey`, che prende un
// argomento solo prima della chiave. Se un domani ci entrasse, il controllo comincerebbe a
// leggere gli helper della Dashboard a meta' — alcune chiamate si', gli array no — e il
// limite dichiarato nel commento diventerebbe falso senza che nessuno se ne accorga.
test('il suffisso libero sui nomi non tira dentro gli helper della Dashboard', () => {
  assert.deepEqual(
    extractPermissionUsages("if (hasPermissionKey(permissionKeys, 'projects.view')) { return; }"),
    [],
  );
});

// Il verde deve dire anche cio' che non ha potuto guardare. La riga vive in una costante
// esportata apposta per essere tenuta ferma da qui: senza, una cancellazione distratta la
// toglierebbe e il messaggio tornerebbe a leggersi come una copertura totale.
test('il messaggio di successo dichiara cio\' che il controllo non copre', () => {
  assert.match(UNCOVERED_NOTICE, /hasPermissionKey/);
  assert.match(UNCOVERED_NOTICE, /hasAnyPermissionKey/);
  assert.match(UNCOVERED_NOTICE, /scripts\/security\/rbac-usage\.mjs/);
});

// Il secondo buco, e il piu' grande: il controllo legge solo server/. Dichiarare il primo e
// tacere questo peggiorerebbe le cose invece di migliorarle — chi legge un verde che nomina
// UN limite conclude che il resto sia coperto, mentre src/ tiene piu' chiavi scritte a mano
// del backend. Tenuto fermo qui perche' e' la meta' che si toglie per prima, essendo l'unica
// che non parla di codice presente in questo file.
test('il messaggio di successo dichiara anche che il frontend resta fuori', () => {
  assert.match(UNCOVERED_NOTICE, /src\//);
  assert.match(UNCOVERED_NOTICE, /server\//);
  assert.match(UNCOVERED_NOTICE, /CRM-64/);
});

// La forma a costante singola e' quella che i sei moduli di rotte usano davvero
// (VIEW_PERMISSION, MANAGE_ROLES_PERMISSION, ...). Finche' restava fuori, il controllo
// vedeva la CHIAMATA requirePermission(..., VIEW_PERMISSION) ma non la chiave che c'era
// dentro: undici costanti in sei file passavano senza che nessuno le guardasse.
test('una costante di modulo con la chiave sbagliata viene nominata per nome', () => {
  const { problems } = findUnknownPermissions({
    catalogSource: CATALOGO,
    files: [{
      path: 'server/routes/workspace-departments.route.ts',
      source: [
        "const VIEW_PERMISSION = 'reparti.vista';",
        "await requirePermission(user.id, workspace.id, VIEW_PERMISSION);",
      ].join('\n'),
    }],
  });

  assert.equal(problems.length, 1);
  assert.equal(problems[0].key, 'reparti.vista');
  assert.equal(problems[0].line, 1);
  assert.equal(problems[0].origin, 'VIEW_PERMISSION');
});

// Accanto alle costanti dei permessi vivono quelle degli EVENTI del registro attivita',
// che hanno la stessa forma e a volte perfino lo stesso valore
// (MODULES_AUDIT_ACTION = 'modules.manage' in workspace-modules.route.ts). Il suffisso
// _PERMISSION e' cio' che le tiene separate: senza, il controllo si riempirebbe di
// segnalazioni false e finirebbe spento.
test('le costanti che non finiscono in _PERMISSION restano fuori', () => {
  const sorgente = [
    "const MODULES_AUDIT_ACTION = 'modules.manage';",
    "const DEFAULT_LOCALE = 'it.IT';",
  ].join('\n');

  assert.deepEqual(extractPermissionUsages(sorgente), []);
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

test('i cancelli scorciatoia dichiarati nel file si risolvono al permesso vero', () => {
  // Senza questo, le quattro rotte delle impostazioni AI risultavano SENZA permesso pur
  // avendone uno: passano da una scorciatoia locale che il permesso ce l'ha dentro.
  const sorgente = `
    const AI_PRODUCTION_PERMISSIONS = { manageSettings: 'ai_production.manage_settings' } as const;

    const ensureAgencySettingsAccess = async (request: FastifyRequest) =>
      ensureAiProductionAccess(request, AI_PRODUCTION_PERMISSIONS.manageSettings);

    app.put('/agency/settings/runtime', async (request, reply) => {
      const { workspace } = await ensureAgencySettingsAccess(request);
    });
  `;
  const costanti = collectConstantObjects(stripNonCode(sorgente));

  assert.deepEqual(
    [...collectGuardAliases(stripNonCode(sorgente), costanti)],
    [['ensureAgencySettingsAccess', 'ai_production.manage_settings']],
  );
  assert.deepEqual(extractRoutePermissions(sorgente, costanti), [{
    method: 'PUT',
    path: '/agency/settings/runtime',
    guard: 'ensureAgencySettingsAccess',
    permission: 'ai_production.manage_settings',
  }]);
});

test('i permessi si leggono con tutte e due le convenzioni di nome, ma gli eventi del registro restano fuori', () => {
  // Il vault e' l'unico modulo che scrive `VaultPermissions` invece di `VAULT_PERMISSIONS`:
  // finche' si accettava solo la seconda forma, le sue sei chiavi non le leggeva nessuno.
  // Nello stesso file c'e' pero' `VaultAuditActions`, che di permessi non ne contiene: se
  // entrasse anche quello, il controllo comincerebbe a chiedere al catalogo dei nomi di
  // evento, e la via d'uscita piu' comoda sarebbe metterceli — cioe' sporcare il catalogo.
  const sorgente = `
    export const VaultPermissions = {
      reveal: 'vault.reveal',
      manageSettings: 'vault.manage_settings',
    } as const;

    export const VaultAuditActions = {
      revealDenied: 'vault.reveal_denied',
      unlockFail: 'vault.unlock_fail',
    } as const;
  `;

  assert.deepEqual(
    extractPermissionUsages(sorgente).map((uso) => uso.key),
    ['vault.reveal', 'vault.manage_settings'],
  );
});
