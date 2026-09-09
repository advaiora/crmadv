import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPendingAuditEntry,
  isTrackedModel,
  isTrackedOperation,
  resolveEntityId,
  resolveEntityType,
  resolveWorkspaceId,
} from './audit-interceptor.js';
import { MAX_PENDING_AUDIT_ENTRIES, requestContext } from '../core/request-context.js';

const WORKSPACE = 'workspace-1';
const USER = 'user-1';

test('resolveEntityType traduce il nome del modello nella forma usata dalle annotazioni a mano', () => {
  assert.equal(resolveEntityType('Client'), 'client');
  assert.equal(resolveEntityType('AiConversation'), 'ai_conversation');
  assert.equal(resolveEntityType('ProjectOpportunity'), 'project_opportunity');
  assert.equal(resolveEntityType('WorkspaceMessage'), 'workspace_message');
  assert.equal(resolveEntityType('TeamInvite'), 'team_invite');
});

test('i tre modelli di sito condividono il tipo web_asset delle annotazioni a mano', () => {
  // Se divergessero, lo scarto dei doppioni non riconoscerebbe il bersaglio.
  assert.equal(resolveEntityType('WebsiteAsset'), 'web_asset');
  assert.equal(resolveEntityType('WebAppAsset'), 'web_asset');
  assert.equal(resolveEntityType('EcommerceAsset'), 'web_asset');
});

test('il registro non traccia se stesso', () => {
  assert.equal(isTrackedModel('AuditLog'), false);
});

test('le scritture di macchina ad alta frequenza restano fuori', () => {
  assert.equal(isTrackedModel('AiUsageLog'), false);
  assert.equal(isTrackedModel('ProjectSourceChunk'), false);
  assert.equal(isTrackedModel('WebAssetAnalyticsEvent'), false);
  assert.equal(isTrackedModel('PasswordResetToken'), false);
});

test('un modello mai visto prima è tracciato di default', () => {
  // E' il punto dell'intero intercettore: cio' che si aggiunge domani risulta
  // tracciato senza che nessuno aggiunga una riga di annotazione.
  assert.equal(isTrackedModel('ModelloInventatoOggi'), true);
});

test("le letture non passano dall'intercettore", () => {
  assert.equal(isTrackedOperation('findMany'), false);
  assert.equal(isTrackedOperation('findUnique'), false);
  assert.equal(isTrackedOperation('count'), false);
  assert.equal(isTrackedOperation('create'), true);
  assert.equal(isTrackedOperation('updateMany'), true);
  assert.equal(isTrackedOperation('deleteMany'), true);
});

test('il workspace della riga scritta batte quello del contesto', () => {
  requestContext.start();
  requestContext.setWorkspaceId('workspace-del-contesto');

  assert.equal(
    resolveWorkspaceId({ data: { workspaceId: 'workspace-della-riga' } }, { workspaceId: 'workspace-della-riga' }),
    'workspace-della-riga',
  );
});

test('senza workspace nella riga si ripiega su quello del contesto', () => {
  requestContext.start();
  requestContext.setWorkspaceId(WORKSPACE);

  assert.equal(resolveWorkspaceId({ where: { id: 'x' } }, { id: 'x' }), WORKSPACE);
});

test('resolveEntityId legge il risultato e, in mancanza, il where', () => {
  assert.equal(resolveEntityId({ where: { id: 'dal-where' } }, { id: 'dal-risultato' }), 'dal-risultato');
  assert.equal(resolveEntityId({ where: { id: 'dal-where' } }, { count: 3 }), 'dal-where');
  assert.equal(resolveEntityId({}, {}), null);
});

test('una creazione produce una registrazione con verbo, tipo e attore', () => {
  requestContext.start();

  const built = buildPendingAuditEntry({
    model: 'ProjectOpportunity',
    operation: 'create',
    args: { data: { workspaceId: WORKSPACE } },
    result: { id: 'opp-1', workspaceId: WORKSPACE },
    actorUserId: USER,
  });

  assert.ok(built);
  assert.equal(built.entry.action, 'project_opportunity.create');
  assert.equal(built.entry.entityType, 'project_opportunity');
  assert.equal(built.entry.entityId, 'opp-1');
  assert.equal(built.entry.workspaceId, WORKSPACE);
  assert.equal(built.entry.actorUserId, USER);
  assert.equal(built.entry.affectedCount, 1);
});

test('upsert e delete finiscono sui verbi update e delete', () => {
  requestContext.start();
  const args = { where: { id: 'a-1' }, data: { workspaceId: WORKSPACE } };

  const upserted = buildPendingAuditEntry({
    model: 'ProjectAlert',
    operation: 'upsert',
    args,
    result: { id: 'a-1', workspaceId: WORKSPACE },
    actorUserId: USER,
  });
  const deleted = buildPendingAuditEntry({
    model: 'ProjectAlert',
    operation: 'delete',
    args,
    result: { id: 'a-1', workspaceId: WORKSPACE },
    actorUserId: USER,
  });

  assert.equal(upserted?.entry.action, 'project_alert.update');
  assert.equal(deleted?.entry.action, 'project_alert.delete');
});

