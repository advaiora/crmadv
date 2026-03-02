import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { badRequest, notFound } from '../../core/errors.js';
import { auditVaultReveal, logVaultAuditEvent, VaultAuditActions } from './audit.js';
import { decryptAESGCM, encryptAESGCM } from './crypto/aesGcm.js';
import { getOrCreateWorkspaceDEK } from './keys.js';
import { vaultRepo } from './repo.js';
import type { VaultItemEncryptedPayload, VaultSecretPayload } from './types.js';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;
const MAX_NAME_LENGTH = 255;
const MAX_USERNAME_LENGTH = 255;
const MAX_URL_LENGTH = 2048;
const MAX_TAG_LENGTH = 64;
const MAX_TAG_COUNT = 30;
const MAX_PASSWORD_LENGTH = 4096;
const MAX_NOTES_LENGTH = 10000;
const MAX_EXTRA_KEY_COUNT = 50;
const MAX_EXTRA_KEY_LENGTH = 120;
const VAULT_SECRET_PAYLOAD_VERSION = 1;

type VaultListQuery = {
  search?: string;
  tag?: string;
  limit: number;
  cursor?: string;
};

type ParsedCreatePayload = {
  name: string;
  username: string | null;
  url: string | null;
  tags: string[];
  password: string;
  notes: string | null;
  extra: Record<string, unknown> | null;
};

type ParsedUpdatePayload = {
  name?: string;
  username?: string | null;
  url?: string | null;
  tags?: string[];
  password?: string;
  notes?: string | null;
  extra?: Record<string, unknown> | null;
};

const nullableTrimmedStringForCreate = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined || value === null) {
        return null;
      }

      return value.length > 0 ? value : null;
    });

const nullableTrimmedStringForUpdate = (maxLength: number) =>
  z
    .union([z.string().max(maxLength), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    });

const normalizeSecretExtra = (
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const entries = Object.entries(value);
  if (entries.length > MAX_EXTRA_KEY_COUNT) {
    throw badRequest('Invalid vault item payload');
  }

  const normalized: Record<string, unknown> = {};
  for (const [rawKey, nestedValue] of entries) {
    const key = rawKey.trim();
    if (key.length === 0 || key.length > MAX_EXTRA_KEY_LENGTH) {
      throw badRequest('Invalid vault item payload');
    }

    normalized[key] = nestedValue;
  }

  return normalized;
};

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(MAX_TAG_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
  cursor: z.string().trim().min(1).max(191).optional(),
});

const createPayloadSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  username: nullableTrimmedStringForCreate(MAX_USERNAME_LENGTH),
  url: nullableTrimmedStringForCreate(MAX_URL_LENGTH),
  tags: z
    .array(z.string().trim().min(1).max(MAX_TAG_LENGTH))
    .max(MAX_TAG_COUNT)
    .optional()
    .default([]),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  notes: z.string().max(MAX_NOTES_LENGTH).nullable().optional(),
  extra: z.record(z.string(), z.unknown()).nullable().optional(),
});

const updatePayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
    username: nullableTrimmedStringForUpdate(MAX_USERNAME_LENGTH),
    url: nullableTrimmedStringForUpdate(MAX_URL_LENGTH),
    tags: z.array(z.string().trim().min(1).max(MAX_TAG_LENGTH)).max(MAX_TAG_COUNT).optional(),
    password: z.string().min(1).max(MAX_PASSWORD_LENGTH).optional(),
    notes: z.string().max(MAX_NOTES_LENGTH).nullable().optional(),
    extra: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasMetadataChange =
      value.name !== undefined
      || value.username !== undefined
      || value.url !== undefined
      || value.tags !== undefined;

    const hasSecretChange =
      value.password !== undefined
      || value.notes !== undefined
      || value.extra !== undefined;

    if (!hasMetadataChange && !hasSecretChange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required',
      });
      return;
    }

    if (hasSecretChange && value.password === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'password is required when updating secret payload',
      });
    }
  });

const revealSecretPayloadSchema = z.object({
  password: z.string().min(1),
  notes: z.string().nullable().optional(),
  extra: z.record(z.string(), z.unknown()).nullable().optional(),
});

