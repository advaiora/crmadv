import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { audit } from '../../audit/audit.js';

export const VaultAuditActions = {
  reveal: 'vault.reveal',
  create: 'vault.create',
  edit: 'vault.edit',
  delete: 'vault.delete',
} as const;

export type VaultAuditAction =
  (typeof VaultAuditActions)[keyof typeof VaultAuditActions];

export const VAULT_AUDIT_TARGET_TYPE = 'VaultItem';

const SENSITIVE_KEY_MARKERS = [
  'secret',
  'plaintext',
  'password',
  'token',
  'apikey',
  'api_key',
  'credential',
  'privatekey',
  'private_key',
  'decrypted',
  'ciphertext',
  'authtag',
  'auth_tag',
  'iv',
  'raw',
] as const;

const MAX_METADATA_DEPTH = 4;

type SafeAuditValue =
  | string
  | number
  | boolean
  | null
  | SafeAuditValue[]
  | { [key: string]: SafeAuditValue };

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSensitiveKey = (key: string): boolean => {
  const normalized = key.trim().toLowerCase();
  return SENSITIVE_KEY_MARKERS.some((marker) => normalized.includes(marker));
};

const sanitizeAuditValue = (
  value: unknown,
  depth: number,
): SafeAuditValue | undefined => {
  if (value === null) {
    return null;
  }

  if (depth > MAX_METADATA_DEPTH) {
    return undefined;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizeAuditValue(item, depth + 1))
      .filter((item): item is SafeAuditValue => item !== undefined);

    return sanitizedItems;
  }

  if (isPlainRecord(value)) {
    const sanitizedObject: { [key: string]: SafeAuditValue } = {};

    Object.entries(value).forEach(([key, nestedValue]) => {
      if (isSensitiveKey(key)) {
        return;
      }

      const sanitizedNestedValue = sanitizeAuditValue(nestedValue, depth + 1);
      if (sanitizedNestedValue !== undefined) {
        sanitizedObject[key] = sanitizedNestedValue;
      }
    });

    return sanitizedObject;
  }

  return undefined;
};

const sanitizeVaultAuditMetadata = (
  metadata: Record<string, unknown> = {},
): { [key: string]: SafeAuditValue } => {
  const sanitized = sanitizeAuditValue(metadata, 0);

  if (sanitized && isPlainRecord(sanitized)) {
    return sanitized;
  }

  return {};
};

type BuildVaultAuditMetaInput = {
  workspaceId: string;
  vaultItemId?: string;
  metadata?: Record<string, unknown>;
};

export const buildVaultAuditMeta = (input: BuildVaultAuditMetaInput) => {
  const sanitizedExtra = sanitizeVaultAuditMetadata(input.metadata);

  return {
    targetType: VAULT_AUDIT_TARGET_TYPE,
    targetId: input.vaultItemId ?? null,
    workspaceId: input.workspaceId,
    ...sanitizedExtra,
  } satisfies Prisma.InputJsonObject;
};

type LogVaultAuditInput = {
  action: VaultAuditAction;
  workspaceId: string;
  actorUserId?: string;
  vaultItemId?: string;
  metadata?: Record<string, unknown>;
  request?: FastifyRequest;
};

export const logVaultAuditEvent = async (input: LogVaultAuditInput) => {
  const auditMeta = buildVaultAuditMeta({
    workspaceId: input.workspaceId,
    vaultItemId: input.vaultItemId,
    metadata: input.metadata,
  });

  return audit.log({
    event: input.action,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    entityType: VAULT_AUDIT_TARGET_TYPE,
    entityId: input.vaultItemId,
    metadata: auditMeta as Prisma.InputJsonValue,
    request: input.request,
  });
};

type AuditVaultRevealInput = {
  workspaceId: string;
  actorUserId: string;
  vaultItemId: string;
  request?: FastifyRequest;
  metadata?: Record<string, unknown>;
};

export const auditVaultReveal = async (input: AuditVaultRevealInput) => {
  // Phase 2 scaffold: reveal endpoint is not implemented yet.
  // This helper is ready to be called by reveal service/route in Phase 4.
  return logVaultAuditEvent({
    action: VaultAuditActions.reveal,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    vaultItemId: input.vaultItemId,
    metadata: input.metadata,
    request: input.request,
  });
};

