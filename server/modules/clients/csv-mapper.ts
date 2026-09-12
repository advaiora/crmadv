import { badRequest } from '../../core/errors.js';
import {
  CSV_HEADER_COLUMNS,
  CSV_IMPORT_HEADER_ALIAS_MAP,
  CSV_IMPORT_IGNORED_HEADERS,
  CUSTOM_FIELD_CSV_PREFIX,
  TAG_CELL_SEPARATOR,
} from './constants.js';
import type { ClientRecord, CsvImportHeaderCell, ExportCustomFieldColumn } from './types.js';

export const normalizeImportHeaderToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

export const assertCsvColumns = (header: string[]) => {
  const normalized = header.map((column) => column.trim());
  const unique = new Set<string>();
  const unknownColumns: string[] = [];
  const mapped: CsvImportHeaderCell[] = normalized.map((column) => {
    // Colonne dei campi personalizzati: prefisso "cf:". La chiave che segue è
    // usata così com'è (minuscola); le chiavi sconosciute vengono poi ignorate
    // in fase di validazione dei valori.
    if (column.toLowerCase().startsWith(CUSTOM_FIELD_CSV_PREFIX)) {
      const customFieldKey = column.slice(CUSTOM_FIELD_CSV_PREFIX.length).trim().toLowerCase();
      return {
        raw: column,
        canonical: null,
        customFieldKey: customFieldKey || null,
      };
    }

    const token = normalizeImportHeaderToken(column);
    if (!token) {
      return {
        raw: column,
        canonical: null,
      };
    }

    const canonical = CSV_IMPORT_HEADER_ALIAS_MAP[token];
    if (canonical) {
      unique.add(canonical);
      return {
        raw: column,
        canonical,
      };
    }

    if (CSV_IMPORT_IGNORED_HEADERS.has(token)) {
      return {
        raw: column,
        canonical: null,
      };
    }

    unknownColumns.push(column);
    return {
      raw: column,
      canonical: null,
    };
  });

  if (unknownColumns.length > 0 && unique.size === 0) {
    throw badRequest('CSV header contains unknown columns', {
      unknownColumns: Array.from(new Set(unknownColumns)).sort(),
      acceptedColumns: [...CSV_HEADER_COLUMNS],
    });
  }

  if (!unique.has('name')) {
    throw badRequest('CSV header must include "name" column');
  }

  return mapped;
};

export const isEmptyCsvRow = (row: string[]) =>
  row.every((cell) => !cell || cell.trim().length === 0);

export const parseTagsCell = (value: string | undefined) => {
  if (!value) {
    return [] as string[];
  }

  return value
    .split(/[|;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const toImportBodyFromCsvRow = (header: CsvImportHeaderCell[], row: string[]) => {
  const byColumn = new Map<string, string>();
  const customFields = new Map<string, string>();
  header.forEach((column, index) => {
    const cellValue = row[index] ?? '';

    if (column.customFieldKey) {
      const existing = customFields.get(column.customFieldKey);
      if (existing && existing.trim().length > 0) {
        return;
      }
      customFields.set(column.customFieldKey, cellValue);
      return;
    }

    if (!column.canonical) {
      return;
    }

    const existing = byColumn.get(column.canonical);
    if (existing && existing.trim().length > 0) {
      return;
    }

    byColumn.set(column.canonical, cellValue);
  });

  const type = byColumn.get('type')?.trim();
  const name = byColumn.get('name') ?? '';
  const email = byColumn.get('email') ?? '';
  const phone = byColumn.get('phone') ?? '';
  const vatNumber = byColumn.get('vatNumber') ?? '';
  const taxCode = byColumn.get('taxCode') ?? '';
  const notes = byColumn.get('notes') ?? '';
  const tags = parseTagsCell(byColumn.get('tags'));

  return {
    ...(type ? { type } : {}),
    name,
    email,
    phone,
    vatNumber,
    taxCode,
    notes,
    tags,
    address: {
      street: byColumn.get('street') ?? '',
      city: byColumn.get('city') ?? '',
      zip: byColumn.get('zip') ?? '',
      province: byColumn.get('province') ?? '',
      country: byColumn.get('country') ?? '',
    },
    customFields: Object.fromEntries(customFields),
  };
};

// Converte un valore di campo personalizzato nella sua cella CSV (stringa).
export const formatCustomFieldCell = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
};

export const toExportCsvRow = (
  record: ClientRecord,
  customFieldColumns: ExportCustomFieldColumn[],
) => {
  const values = (record.customFields ?? {}) as Record<string, unknown>;
  return [
    record.type,
    record.name,
    record.email ?? '',
    record.phone ?? '',
    record.vatNumber ?? '',
    record.taxCode ?? '',
    record.street ?? '',
    record.city ?? '',
    record.zip ?? '',
    record.province ?? '',
    record.country ?? '',
    record.notes ?? '',
    record.tags.join(TAG_CELL_SEPARATOR),
    ...customFieldColumns.map((column) => formatCustomFieldCell(values[column.key])),
  ];
};
