import type { ClientType } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { audit } from '../../audit/audit.js';
import { badRequest, isHttpError, notFound } from '../../core/errors.js';
import { validateAndNormalizePhone } from '../../../core/utils/phone.js';
import { buildPhoneFieldSchema, PHONE_INVALID_MESSAGE } from './clients.schema.js';
import { detectCsvDelimiter, parseCsvRows, stringifyCsv } from './csv.js';
import {
  clientsRepository,
  type ClientSortDirection,
  type ClientSortField,
} from './repository.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 120;
const MAX_NAME_LENGTH = 160;
const MAX_EMAIL_LENGTH = 320;
const MAX_VAT_LENGTH = 40;
const MAX_TAX_CODE_LENGTH = 40;
const MAX_ADDRESS_LENGTH = 120;
const MAX_ZIP_LENGTH = 20;
const MAX_NOTES_LENGTH = 4000;
const MAX_TAGS = 30;
const MAX_TAG_LENGTH = 40;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SORT_FIELDS: ClientSortField[] = ['name', 'createdAt', 'updatedAt'];
const CSV_HEADER_COLUMNS = [
  'type',
  'name',
  'email',
  'phone',
  'vatNumber',
  'taxCode',
  'street',
  'city',
  'zip',
  'province',
  'country',
  'notes',
  'tags',
] as const;
const MAX_IMPORT_ERRORS = 100;
const TAG_CELL_SEPARATOR = '|';

const ADDRESS_FIELDS = ['street', 'city', 'zip', 'province', 'country'] as const;
const CLIENT_BODY_FIELDS = [
  'type',
  'name',
  'email',
  'phone',
  'vatNumber',
  'taxCode',
  'address',
  'notes',
  'tags',
] as const;

type AddressField = (typeof ADDRESS_FIELDS)[number];
type ClientBodyField = (typeof CLIENT_BODY_FIELDS)[number];
type CsvHeaderColumn = (typeof CSV_HEADER_COLUMNS)[number];

type ClientListFilters = {
  query?: string;
  type?: ClientType;
  page: number;
  pageSize: number;
  sortField: ClientSortField;
  sortDirection: ClientSortDirection;
  sort: string;
};

type ClientAddress = Record<AddressField, string | null>;

type ClientWritePayload = {
  type: ClientType;
  name: string;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  taxCode: string | null;
  notes: string | null;
  tags: string[];
} & ClientAddress;

type ClientPatchPayload = Partial<ClientWritePayload>;
type ImportClientsBody = {
  csv: string;
  dryRun?: boolean;
};
type ClientImportError = {
  row: number;
  message: string;
};
type ClientImportRow = {
  row: number;
  payload: ClientWritePayload;
};
type CsvImportHeaderCell = {
  raw: string;
  canonical: CsvHeaderColumn | null;
};

type ClientRecord = NonNullable<Awaited<ReturnType<typeof clientsRepository.findById>>>;
type ClientProjectRecord = Awaited<ReturnType<typeof clientsRepository.listProjectsByClient>>[number];
type MapClientOptions = {
  includeProjects?: boolean;
  projects?: ClientProjectRecord[];
};

