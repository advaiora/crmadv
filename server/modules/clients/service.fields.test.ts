import test from 'node:test';
import assert from 'node:assert/strict';
import { clientsService } from './service.js';
import { clientsRepository } from './repository.js';
import { customFieldsService } from '../custom-fields/custom-fields.service.js';
import { audit } from '../../audit/audit.js';
import { parseCsvRows } from './csv.js';

/**
 * I quattro campi arrivati con CRMA-24 — PEC, codice destinatario SDI, sito web
 * e referente — visti dal servizio: si scrivono, si rileggono, si modificano, e
 * fanno il giro dell'import e dell'export.
 *
 * Il database non serve: il repository e' finto, come in `service.import.test.ts`.
 */

const CLIENTE = {
  id: 'c1',
  workspaceId: 'w1',
  type: 'company' as const,
  name: 'Studio Rossi S.r.l.',
  email: 'info@studiorossi.it',
  phone: null,
  vatNumber: '12345678901',
  taxCode: null,
  pecEmail: 'studiorossi@pec.it',
  sdiCode: 'M5UXCR1',
  website: 'https://www.studiorossi.it',
  contactPerson: 'Maria Rossi',
  street: null,
  city: null,
  zip: null,
  province: null,
  country: null,
  notes: null,
  tags: [] as string[],
  customFields: {},
  createdAt: new Date('2026-09-09T09:00:00.000Z'),
  updatedAt: new Date('2026-09-09T09:00:00.000Z'),
};

// Il corpo che il form manda davvero: TUTTE le chiavi, anche quelle lasciate
// vuote (`buildClientPayload` in `src/modules/clients/ui/clientFormValues.js`).
const CORPO_DEL_FORM = {
  type: 'person',
  name: 'Mario Bianchi',
  email: null,
  phone: null,
  pecEmail: null,
  website: null,
  contactPerson: null,
  vatNumber: null,
  taxCode: null,
  sdiCode: null,
  notes: null,
  tags: [],
  address: { street: null, city: null, zip: null, province: null, country: null },
  customFields: {},
};

test('il corpo che manda il form non e\' piu\' respinto come sconosciuto', () => {
  // La regressione da cui nasce questo compito: finche' i quattro nomi non
  // erano fra i campi ammessi, NESSUN cliente si salvava — nemmeno quelli che
  // li lasciavano vuoti, perche' il form manda le chiavi comunque.
  const payload = clientsService.parseCreatePayload(CORPO_DEL_FORM);

  assert.equal(payload.name, 'Mario Bianchi');
  assert.equal(payload.pecEmail, null);
  assert.equal(payload.sdiCode, null);
  assert.equal(payload.website, null);
  assert.equal(payload.contactPerson, null);
});

test('creazione: i quattro campi si normalizzano (PEC minuscola, SDI maiuscolo)', () => {
  const payload = clientsService.parseCreatePayload({
    name: 'Studio Rossi S.r.l.',
    pecEmail: '  StudioRossi@PEC.it ',
    sdiCode: ' m5uxcr1 ',
    website: ' https://www.studiorossi.it ',
    contactPerson: '  Maria Rossi ',
  });

  assert.equal(payload.pecEmail, 'studiorossi@pec.it');
  assert.equal(payload.sdiCode, 'M5UXCR1');
  assert.equal(payload.website, 'https://www.studiorossi.it');
  assert.equal(payload.contactPerson, 'Maria Rossi');
});

test('creazione: un codice SDI di forma sbagliata viene respinto', () => {
  assert.throws(() => clientsService.parseCreatePayload({ name: 'Acme', sdiCode: 'M5U' }), {
    statusCode: 400,
  });
});

test('creazione: una PEC di forma sbagliata viene respinta, e il messaggio dice quale campo', () => {
  assert.throws(() => clientsService.parseCreatePayload({ name: 'Acme', pecEmail: 'pec-sbagliata' }), {
    message: 'pecEmail must be a valid email',
  });
});

test('modifica: la patch accetta i quattro campi, e uno solo basta', () => {
  const patch = clientsService.parsePatchPayload({ sdiCode: 'uf1234' });

  assert.deepEqual(patch, { sdiCode: 'UF1234' });
});

test('modifica: si possono azzerare passando null', () => {
  const patch = clientsService.parsePatchPayload({
    pecEmail: null,
    sdiCode: null,
    website: null,
    contactPerson: null,
  });

  assert.deepEqual(patch, {
    pecEmail: null,
    sdiCode: null,
    website: null,
    contactPerson: null,
  });
});

test('lettura: il dettaglio restituisce i quattro campi', async (t) => {
  t.mock.method(clientsRepository, 'findById', async () => CLIENTE);
  t.mock.method(clientsRepository, 'listProjectsByClient', async () => []);

  const dto = (await clientsService.getClient('w1', 'c1')) as Record<string, unknown>;

  // Senza questi quattro, riaprendo in modifica un cliente che in banca dati li
  // HA, il form li leggerebbe vuoti e il salvataggio successivo li azzererebbe.
  assert.equal(dto.pecEmail, 'studiorossi@pec.it');
  assert.equal(dto.sdiCode, 'M5UXCR1');
  assert.equal(dto.website, 'https://www.studiorossi.it');
  assert.equal(dto.contactPerson, 'Maria Rossi');
});

