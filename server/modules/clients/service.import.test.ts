import test from 'node:test';
import assert from 'node:assert/strict';
import { clientsService } from './service.js';
import { clientsRepository } from './repository.js';
import { customFieldsService } from '../custom-fields/custom-fields.service.js';
import { audit } from '../../audit/audit.js';

// L'import visto dal servizio, dal file gia' letto in poi: che il CSV e l'Excel
// arrivino allo stesso risultato, che la prova senza salvare non crei niente, e
// che una riga sbagliata non trascini le altre.

const HEADER = ['name', 'email', 'phone'];
const RECORDS = [
  ['Rossi Mario', 'mario@example.com', '3331234567'],
  ['Bianchi Srl', 'info@bianchi.example', '0212345678'],
];

const CSV_CONTENT = [HEADER.join(','), ...RECORDS.map((row) => row.join(','))].join('\n');

const buildXlsx = async (header: string[], records: string[][]) => {
  const imported = (await import('exceljs')) as unknown as { default?: unknown };
  const ExcelJS = (imported.default ?? imported) as {
    Workbook: new () => {
      addWorksheet(name: string): { addRow(values: unknown[]): void };
      xlsx: { writeBuffer(): Promise<ArrayBuffer> };
    };
  };

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Clienti');
  sheet.addRow(header);
  records.forEach((row) => sheet.addRow(row));

  return Buffer.from(await workbook.xlsx.writeBuffer());
};

type Recorded = { created: string[]; events: string[] };

// Aggancia i finti a repository, campi personalizzati e registro attivita':
// l'import non ha bisogno del database per essere provato.
const stubDependencies = (t: { mock: { method: Function } }): Recorded => {
  const recorded: Recorded = { created: [], events: [] };

  t.mock.method(customFieldsService, 'listActiveDefinitions', async () => []);
  t.mock.method(audit, 'log', async (input: { event?: string }) => {
    recorded.events.push(input.event ?? '');
  });
  t.mock.method(clientsRepository, 'create', async (_workspaceId: string, payload: { name: string }) => {
    recorded.created.push(payload.name);
    return { id: `c${recorded.created.length}`, name: payload.name };
  });

  return recorded;
};

const runImport = (upload: { buffer: Buffer; filename: string; dryRun?: boolean }) =>
  clientsService.importClientsFromCsv({
    workspaceId: 'w1',
    actorUserId: 'u1',
    request: {} as never,
    upload: {
      buffer: upload.buffer,
      filename: upload.filename,
      mimeType: '',
      dryRun: upload.dryRun ?? false,
    },
  });

test('lo stesso elenco come .csv e come .xlsx crea gli stessi clienti', async (t) => {
  const fromCsv = stubDependencies(t);
  const csvResult = await runImport({ buffer: Buffer.from(CSV_CONTENT, 'utf8'), filename: 'clienti.csv' });
  const createdFromCsv = [...fromCsv.created];

  t.mock.restoreAll();
  const fromExcel = stubDependencies(t);
  const excelResult = await runImport({
    buffer: await buildXlsx(HEADER, RECORDS),
    filename: 'clienti.xlsx',
  });

  assert.deepEqual(fromExcel.created, createdFromCsv);
  assert.deepEqual(fromExcel.created, ['Rossi Mario', 'Bianchi Srl']);
  assert.equal(excelResult.summary.createdRows, csvResult.summary.createdRows);
  assert.equal(excelResult.summary.validRows, csvResult.summary.validRows);
  assert.equal(excelResult.summary.failedRows, csvResult.summary.failedRows);
  assert.equal(excelResult.summary.totalRows, csvResult.summary.totalRows);
});

test('la risposta dichiara da quale formato ha letto', async (t) => {
  stubDependencies(t);

  const result = await runImport({ buffer: await buildXlsx(HEADER, RECORDS), filename: 'clienti.xlsx' });

  assert.equal(result.summary.format, 'xlsx');
  assert.equal(result.summary.delimiter, null);
});

test('prova senza salvare da un Excel: nessun cliente creato, e il conto di chi entrerebbe', async (t) => {
  const recorded = stubDependencies(t);

  const result = await runImport({
    buffer: await buildXlsx(HEADER, [...RECORDS, ['', 'senzanome@example.com', '3331111111']]),
    filename: 'clienti.xlsx',
    dryRun: true,
  });

  assert.deepEqual(recorded.created, [], 'in prova non si crea nessun cliente');
  assert.equal(result.summary.dryRun, true);
  assert.equal(result.summary.createdRows, 0);
  assert.equal(result.summary.totalRows, 3);
  assert.equal(result.summary.validRows, 2);
  assert.equal(result.summary.failedRows, 1);
  // Quali non entrano e perche': riga 4 del file (l'intestazione e' la 1).
  assert.equal(result.summary.errors.length, 1);
  assert.equal(result.summary.errors[0].row, 4);
  assert.match(result.summary.errors[0].message, /name/);
});

test('una riga sbagliata non fa cadere le altre, anche leggendo da Excel', async (t) => {
  const recorded = stubDependencies(t);

  const result = await runImport({
    buffer: await buildXlsx(HEADER, [
      ['Rossi Mario', 'mario@example.com', '3331234567'],
      ['Senza Email Valida', 'non-e-una-email', '3331234567'],
      ['Bianchi Srl', 'info@bianchi.example', '0212345678'],
    ]),
    filename: 'clienti.xlsx',
  });

  assert.deepEqual(recorded.created, ['Rossi Mario', 'Bianchi Srl']);
  assert.equal(result.summary.createdRows, 2);
  assert.equal(result.summary.failedRows, 1);
  assert.equal(result.summary.errors[0].row, 3);
});

test('la prova senza salvare scrive un evento suo nel registro attivita', async (t) => {
  const recorded = stubDependencies(t);

  await runImport({ buffer: Buffer.from(CSV_CONTENT, 'utf8'), filename: 'clienti.csv', dryRun: true });
  assert.deepEqual(recorded.events, ['clients.import.preview']);

  await runImport({ buffer: Buffer.from(CSV_CONTENT, 'utf8'), filename: 'clienti.csv' });
  assert.deepEqual(recorded.events, ['clients.import.preview', 'clients.import']);
});

test('la vecchia forma JSON continua a funzionare finche il frontend non passa all allegato', async (t) => {
  const recorded = stubDependencies(t);

  const result = await clientsService.importClientsFromCsv({
    workspaceId: 'w1',
    actorUserId: 'u1',
    request: {} as never,
    body: { csv: CSV_CONTENT },
  });

  assert.deepEqual(recorded.created, ['Rossi Mario', 'Bianchi Srl']);
  assert.equal(result.summary.format, 'csv');
  assert.equal(result.summary.delimiter, ',');
});

test('un file con la sola intestazione lo dice in italiano', async (t) => {
  stubDependencies(t);

  await assert.rejects(
    () => runImport({ buffer: Buffer.from('name,email\n', 'utf8'), filename: 'clienti.csv' }),
    { message: /solo la riga di intestazione/ },
  );
});
