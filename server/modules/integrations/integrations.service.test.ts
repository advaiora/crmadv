import test from 'node:test';
import assert from 'node:assert/strict';
import { integrationsService } from './integrations.service.js';
import { integrationsRepository } from './integrations.repository.js';
import { integrationsCrypto } from './integrations.crypto.js';
import { brevoConnector, BrevoApiError } from './connectors/brevo.js';
import { clientsRepository } from '../clients/repository.js';
import { audit } from '../../audit/audit.js';

const ENABLED_BREVO = {
  id: 'int1',
  workspaceId: 'w1',
  provider: 'brevo',
  enabled: true,
  configJson: { listId: 9 },
  ciphertext: 'ct',
  iv: 'iv',
  authTag: 'tag',
  keyVersion: 1,
  lastSyncAt: null,
  lastSyncStatus: null,
  lastSyncMessage: null,
  lastSyncStats: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const client = (over: Record<string, unknown>) => ({
  id: 'c',
  workspaceId: 'w1',
  type: 'person',
  name: 'Mario Rossi',
  email: 'mario@rossi.it',
  phone: '+390612345678',
  vatNumber: null,
  taxCode: null,
  street: null,
  city: null,
  zip: null,
  province: null,
  country: null,
  notes: null,
  tags: [] as string[],
  customFields: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...over,
});

test('syncClients: invia solo i clienti con email e conteggia gli esiti', async (t) => {
  t.mock.method(integrationsRepository, 'findByProvider', async () => ENABLED_BREVO);
  t.mock.method(integrationsCrypto, 'decrypt', async () => 'plain-key');
  t.mock.method(clientsRepository, 'listForExport', async () => [
    client({ id: 'c1', name: 'Mario Rossi', email: 'mario@rossi.it' }),
    client({ id: 'c2', name: 'Acme Srl', email: null }), // senza email → saltato
    client({ id: 'c3', name: 'Lucia Bianchi', email: 'lucia@bianchi.it' }),
  ]);
  const outcome: Array<Record<string, unknown>> = [];
  t.mock.method(integrationsRepository, 'recordSyncOutcome', async (input: any) => {
    outcome.push(input);
    return ENABLED_BREVO;
  });
  t.mock.method(audit, 'log', async () => {});
  const sent: string[] = [];
  t.mock.method(brevoConnector, 'upsertContact', async (_key: string, contact: any) => {
    sent.push(contact.email);
  });

  const result = await integrationsService.syncClients({
    workspaceId: 'w1',
    providerInput: 'brevo',
    actorUserId: 'u1',
    request: {} as never,
    now: new Date('2026-07-09'),
  });

  assert.deepEqual(sent, ['mario@rossi.it', 'lucia@bianchi.it']);
  assert.equal(result.status, 'success');
  assert.equal(result.stats.synced, 2);
  assert.equal(result.stats.skippedNoEmail, 1);
  assert.equal(result.stats.failed, 0);
  // Esito registrato sull'integrazione.
  assert.equal(outcome[0].status, 'success');
});

test('syncClients: un contatto in errore non blocca gli altri (esito parziale)', async (t) => {
  t.mock.method(integrationsRepository, 'findByProvider', async () => ENABLED_BREVO);
  t.mock.method(integrationsCrypto, 'decrypt', async () => 'plain-key');
  t.mock.method(clientsRepository, 'listForExport', async () => [
    client({ id: 'c1', email: 'ok@x.it' }),
    client({ id: 'c2', email: 'bad@x.it' }),
  ]);
  t.mock.method(integrationsRepository, 'recordSyncOutcome', async () => ENABLED_BREVO);
  t.mock.method(audit, 'log', async () => {});
  t.mock.method(brevoConnector, 'upsertContact', async (_key: string, contact: any) => {
    if (contact.email === 'bad@x.it') {
      throw new BrevoApiError('Invalid attributes', 400);
    }
  });

  const result = await integrationsService.syncClients({
    workspaceId: 'w1',
    providerInput: 'brevo',
    actorUserId: 'u1',
    request: {} as never,
    now: new Date('2026-07-09'),
  });

  assert.equal(result.status, 'partial');
  assert.equal(result.stats.synced, 1);
  assert.equal(result.stats.failed, 1);
  assert.equal(result.stats.errors[0].email, 'bad@x.it');
  assert.match(result.stats.errors[0].message, /Invalid attributes/);
});

test('syncClients: integrazione non abilitata viene rifiutata', async (t) => {
  t.mock.method(integrationsRepository, 'findByProvider', async () => ({
    ...ENABLED_BREVO,
    enabled: false,
  }));

  await assert.rejects(
    () =>
      integrationsService.syncClients({
        workspaceId: 'w1',
        providerInput: 'brevo',
        actorUserId: 'u1',
        request: {} as never,
        now: new Date('2026-07-09'),
      }),
    /non abilitata/i,
  );
});

test('saveIntegration: non permette di abilitare senza chiave API', async (t) => {
  t.mock.method(integrationsRepository, 'findByProvider', async () => null);

  await assert.rejects(
    () =>
      integrationsService.saveIntegration({
        workspaceId: 'w1',
        providerInput: 'brevo',
        actorUserId: 'u1',
        body: { enabled: true },
        request: {} as never,
      }),
    /chiave api/i,
  );
});

test('saveIntegration: cifra la chiave API e non la ri-espone', async (t) => {
  t.mock.method(integrationsRepository, 'findByProvider', async () => null);
  t.mock.method(integrationsCrypto, 'encrypt', async () => ({
    ciphertext: 'CT',
    iv: 'IV',
    authTag: 'TAG',
    keyVersion: 1,
  }));
  let upserted: any;
  t.mock.method(integrationsRepository, 'upsert', async (input: any) => {
    upserted = input;
    return { ...ENABLED_BREVO, enabled: false };
  });
  t.mock.method(audit, 'log', async () => {});

  const result = await integrationsService.saveIntegration({
    workspaceId: 'w1',
    providerInput: 'brevo',
    actorUserId: 'u1',
    body: { apiKey: 'secret-key', listId: 3 },
    request: {} as never,
  });

  // La chiave arriva cifrata al repository...
  assert.deepEqual(upserted.secret, { ciphertext: 'CT', iv: 'IV', authTag: 'TAG', keyVersion: 1 });
  // ...e non compare nella vista pubblica (solo hasApiKey).
  assert.equal(result.hasApiKey, true);
  assert.equal('apiKey' in result, false);
});

test('provider non valido genera errore', async () => {
  await assert.rejects(
    () => integrationsService.getIntegration('w1', 'mailchimp'),
    /provider/i,
  );
});
