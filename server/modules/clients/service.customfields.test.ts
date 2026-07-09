import test from 'node:test';
import assert from 'node:assert/strict';
import { clientsService } from './service.js';
import { clientsRepository } from './repository.js';
import { customFieldsService } from '../custom-fields/custom-fields.service.js';
import { audit } from '../../audit/audit.js';
import { parseCsvRows } from './csv.js';

// Definizioni di campi personalizzati usate dai test (una per tipo rilevante).
const DEFINITIONS = [
  { key: 'budget', label: 'Budget', type: 'number', options: [], required: false },
  { key: 'vip', label: 'VIP', type: 'boolean', options: [], required: false },
  {
    key: 'piano',
    label: 'Piano',
    type: 'select',
    options: [{ value: 'base', label: 'Base' }, { value: 'pro', label: 'Pro' }],
    required: false,
  },
] as const;

const makeClient = (over: Record<string, unknown>) => ({
  id: 'c1',
  workspaceId: 'w1',
  type: 'company',
  name: 'Acme',
  email: null,
  phone: null,
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

test('export CSV: aggiunge una colonna cf:<chiave> per ogni campo personalizzato attivo', async (t) => {
  t.mock.method(customFieldsService, 'listActiveDefinitions', async () => DEFINITIONS);
  t.mock.method(clientsRepository, 'listForExport', async () => [
    makeClient({ name: 'Acme', customFields: { budget: 1000, vip: true, piano: 'pro' } }),
    makeClient({ id: 'c2', name: 'Beta', customFields: { budget: 50 } }),
  ]);

  const result = await clientsService.exportClientsCsv('w1', {});
  const rows = parseCsvRows(result.csv, ',');

  // Intestazione: le tre colonne custom in coda a quelle standard.
  assert.deepEqual(rows[0].slice(-3), ['cf:budget', 'cf:vip', 'cf:piano']);
  // Prima riga dati: valori serializzati (boolean come "true").
  assert.deepEqual(rows[1].slice(-3), ['1000', 'true', 'pro']);
  // Seconda riga: campi mancanti come stringa vuota.
  assert.deepEqual(rows[2].slice(-3), ['50', '', '']);
});

test('import CSV: valori delle colonne cf:<chiave> salvati e validati per tipo', async (t) => {
  t.mock.method(customFieldsService, 'listActiveDefinitions', async () => DEFINITIONS);
  t.mock.method(audit, 'log', async () => {});
  const created: Array<{ name: string; customFields: unknown }> = [];
  t.mock.method(clientsRepository, 'create', async (_workspaceId: string, payload: any) => {
    created.push({ name: payload.name, customFields: payload.customFields });
    return makeClient({ name: payload.name, customFields: payload.customFields });
  });

  const csv = [
    'name,cf:budget,cf:vip,cf:piano',
    'Acme,1000,true,pro',
    'Beta,,false,base',
  ].join('\n');

  const result = await clientsService.importClientsFromCsv({
    workspaceId: 'w1',
    actorUserId: 'u1',
    body: { csv },
    request: {} as never,
  });

  assert.equal(result.summary.createdRows, 2);
  assert.equal(result.summary.failedRows, 0);
  // Numero convertito, boolean convertito, chiave vuota omessa.
  assert.deepEqual(created[0], { name: 'Acme', customFields: { budget: 1000, vip: true, piano: 'pro' } });
  assert.deepEqual(created[1], { name: 'Beta', customFields: { vip: false, piano: 'base' } });
});

test('import CSV: opzione select non valida fa fallire solo quella riga', async (t) => {
  t.mock.method(customFieldsService, 'listActiveDefinitions', async () => DEFINITIONS);
  t.mock.method(audit, 'log', async () => {});
  const created: string[] = [];
  t.mock.method(clientsRepository, 'create', async (_workspaceId: string, payload: any) => {
    created.push(payload.name);
    return makeClient({ name: payload.name });
  });

  const csv = ['name,cf:piano', 'Acme,pro', 'Beta,inesistente'].join('\n');

  const result = await clientsService.importClientsFromCsv({
    workspaceId: 'w1',
    actorUserId: 'u1',
    body: { csv },
    request: {} as never,
  });

  assert.equal(result.summary.createdRows, 1);
  assert.equal(result.summary.failedRows, 1);
  assert.deepEqual(created, ['Acme']);
  assert.equal(result.summary.errors[0]?.row, 3);
});

test('import CSV: chiavi cf: sconosciute (campo rimosso) vengono ignorate senza errore', async (t) => {
  t.mock.method(customFieldsService, 'listActiveDefinitions', async () => DEFINITIONS);
  t.mock.method(audit, 'log', async () => {});
  const created: Array<Record<string, unknown>> = [];
  t.mock.method(clientsRepository, 'create', async (_workspaceId: string, payload: any) => {
    created.push(payload.customFields);
    return makeClient({ name: payload.name });
  });

  const csv = ['name,cf:sconosciuto', 'Acme,qualcosa'].join('\n');

  const result = await clientsService.importClientsFromCsv({
    workspaceId: 'w1',
    actorUserId: 'u1',
    body: { csv },
    request: {} as never,
  });

  assert.equal(result.summary.createdRows, 1);
  assert.deepEqual(created[0], {});
});
