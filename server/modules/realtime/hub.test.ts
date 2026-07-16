import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type RealtimeConnection,
  subscribe,
  unsubscribe,
  removeConnection,
  broadcast,
  broadcastToConversation,
  broadcastToUser,
  userChannel,
  conversationChannel,
  __resetHubForTest,
  __hubChannelCountForTest,
} from './hub.js';

// Connessione finta: raccoglie i messaggi "inviati" e simula lo stato aperto/chiuso,
// cosi' l'hub si testa senza aprire socket veri.
const makeConnection = (id: string, userId = 'u', open = true): RealtimeConnection & { sent: string[]; open: boolean } => {
  const conn = {
    id,
    userId,
    workspaceId: 'w1',
    channels: new Set<string>(),
    sent: [] as string[],
    open,
    send(data: string) {
      this.sent.push(data);
    },
    isOpen() {
      return this.open;
    },
  };
  return conn;
};

test('broadcast raggiunge tutti gli iscritti aperti del canale', () => {
  __resetHubForTest();
  const a = makeConnection('a');
  const b = makeConnection('b');
  subscribe(a, 'canale');
  subscribe(b, 'canale');
  const delivered = broadcast('canale', { type: 'ping' });
  assert.equal(delivered, 2);
  assert.deepEqual(JSON.parse(a.sent[0]), { type: 'ping' });
  assert.deepEqual(JSON.parse(b.sent[0]), { type: 'ping' });
});

test('un socket chiuso non riceve e non conta', () => {
  __resetHubForTest();
  const a = makeConnection('a', 'u', true);
  const b = makeConnection('b', 'u', false);
  subscribe(a, 'canale');
  subscribe(b, 'canale');
  const delivered = broadcast('canale', { type: 'ping' });
  assert.equal(delivered, 1);
  assert.equal(b.sent.length, 0);
});

test('excludeConnectionId salta il mittente', () => {
  __resetHubForTest();
  const a = makeConnection('a');
  const b = makeConnection('b');
  subscribe(a, 'canale');
  subscribe(b, 'canale');
  const delivered = broadcast('canale', { type: 'ping' }, { excludeConnectionId: 'a' });
  assert.equal(delivered, 1);
  assert.equal(a.sent.length, 0);
  assert.equal(b.sent.length, 1);
});

test('unsubscribe toglie dal canale e pulisce i canali vuoti', () => {
  __resetHubForTest();
  const a = makeConnection('a');
  subscribe(a, 'canale');
  assert.equal(__hubChannelCountForTest(), 1);
  unsubscribe(a, 'canale');
  assert.equal(__hubChannelCountForTest(), 0);
  assert.equal(broadcast('canale', { type: 'ping' }), 0);
});

test('removeConnection stacca il socket da tutti i suoi canali', () => {
  __resetHubForTest();
  const a = makeConnection('a');
  subscribe(a, 'uno');
  subscribe(a, 'due');
  removeConnection(a);
  assert.equal(__hubChannelCountForTest(), 0);
  assert.equal(a.channels.size, 0);
});

test('helper broadcastToUser e broadcastToConversation usano i canali giusti', () => {
  __resetHubForTest();
  const perUtente = makeConnection('a');
  const perConversazione = makeConnection('b');
  subscribe(perUtente, userChannel('u1'));
  subscribe(perConversazione, conversationChannel('c1'));
  assert.equal(broadcastToUser('u1', { type: 'message.new' }), 1);
  assert.equal(broadcastToConversation('c1', { type: 'chat.changed' }), 1);
  assert.deepEqual(JSON.parse(perUtente.sent[0]), { type: 'message.new' });
  assert.deepEqual(JSON.parse(perConversazione.sent[0]), { type: 'chat.changed' });
});
