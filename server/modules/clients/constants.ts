import type { ClientSortField } from './repository.js';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MIN_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_LENGTH = 120;
export const MAX_NAME_LENGTH = 160;
export const MAX_EMAIL_LENGTH = 320;
export const MAX_VAT_LENGTH = 40;
export const MAX_TAX_CODE_LENGTH = 40;
export const MAX_ADDRESS_LENGTH = 120;
export const MAX_ZIP_LENGTH = 20;
export const MAX_NOTES_LENGTH = 4000;
export const MAX_TAGS = 30;
export const MAX_TAG_LENGTH = 40;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SORT_FIELDS: ClientSortField[] = ['name', 'createdAt', 'updatedAt'];
export const CSV_HEADER_COLUMNS = [
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
export const MAX_IMPORT_ERRORS = 100;
export const TAG_CELL_SEPARATOR = '|';
// Prefisso delle colonne CSV dedicate ai campi personalizzati: es. "cf:budget".
// Il prefisso evita collisioni con le colonne standard e i loro alias.
export const CUSTOM_FIELD_CSV_PREFIX = 'cf:';

export const ADDRESS_FIELDS = ['street', 'city', 'zip', 'province', 'country'] as const;
export const CLIENT_BODY_FIELDS = [
  'type',
  'name',
  'email',
  'phone',
  'vatNumber',
  'taxCode',
  'address',
  'notes',
  'tags',
  'customFields',
] as const;

export const CSV_IMPORT_IGNORED_HEADERS = new Set(['id', 'status', 'stato']);
export const CSV_IMPORT_HEADER_ALIAS_MAP: Record<string, CsvHeaderColumn> = {
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

export type AddressField = (typeof ADDRESS_FIELDS)[number];
export type ClientBodyField = (typeof CLIENT_BODY_FIELDS)[number];
export type CsvHeaderColumn = (typeof CSV_HEADER_COLUMNS)[number];
