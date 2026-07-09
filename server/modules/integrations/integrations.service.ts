import type { FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { audit } from '../../audit/audit.js';
import { badRequest, notFound } from '../../core/errors.js';
import { clientsRepository } from '../clients/repository.js';
import { brevoConnector } from './connectors/brevo.js';
import { integrationsCrypto } from './integrations.crypto.js';
import { integrationsRepository, type IntegrationRecord } from './integrations.repository.js';

// Provider supportati dal layer integrazioni. Per ora solo Brevo; la struttura
// è pronta ad accoglierne altri (Fatture in Cloud, Zoom, …) in futuro.
export const INTEGRATION_PROVIDERS = ['brevo'] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

// Quanti errori per-contatto conservare nel report di sync (evita payload enormi).
const MAX_SYNC_ERRORS = 50;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeProvider = (value: unknown): IntegrationProvider => {
  if (typeof value !== 'string' || !INTEGRATION_PROVIDERS.includes(value as IntegrationProvider)) {
    throw badRequest('Provider di integrazione non valido', { allowed: INTEGRATION_PROVIDERS });
  }
  return value as IntegrationProvider;
};

type BrevoConfig = { listId: number | null };

const parseBrevoConfig = (value: unknown): BrevoConfig => {
  const config = value ?? {};
  if (!isObject(config)) {
    return { listId: null };
  }
  const raw = config.listId;
  if (raw === undefined || raw === null || raw === '') {
    return { listId: null };
  }
  const listId = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(listId) || listId <= 0) {
    return { listId: null };
  }
  return { listId };
};

// Vista pubblica di un'integrazione: MAI espone il segreto, solo se è presente.
const serializeIntegration = (record: NonNullable<IntegrationRecord>) => ({
  provider: record.provider,
  enabled: record.enabled,
  hasApiKey: Boolean(record.ciphertext),
  config: parseBrevoConfig(record.configJson),
  lastSyncAt: record.lastSyncAt,
  lastSyncStatus: record.lastSyncStatus,
  lastSyncMessage: record.lastSyncMessage,
  lastSyncStats: record.lastSyncStats ?? null,
  updatedAt: record.updatedAt,
});

// Divide il nome del cliente in nome/cognome per gli attributi Brevo. Per le
// aziende (o nomi con una sola parola) il valore intero finisce nel nome.
const splitName = (name: string): { firstName: string; lastName: string | null } => {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: name.trim(), lastName: null };
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
};

const requireApiKey = async (record: NonNullable<IntegrationRecord>): Promise<string> => {
  const apiKey = await integrationsCrypto.decrypt({
    workspaceId: record.workspaceId,
    provider: record.provider,
    ciphertext: record.ciphertext,
    iv: record.iv,
    authTag: record.authTag,
    keyVersion: record.keyVersion,
  });
  if (!apiKey) {
    throw badRequest('Chiave API non configurata per questa integrazione');
  }
  return apiKey;
};

