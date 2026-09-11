import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConversationMessagesForPeersWhere,
  buildConversationMessagesWhere,
  buildMarkConversationAsReadWhere,
  buildWorkspaceMemberWhere,
  buildWorkspaceMembersWhere,
} from './repository.js';

/**
 * Le clausole `where` dei Messaggi, provate senza database (CRMA-133).
 *
 * Si provano le funzioni invece delle query perche' `server/prisma.ts` esporta
 * un Proxy che spara un errore se il client non e' inizializzato: montare un
 * database per verificare un filtro sarebbe sproporzionato, e il filtro e'
 * esattamente la cosa che puo' sfuggire. Vedi la nota #76 per il runner:
 * `server/` gira con `node --test`, non con Vitest.
 */

const WORKSPACE_ID = 'workspace-1';
const ME = 'user-me';
const PEER = 'user-peer';

test('il picker "nuova conversazione" non propone un contatto cestinato', () => {
  const where = buildWorkspaceMembersWhere({
    workspaceId: WORKSPACE_ID,
    excludeUserId: ME,
    limit: 50,
  });

  assert.equal(
    where.deletedAt,
    null,
    'senza questo filtro un contatto nel cestino resta selezionabile',
  );
});

test('lo stato ACTIVE da solo non basta: cestinare non cambia lo stato della membership', () => {
  // E' il punto preciso in cui il filtro sarebbe sfuggito. La riga di un
  // contatto cestinato resta `ACTIVE`: si nasconde solo per la `deletedAt`.
  const where = buildWorkspaceMembersWhere({ workspaceId: WORKSPACE_ID, limit: 50 });

  assert.equal(where.status, 'ACTIVE');
  assert.equal(where.deletedAt, null);
});

test('il filtro del cestino non mangia la ricerca per nome ne il resto del where', () => {
  const where = buildWorkspaceMembersWhere({
    workspaceId: WORKSPACE_ID,
    excludeUserId: ME,
    query: 'rossi',
    limit: 50,
  });

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.deepEqual(where.userId, { not: ME });
  assert.equal(where.deletedAt, null);
  assert.equal(where.OR?.length, 2, 'la ricerca guarda nome ed email');
});

test('la conversazione gia scambiata con un cestinato resta leggibile', () => {
  // Il cuore del compito: il picker esclude, la cronologia no. La lettura di UN
  // contatto preciso lo trova anche se e' nel cestino, quando chi chiama lo
  // dichiara.
  const perLeggere = buildWorkspaceMemberWhere(WORKSPACE_ID, PEER, { includeTrashed: true });

  assert.ok(
    !('deletedAt' in perLeggere),
    'chiedendo includeTrashed la riga cestinata deve poter tornare',
  );
  assert.equal(perLeggere.userId, PEER);
});

test('senza includeTrashed lo stesso contatto non si trova', () => {
  const predefinito = buildWorkspaceMemberWhere(WORKSPACE_ID, PEER);

  assert.equal(
    (predefinito as { deletedAt?: null }).deletedAt,
    null,
    'il caso predefinito e il piu sicuro: escludere',
  );
});

test('i messaggi cestinati uno per uno non si rileggono', () => {
  const where = buildConversationMessagesWhere({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserId: PEER,
    limit: 100,
  });

  assert.equal(where.deletedAt, null);
  assert.equal(where.OR?.length, 2, 'la conversazione e nei due versi');
});

test('la paginazione "prima di" convive col filtro del cestino', () => {
  const before = new Date('2026-09-10T12:00:00.000Z');
  const where = buildConversationMessagesWhere({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserId: PEER,
    limit: 100,
    before,
  });

  assert.deepEqual(where.createdAt, { lt: before });
  assert.equal(where.deletedAt, null);
});

test('anteprima e non-letti non contano i messaggi cestinati', () => {
  // Questa e la query da cui esce il pallino della campanella in TopNav.jsx:
  // il conteggio dei non-letti non ha una query sua.
  const where = buildConversationMessagesForPeersWhere({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserIds: [PEER],
    limit: 1500,
  });

  assert.equal(where.deletedAt, null);
});

test('"segna come letti" non timbra righe cestinate', () => {
  const where = buildMarkConversationAsReadWhere({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserId: PEER,
  });

  assert.equal(where.deletedAt, null);
  assert.equal(where.readAt, null, 'tocca solo quelli ancora da leggere');
  assert.equal(where.recipientUserId, ME);
});

test('ogni lettura dei Messaggi porta il filtro, nessuna esclusa', () => {
  // La rete vera: se domani qualcuno aggiunge una lettura e si dimentica il
  // filtro, e' qui che se ne accorge, non in produzione.
  const letture = [
    buildWorkspaceMembersWhere({ workspaceId: WORKSPACE_ID, limit: 50 }),
    buildWorkspaceMemberWhere(WORKSPACE_ID, PEER),
    buildConversationMessagesWhere({
      workspaceId: WORKSPACE_ID,
      userId: ME,
      peerUserId: PEER,
      limit: 100,
    }),
    buildConversationMessagesForPeersWhere({
      workspaceId: WORKSPACE_ID,
      userId: ME,
      peerUserIds: [PEER],
      limit: 1500,
    }),
    buildMarkConversationAsReadWhere({
      workspaceId: WORKSPACE_ID,
      userId: ME,
      peerUserId: PEER,
    }),
  ];

  for (const [indice, where] of letture.entries()) {
    assert.equal(
      (where as { deletedAt?: unknown }).deletedAt,
      null,
      `la lettura numero ${indice + 1} non filtra i cestinati`,
    );
  }
});

test('ogni lettura resta chiusa nel suo workspace', () => {
  // La seconda regola non negoziabile del backend, provata insieme alla prima:
  // un filtro nuovo non deve far perdere per strada lo scoping per azienda.
  const letture = [
    buildWorkspaceMembersWhere({ workspaceId: WORKSPACE_ID, limit: 50 }),
    buildWorkspaceMemberWhere(WORKSPACE_ID, PEER),
    buildConversationMessagesWhere({
      workspaceId: WORKSPACE_ID,
      userId: ME,
      peerUserId: PEER,
      limit: 100,
    }),
    buildConversationMessagesForPeersWhere({
      workspaceId: WORKSPACE_ID,
      userId: ME,
      peerUserIds: [PEER],
      limit: 1500,
    }),
    buildMarkConversationAsReadWhere({
      workspaceId: WORKSPACE_ID,
      userId: ME,
      peerUserId: PEER,
    }),
  ];

  for (const where of letture) {
    assert.equal((where as { workspaceId?: string }).workspaceId, WORKSPACE_ID);
  }
});
