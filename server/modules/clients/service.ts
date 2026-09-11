import type { FastifyRequest } from 'fastify';
import { audit } from '../../audit/audit.js';
import { badRequest, notFound } from '../../core/errors.js';
import { customFieldsService } from '../custom-fields/custom-fields.service.js';
import type { ClientImportUpload } from './import-file.js';
import { arraysAreEqual, mapClient, sortUniqueFields } from './mapper.js';
import {
  parseClientId,
  parseCreatePayload,
  parseExportFilters,
  parseListFilters,
  parsePatchPayload,
} from './payloads.js';
import { clientsRepository } from './repository.js';
import { clientsTransferService } from './transfer.service.js';
import type { ClientPatchPayload } from './types.js';
import { isObject, normalizePhoneForStorage } from './validation.js';

export const clientsService = {
  // I parser restano esposti qui perche' erano parte della superficie del
  // servizio prima della spezzatura: vivono in payloads.ts, questi sono ponti.
  parseListFilters,
  parseCreatePayload,
  parsePatchPayload,
  parseClientId,
  parseExportFilters,

  async requireClient(workspaceId: string, rawClientId: string) {
    const clientId = parseClientId(rawClientId);
    const client = await clientsRepository.findById(workspaceId, clientId);
    if (!client) {
      throw notFound('Client not found');
    }

    return client;
  },

  async listClients(workspaceId: string, query: unknown) {
    const filters = parseListFilters(query);
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

  async exportClientsCsv(workspaceId: string, query: unknown) {
    return clientsTransferService.exportClientsCsv(workspaceId, query);
  },

  async importClientsFromCsv(input: {
    workspaceId: string;
    actorUserId: string;
    request: FastifyRequest;
    upload?: ClientImportUpload;
    body?: unknown;
  }) {
    return clientsTransferService.importClientsFromCsv(input);
  },

  async createClient(input: {
    workspaceId: string;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const payload = parseCreatePayload(input.body);
    // Valida i valori dei campi personalizzati contro le definizioni del workspace.
    const rawCustomFields = isObject(input.body) ? input.body.customFields : undefined;
    const customFields = await customFieldsService.validateValues(
      input.workspaceId,
      'client',
      rawCustomFields,
      { enforceRequired: true },
    );
    const created = await clientsRepository.create(input.workspaceId, { ...payload, customFields });

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

    const body = isObject(input.body) ? input.body : {};
    const hasCustomFields = 'customFields' in body;
    const hasScalarFields = Object.keys(body).some((key) => key !== 'customFields');

    // Campi scalari (se il body contiene solo customFields, il patch scalare è vuoto).
    const patch: ClientPatchPayload = hasScalarFields ? parsePatchPayload(input.body) : {};
    if ('phone' in patch && patch.phone) {
      const countryForPhone =
        typeof patch.country === 'string' || patch.country === null
          ? patch.country
          : current.country;
      patch.phone = normalizePhoneForStorage(patch.phone, countryForPhone);
    }

    // Valori dei campi personalizzati, validati contro le definizioni attive.
    const customFields = hasCustomFields
      ? await customFieldsService.validateValues(input.workspaceId, 'client', body.customFields, {
          enforceRequired: true,
        })
      : undefined;

    if (!hasScalarFields && !hasCustomFields) {
      throw badRequest('At least one field is required');
    }

    const updated = await clientsRepository.update(
      input.workspaceId,
      parseClientId(input.clientId),
      { ...patch, ...(customFields !== undefined ? { customFields } : {}) },
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
    if (
      hasCustomFields &&
      JSON.stringify(current.customFields ?? {}) !== JSON.stringify(updated.customFields ?? {})
    ) {
      changedFields.push('customFields');
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

  /**
   * Sposta il cliente nel cestino (CRMA-165).
   *
   * Il nome del metodo, la rotta e il permesso (`clients.delete`) restano
   * quelli di prima ed e' voluto: per chi usa il CRM il gesto e' lo stesso —
   * cambia cosa succede al database, non chi puo' premere. Il permesso nuovo
   * sarebbe stato un allargamento travestito da rifattorizzazione.
   *
   * L'evento del registro attivita' resta `clients.delete` per la stessa
   * ragione; a cambiare e' `fieldsUpdated`, che ora dice quali colonne sono
   * state scritte invece dell'etichetta generica `deleted`.
   */
  async deleteClient(input: {
    workspaceId: string;
    clientId: string;
    actorUserId: string;
    request: FastifyRequest;
  }) {
    const client = await this.requireClient(input.workspaceId, input.clientId);
    const trashed = await clientsRepository.markTrashed(
      input.workspaceId,
      client.id,
      input.actorUserId,
    );
    if (trashed.count === 0) {
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
        fieldsUpdated: ['deletedAt', 'deletedByUserId'],
      },
      request: input.request,
    });
  },
};
