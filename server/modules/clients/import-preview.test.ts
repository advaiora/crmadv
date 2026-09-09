import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportPreviewRows, MAX_IMPORT_PREVIEW_ROWS } from './import-preview.js';

const makeRow = (row: number, name: string) => ({
  row,
  payload: { type: 'company', name, email: null, phone: null },
});

test('l anteprima riporta il numero di riga del file, non la posizione nell elenco', () => {
  const rows = buildImportPreviewRows([makeRow(2, 'Acme'), makeRow(5, 'Beta')]);

  assert.deepEqual(rows.map((entry) => entry.row), [2, 5]);
  assert.deepEqual(rows.map((entry) => entry.name), ['Acme', 'Beta']);
});

test('l anteprima porta solo nome, tipo, email e telefono', () => {
  const rows = buildImportPreviewRows([
    {
      row: 2,
      payload: { type: 'person', name: 'Rossi Mario', email: 'mario@example.com', phone: '3331234567' },
    },
  ]);

  assert.deepEqual(rows[0], {
    row: 2,
    type: 'person',
    name: 'Rossi Mario',
    email: 'mario@example.com',
    phone: '3331234567',
  });
});

test('un elenco lunghissimo viene troncato: il conto vero resta in validRows', () => {
  const many = Array.from({ length: MAX_IMPORT_PREVIEW_ROWS + 50 }, (_, index) =>
    makeRow(index + 2, `Cliente ${index}`),
  );

  const rows = buildImportPreviewRows(many);

  assert.equal(rows.length, MAX_IMPORT_PREVIEW_ROWS);
  assert.equal(rows.at(-1)?.name, `Cliente ${MAX_IMPORT_PREVIEW_ROWS - 1}`);
});
