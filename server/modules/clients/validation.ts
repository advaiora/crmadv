import type { ClientType } from '@prisma/client';
import { badRequest } from '../../core/errors.js';
import { validateAndNormalizePhone } from '../../../core/utils/phone.js';
import { buildPhoneFieldSchema, PHONE_INVALID_MESSAGE } from './clients.schema.js';
import {
  ADDRESS_FIELDS,
  EMAIL_REGEX,
  MAX_ADDRESS_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_ZIP_LENGTH,
  type AddressField,
  type ClientBodyField,
} from './constants.js';
import type { ClientAddress } from './types.js';

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const assertNoUnknownFields = (
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

export const normalizeOptionalString = (
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

export const normalizeRequiredString = (
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

export const parsePageNumber = (value: unknown, fieldName: string, fallback: number) => {
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

export const parseClientType = (
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

export const normalizeEmail = (value: unknown, fieldName: string) => {
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

export const normalizePhoneForStorage = (phone: string | null, country?: string | null) => {
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

export const normalizeTags = (value: unknown, fieldName: string) => {
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

export const parseAddressCreate = (value: unknown): ClientAddress => {
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

export const parseAddressPatch = (value: unknown): Partial<ClientAddress> => {
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

export const parseOptionalClientTypeFilter = (value: unknown): ClientType | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value !== 'person' && value !== 'company') {
    throw badRequest('type must be person or company');
  }

  return value;
};
