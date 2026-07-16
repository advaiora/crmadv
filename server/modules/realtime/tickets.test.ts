import assert from 'node:assert/strict';
import test from 'node:test';
import {
  issueRealtimeTicket,
  consumeRealtimeTicket,
  REALTIME_TICKET_TTL_MS,
  __resetRealtimeTicketsForTest,
} from './tickets.js';

// Biglietto usa-e-getta per il WebSocket. La logica critica e' deterministica
// (monouso + scadenza): si testa qui, passando `now` esplicito.

test('un biglietto valido si consuma una volta e restituisce le claims', () => {
  __resetRealtimeTicketsForTest();
  const now = 1_000_000;
  const ticket = issueRealtimeTicket({ userId: 'u1', workspaceId: 'w1' }, now);
  const claims = consumeRealtimeTicket(ticket, now + 100);
  assert.deepEqual(claims, { userId: 'u1', workspaceId: 'w1' });
});

test('il biglietto e MONOUSO: la seconda consumazione fallisce', () => {
  __resetRealtimeTicketsForTest();
  const now = 1_000_000;
  const ticket = issueRealtimeTicket({ userId: 'u1', workspaceId: 'w1' }, now);
  assert.ok(consumeRealtimeTicket(ticket, now + 100));
  assert.equal(consumeRealtimeTicket(ticket, now + 200), null);
});

test('un biglietto scaduto non e valido (ma viene comunque rimosso)', () => {
  __resetRealtimeTicketsForTest();
  const now = 1_000_000;
  const ticket = issueRealtimeTicket({ userId: 'u1', workspaceId: 'w1' }, now);
  const claims = consumeRealtimeTicket(ticket, now + REALTIME_TICKET_TTL_MS + 1);
  assert.equal(claims, null);
  // Anche riprovando entro la finestra non deve resuscitare: era gia' stato tolto.
  assert.equal(consumeRealtimeTicket(ticket, now + 10), null);
});

test('un biglietto inventato non e valido', () => {
  __resetRealtimeTicketsForTest();
  assert.equal(consumeRealtimeTicket('non-esiste', 1_000_000), null);
});

test('biglietti diversi non collidono tra loro', () => {
  __resetRealtimeTicketsForTest();
  const now = 1_000_000;
  const a = issueRealtimeTicket({ userId: 'ua', workspaceId: 'w1' }, now);
  const b = issueRealtimeTicket({ userId: 'ub', workspaceId: 'w1' }, now);
  assert.notEqual(a, b);
  assert.deepEqual(consumeRealtimeTicket(a, now + 1), { userId: 'ua', workspaceId: 'w1' });
  assert.deepEqual(consumeRealtimeTicket(b, now + 1), { userId: 'ub', workspaceId: 'w1' });
});
