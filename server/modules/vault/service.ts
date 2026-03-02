import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { badRequest, notFound } from '../../core/errors.js';
import { getOrCreateWorkspaceVaultKeyRecord } from './keys.js';
import { logVaultAuditEvent, VaultAuditActions } from './audit.js';
import { vaultRepo } from './repo.js';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;
const MAX_NAME_LENGTH = 255;
const MAX_USERNAME_LENGTH = 255;
const MAX_URL_LENGTH = 2048;
const MAX_TAG_LENGTH = 64;
const MAX_TAG_COUNT = 30;
const MAX_CIPHERTEXT_LENGTH = 32768;
const MAX_IV_LENGTH = 255;
const MAX_AUTH_TAG_LENGTH = 255;

const nullableTrimmedString = (maxLength: number) =>
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

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(MAX_TAG_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
  cursor: z.string().trim().min(1).max(191).optional(),
});

const encryptedPayloadSchema = z.object({
  // TODO(vault-phase-3): validate AES-256-GCM payload contract generated server-side.
  ciphertext: z.string().trim().min(1).max(MAX_CIPHERTEXT_LENGTH),
  iv: z.string().trim().min(1).max(MAX_IV_LENGTH),
  authTag: z.string().trim().min(1).max(MAX_AUTH_TAG_LENGTH),
  version: z.coerce.number().int().min(1).default(1),
});

const createPayloadSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  username: nullableTrimmedString(MAX_USERNAME_LENGTH),
  url: nullableTrimmedString(MAX_URL_LENGTH),
  tags: z
    .array(z.string().trim().min(1).max(MAX_TAG_LENGTH))
    .max(MAX_TAG_COUNT)
    .optional()
    .default([]),
  ...encryptedPayloadSchema.shape,
});

const updatePayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
    username: nullableTrimmedString(MAX_USERNAME_LENGTH),
    url: nullableTrimmedString(MAX_URL_LENGTH),
    tags: z.array(z.string().trim().min(1).max(MAX_TAG_LENGTH)).max(MAX_TAG_COUNT).optional(),
    ciphertext: z.string().trim().min(1).max(MAX_CIPHERTEXT_LENGTH).optional(),
    iv: z.string().trim().min(1).max(MAX_IV_LENGTH).optional(),
    authTag: z.string().trim().min(1).max(MAX_AUTH_TAG_LENGTH).optional(),
    version: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasMetadataChange =
      value.name !== undefined ||
      value.username !== undefined ||
      value.url !== undefined ||
      value.tags !== undefined;
    const hasEncryptedChange =
      value.ciphertext !== undefined ||
      value.iv !== undefined ||
      value.authTag !== undefined ||
      value.version !== undefined;

    if (!hasMetadataChange && !hasEncryptedChange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required',
      });
      return;
    }

    const encryptedParts = [value.ciphertext, value.iv, value.authTag].filter(
      (item) => item !== undefined,
    ).length;

    if (encryptedParts > 0 && encryptedParts < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ciphertext, iv and authTag must be provided together',
      });
    }

    if (value.version !== undefined && encryptedParts === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'version requires ciphertext, iv and authTag',
      });
    }
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

export const vaultService = {
  parseListQuery(query: unknown) {
    const parsed = parseWithSchema(listQuerySchema, query ?? {}, 'Invalid vault list query');
    return {
      search: parsed.search?.trim() || undefined,
      tag: parsed.tag?.trim() || undefined,
      limit: parsed.limit ?? DEFAULT_LIST_LIMIT,
      cursor: parsed.cursor?.trim() || undefined,
    };
  },

  parseCreatePayload(payload: unknown) {
    return parseWithSchema(createPayloadSchema, payload ?? {}, 'Invalid vault item payload');
  },

  parseUpdatePayload(payload: unknown) {
    return parseWithSchema(updatePayloadSchema, payload ?? {}, 'Invalid vault update payload');
  },

  async listVaultItems(workspaceId: string, query: unknown) {
    const parsedQuery = this.parseListQuery(query);
    return vaultRepo.listVaultItems(workspaceId, parsedQuery);
  },

  async createVaultItem(input: {
    workspaceId: string;
    actorUserId: string;
    body: unknown;
    request?: FastifyRequest;
  }) {
    const payload = this.parseCreatePayload(input.body);

    // TODO(vault-phase-3): use workspace key for AES-256-GCM encryption/decryption flow.
    await getOrCreateWorkspaceVaultKeyRecord(input.workspaceId);

    const created = await vaultRepo.createVaultItem(input.workspaceId, {
      name: payload.name,
      username: payload.username,
      url: payload.url,
      tags: payload.tags,
      payload: {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        authTag: payload.authTag,
        version: payload.version,
      },
      actorUserId: input.actorUserId,
    });

    await logVaultAuditEvent({
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
    const payload = this.parseUpdatePayload(input.body);

    const updated = await vaultRepo.updateVaultItem(input.workspaceId, input.vaultItemId, {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.username !== undefined ? { username: payload.username } : {}),
      ...(payload.url !== undefined ? { url: payload.url } : {}),
      ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
      ...(
        payload.ciphertext !== undefined &&
        payload.iv !== undefined &&
        payload.authTag !== undefined
          ? {
              payload: {
                ciphertext: payload.ciphertext,
                iv: payload.iv,
                authTag: payload.authTag,
                version: payload.version ?? 1,
              },
            }
          : {}
      ),
      actorUserId: input.actorUserId,
    });

    if (!updated) {
      throw notFound('Vault item not found');
    }

    await logVaultAuditEvent({
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

  async deleteVaultItem(input: {
    workspaceId: string;
    actorUserId: string;
    vaultItemId: string;
    request?: FastifyRequest;
  }) {
    const existing = await vaultRepo.getVaultItemById(input.workspaceId, input.vaultItemId);
    if (!existing) {
      throw notFound('Vault item not found');
    }

    const deleted = await vaultRepo.deleteVaultItem(input.workspaceId, input.vaultItemId);
    if (!deleted) {
      throw notFound('Vault item not found');
    }

    await logVaultAuditEvent({
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
