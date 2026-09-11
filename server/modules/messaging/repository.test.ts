import assert from 'node:assert/strict';
import test from 'node:test';
import { markTrashed } from '../../core/soft-delete.js';
import {
  buildConversationMessagesForPeersWhere,
  buildConversationMessagesWhere,
  buildMarkConversationAsReadWhere,
  buildTrashMessageWhere,
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

/**
 * Il gesto che cestina un messaggio (CRMA-165).
 *
 * E' l'unico dei quattro che prima non esisteva affatto: un messaggio interno,
 * una volta inviato, non si poteva togliere in nessun modo. Le tre condizioni
 * del `where` sono quelle che tengono in piedi il controllo di accesso, e
 * nessuna di loro ha un sintomo visibile se salta.
 */
test('cestina solo chi ha scritto il messaggio, non chi lo ha ricevuto', () => {
  const where = buildTrashMessageWhere({
    workspaceId: WORKSPACE_ID,
    messageId: 'msg-1',
    actorUserId: ME,
  });

  // La riga e' UNA e la vedono in due: toglierla la toglie a entrambi. Se il
  // filtro guardasse anche `recipientUserId`, chi riceve potrebbe cancellare
  // le parole di un altro dalla cronologia di quell'altro.
  assert.equal(where.senderUserId, ME);
  assert.equal('recipientUserId' in where, false);
});

test('cestinare un messaggio non esce dal workspace', () => {
  const where = buildTrashMessageWhere({
    workspaceId: WORKSPACE_ID,
    messageId: 'msg-1',
    actorUserId: ME,
  });

  assert.equal(where.workspaceId, WORKSPACE_ID);
  assert.equal(where.id, 'msg-1');
});

test('un messaggio gia cestinato non si ricestina', () => {
  const where = buildTrashMessageWhere({
    workspaceId: WORKSPACE_ID,
    messageId: 'msg-1',
    actorUserId: ME,
  });

  assert.equal(where.deletedAt, null);
});

test('il messaggio cestinato sparisce dalle letture gia filtrate, ma la riga resta', () => {
  // Le due meta' del Cestino messe una accanto all'altra: a sinistra cio' che
  // si scrive (la riga resta, con chi e quando), a destra cio' che le letture
  // gia' filtrate chiedono (niente cestinati). Il messaggio sparisce dalla
  // conversazione e dai non-letti perche' `deletedAt` smette di essere `null`,
  // non perche' qualcuno abbia cancellato qualcosa.
  const scritto = markTrashed(ME, new Date('2026-09-11T10:00:00.000Z'));
  assert.equal(scritto.deletedByUserId, ME);
  assert.notEqual(scritto.deletedAt, null);

  const conversazione = buildConversationMessagesWhere({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserId: PEER,
    limit: 100,
  });
  const nonLetti = buildMarkConversationAsReadWhere({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserId: PEER,
  });

  assert.equal(conversazione.deletedAt, null);
  assert.equal(nonLetti.deletedAt, null);
});

test('deletedByUserId e sempre l attore reale: e meta del controllo di accesso al Cestino', () => {
  // Non e' un'etichetta. La pagina Cestino dei messaggi rilegge con
  // «partecipo alla conversazione E l'ho cestinato io»: un id di servizio o un
  // `null` qui dentro renderebbe la riga di nessuno, cioe' irrecuperabile.
  const scritto = markTrashed(ME);

  assert.equal(scritto.deletedByUserId, ME);
  assert.notEqual(scritto.deletedByUserId, null);
});