const CSV_IMPORT_IGNORED_HEADERS = new Set(['id', 'status', 'stato']);
const CSV_IMPORT_HEADER_ALIAS_MAP: Record<string, CsvHeaderColumn> = {
  type: 'type',
  clienttype: 'type',
  tipocliente: 'type',
  name: 'name',
  companyname: 'name',
  contactname: 'name',
  ragionesociale: 'name',
  nominativo: 'name',
  email: 'email',
  mail: 'email',
  phone: 'phone',
  telefono: 'phone',
  vatnumber: 'vatNumber',
  vat: 'vatNumber',
  vatnumberit: 'vatNumber',
  piva: 'vatNumber',
  partitaiva: 'vatNumber',
  taxcode: 'taxCode',
  codicefiscale: 'taxCode',
  street: 'street',
  address: 'street',
  via: 'street',
  city: 'city',
  citta: 'city',
  comune: 'city',
  zip: 'zip',
  cap: 'zip',
  postalcode: 'zip',
  postcode: 'zip',
  province: 'province',
  provincia: 'province',
  country: 'country',
  nazione: 'country',
  countrycode: 'country',
  notes: 'notes',
  note: 'notes',
  tags: 'tags',
  tag: 'tags',
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const assertNoUnknownFields = (
  body: Record<string, unknown>,
  allowedFields: readonly ClientBodyField[],
) => {
  const unknownFields = Object.keys(body).filter(
    (fieldName) => !allowedFields.includes(fieldName as ClientBodyField),
  );

  if (unknownFields.length > 0) {
    throw badRequest('Body contains unknown fields', {
      unknownFields: unknownFields.sort(),
    });
  }
};

const normalizeOptionalString = (
  value: unknown,
  fieldName: string,
  options?: { maxLength?: number },
) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (options?.maxLength && normalized.length > options.maxLength) {
    throw badRequest(`${fieldName} is too long`, {
      maxLength: options.maxLength,
    });
  }

  return normalized;
};

const normalizeRequiredString = (
  value: unknown,
  fieldName: string,
  options?: { maxLength?: number },
) => {
  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} is required`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw badRequest(`${fieldName} is required`);
  }

  if (options?.maxLength && normalized.length > options.maxLength) {
    throw badRequest(`${fieldName} is too long`, {
      maxLength: options.maxLength,
    });
  }

  return normalized;
};

const parsePageNumber = (value: unknown, fieldName: string, fallback: number) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = typeof value === 'string' ? value.trim() : value;
  const parsed = typeof normalized === 'string' ? Number(normalized) : (normalized as number);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${fieldName} must be an integer >= 1`);
  }

  return parsed;
};

const parseClientType = (
  value: unknown,
  fieldName: string,
  options?: { defaultValue?: ClientType },
): ClientType => {
  if (value === undefined) {
    if (options?.defaultValue) {
      return options.defaultValue;
    }

    throw badRequest(`${fieldName} is required`);
  }
  if (value === null || value === '') {
    throw badRequest(`${fieldName} must be person or company`);
  }
  if (value !== 'person' && value !== 'company') {
    throw badRequest(`${fieldName} must be person or company`);
  }

  return value;
};

const normalizeEmail = (value: unknown, fieldName: string) => {
  const normalized = normalizeOptionalString(value, fieldName, {
    maxLength: MAX_EMAIL_LENGTH,
  });

  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (!EMAIL_REGEX.test(lowered)) {
    throw badRequest(`${fieldName} must be a valid email`);
  }

  return lowered;
};

const normalizePhoneForStorage = (phone: string | null, country?: string | null) => {
  if (!phone) {
    return null;
  }

  const schemaResult = buildPhoneFieldSchema(country ?? undefined).safeParse(phone);
  if (!schemaResult.success) {
    throw badRequest(schemaResult.error.issues[0]?.message ?? PHONE_INVALID_MESSAGE);
  }

  const normalized = validateAndNormalizePhone(phone, country ?? undefined);
  if (!normalized.isValid || !normalized.e164) {
    throw badRequest(PHONE_INVALID_MESSAGE);
  }

  return normalized.e164;
};

const normalizeTags = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null) {
    return [] as string[];
  }
  if (!Array.isArray(value)) {
    throw badRequest(`${fieldName} must be an array of strings`);
  }
  if (value.length > MAX_TAGS) {
    throw badRequest(`${fieldName} cannot contain more than ${MAX_TAGS} values`);
  }

  const unique = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const tag = value[index];
    if (typeof tag !== 'string') {
      throw badRequest(`${fieldName}[${index}] must be a string`);
    }

    const normalized = tag.trim();
    if (!normalized) {
      throw badRequest(`${fieldName}[${index}] cannot be empty`);
    }
    if (normalized.length > MAX_TAG_LENGTH) {
      throw badRequest(`${fieldName}[${index}] is too long`, {
        maxLength: MAX_TAG_LENGTH,
      });
    }

    unique.add(normalized);
  }

  return Array.from(unique);
};