export const integrationsService = {
  parseProvider: normalizeProvider,

  async listIntegrations(workspaceId: string) {
    const records = await integrationsRepository.list(workspaceId);
    return records.map((record) => serializeIntegration(record));
  },

  async getIntegration(workspaceId: string, providerInput: unknown) {
    const provider = normalizeProvider(providerInput);
    const record = await integrationsRepository.findByProvider(workspaceId, provider);
    return record ? serializeIntegration(record) : null;
  },

  // Crea/aggiorna la configurazione di un provider. La chiave API è opzionale:
  // se assente si conserva quella già salvata; se presente viene cifrata.
  async saveIntegration(input: {
    workspaceId: string;
    providerInput: unknown;
    actorUserId: string;
    body: unknown;
    request: FastifyRequest;
  }) {
    const provider = normalizeProvider(input.providerInput);
    if (!isObject(input.body)) {
      throw badRequest('Body must be a JSON object');
    }

    const existing = await integrationsRepository.findByProvider(input.workspaceId, provider);

    // Chiave API: accetta solo stringa non vuota; stringa vuota = "non cambiare".
    let secret: Awaited<ReturnType<typeof integrationsCrypto.encrypt>> | undefined;
    const rawApiKey = input.body.apiKey;
    let apiKeyChanged = false;
    if (rawApiKey !== undefined && rawApiKey !== null && rawApiKey !== '') {
      if (typeof rawApiKey !== 'string') {
        throw badRequest('apiKey deve essere una stringa');
      }
      secret = await integrationsCrypto.encrypt({
        workspaceId: input.workspaceId,
        provider,
        value: rawApiKey.trim(),
      });
      apiKeyChanged = true;
    }

    const willHaveKey = apiKeyChanged || Boolean(existing?.ciphertext);

    // enabled opzionale; non si può abilitare senza una chiave API.
    let enabled: boolean | undefined;
    if (input.body.enabled !== undefined) {
      if (typeof input.body.enabled !== 'boolean') {
        throw badRequest('enabled deve essere un booleano');
      }
      if (input.body.enabled && !willHaveKey) {
        throw badRequest('Configura prima una chiave API per abilitare l\'integrazione');
      }
      enabled = input.body.enabled;
    }

    // config: per ora solo listId (opzionale) per Brevo.
    let configJson: Prisma.InputJsonValue | undefined;
    if ('listId' in input.body) {
      configJson = parseBrevoConfig(input.body) as unknown as Prisma.InputJsonValue;
    }

    const saved = await integrationsRepository.upsert({
      workspaceId: input.workspaceId,
      provider,
      enabled,
      configJson,
      secret,
    });

    await audit.log({
      event: 'integrations.save',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Integration',
      entityId: saved.id,
      metadata: {
        provider,
        apiKeyChanged,
        enabled: saved.enabled,
      },
      request: input.request,
    });

    return serializeIntegration(saved);
  },

  // Verifica la connessione col provider usando la chiave salvata.
  async testConnection(workspaceId: string, providerInput: unknown) {
    const provider = normalizeProvider(providerInput);
    const record = await integrationsRepository.findByProvider(workspaceId, provider);
    if (!record) {
      throw notFound('Integrazione non configurata');
    }
    const apiKey = await requireApiKey(record);
    const result = await brevoConnector.testConnection(apiKey);
    return result;
  },

  // Sincronizza i clienti del workspace verso il provider come contatti.
  // Solo i clienti con email vengono inviati. Un errore su un contatto non
  // interrompe gli altri; il report riepiloga esiti ed errori.
  async syncClients(input: {
    workspaceId: string;
    providerInput: unknown;
    actorUserId: string;
    request: FastifyRequest;
    now: Date;
  }) {
    const provider = normalizeProvider(input.providerInput);
    const record = await integrationsRepository.findByProvider(input.workspaceId, provider);
    if (!record) {
      throw notFound('Integrazione non configurata');
    }
    if (!record.enabled) {
      throw badRequest('Integrazione non abilitata');
    }
    const apiKey = await requireApiKey(record);
    const config = parseBrevoConfig(record.configJson);
    const listIds = config.listId ? [config.listId] : undefined;

    const clients = await clientsRepository.listForExport({
      workspaceId: input.workspaceId,
      sortField: 'name',
      sortDirection: 'asc',
    });

    const eligible = clients.filter((client) => Boolean(client.email));
    const errors: Array<{ clientId: string; email: string; message: string }> = [];
    let synced = 0;

    for (const client of eligible) {
      const { firstName, lastName } = splitName(client.name);
      try {
        await brevoConnector.upsertContact(apiKey, {
          email: client.email as string,
          firstName,
          lastName,
          phone: client.phone,
          listIds,
        });
        synced += 1;
      } catch (error) {
        if (errors.length < MAX_SYNC_ERRORS) {
          errors.push({
            clientId: client.id,
            email: client.email as string,
            message: error instanceof Error ? error.message : 'Errore sconosciuto',
          });
        }
      }
    }

    const failed = eligible.length - synced;
    const stats = {
      totalClients: clients.length,
      eligible: eligible.length,
      skippedNoEmail: clients.length - eligible.length,
      synced,
      failed,
      errors,
    };
    const status = failed === 0 ? 'success' : synced === 0 ? 'error' : 'partial';
    const message =
      failed === 0
        ? `${synced} contatti sincronizzati`
        : `${synced} sincronizzati, ${failed} falliti`;

    await integrationsRepository.recordSyncOutcome({
      workspaceId: input.workspaceId,
      provider,
      status,
      message,
      stats: stats as unknown as Prisma.InputJsonValue,
      syncedAt: input.now,
    });

    await audit.log({
      event: 'integrations.sync',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Integration',
      entityId: record.id,
      metadata: {
        provider,
        synced,
        failed,
        eligible: eligible.length,
      },
      request: input.request,
    });

    return { status, message, stats };
  },

  async deleteIntegration(input: {
    workspaceId: string;
    providerInput: unknown;
    actorUserId: string;
    request: FastifyRequest;
  }) {
    const provider = normalizeProvider(input.providerInput);
    const deleted = await integrationsRepository.delete(input.workspaceId, provider);
    if (deleted.count === 0) {
      throw notFound('Integrazione non configurata');
    }

    await audit.log({
      event: 'integrations.delete',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Integration',
      metadata: { provider },
      request: input.request,
    });
  },
};
