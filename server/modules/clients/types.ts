import type { ClientType } from '@prisma/client';
import type { AddressField, CsvHeaderColumn } from './constants.js';
import type { clientsRepository, ClientSortDirection, ClientSortField } from './repository.js';

export type ClientListFilters = {
  query?: string;
  type?: ClientType;
  page: number;
  pageSize: number;
  sortField: ClientSortField;
  sortDirection: ClientSortDirection;
  sort: string;
};

export type ClientAddress = Record<AddressField, string | null>;

export type ClientWritePayload = {
  type: ClientType;
  name: string;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  taxCode: string | null;
  notes: string | null;
  tags: string[];
} & ClientAddress;

export type ClientPatchPayload = Partial<ClientWritePayload>;

export type ClientImportError = {
  row: number;
  message: string;
};

export type ClientImportRow = {
  row: number;
  payload: ClientWritePayload;
  customFields: Record<string, string | number | boolean>;
};

export type CsvImportHeaderCell = {
  raw: string;
  canonical: CsvHeaderColumn | null;
  // Valorizzato per le colonne "cf:<chiave>" dei campi personalizzati.
  customFieldKey?: string | null;
};

// Colonna custom field pronta per l'export: chiave + intestazione CSV.
export type ExportCustomFieldColumn = {
  key: string;
  header: string;
};

export type ClientRecord = NonNullable<Awaited<ReturnType<typeof clientsRepository.findById>>>;
export type ClientProjectRecord = Awaited<
  ReturnType<typeof clientsRepository.listProjectsByClient>
>[number];

export type MapClientOptions = {
  includeProjects?: boolean;
  projects?: ClientProjectRecord[];
};
