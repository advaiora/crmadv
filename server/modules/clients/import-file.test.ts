import test from 'node:test';
import assert from 'node:assert/strict';
import { readClientImportFile, readClientImportJsonBody, sheetToRows } from './import-file.js';

// Le stesse anagrafiche, scritte una volta sola: servono a provare che il CSV e
// l'Excel finiscono nelle stesse identiche righe.
const HEADER = ['name', 'email', 'phone', 'tags'];
const RECORDS = [
  ['Rossi Mario', 'mario@example.com', '3331234567', 'vip|storico'],
  ['Bianchi Srl', 'info@bianchi.example', '0212345678', ''],
];

const CSV_CONTENT = [HEADER.join(','), ...RECORDS.map((row) => row.join(','))].join('\n');

const buildXlsx = async (header: string[], records: string[][]) => {
  const imported = (await import('exceljs')) as unknown as {
    default?: { Workbook: new () => never };
    Workbook?: new () => never;
  };
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

const upload = (buffer: Buffer, filename: string, mimeType = '', dryRun = false) => ({
  buffer,
  filename,
  mimeType,
  dryRun,
});

test('sheetToRows mette le intestazioni in prima riga e le celle nel loro ordine', () => {
  const rows = sheetToRows({
    sheetName: 'Clienti',
    headers: ['name', 'email', 'phone'],
    rows: [{ name: 'Rossi Mario', email: 'mario@example.com', phone: 3331234567 }],
    rowCount: 1,
  });

  assert.deepEqual(rows, [
    ['name', 'email', 'phone'],
    ['Rossi Mario', 'mario@example.com', '3331234567'],
  ]);
});

test('sheetToRows rende vuote le celle mancanti invece di saltarle', () => {
  const rows = sheetToRows({
    sheetName: 'Clienti',
    headers: ['name', 'email'],
    rows: [{ name: 'Rossi Mario', email: null }],
    rowCount: 1,
  });

  assert.deepEqual(rows[1], ['Rossi Mario', '']);
});

test('lo stesso elenco letto da CSV e da Excel produce le stesse righe', async () => {
  const fromCsv = await readClientImportFile(upload(Buffer.from(CSV_CONTENT, 'utf8'), 'clienti.csv'));
  const fromExcel = await readClientImportFile(
    upload(await buildXlsx(HEADER, RECORDS), 'clienti.xlsx'),
  );

  assert.equal(fromCsv.format, 'csv');
  assert.equal(fromExcel.format, 'xlsx');
  assert.deepEqual(fromExcel.rows, fromCsv.rows);
  assert.deepEqual(fromExcel.rows, [HEADER, ...RECORDS]);
});

test('sull Excel il separatore e nullo: le colonne sono celle, non testo separato', async () => {
  const source = await readClientImportFile(upload(await buildXlsx(HEADER, RECORDS), 'clienti.xlsx'));

  assert.equal(source.delimiter, null);
});

test('il CSV col punto e virgola viene riconosciuto', async () => {
  const source = await readClientImportFile(
    upload(Buffer.from('name;email\nRossi Mario;mario@example.com', 'utf8'), 'clienti.csv'),
  );

  assert.equal(source.delimiter, ';');
  assert.deepEqual(source.rows[1], ['Rossi Mario', 'mario@example.com']);
});

test('la prova senza salvare arriva fino in fondo alla lettura del file', async () => {
  const source = await readClientImportFile(
    upload(await buildXlsx(HEADER, RECORDS), 'clienti.xlsx', '', true),
  );

  assert.equal(source.dryRun, true);
});

test('un Excel vero passa anche se il file e stato rinominato .csv', async () => {
  const source = await readClientImportFile(upload(await buildXlsx(HEADER, RECORDS), 'clienti.csv'));

  assert.equal(source.format, 'xlsx');
});

test('un file binario viene rifiutato invece di finire nel lettore Excel', async () => {
  const binary = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x00, 0x00, 0x01, 0x00]);

  await assert.rejects(() => readClientImportFile(upload(binary, 'clienti.csv')), {
    message: /non è un CSV né un Excel/,
  });
});

test('un .xls vecchio formato viene rifiutato dicendo come rimediare', async () => {
  const legacy = Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(64),
  ]);

  await assert.rejects(() => readClientImportFile(upload(legacy, 'clienti.xls')), {
    message: /salvalo come \.xlsx/,
  });
});

test('un file di testo con estensione .xlsx viene rifiutato: il tipo si controlla sul contenuto', async () => {
  await assert.rejects(
    () => readClientImportFile(upload(Buffer.from(CSV_CONTENT, 'utf8'), 'clienti.xlsx')),
    { message: /il contenuto non lo è/ },
  );
});

test('un formato non previsto viene rifiutato nominando quelli accettati', async () => {
  await assert.rejects(
    () => readClientImportFile(upload(Buffer.from('testo qualunque', 'utf8'), 'clienti.docx')),
    { message: /solo CSV e Excel/ },
  );
});

test('il nome del file serve solo per l estensione: le cartelle davanti vengono ignorate', async () => {
  const source = await readClientImportFile(
    upload(Buffer.from(CSV_CONTENT, 'utf8'), '../../etc/passwd/clienti.csv'),
  );

  assert.equal(source.format, 'csv');
});

test('un file vuoto viene rifiutato', async () => {
  await assert.rejects(() => readClientImportFile(upload(Buffer.alloc(0), 'clienti.csv')), {
    message: /Il file è vuoto/,
  });
});

test('un CSV con solo spazi viene rifiutato come vuoto', async () => {
  await assert.rejects(
    () => readClientImportFile(upload(Buffer.from('   \n  \n', 'utf8'), 'clienti.csv')),
    { message: /Il file è vuoto/ },
  );
});

test('il BOM di Excel non finisce nella prima intestazione', async () => {
  const source = await readClientImportFile(
    upload(Buffer.from('﻿name,email\nRossi,mario@example.com', 'utf8'), 'clienti.csv'),
  );

  assert.equal(source.rows[0][0], 'name');
});

test('una virgoletta mai chiusa da un messaggio comprensibile, non un errore grezzo', async () => {
  await assert.rejects(
    () => readClientImportFile(upload(Buffer.from('name,notes\n"Rossi,aperta', 'utf8'), 'clienti.csv')),
    { message: /virgoletta è rimasta aperta/ },
  );
});

test('la vecchia forma JSON legge il CSV dal corpo e rifiuta i campi sconosciuti', async () => {
  const source = readClientImportJsonBody({ csv: 'name,email\nRossi,mario@example.com', dryRun: true });

  assert.equal(source.format, 'csv');
  assert.equal(source.dryRun, true);
  assert.deepEqual(source.rows[1], ['Rossi', 'mario@example.com']);

  assert.throws(() => readClientImportJsonBody({ csv: 'name', altro: 1 }), {
    message: /unknown fields/,
  });
  assert.throws(() => readClientImportJsonBody({ csv: '   ' }), { message: /csv cannot be empty/ });
  assert.throws(() => readClientImportJsonBody('name,email'), { message: /must be a JSON object/ });
});
