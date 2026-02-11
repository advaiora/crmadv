const CSV_DELIMITERS = [',', ';'] as const;

type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

const hasMore = (value: string, left: string, right: string) => {
  const leftCount = value.split(left).length - 1;
  const rightCount = value.split(right).length - 1;

  return leftCount > rightCount;
};

export const detectCsvDelimiter = (csv: string): CsvDelimiter => {
  const firstLine = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/, 1)
    .at(0)
    ?.trim() ?? '';

  if (hasMore(firstLine, ';', ',')) {
    return ';';
  }

  return ',';
};

export const parseCsvRows = (csv: string, delimiter: CsvDelimiter): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const normalized = csv.replace(/^\uFEFF/, '');

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[index + 1] === '"') {
          currentCell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      if (char === '\r' && normalized[index + 1] === '\n') {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  if (inQuotes) {
    throw new Error('CSV contains an unterminated quoted field');
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
};

const quoteCell = (value: string, delimiter: CsvDelimiter) => {
  if (
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.includes(delimiter)
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

export const stringifyCsv = (
  rows: readonly (readonly string[])[],
  delimiter: CsvDelimiter,
) => rows.map((row) => row.map((cell) => quoteCell(cell, delimiter)).join(delimiter)).join('\r\n');
