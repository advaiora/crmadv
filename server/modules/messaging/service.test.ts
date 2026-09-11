import assert from 'node:assert/strict';
import test from 'node:test';
import { isHttpError } from '../../core/errors.js';
import { messagingRepository, type WorkspaceMember } from './repository.js';
import { messagingService } from './service.js';

/**
 * Il comportamento dei Messaggi davanti al Cestino (CRMA-133).
 *
 * Qui si prova la REGOLA, non la clausola: un contatto cestinato si legge
 * ancora ma non gli si scrive. Le clausole stanno in `repository.test.ts`.
 */

const WORKSPACE_ID = 'workspace-1';
const ME = 'user-me';
const PEER = 'user-peer';

const contatto = (overrides: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
  userId: PEER,
  name: 'Giulia Bianchi',
  email: 'giulia@esempio.it',
  role: 'MEMBER',
  isTrashed: false,
  ...overrides,
});

const messaggio = (senderUserId: string) => ({
  id: 'msg-1',
  senderUserId,
  recipientUserId: senderUserId === ME ? PEER : ME,
  body: 'Ci sentiamo domani',
  readAt: null,
  createdAt: new Date('2026-09-10T12:00:00.000Z'),
});

test('la conversazione con un contatto cestinato si apre ancora, e la cronologia c e', async (t) => {
  t.mock.method(messagingRepository, 'getWorkspaceMember', async () =>
    contatto({ isTrashed: true }),
  );
  t.mock.method(messagingRepository, 'listConversationMessages', async () => [messaggio(PEER)]);

  const risultato = await messagingService.listConversation({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserId: PEER,
    query: {},
  });

  assert.equal(risultato.items.length, 1, 'i messaggi gia scambiati non si cancellano');
  assert.equal(risultato.peer.isTrashed, true, 'chi legge deve poter dire che e cestinato');
});

test('leggere una conversazione chiede la riga cestinata di proposito', async (t) => {
  const chiamate: unknown[] = [];
  t.mock.method(
    messagingRepository,
    'getWorkspaceMember',
    async (_workspaceId: string, _userId: string, options?: unknown) => {
      chiamate.push(options);
      return contatto({ isTrashed: true });
    },
  );
  t.mock.method(messagingRepository, 'listConversationMessages', async () => []);

  await messagingService.listConversation({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserId: PEER,
    query: {},
  });

  assert.deepEqual(chiamate[0], { includeTrashed: true });
});

test('a un contatto cestinato non si scrive piu', async (t) => {
  t.mock.method(messagingRepository, 'getWorkspaceMember', async () =>
    contatto({ isTrashed: true }),
  );
  const creazione = t.mock.method(messagingRepository, 'createMessage', async () => messaggio(ME));

  await assert.rejects(
    async () =>
      messagingService.sendMessage({
        workspaceId: WORKSPACE_ID,
        userId: ME,
        peerUserId: PEER,
        payload: { body: 'Ci sei?' },
      }),
    (error: unknown) => {
      assert.ok(isHttpError(error), 'deve essere un errore HTTP, non un crash');
      assert.equal((error as { statusCode?: number }).statusCode, 400);
      return true;
    },
  );

  assert.equal(
    creazione.mock.callCount(),
    0,
    'il messaggio non deve nemmeno arrivare al database',
  );
});

test('a un contatto vivo si scrive come sempre', async (t) => {
  // La rete dall altra parte: il filtro nuovo non deve rompere il caso normale.
  t.mock.method(messagingRepository, 'getWorkspaceMember', async () => contatto());
  t.mock.method(messagingRepository, 'createMessage', async () => messaggio(ME));

  const risultato = await messagingService.sendMessage({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserId: PEER,
    payload: { body: 'Ci sei?' },
  });

  assert.equal(risultato.message.body, 'Ci sentiamo domani');
  assert.equal(risultato.peer.isTrashed, false);
});

test('i non-letti di un contatto cestinato si possono ancora chiudere', async (t) => {
  // Altrimenti resterebbero appesi per sempre: la conversazione si apre, ma il
  // pallino non si spegnerebbe mai.
  t.mock.method(messagingRepository, 'getWorkspaceMember', async () =>
    contatto({ isTrashed: true }),
  );
  t.mock.method(messagingRepository, 'markConversationAsRead', async () => ({ count: 3 }));

  const risultato = await messagingService.markConversationAsRead({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    peerUserId: PEER,
  });

  assert.equal(risultato.updatedCount, 3);
});

test('un contatto che non esiste resta un 404, non diventa "cestinato"', async (t) => {
  t.mock.method(messagingRepository, 'getWorkspaceMember', async () => null);

  await assert.rejects(
    async () =>
      messagingService.listConversation({
        workspaceId: WORKSPACE_ID,
        userId: ME,
        peerUserId: 'chi-non-ce',
        query: {},
      }),
    (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 404);
      return true;
    },
  );
});

test('il picker non propone i cestinati: la lista contatti esce dal repository gia filtrata', async (t) => {
  t.mock.method(messagingRepository, 'listWorkspaceMembers', async () => [contatto()]);
  t.mock.method(messagingRepository, 'listConversationMessagesForUserAndPeers', async () => [
    messaggio(PEER),
  ]);

  const risultato = await messagingService.listContacts({
    workspaceId: WORKSPACE_ID,
    userId: ME,
    query: {},
  });

  assert.equal(risultato.items.length, 1);
  assert.equal(risultato.items[0].unreadCount, 1, 'i non-letti dei contatti vivi restano contati');
});