const parseWithSchema = <T>(schema: z.ZodType<T>, input: unknown, errorMessage: string): T => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw badRequest(errorMessage, {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const toSecretPayloadBuffer = (payload: VaultSecretPayload): Buffer =>
  Buffer.from(JSON.stringify(payload), 'utf8');

const buildVaultItemAAD = (workspaceId: string, vaultItemId: string): Buffer =>
  Buffer.from(`vault:v1|workspace:${workspaceId}|item:${vaultItemId}`, 'utf8');

const parseVaultListQuery = (query: unknown): VaultListQuery => {
  const parsed = parseWithSchema(listQuerySchema, query ?? {}, 'Invalid vault list query');
  return {
    search: parsed.search?.trim() || undefined,
    tag: parsed.tag?.trim() || undefined,
    limit: parsed.limit ?? DEFAULT_LIST_LIMIT,
    cursor: parsed.cursor?.trim() || undefined,
  };
};

const parseVaultCreatePayload = (payload: unknown): ParsedCreatePayload => {
  const parsed = parseWithSchema(createPayloadSchema, payload ?? {}, 'Invalid vault item payload');
  return {
    name: parsed.name,
    username: parsed.username,
    url: parsed.url,
    tags: parsed.tags,
    password: parsed.password,
    notes: parsed.notes ?? null,
    extra: normalizeSecretExtra(parsed.extra) ?? null,
  };
};

const parseVaultUpdatePayload = (payload: unknown): ParsedUpdatePayload => {
  const parsed = parseWithSchema(updatePayloadSchema, payload ?? {}, 'Invalid vault update payload');

  return {
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    ...(parsed.username !== undefined ? { username: parsed.username } : {}),
    ...(parsed.url !== undefined ? { url: parsed.url } : {}),
    ...(parsed.tags !== undefined ? { tags: parsed.tags } : {}),
    ...(parsed.password !== undefined ? { password: parsed.password } : {}),
    ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
    ...(parsed.extra !== undefined ? { extra: normalizeSecretExtra(parsed.extra) ?? null } : {}),
  };
};

type VaultServiceDependencies = {
  vaultRepoApi: typeof vaultRepo;
  getWorkspaceDekFn: typeof getOrCreateWorkspaceDEK;
  encryptFn: typeof encryptAESGCM;
  decryptFn: typeof decryptAESGCM;
  logAuditFn: typeof logVaultAuditEvent;
  auditRevealFn: typeof auditVaultReveal;
  createIdFn: () => string;
};

const defaultDependencies: VaultServiceDependencies = {
  vaultRepoApi: vaultRepo,
  getWorkspaceDekFn: getOrCreateWorkspaceDEK,
  encryptFn: encryptAESGCM,
  decryptFn: decryptAESGCM,
  logAuditFn: logVaultAuditEvent,
  auditRevealFn: auditVaultReveal,
  createIdFn: randomUUID,
};

export const buildVaultService = (dependencies: VaultServiceDependencies = defaultDependencies) => {
  const encryptSecretPayload = async (input: {
    workspaceId: string;
    vaultItemId: string;
    payload: VaultSecretPayload;
  }): Promise<VaultItemEncryptedPayload> => {
    const workspaceDEK = await dependencies.getWorkspaceDekFn(input.workspaceId);
    const encrypted = dependencies.encryptFn({
      key: workspaceDEK,
      plaintext: toSecretPayloadBuffer(input.payload),
      aad: buildVaultItemAAD(input.workspaceId, input.vaultItemId),
    });

    return {
      ciphertext: encrypted.ciphertext.toString('base64'),
      iv: encrypted.iv.toString('base64'),
      authTag: encrypted.authTag.toString('base64'),
      version: VAULT_SECRET_PAYLOAD_VERSION,
    };
  };

  const decryptSecretPayload = async (input: {
    workspaceId: string;
    vaultItemId: string;
    ciphertext: string;
    iv: string;
    authTag: string;
  }): Promise<VaultSecretPayload> => {
    const workspaceDEK = await dependencies.getWorkspaceDekFn(input.workspaceId);

    let plaintext: Buffer;
    try {
      plaintext = dependencies.decryptFn({
        key: workspaceDEK,
        ciphertext: Buffer.from(input.ciphertext, 'base64'),
        iv: Buffer.from(input.iv, 'base64'),
        authTag: Buffer.from(input.authTag, 'base64'),
        aad: buildVaultItemAAD(input.workspaceId, input.vaultItemId),
      });
    } catch {
      throw badRequest('Invalid vault payload');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(plaintext.toString('utf8'));
    } catch {
      throw badRequest('Invalid vault payload');
    }

    const parsed = revealSecretPayloadSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw badRequest('Invalid vault payload');
    }

    return {
      password: parsed.data.password,
      notes: parsed.data.notes ?? null,
      extra: normalizeSecretExtra(parsed.data.extra) ?? null,
    };
  };

  return {
    parseListQuery(query: unknown): VaultListQuery {
      return parseVaultListQuery(query);
    },

    parseCreatePayload(payload: unknown): ParsedCreatePayload {
      return parseVaultCreatePayload(payload);
    },

    parseUpdatePayload(payload: unknown): ParsedUpdatePayload {
      return parseVaultUpdatePayload(payload);
    },

    async listVaultItems(workspaceId: string, query: unknown) {
      const parsedQuery = parseVaultListQuery(query);
      return dependencies.vaultRepoApi.listVaultItems(workspaceId, parsedQuery);
    },

    async createVaultItem(input: {
      workspaceId: string;
      actorUserId: string;
      body: unknown;
      request?: FastifyRequest;
    }) {
      const payload = parseVaultCreatePayload(input.body);
      const vaultItemId = dependencies.createIdFn();

      const encryptedPayload = await encryptSecretPayload({
        workspaceId: input.workspaceId,
        vaultItemId,
        payload: {
          password: payload.password,
          notes: payload.notes,
          extra: payload.extra,
        },
      });

      const created = await dependencies.vaultRepoApi.createVaultItem(input.workspaceId, {
        id: vaultItemId,
        name: payload.name,
        username: payload.username,
        url: payload.url,
        tags: payload.tags,
        payload: encryptedPayload,
        actorUserId: input.actorUserId,
      });

      await dependencies.logAuditFn({
        action: VaultAuditActions.create,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        vaultItemId: created.id,
        metadata: {
          name: created.name,
        },
        request: input.request,
      });

      return created;
    },

    async updateVaultItem(input: {
      workspaceId: string;
      actorUserId: string;
      vaultItemId: string;
      body: unknown;
      request?: FastifyRequest;
    }) {
      const payload = parseVaultUpdatePayload(input.body);

      const hasSecretPayload =
        payload.password !== undefined
        || payload.notes !== undefined
        || payload.extra !== undefined;

      const encryptedPayload = hasSecretPayload
        ? await encryptSecretPayload({
          workspaceId: input.workspaceId,
          vaultItemId: input.vaultItemId,
          payload: {
            password: payload.password as string,
            notes: payload.notes ?? null,
            extra: payload.extra ?? null,
          },
        })
        : undefined;

      const updated = await dependencies.vaultRepoApi.updateVaultItem(input.workspaceId, input.vaultItemId, {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.username !== undefined ? { username: payload.username } : {}),
        ...(payload.url !== undefined ? { url: payload.url } : {}),
        ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
        ...(encryptedPayload ? { payload: encryptedPayload } : {}),
        actorUserId: input.actorUserId,
      });

      if (!updated) {
        throw notFound('Vault item not found');
      }

      await dependencies.logAuditFn({
        action: VaultAuditActions.edit,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        vaultItemId: updated.id,
        metadata: {
          name: updated.name,
        },
        request: input.request,
      });

      return updated;
    },

    async revealVaultItem(input: {
      workspaceId: string;
      actorUserId: string;
      vaultItemId: string;
      request?: FastifyRequest;
    }) {
      // TODO(vault-phase-4): enforce requireStepUp() before revealing decrypted payloads.
      const item = await dependencies.vaultRepoApi.getVaultItemById(input.workspaceId, input.vaultItemId);
      if (!item) {
        throw notFound('Vault item not found');
      }

      if (item.version !== VAULT_SECRET_PAYLOAD_VERSION) {
        throw badRequest('Invalid vault payload');
      }

      const secret = await decryptSecretPayload({
        workspaceId: input.workspaceId,
        vaultItemId: item.id,
        ciphertext: item.ciphertext,
        iv: item.iv,
        authTag: item.authTag,
      });

      await dependencies.auditRevealFn({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        vaultItemId: item.id,
        request: input.request,
        metadata: {
          name: item.name,
        },
      });

      return {
        id: item.id,
        password: secret.password,
        notes: secret.notes,
        extra: secret.extra,
      };
    },

    async deleteVaultItem(input: {
      workspaceId: string;
      actorUserId: string;
      vaultItemId: string;
      request?: FastifyRequest;
    }) {
      const existing = await dependencies.vaultRepoApi.getVaultItemById(input.workspaceId, input.vaultItemId);
      if (!existing) {
        throw notFound('Vault item not found');
      }

      const deleted = await dependencies.vaultRepoApi.deleteVaultItem(input.workspaceId, input.vaultItemId);
      if (!deleted) {
        throw notFound('Vault item not found');
      }

      await dependencies.logAuditFn({
        action: VaultAuditActions.delete,
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        vaultItemId: input.vaultItemId,
        metadata: {
          name: existing.name,
        },
        request: input.request,
      });
    },
  };
};

export const vaultService = buildVaultService();
