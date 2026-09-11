import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCrossWorkspaceWhere,
  buildWhere,
  type AiUsageCrossWorkspaceFilter,
  type AiUsageFilter,
} from './ai-usage.repository.js';

/**
 * Il difetto che questi test tengono chiuso (CRMA-179, audit CRMA-34): il filtro
 * per workspace era condizionale (`if (filter.workspaceId)`), quindi ometterlo
 * non dava errore — dava i consumi AI di TUTTI i workspace. Sbagliare in modo
 * permissivo e' l'unico modo di sbagliare che non si vede: la query torna dati,
 * la pagina si disegna, e il guasto salta fuori solo dove i workspace popolati
 * sono piu' di uno, cioe' in produzione.
 *
 * Il tipo `AiUsageFilter` ora rende obbligatorio `workspaceId`, e quella e' la
 * rete vera: la ricostruzione della condizione non compilerebbe. Ma il tipo
 * sparisce a runtime, e un `as any` al punto di chiamata lo aggira. Questi test
 * controllano il comportamento del costruttore, che resta anche compilato.
 */

const WORKSPACE = 'ws-consumi-1';

test('il perimetro di un workspace porta sempre workspaceId, anche senza altri filtri', () => {
  const where = buildWhere({ workspaceId: WORKSPACE });
  assert.equal(where.workspaceId, WORKSPACE);
});

test('workspaceId resta anche quando ci sono tutti gli altri filtri', () => {
  const since = new Date('2026-09-01T00:00:00.000Z');
  const filter: AiUsageFilter = {
    workspaceId: WORKSPACE,
    since,
    userId: 'user-1',
    model: 'claude-opus-5',
    functionName: 'chat',
    projectId: 'prj-1',
  };

  const where = buildWhere(filter);

  assert.equal(where.workspaceId, WORKSPACE);
  assert.deepEqual(where.createdAt, { gte: since });
  assert.equal(where.userId, 'user-1');
  assert.equal(where.model, 'claude-opus-5');
  assert.equal(where.functionName, 'chat');
  assert.equal(where.projectId, 'prj-1');
});

// Un workspaceId vuoto o spazio non e' "nessun filtro": e' un filtro che non
// trova niente. E' la differenza fra sbagliare in modo restrittivo (una pagina
// vuota, che si nota) e sbagliare in modo permissivo (i dati di tutti, che non
// si nota). Il vecchio `if (filter.workspaceId)` faceva la seconda.
test('un workspaceId vuoto non fa sparire la clausola', () => {
  assert.equal(buildWhere({ workspaceId: '' }).workspaceId, '');
});

test('la via cross-workspace non filtra per workspace, e lo dice nel nome', () => {
  const since = new Date('2026-09-01T00:00:00.000Z');
  const filter: AiUsageCrossWorkspaceFilter = { since, allWorkspaces: true };

  const where = buildCrossWorkspaceWhere(filter);

  assert.ok(!('workspaceId' in where), 'la vista di piattaforma non deve filtrare per workspace');
  assert.deepEqual(where.createdAt, { gte: since });
});

// `allWorkspaces` e' una dichiarazione per chi legge, non un dato della query:
// non deve finire nel `where`, o Prisma fallirebbe su un campo inesistente.
test('allWorkspaces non viene passato a Prisma', () => {
  const where = buildCrossWorkspaceWhere({ allWorkspaces: true }) as Record<string, unknown>;
  assert.ok(!('allWorkspaces' in where));
});