test('lettura: ogni colonna letta dal repository esce anche dall\'API', async (t) => {
  t.mock.method(clientsRepository, 'findById', async () => CLIENTE);
  t.mock.method(clientsRepository, 'listProjectsByClient', async () => []);

  const dto = (await clientsService.getClient('w1', 'c1')) as Record<string, unknown>;

  // Le colonne dell'indirizzo escono annidate sotto `address`, le altre a
  // livello. Un campo aggiunto al modello e dimenticato qui si salverebbe e non
  // si rileggerebbe: stesso guasto del `select` incompleto, un piano piu' su.
  const ANNIDATE = new Set(['street', 'city', 'zip', 'province', 'country']);
  const indirizzo = dto.address as Record<string, unknown>;

  for (const colonna of Object.keys(CLIENTE)) {
    if (ANNIDATE.has(colonna)) {
      assert.ok(colonna in indirizzo, `la colonna "${colonna}" non esce sotto address`);
      continue;
    }
    assert.ok(colonna in dto, `la colonna "${colonna}" non esce dall'API`);
  }
});

test('modifica: il registro attivita\' nomina i quattro campi cambiati', async (t) => {
  const eventi: Array<Record<string, unknown>> = [];
  t.mock.method(clientsRepository, 'findById', async () => ({
    ...CLIENTE,
    pecEmail: null,
    sdiCode: null,
    website: null,
    contactPerson: null,
  }));
  t.mock.method(clientsRepository, 'update', async () => CLIENTE);
  t.mock.method(audit, 'log', async (input: Record<string, unknown>) => {
    eventi.push(input);
  });

  await clientsService.updateClient({
    workspaceId: 'w1',
    clientId: 'c1',
    actorUserId: 'u1',
    request: {} as never,
    body: {
      pecEmail: 'studiorossi@pec.it',
      sdiCode: 'M5UXCR1',
      website: 'https://www.studiorossi.it',
      contactPerson: 'Maria Rossi',
    },
  });

  const metadata = eventi[0]?.metadata as { fieldsUpdated: string[] };
  assert.deepEqual(metadata.fieldsUpdated, [
    'contactPerson',
    'pecEmail',
    'sdiCode',
    'website',
  ]);
});

test('import: le intestazioni italiane portano dentro i quattro campi', async (t) => {
  const creati: Array<Record<string, unknown>> = [];
  t.mock.method(customFieldsService, 'listActiveDefinitions', async () => []);
  t.mock.method(audit, 'log', async () => {});
  t.mock.method(clientsRepository, 'create', async (_ws: string, input: Record<string, unknown>) => {
    creati.push(input);
    return { ...CLIENTE, ...input };
  });

  const csv = [
    'name,pec,codice destinatario,sito web,referente',
    'Studio Rossi S.r.l.,studiorossi@pec.it,m5uxcr1,advaiora.com,Maria Rossi',
  ].join('\n');

  const result = await clientsService.importClientsFromCsv({
    workspaceId: 'w1',
    actorUserId: 'u1',
    request: {} as never,
    body: { csv },
  });

  assert.equal(result.summary.createdRows, 1);
  assert.equal(creati[0].pecEmail, 'studiorossi@pec.it');
  assert.equal(creati[0].sdiCode, 'M5UXCR1');
  assert.equal(creati[0].website, 'advaiora.com');
  assert.equal(creati[0].contactPerson, 'Maria Rossi');
});

test('import: valgono anche le intestazioni inglesi', async (t) => {
  const creati: Array<Record<string, unknown>> = [];
  t.mock.method(customFieldsService, 'listActiveDefinitions', async () => []);
  t.mock.method(audit, 'log', async () => {});
  t.mock.method(clientsRepository, 'create', async (_ws: string, input: Record<string, unknown>) => {
    creati.push(input);
    return { ...CLIENTE, ...input };
  });

  const csv = [
    'name,pecEmail,sdiCode,website,contactPerson',
    'Beta Srl,beta@pec.it,UF1234,https://beta.example,Luca Verdi',
  ].join('\n');

  await clientsService.importClientsFromCsv({
    workspaceId: 'w1',
    actorUserId: 'u1',
    request: {} as never,
    body: { csv },
  });

  assert.equal(creati[0].pecEmail, 'beta@pec.it');
  assert.equal(creati[0].sdiCode, 'UF1234');
  assert.equal(creati[0].website, 'https://beta.example');
  assert.equal(creati[0].contactPerson, 'Luca Verdi');
});

test('export: le quattro colonne ci sono, e chi riesporta non perde niente', async (t) => {
  t.mock.method(customFieldsService, 'listActiveDefinitions', async () => []);
  t.mock.method(clientsRepository, 'listForExport', async () => [CLIENTE]);

  const { csv } = await clientsService.exportClientsCsv('w1', undefined);
  const [header, riga] = parseCsvRows(csv, ',');

  for (const colonna of ['pecEmail', 'sdiCode', 'website', 'contactPerson']) {
    assert.ok(header.includes(colonna), `manca la colonna "${colonna}"`);
  }

  assert.equal(riga[header.indexOf('pecEmail')], 'studiorossi@pec.it');
  assert.equal(riga[header.indexOf('sdiCode')], 'M5UXCR1');
  assert.equal(riga[header.indexOf('website')], 'https://www.studiorossi.it');
  assert.equal(riga[header.indexOf('contactPerson')], 'Maria Rossi');
});
