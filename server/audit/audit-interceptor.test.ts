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
import { normalizeEntityType } from './entity-type.js';
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

test('una scrittura in blocco che non ha toccato NESSUNA riga non si registra', () => {
  // Il difetto che questa prova chiude: senza il controllo, il polling dei
  // Messaggi su una conversazione gia' letta faceva comparire nel registro un
  // `workspace_message.update` indistinguibile da un aggiornamento vero, ogni
  // volta. Il registro dichiarava un cambiamento che non era avvenuto.
  requestContext.start();
  requestContext.setWorkspaceId(WORKSPACE);

  for (const operation of ['updateMany', 'deleteMany', 'createMany']) {
    assert.equal(
      buildPendingAuditEntry({
        model: 'WorkspaceMessage',
        operation,
        args: { where: { workspaceId: WORKSPACE } },
        result: { count: 0 },
        actorUserId: USER,
      }),
      null,
      `${operation} a zero righe non deve produrre una registrazione`,
    );
  }
});

test('una scrittura in blocco che ha toccato una riga sola si registra', () => {
  // Il confine dell'esclusione qui sopra: si scarta lo zero, non l'uno.
  requestContext.start();
  requestContext.setWorkspaceId(WORKSPACE);

  const built = buildPendingAuditEntry({
    model: 'WorkspaceMessage',
    operation: 'updateMany',
    args: { where: { workspaceId: WORKSPACE } },
    result: { count: 1 },
    actorUserId: USER,
  });

  assert.equal(built?.entry.action, 'workspace_message.update');
  assert.equal(built?.entry.affectedCount, 1);
});

test('le varianti *AndReturn contano le righe restituite, e a elenco vuoto non registrano', () => {
  requestContext.start();
  requestContext.setWorkspaceId(WORKSPACE);

  const due = buildPendingAuditEntry({
    model: 'Client',
    operation: 'createManyAndReturn',
    args: { data: [{ workspaceId: WORKSPACE }, { workspaceId: WORKSPACE }] },
    result: [{ id: 'c-1' }, { id: 'c-2' }],
    actorUserId: USER,
  });
  assert.equal(due?.entry.affectedCount, 2);

  const nessuna = buildPendingAuditEntry({
    model: 'Client',
    operation: 'updateManyAndReturn',
    args: { where: { workspaceId: WORKSPACE } },
    result: [],
    actorUserId: USER,
  });
  assert.equal(nessuna, null);
});

