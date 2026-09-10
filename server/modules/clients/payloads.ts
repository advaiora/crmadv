import { badRequest } from '../../core/errors.js';
import {
  CLIENT_BODY_FIELDS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  MAX_TAX_CODE_LENGTH,
  MAX_VAT_LENGTH,
  MIN_PAGE_SIZE,
  SORT_FIELDS,
} from './constants.js';
import { mapSortToken } from './mapper.js';
import type { ClientSortDirection, ClientSortField } from './repository.js';
import type { ClientListFilters, ClientPatchPayload, ClientWritePayload } from './types.js';
import {
  assertNoUnknownFields,
  isObject,
  normalizeEmail,
  normalizeOptionalString,
  normalizePhoneForStorage,
  normalizeRequiredString,
  normalizeTags,
  parseAddressCreate,
  parseAddressPatch,
  parseClientType,
  parseOptionalClientTypeFilter,
  parsePageNumber,
} from './validation.js';

export const parseListFilters = (query: unknown): ClientListFilters => {
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
};

export const parseCreatePayload = (body: unknown): ClientWritePayload => {
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
};

export const parsePatchPayload = (body: unknown): ClientPatchPayload => {
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
};

export const parseClientId = (rawId: string) => {
  const normalizedId = rawId?.trim();
  if (!normalizedId) {
    throw badRequest('Client id is required');
  }

  return normalizedId;
};

export const parseExportFilters = (query: unknown) => {
  const parsed = parseListFilters(query);

  return {
    query: parsed.query,
    type: parsed.type,
    sortField: parsed.sortField,
    sortDirection: parsed.sortDirection,
    sort: parsed.sort,
  };
};