const parseAddressCreate = (value: unknown): ClientAddress => {
  if (value === undefined || value === null) {
    return {
      street: null,
      city: null,
      zip: null,
      province: null,
      country: null,
    };
  }
  if (!isObject(value)) {
    throw badRequest('address must be an object');
  }

  const unknownFields = Object.keys(value).filter(
    (fieldName) => !ADDRESS_FIELDS.includes(fieldName as AddressField),
  );
  if (unknownFields.length > 0) {
    throw badRequest('address contains unknown fields', {
      unknownFields: unknownFields.sort(),
    });
  }

  return {
    street: normalizeOptionalString(value.street, 'address.street', {
      maxLength: MAX_ADDRESS_LENGTH,
    }),
    city: normalizeOptionalString(value.city, 'address.city', {
      maxLength: MAX_ADDRESS_LENGTH,
    }),
    zip: normalizeOptionalString(value.zip, 'address.zip', {
      maxLength: MAX_ZIP_LENGTH,
    }),
    province: normalizeOptionalString(value.province, 'address.province', {
      maxLength: MAX_ADDRESS_LENGTH,
    }),
    country: normalizeOptionalString(value.country, 'address.country', {
      maxLength: MAX_ADDRESS_LENGTH,
    }),
  };
};

const parseAddressPatch = (value: unknown): Partial<ClientAddress> => {
  if (value === null) {
    return {
      street: null,
      city: null,
      zip: null,
      province: null,
      country: null,
    };
  }
  if (!isObject(value)) {
    throw badRequest('address must be an object or null');
  }

  const unknownFields = Object.keys(value).filter(
    (fieldName) => !ADDRESS_FIELDS.includes(fieldName as AddressField),
  );
  if (unknownFields.length > 0) {
    throw badRequest('address contains unknown fields', {
      unknownFields: unknownFields.sort(),
    });
  }

  const patch: Partial<ClientAddress> = {};

  if ('street' in value) {
    patch.street = normalizeOptionalString(value.street, 'address.street', {
      maxLength: MAX_ADDRESS_LENGTH,
    });
  }
  if ('city' in value) {
    patch.city = normalizeOptionalString(value.city, 'address.city', {
      maxLength: MAX_ADDRESS_LENGTH,
    });
  }
  if ('zip' in value) {
    patch.zip = normalizeOptionalString(value.zip, 'address.zip', {
      maxLength: MAX_ZIP_LENGTH,
    });
  }
  if ('province' in value) {
    patch.province = normalizeOptionalString(value.province, 'address.province', {
      maxLength: MAX_ADDRESS_LENGTH,
    });
  }
  if ('country' in value) {
    patch.country = normalizeOptionalString(value.country, 'address.country', {
      maxLength: MAX_ADDRESS_LENGTH,
    });
  }

  return patch;
};

const parseOptionalClientTypeFilter = (value: unknown): ClientType | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value !== 'person' && value !== 'company') {
    throw badRequest('type must be person or company');
  }

  return value;
};

const parseImportBody = (body: unknown): ImportClientsBody => {
  if (!isObject(body)) {
    throw badRequest('Body must be a JSON object');
  }

  const unknownFields = Object.keys(body).filter((key) => key !== 'csv' && key !== 'dryRun');
  if (unknownFields.length > 0) {
    throw badRequest('Body contains unknown fields', {
      unknownFields: unknownFields.sort(),
    });
  }

  if (typeof body.csv !== 'string') {
    throw badRequest('csv must be a string');
  }

  const csv = body.csv.replace(/^\uFEFF/, '').trim();
  if (!csv) {
    throw badRequest('csv cannot be empty');
  }

  if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') {
    throw badRequest('dryRun must be a boolean');
  }

  return {
    csv,
    dryRun: body.dryRun ?? false,
  };
};

const normalizeImportHeaderToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const assertCsvColumns = (header: string[]) => {
  const normalized = header.map((column) => column.trim());
  const unique = new Set<string>();
  const unknownColumns: string[] = [];
  const mapped: CsvImportHeaderCell[] = normalized.map((column) => {
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

const isEmptyCsvRow = (row: string[]) => row.every((cell) => !cell || cell.trim().length === 0);

const parseTagsCell = (value: string | undefined) => {
  if (!value) {
    return [] as string[];
  }

  return value
    .split(/[|;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toImportBodyFromCsvRow = (header: CsvImportHeaderCell[], row: string[]) => {
  const byColumn = new Map<string, string>();
  header.forEach((column, index) => {
    if (!column.canonical) {
      return;
    }

    const cellValue = row[index] ?? '';
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
  };
};

const toExportCsvRow = (record: ClientRecord) => [
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
];

const arraysAreEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const sortUniqueFields = (fields: string[]) => Array.from(new Set(fields)).sort();

const mapClientProject = (project: ClientProjectRecord) => ({
  id: project.id,
  workspaceId: project.workspaceId,
  clientId: project.clientId,
  name: project.name,
  categoryId: project.pipelineStage?.categoryId ?? null,
  stageId: project.pipelineStageId,
  pipelineStageId: project.pipelineStageId,
  stage: project.pipelineStage
    ? {
        id: project.pipelineStage.id,
        categoryId: project.pipelineStage.categoryId,
        name: project.pipelineStage.name,
        sortOrder: project.pipelineStage.sortOrder,
        isClosed: project.pipelineStage.isClosed,
        color: project.pipelineStage.color,
      }
    : null,
  categoryName: project.pipelineStage?.category?.name ?? null,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

const mapClient = (record: ClientRecord, options: MapClientOptions = {}) => ({
  id: record.id,
  workspaceId: record.workspaceId,
  type: record.type,
  name: record.name,
  email: record.email,
  phone: record.phone,
  vatNumber: record.vatNumber,
  taxCode: record.taxCode,
  address: {
    street: record.street,
    city: record.city,
    zip: record.zip,
    province: record.province,
    country: record.country,
  },
  notes: record.notes,
  tags: record.tags,
  ...(options.includeProjects
    ? {
        projects: (options.projects ?? []).map((project) => mapClientProject(project)),
      }
    : {}),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapSortToken = (sortField: ClientSortField, sortDirection: ClientSortDirection) =>
  sortDirection === 'desc' ? `-${sortField}` : sortField;

export const clientsService = {
  parseListFilters(query: unknown): ClientListFilters {
    if (query === undefined) {
      return {
        page: DEFAULT_PAGE,
        pageSize: DEFAULT_PAGE_SIZE,
        sortField: 'updatedAt',
        sortDirection: 'desc',
        sort: '-updatedAt',
      };
    }
    if (!isObject(query)) {
      throw badRequest('Querystring is invalid');
    }

    const page = parsePageNumber(query.page, 'page', DEFAULT_PAGE);
    const rawPageSize = parsePageNumber(query.pageSize, 'pageSize', DEFAULT_PAGE_SIZE);
    const pageSize = Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, rawPageSize));

    let sortField: ClientSortField = 'updatedAt';
    let sortDirection: ClientSortDirection = 'desc';
    if (query.sort !== undefined) {
      if (typeof query.sort !== 'string') {
        throw badRequest('sort must be a string');
      }

      const normalizedSort = query.sort.trim();
      if (!normalizedSort) {
        throw badRequest('sort cannot be empty');
      }

      const parsedSortField = normalizedSort.startsWith('-')
        ? normalizedSort.slice(1)
        : normalizedSort;

      if (!SORT_FIELDS.includes(parsedSortField as ClientSortField)) {
        throw badRequest('sort is invalid', {
          accepted: ['name', 'createdAt', 'updatedAt', '-name', '-createdAt', '-updatedAt'],
        });
      }

      sortField = parsedSortField as ClientSortField;
      sortDirection = normalizedSort.startsWith('-') ? 'desc' : 'asc';
    }

    const rawSearch = query.query !== undefined ? query.query : query.search;
    let normalizedQuery: string | undefined;
    if (rawSearch !== undefined) {
      if (typeof rawSearch !== 'string') {
        throw badRequest('query must be a string');
      }
      const trimmed = rawSearch.trim();
      if (trimmed.length > MAX_SEARCH_LENGTH) {
        throw badRequest('query is too long', {
          maxLength: MAX_SEARCH_LENGTH,
        });
      }
      if (trimmed) {
        normalizedQuery = trimmed;
      }
    }
    const type = parseOptionalClientTypeFilter(query.type);

    return {
      query: normalizedQuery,
      type,
      page,
      pageSize,
      sortField,
      sortDirection,
      sort: mapSortToken(sortField, sortDirection),
    };
  },

  parseCreatePayload(body: unknown): ClientWritePayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }
    assertNoUnknownFields(body, CLIENT_BODY_FIELDS);

    const address = parseAddressCreate(body.address);
    const rawPhone = normalizeOptionalString(body.phone, 'phone');

    return {
      type: parseClientType(body.type, 'type', { defaultValue: 'person' }),
      name: normalizeRequiredString(body.name, 'name', {
        maxLength: MAX_NAME_LENGTH,
      }),
      email: normalizeEmail(body.email, 'email'),
      phone: normalizePhoneForStorage(rawPhone, address.country),
      vatNumber: normalizeOptionalString(body.vatNumber, 'vatNumber', {
        maxLength: MAX_VAT_LENGTH,
      }),
      taxCode: normalizeOptionalString(body.taxCode, 'taxCode', {
        maxLength: MAX_TAX_CODE_LENGTH,
      }),
      notes: normalizeOptionalString(body.notes, 'notes', {
        maxLength: MAX_NOTES_LENGTH,
      }),
      tags: normalizeTags(body.tags, 'tags'),
      ...address,
    };
  },

  parsePatchPayload(body: unknown): ClientPatchPayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }
    assertNoUnknownFields(body, CLIENT_BODY_FIELDS);

    const patch: ClientPatchPayload = {};

    if ('type' in body) {
      patch.type = parseClientType(body.type, 'type');
    }

    if ('name' in body) {
      patch.name = normalizeRequiredString(body.name, 'name', {
        maxLength: MAX_NAME_LENGTH,
      });
    }

    if ('email' in body) {
      patch.email = normalizeEmail(body.email, 'email');
    }

    if ('phone' in body) {
      patch.phone = normalizeOptionalString(body.phone, 'phone');
    }

    if ('vatNumber' in body) {
      patch.vatNumber = normalizeOptionalString(body.vatNumber, 'vatNumber', {
        maxLength: MAX_VAT_LENGTH,
      });
    }

    if ('taxCode' in body) {
      patch.taxCode = normalizeOptionalString(body.taxCode, 'taxCode', {
        maxLength: MAX_TAX_CODE_LENGTH,
      });
    }

    if ('notes' in body) {
      patch.notes = normalizeOptionalString(body.notes, 'notes', {
        maxLength: MAX_NOTES_LENGTH,
      });
    }

    if ('tags' in body) {
      patch.tags = normalizeTags(body.tags, 'tags');
    }

    if ('address' in body) {
      Object.assign(patch, parseAddressPatch(body.address));
    }

    if (Object.keys(patch).length === 0) {
      throw badRequest('At least one field is required');
    }

    return patch;
  },

  parseClientId(rawId: string) {
    const normalizedId = rawId?.trim();
    if (!normalizedId) {
      throw badRequest('Client id is required');
    }

    return normalizedId;
  },

  async requireClient(workspaceId: string, rawClientId: string) {
    const clientId = this.parseClientId(rawClientId);
    const client = await clientsRepository.findById(workspaceId, clientId);
    if (!client) {
      throw notFound('Client not found');
    }

    return client;
  },

  async listClients(workspaceId: string, query: unknown) {
    const filters = this.parseListFilters(query);
    const result = await clientsRepository.listClients({
      workspaceId,
      query: filters.query,
      type: filters.type,
      page: filters.page,
      pageSize: filters.pageSize,
      sortField: filters.sortField,
      sortDirection: filters.sortDirection,
    });

    const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / filters.pageSize);

    return {
      items: result.items.map((item) => mapClient(item)),
      pageInfo: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: result.total,
        totalPages,
        hasNextPage: filters.page < totalPages,
        hasPrevPage: filters.page > 1,
      },
      filters: {
        query: filters.query ?? null,
        type: filters.type ?? null,
        sort: filters.sort,
      },
    };
  },

  async getClient(workspaceId: string, clientId: string) {
    const client = await this.requireClient(workspaceId, clientId);
    const projects = await clientsRepository.listProjectsByClient(workspaceId, client.id);

    return mapClient(client, {
      includeProjects: true,
      projects,
    });
  },

  parseExportFilters(query: unknown) {
    const parsed = this.parseListFilters(query);

    return {
      query: parsed.query,
      type: parsed.type,
      sortField: parsed.sortField,
      sortDirection: parsed.sortDirection,
      sort: parsed.sort,
    };
  },

  async exportClientsCsv(workspaceId: string, query: unknown) {
    const filters = this.parseExportFilters(query);
    const clients = await clientsRepository.listForExport({
      workspaceId,
      query: filters.query,
      type: filters.type,
      sortField: filters.sortField,
      sortDirection: filters.sortDirection,
    });

    const delimiter = ',';
    const csv = stringifyCsv(
      [
        [...CSV_HEADER_COLUMNS],
        ...clients.map((client) => toExportCsvRow(client)),
      ],
      delimiter,
    );

    const dateToken = new Date().toISOString().slice(0, 10);
    return {
      csv,
      filename: `clients-export-${dateToken}.csv`,
      totalRows: clients.length,
      filters: {
        query: filters.query ?? null,
        type: filters.type ?? null,
        sort: filters.sort,
      },
    };
  },

  async importClientsFromCsv(input: {
    workspaceId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const parsedBody = parseImportBody(input.body);
    const delimiter = detectCsvDelimiter(parsedBody.csv);
    let rows: string[][];

    try {
      rows = parseCsvRows(parsedBody.csv, delimiter);
    } catch (error) {
      throw badRequest('CSV is malformed', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }

    if (rows.length === 0) {
      throw badRequest('CSV has no rows');
    }

    const header = assertCsvColumns(rows[0]);
    const dataRows = rows
      .slice(1)
      .map((row, index) => ({
        row: index + 2,
        values: row,
      }))
      .filter((entry) => !isEmptyCsvRow(entry.values));

    if (dataRows.length === 0) {
      throw badRequest('CSV has no data rows');
    }

    const validRows: ClientImportRow[] = [];
    const errors: ClientImportError[] = [];
    let failedRowsCount = 0;

    dataRows.forEach((entry) => {
      const rowBody = toImportBodyFromCsvRow(header, entry.values);
      try {
        const payload = this.parseCreatePayload(rowBody);
        validRows.push({
          row: entry.row,
          payload,
        });
      } catch (error) {
        failedRowsCount += 1;

        if (errors.length < MAX_IMPORT_ERRORS && isHttpError(error)) {
          errors.push({
            row: entry.row,
            message: error.message,
          });
          return;
        }

        if (errors.length < MAX_IMPORT_ERRORS) {
          errors.push({
            row: entry.row,
            message: 'Unexpected validation error',
          });
        }
      }
    });

    let createdRows = 0;

    if (!parsedBody.dryRun) {
      for (const entry of validRows) {
        try {
          await clientsRepository.create(input.workspaceId, entry.payload);
          createdRows += 1;
        } catch (error) {
          failedRowsCount += 1;
          if (errors.length < MAX_IMPORT_ERRORS) {
            errors.push({
              row: entry.row,
              message: error instanceof Error ? error.message : 'Failed to persist row',
            });
          }
        }
      }
    }

    const failedRows = failedRowsCount;

    await audit.log({
      event: 'clients.import',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Client',
      metadata: {
        dryRun: parsedBody.dryRun,
        totalRows: dataRows.length,
        validRows: validRows.length,
        createdRows,
        failedRows,
      },
      request: input.request,
    });

    return {
      summary: {
        delimiter,
        dryRun: parsedBody.dryRun,
        totalRows: dataRows.length,
        validRows: validRows.length,
        createdRows,
        failedRows,
        errors,
      },
    };
  },

  async createClient(input: {
    workspaceId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const payload = this.parseCreatePayload(input.body);
    const created = await clientsRepository.create(input.workspaceId, payload);

    const fieldsUpdated = sortUniqueFields(
      [
        'type',
        'name',
        ...(created.email ? ['email'] : []),
        ...(created.phone ? ['phone'] : []),
        ...(created.vatNumber ? ['vatNumber'] : []),
        ...(created.taxCode ? ['taxCode'] : []),
        ...(created.street ? ['address.street'] : []),
        ...(created.city ? ['address.city'] : []),
        ...(created.zip ? ['address.zip'] : []),
        ...(created.province ? ['address.province'] : []),
        ...(created.country ? ['address.country'] : []),
        ...(created.notes ? ['notes'] : []),
        ...(created.tags.length > 0 ? ['tags'] : []),
      ].filter(Boolean),
    );

    await audit.log({
      event: 'clients.create',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Client',
      entityId: created.id,
      metadata: {
        clientId: created.id,
        fieldsUpdated,
      },
      request: input.request,
    });

    return mapClient(created);
  },

  async updateClient(input: {
    workspaceId: string;
    clientId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const current = await this.requireClient(input.workspaceId, input.clientId);
    const patch = this.parsePatchPayload(input.body);
    if ('phone' in patch && patch.phone) {
      const countryForPhone =
        typeof patch.country === 'string' || patch.country === null
          ? patch.country
          : current.country;
      patch.phone = normalizePhoneForStorage(patch.phone, countryForPhone);
    }

    const updated = await clientsRepository.update(
      input.workspaceId,
      this.parseClientId(input.clientId),
      patch,
    );
    if (!updated) {
      throw notFound('Client not found');
    }

    const changedFields: string[] = [];

    if ('type' in patch && current.type !== updated.type) {
      changedFields.push('type');
    }
    if ('name' in patch && current.name !== updated.name) {
      changedFields.push('name');
    }
    if ('email' in patch && current.email !== updated.email) {
      changedFields.push('email');
    }
    if ('phone' in patch && current.phone !== updated.phone) {
      changedFields.push('phone');
    }
    if ('vatNumber' in patch && current.vatNumber !== updated.vatNumber) {
      changedFields.push('vatNumber');
    }
    if ('taxCode' in patch && current.taxCode !== updated.taxCode) {
      changedFields.push('taxCode');
    }
    if ('notes' in patch && current.notes !== updated.notes) {
      changedFields.push('notes');
    }
    if ('tags' in patch && !arraysAreEqual(current.tags, updated.tags)) {
      changedFields.push('tags');
    }
    if ('street' in patch && current.street !== updated.street) {
      changedFields.push('address.street');
    }
    if ('city' in patch && current.city !== updated.city) {
      changedFields.push('address.city');
    }
    if ('zip' in patch && current.zip !== updated.zip) {
      changedFields.push('address.zip');
    }
    if ('province' in patch && current.province !== updated.province) {
      changedFields.push('address.province');
    }
    if ('country' in patch && current.country !== updated.country) {
      changedFields.push('address.country');
    }

    await audit.log({
      event: 'clients.update',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Client',
      entityId: updated.id,
      metadata: {
        clientId: updated.id,
        fieldsUpdated: sortUniqueFields(changedFields),
      },
      request: input.request,
    });

    return mapClient(updated);
  },

  async deleteClient(input: {
    workspaceId: string;
    clientId: string;
    actorUserId: string;
    request: FastifyRequest;
  }) {
    const client = await this.requireClient(input.workspaceId, input.clientId);
    const deleted = await clientsRepository.delete(input.workspaceId, client.id);
    if (deleted.count === 0) {
      throw notFound('Client not found');
    }

    await audit.log({
      event: 'clients.delete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Client',
      entityId: client.id,
      metadata: {
        clientId: client.id,
        fieldsUpdated: ['deleted'],
      },
      request: input.request,
    });
  },
};