test('un risultato di forma inattesa non fa perdere la scrittura', () => {
  // Ripiego voluto: meglio una riga con conteggio impreciso che una scrittura
  // che sparisce dal registro perche' il risultato non aveva la forma prevista.
  requestContext.start();
  requestContext.setWorkspaceId(WORKSPACE);

  const built = buildPendingAuditEntry({
    model: 'Client',
    operation: 'updateMany',
    args: { where: { workspaceId: WORKSPACE } },
    result: undefined,
    actorUserId: USER,
  });

  assert.equal(built?.entry.affectedCount, 1);
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

// I casi qui sotto coprono il difetto trovato in revisione: l'annotazione a
// mano e la registrazione automatica nominavano lo stesso bersaglio in due
// convenzioni diverse, quindi lo scarto dei doppioni non agganciava mai.
// Sono scritti apposta con i due lati in forme DIVERSE: una prova con i due
// tipi gia' identici passerebbe anche col difetto dentro.
test("l'annotazione a mano in PascalCase scarta la registrazione automatica in forma snake", () => {
  // Caso reale: clientsService.createClient scrive sul modello `Client` e poi
  // annota a mano con entityType: 'Client'. Prima della normalizzazione il
  // registro riceveva DUE righe per ogni cliente creato.
  requestContext.start();

  const built = buildPendingAuditEntry({
    model: 'Client',
    operation: 'create',
    args: { data: { workspaceId: WORKSPACE } },
    result: { id: 'c-9', workspaceId: WORKSPACE },
    actorUserId: USER,
  });
  assert.ok(built);
  requestContext.addPendingAuditEntry(built.key, built.entry);

  requestContext.markManualAudit('Client', 'c-9');

  const { entries } = requestContext.drainPendingAuditEntries();
  assert.deepEqual(entries, []);
});

test('lo scarto in PascalCase vale per tutti i modelli censiti, non solo per Client', () => {
  // I dieci valori scritti a mano trovati in revisione, con il modello Prisma
  // su cui l'intercettore produce la riga automatica corrispondente.
  const casi: Array<[manuale: string, modello: string]> = [
    ['Client', 'Client'],
    ['Project', 'Project'],
    ['ChecklistInstanceItem', 'ChecklistInstanceItem'],
    ['ChecklistTemplate', 'ChecklistTemplate'],
    ['ChecklistTemplateItem', 'ChecklistTemplateItem'],
    ['PipelineStage', 'PipelineStage'],
    ['ProjectCategory', 'ProjectCategory'],
    ['ProjectSource', 'ProjectSource'],
    ['Integration', 'Integration'],
    ['VaultItem', 'VaultItem'],
  ];

  for (const [manuale, modello] of casi) {
    requestContext.start();

    const built = buildPendingAuditEntry({
      model: modello,
      operation: 'update',
      args: { where: { id: 'x-1' } },
      result: { id: 'x-1', workspaceId: WORKSPACE },
      actorUserId: USER,
    });
    assert.ok(built, `nessuna registrazione automatica per ${modello}`);
    requestContext.addPendingAuditEntry(built.key, built.entry);

    requestContext.markManualAudit(manuale, 'x-1');

    const { entries } = requestContext.drainPendingAuditEntries();
    assert.deepEqual(entries, [], `doppione rimasto su ${manuale}/${modello}`);
  }
});

test('il segno per TUTTO il tipo funziona anche se scritto in PascalCase', () => {
  requestContext.start();

  const built = buildPendingAuditEntry({
    model: 'DepartmentMember',
    operation: 'updateMany',
    args: { where: { workspaceId: WORKSPACE } },
    result: { count: 4 },
    actorUserId: USER,
  });
  assert.ok(built);
  requestContext.addPendingAuditEntry(built.key, built.entry);

  // Senza entityId: copre le righe che questa richiesta ha scritto sul tipo.
  requestContext.markManualAudit('DepartmentMember', undefined);

  const { entries } = requestContext.drainPendingAuditEntries();
  assert.deepEqual(entries, []);
});

test('normalizzare non allarga lo scarto: due modelli diversi restano diversi', () => {
  // Il controllo negativo che tiene onesta la correzione. Se la normalizzazione
  // schiacciasse troppo, un'annotazione su un bersaglio scarterebbe quella di un
  // altro: qui la registrazione automatica deve sopravvivere.
  requestContext.start();

  const built = buildPendingAuditEntry({
    model: 'Project',
    operation: 'update',
    args: { where: { id: 'p-1' } },
    result: { id: 'p-1', workspaceId: WORKSPACE },
    actorUserId: USER,
  });
  assert.ok(built);
  requestContext.addPendingAuditEntry(built.key, built.entry);

  requestContext.markManualAudit('ProjectCategory', 'p-1');

  const { entries } = requestContext.drainPendingAuditEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.entityType, 'project');
});

test('normalizeEntityType e idempotente: le annotazioni gia in forma snake non cambiano', () => {
  // Le 49 annotazioni che erano gia' giuste devono restare identiche a se
  // stesse, altrimenti la correzione ne romperebbe una meta' per aggiustare
  // l'altra.
  for (const gia of ['client', 'quote_template', 'user_role', 'web_asset', 'workspace']) {
    assert.equal(normalizeEntityType(gia), gia);
  }

  // E le tre eccezioni sui tipi di sito valgono da entrambi i lati.
  assert.equal(normalizeEntityType('WebsiteAsset'), 'web_asset');
  assert.equal(normalizeEntityType('web_asset'), 'web_asset');
});


test('tre scritture sulla stessa riga fanno una registrazione sola, e di UNA riga', () => {
  // Il conteggio dice quante RIGHE sono cambiate, non quante volte le si e'
  // scritte: qui la riga e' una, aggiornata tre volte nella stessa richiesta.
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
  assert.equal(entries[0]?.affectedCount, 1);
});

test('due scritture in blocco sulla stessa chiave sommano le righe toccate', () => {
  // Il caso opposto al precedente: due `updateMany` toccano insiemi di righe che
  // si aggiungono davvero, quindi li' sommare e' giusto.
  requestContext.start();
  requestContext.setWorkspaceId(WORKSPACE);

  for (const count of [3, 4]) {
    const built = buildPendingAuditEntry({
      model: 'Client',
      operation: 'updateMany',
      args: { where: { workspaceId: WORKSPACE } },
      result: { count },
      actorUserId: USER,
    });
    assert.ok(built);
    requestContext.addPendingAuditEntry(built.key, built.entry);
  }

  const { entries } = requestContext.drainPendingAuditEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.affectedCount, 7);
});

test("un'annotazione a mano senza id scarta le automatiche di tutto il suo tipo", () => {
  // Serve alle annotazioni che riassumono piu' righe insieme e non possono
  // nominarle una per una — «ha assegnato i membri del reparto» copre le righe
  // di DepartmentMember che quella richiesta ha scritto.
  requestContext.start();

  for (const id of ['dm-1', 'dm-2']) {
    const built = buildPendingAuditEntry({
      model: 'DepartmentMember',
      operation: 'create',
      args: { data: { workspaceId: WORKSPACE } },
      result: { id, workspaceId: WORKSPACE },
      actorUserId: USER,
    });
    assert.ok(built);
    requestContext.addPendingAuditEntry(built.key, built.entry);
  }

  requestContext.markManualAudit('department_member', undefined);

  const { entries } = requestContext.drainPendingAuditEntries();
  assert.deepEqual(entries, []);
});

test("lo scarto per tipo non tracima su un tipo diverso", () => {
  requestContext.start();

  const built = buildPendingAuditEntry({
    model: 'Department',
    operation: 'update',
    args: { where: { id: 'd-1' } },
    result: { id: 'd-1', workspaceId: WORKSPACE },
    actorUserId: USER,
  });
  assert.ok(built);
  requestContext.addPendingAuditEntry(built.key, built.entry);

  requestContext.markManualAudit('department_member', undefined);

  const { entries } = requestContext.drainPendingAuditEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.entityType, 'department');
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
      bulk: false,
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
    bulk: false,
  });

  assert.equal(requestContext.drainPendingAuditEntries().entries.length, 1);
  assert.equal(requestContext.drainPendingAuditEntries().entries.length, 0);
});