test('una scrittura in blocco porta con sé quante righe ha toccato', () => {
  requestContext.start();

  const built = buildPendingAuditEntry({
    model: 'Client',
    operation: 'createMany',
    args: { data: [{ workspaceId: WORKSPACE }, { workspaceId: WORKSPACE }] },
    result: { count: 42 },
    actorUserId: USER,
  });

  assert.equal(built?.entry.affectedCount, 42);
});

test('senza workspace non si registra niente', () => {
  requestContext.start();
  // Nessun workspace nel contesto e nessuno nella riga: la registrazione non
  // sarebbe scrivibile (colonna obbligatoria) né leggibile da nessuno.
  const built = buildPendingAuditEntry({
    model: 'Client',
    operation: 'create',
    args: { data: { name: 'Rossi' } },
    result: { id: 'c-1' },
    actorUserId: USER,
  });

  assert.equal(built, null);
});

test('un job di sistema senza attore viene comunque registrato', () => {
  requestContext.start();

  const built = buildPendingAuditEntry({
    model: 'ProjectAlert',
    operation: 'create',
    args: { data: { workspaceId: WORKSPACE } },
    result: { id: 'a-9', workspaceId: WORKSPACE },
    actorUserId: null,
  });

  assert.equal(built?.entry.actorUserId, null);
  assert.equal(built?.entry.action, 'project_alert.create');
});

test("l'annotazione scritta a mano scarta quella automatica sullo stesso bersaglio", () => {
  requestContext.start();

  const built = buildPendingAuditEntry({
    model: 'Client',
    operation: 'update',
    args: { where: { id: 'c-7' } },
    result: { id: 'c-7', workspaceId: WORKSPACE },
    actorUserId: USER,
  });
  assert.ok(built);
  requestContext.addPendingAuditEntry(built.key, built.entry);

  requestContext.markManualAudit('client', 'c-7');

  const { entries } = requestContext.drainPendingAuditEntries();
  assert.deepEqual(entries, []);
});

test("un'annotazione a mano su un altro bersaglio non scarta niente", () => {
  requestContext.start();

  const built = buildPendingAuditEntry({
    model: 'Client',
    operation: 'update',
    args: { where: { id: 'c-7' } },
    result: { id: 'c-7', workspaceId: WORKSPACE },
    actorUserId: USER,
  });
  assert.ok(built);
  requestContext.addPendingAuditEntry(built.key, built.entry);

  requestContext.markManualAudit('client', 'c-8');

  const { entries } = requestContext.drainPendingAuditEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.entityId, 'c-7');
});

test('due scritture sulla stessa riga e con lo stesso verbo fanno una registrazione sola', () => {
  requestContext.start();

  for (let index = 0; index < 3; index += 1) {
    const built = buildPendingAuditEntry({
      model: 'Client',
      operation: 'update',
      args: { where: { id: 'c-7' } },
      result: { id: 'c-7', workspaceId: WORKSPACE },
      actorUserId: USER,
    });
    assert.ok(built);
    requestContext.addPendingAuditEntry(built.key, built.entry);
  }

  const { entries } = requestContext.drainPendingAuditEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.affectedCount, 3);
});

test('oltre il tetto per richiesta si conta invece di accumulare', () => {
  requestContext.start();

  for (let index = 0; index < MAX_PENDING_AUDIT_ENTRIES + 5; index += 1) {
    requestContext.addPendingAuditEntry(`client:c-${index}:update`, {
      action: 'client.update',
      entityType: 'client',
      entityId: `c-${index}`,
      workspaceId: WORKSPACE,
      actorUserId: USER,
      operation: 'update',
      affectedCount: 1,
    });
  }

  const { entries, dropped } = requestContext.drainPendingAuditEntries();
  assert.equal(entries.length, MAX_PENDING_AUDIT_ENTRIES);
  assert.equal(dropped, 5);
});

test('svuotare due volte non riscrive le stesse registrazioni', () => {
  requestContext.start();
  requestContext.addPendingAuditEntry('client:c-1:create', {
    action: 'client.create',
    entityType: 'client',
    entityId: 'c-1',
    workspaceId: WORKSPACE,
    actorUserId: USER,
    operation: 'create',
    affectedCount: 1,
  });

  assert.equal(requestContext.drainPendingAuditEntries().entries.length, 1);
  assert.equal(requestContext.drainPendingAuditEntries().entries.length, 0);
});
