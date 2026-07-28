import { badRequest } from '../../../core/errors.js';

// Lettura di un file .xlsx del cliente in righe/colonne (Reportistica multi-sorgente,
// sotto-modulo Excel+AI). exceljs e' importato in modo DINAMICO (come mammoth/pdf-parse
// altrove): libreria pesante, caricata solo quando arriva davvero un Excel.

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
}

// exceljs restituisce, a seconda della cella, un primitivo, una Date, o un oggetto
// ricco (formula {result}, hyperlink {text}, richText {richText:[]}). Lo riduciamo a
// un valore semplice, lasciando Date e numeri intatti (servono al parsing a valle).
const normalizeCellValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.text === 'string') {
      return record.text;
    }
    if ('result' in record) {
      return record.result ?? null;
    }
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => (part as { text?: string }).text ?? '').join('');
    }
  }
  return String(value);
};

export const parseExcelBuffer = async (buffer: Buffer): Promise<ParsedSheet> => {
  const imported = (await import('exceljs')) as unknown as {
    default?: { Workbook: new () => ExcelWorkbook };
    Workbook?: new () => ExcelWorkbook;
  };
  const ExcelJS = imported.default ?? imported;
  const WorkbookCtor = (ExcelJS as { Workbook: new () => ExcelWorkbook }).Workbook;

  const workbook = new WorkbookCtor();
  try {
    await workbook.xlsx.load(buffer);
  } catch (_error) {
    throw badRequest('Impossibile leggere il file Excel: potrebbe essere corrotto o non essere un .xlsx.');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw badRequest('Il file non contiene fogli leggibili.');
  }

  // Prima riga = intestazioni (indice colonna 1-based in exceljs).
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  const headerByCol = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const label = String(normalizeCellValue(cell.value) ?? '').trim();
    if (label) {
      headers.push(label);
      headerByCol.set(colNumber, label);
    }
  });
  if (headers.length === 0) {
    throw badRequest('La prima riga del foglio non contiene intestazioni leggibili.');
  }

  const rows: Array<Record<string, unknown>> = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headerByCol.forEach((label, colNumber) => {
      const value = normalizeCellValue(row.getCell(colNumber).value);
      record[label] = value;
      if (value !== null && value !== '') {
        hasValue = true;
      }
    });
    if (hasValue) {
      rows.push(record);
    }
  }

  return { sheetName: worksheet.name, headers, rows, rowCount: rows.length };
};

// Tipi minimi di exceljs che usiamo (evita di dipendere dai suoi .d.ts nell'import dinamico).
interface ExcelCell {
  value: unknown;
}
interface ExcelRow {
  eachCell(opts: { includeEmpty: boolean }, cb: (cell: ExcelCell, col: number) => void): void;
  getCell(col: number): ExcelCell;
}
interface ExcelWorksheet {
  name: string;
  rowCount: number;
  getRow(row: number): ExcelRow;
}
interface ExcelWorkbook {
  worksheets: ExcelWorksheet[];
  xlsx: { load(buffer: Buffer): Promise<unknown> };
}
