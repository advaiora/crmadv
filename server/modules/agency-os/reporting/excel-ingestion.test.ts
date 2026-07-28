import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyMapping,
  parseDateValue,
  parseItalianNumber,
  type ExcelMapping,
} from './excel-ingestion.service.js';
import type { ParsedSheet } from './excel-parser.js';

test('parseItalianNumber legge il formato all\'italiana', () => {
  assert.equal(parseItalianNumber('18.324,66'), 18324.66);
  assert.equal(parseItalianNumber('1.000,00'), 1000);
  assert.equal(parseItalianNumber('1.234'), 1234); // separatore migliaia
  assert.equal(parseItalianNumber('€ 2.500,50'), 2500.5); // simbolo valuta ignorato
  assert.equal(parseItalianNumber(0), 0);
  assert.equal(parseItalianNumber(''), 0);
  assert.equal(parseItalianNumber(null), 0);
  assert.equal(parseItalianNumber(42), 42);
});

test('parseDateValue legge date IT e ISO, scarta le non-date', () => {
  const it = parseDateValue('15/01/2026');
  assert.equal(it?.getFullYear(), 2026);
  assert.equal(it?.getMonth(), 0);
  assert.equal(it?.getDate(), 15);
  const short = parseDateValue('30/01/26'); // anno a 2 cifre
  assert.equal(short?.getFullYear(), 2026);
  const iso = parseDateValue('2026-03-07');
  assert.equal(iso?.getMonth(), 2);
  assert.equal(parseDateValue(''), null);
  assert.equal(parseDateValue('non una data'), null);
});

test('applyMapping raggruppa per mese, conta conversioni e riconcilia', () => {
  const sheet: ParsedSheet = {
    sheetName: 'test',
    headers: ['Data', 'Valore', 'Source'],
    rows: [
      { Data: '10/01/2026', Valore: 0, Source: 'fb' },
      { Data: '20/01/2026', Valore: '100,50', Source: 'ig' },
      { Data: '05/02/2026', Valore: '1.000,00', Source: 'none' },
      { Data: 'boh', Valore: 10, Source: 'fb' }, // senza data valida -> scartata
    ],
    rowCount: 4,
  };
  const mapping: ExcelMapping = {
    rowMeaning: 'lead',
    dateColumn: 'Data',
    valueColumn: 'Valore',
    sourceColumn: 'Source',
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  };

  const { snapshots, reconciliation } = applyMapping(sheet, mapping);

  assert.equal(reconciliation.rowsParsed, 4);
  assert.equal(reconciliation.rowsBucketed, 3);
  assert.equal(reconciliation.rowsSkippedNoDate, 1);
  assert.equal(reconciliation.balanced, true);
  assert.equal(reconciliation.months, 2);

  const january = snapshots.find((s) => s.periodKey === '2026-01');
  assert.ok(january);
  assert.equal(january?.metrics.leads, 2);
  assert.equal(january?.metrics.conversions, 1); // solo il 100,50 ha valore > 0
  assert.equal(january?.metrics.conversionValue, 100.5);

  const february = snapshots.find((s) => s.periodKey === '2026-02');
  assert.equal(february?.metrics.leads, 1);
  assert.equal(february?.metrics.conversions, 1);
  assert.equal(february?.metrics.conversionValue, 1000);
});
