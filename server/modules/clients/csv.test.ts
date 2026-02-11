import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCsvDelimiter, parseCsvRows, stringifyCsv } from './csv.js';

test('detectCsvDelimiter detects semicolon-separated CSV', () => {
  const delimiter = detectCsvDelimiter('name;email;phone\nMario;test@example.com;3331234567');
  assert.equal(delimiter, ';');
});

test('parseCsvRows handles quoted delimiters and escaped quotes', () => {
  const rows = parseCsvRows('name,email,notes\n"Rossi, Mario",m@example.com,"He said ""hello"""', ',');

  assert.deepEqual(rows, [
    ['name', 'email', 'notes'],
    ['Rossi, Mario', 'm@example.com', 'He said "hello"'],
  ]);
});

test('stringifyCsv escapes fields as expected', () => {
  const csv = stringifyCsv(
    [
      ['name', 'notes'],
      ['Rossi, Mario', 'line1\nline2'],
    ],
    ',',
  );

  assert.equal(csv, 'name,notes\r\n"Rossi, Mario","line1\nline2"');
});
