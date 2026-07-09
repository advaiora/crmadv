import test from 'node:test';
import assert from 'node:assert/strict';
import { brevoConnector, BrevoApiError } from './brevo.js';

// Sostituisce la fetch globale con una risposta finta per il singolo test.
const stubFetch = (
  t: import('node:test').TestContext,
  handler: (url: string, init: RequestInit) => { status: number; body?: unknown },
) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const { status, body } = handler(url, init);
    return {
      status,
      json: async () => body ?? null,
    } as Response;
  });
  return calls;
};

test('testConnection: chiave valida ritorna ok con i dati account', async (t) => {
  stubFetch(t, () => ({ status: 200, body: { email: 'me@studio.it', companyName: 'Studio' } }));
  const result = await brevoConnector.testConnection('valid-key');
  assert.deepEqual(result, { ok: true, account: { email: 'me@studio.it', companyName: 'Studio' } });
});

test('testConnection: 401 ritorna ok=false con messaggio chiaro', async (t) => {
  stubFetch(t, () => ({ status: 401, body: { message: 'Key not found' } }));
  const result = await brevoConnector.testConnection('bad-key');
  assert.equal(result.ok, false);
  assert.match((result as { message: string }).message, /non valida/i);
});

test('upsertContact: invia email, attributi e listIds; 201 = successo', async (t) => {
  const calls = stubFetch(t, () => ({ status: 201, body: { id: 42 } }));
  await brevoConnector.upsertContact('key', {
    email: 'mario@rossi.it',
    firstName: 'Mario',
    lastName: 'Rossi',
    phone: '+390612345678',
    listIds: [7],
  });

  assert.equal(calls.length, 1);
  const sent = JSON.parse(calls[0].init.body as string);
  assert.equal(sent.email, 'mario@rossi.it');
  assert.equal(sent.updateEnabled, true);
  assert.deepEqual(sent.attributes, { FIRSTNAME: 'Mario', LASTNAME: 'Rossi', SMS: '+390612345678' });
  assert.deepEqual(sent.listIds, [7]);
  assert.equal((calls[0].init.headers as Record<string, string>)['api-key'], 'key');
});

test('upsertContact: 204 (aggiornato) = successo', async (t) => {
  stubFetch(t, () => ({ status: 204 }));
  await brevoConnector.upsertContact('key', { email: 'x@y.it' });
  // Nessuna eccezione => ok.
});

test('upsertContact: 400 lancia BrevoApiError col messaggio del server', async (t) => {
  stubFetch(t, () => ({ status: 400, body: { message: 'Invalid attributes' } }));
  await assert.rejects(
    () => brevoConnector.upsertContact('key', { email: 'x@y.it' }),
    (error: unknown) =>
      error instanceof BrevoApiError &&
      error.status === 400 &&
      /Invalid attributes/.test(error.message),
  );
});
