import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getVaultUnlockRuntimeConfig } from './unlock-config.js';

export type VaultUnlockTokenPayload = {
  userId: string;
  workspaceId: string;
  iat: number;
  exp: number;
  sessionHash?: string;
};

export type VaultUnlockTokenValidationReason =
  | 'missing'
  | 'malformed'
  | 'invalid_signature'
  | 'invalid_ciphertext'
  | 'expired'
  | 'subject_mismatch'
  | 'workspace_mismatch'
  | 'session_mismatch';

export type VaultUnlockTokenValidationResult =
  | {
      valid: true;
      payload: VaultUnlockTokenPayload;
    }
  | {
      valid: false;
      reason: VaultUnlockTokenValidationReason;
    };

type IssueVaultUnlockTokenInput = {
  userId: string;
  workspaceId: string;
  ttlSeconds?: number;
  sessionHash?: string;
  nowMs?: number;
};

type ValidateVaultUnlockTokenInput = {
  token: string | null | undefined;
  userId: string;
  workspaceId: string;
  sessionHash?: string;
  nowMs?: number;
};

const isValidEpochSeconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const asPayload = (value: unknown): VaultUnlockTokenPayload | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const parsed = value as Record<string, unknown>;
  if (
    typeof parsed.userId !== 'string'
    || typeof parsed.workspaceId !== 'string'
    || !isValidEpochSeconds(parsed.iat)
    || !isValidEpochSeconds(parsed.exp)
  ) {
    return null;
  }

  if (parsed.iat >= parsed.exp) {
    return null;
  }

  if (parsed.sessionHash !== undefined && typeof parsed.sessionHash !== 'string') {
    return null;
  }

  return {
    userId: parsed.userId,
    workspaceId: parsed.workspaceId,
    iat: parsed.iat,
    exp: parsed.exp,
    sessionHash: parsed.sessionHash,
  };
};

const getDerivedSigningKey = () => {
  const { tokenSecret } = getVaultUnlockRuntimeConfig();
  return createHash('sha256').update(tokenSecret, 'utf8').digest();
};

const getDerivedEncryptionKey = () => {
  const { tokenSecret } = getVaultUnlockRuntimeConfig();
  return createHash('sha256').update(`${tokenSecret}:vault_unlock`, 'utf8').digest();
};

const secureEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const signTokenParts = (parts: readonly string[]) => createHmac('sha256', getDerivedSigningKey())
  .update(parts.join('.'), 'utf8')
  .digest('base64url');

export const hashAccessTokenForVaultUnlock = (accessToken: string) =>
  createHash('sha256').update(accessToken, 'utf8').digest('base64url');

export const issueVaultUnlockToken = (input: IssueVaultUnlockTokenInput) => {
  const config = getVaultUnlockRuntimeConfig();
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const payload: VaultUnlockTokenPayload = {
    userId: input.userId,
    workspaceId: input.workspaceId,
    iat: nowSeconds,
    exp: nowSeconds + (input.ttlSeconds ?? config.ttlSeconds),
    ...(input.sessionHash ? { sessionHash: input.sessionHash } : {}),
  };

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getDerivedEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), 'utf8')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const ivB64Url = iv.toString('base64url');
  const ciphertextB64Url = ciphertext.toString('base64url');
  const authTagB64Url = authTag.toString('base64url');
  const signature = signTokenParts([ivB64Url, ciphertextB64Url, authTagB64Url]);

  return {
    token: `${ivB64Url}.${ciphertextB64Url}.${authTagB64Url}.${signature}`,
    payload,
  };
};

export const validateVaultUnlockToken = (
  input: ValidateVaultUnlockTokenInput,
): VaultUnlockTokenValidationResult => {
  if (!input.token || input.token.trim().length === 0) {
    return {
      valid: false,
      reason: 'missing',
    };
  }

  const [ivB64Url, ciphertextB64Url, authTagB64Url, signature, ...rest] = input.token.split('.');
  if (!ivB64Url || !ciphertextB64Url || !authTagB64Url || !signature || rest.length > 0) {
    return {
      valid: false,
      reason: 'malformed',
    };
  }

  const expectedSignature = signTokenParts([ivB64Url, ciphertextB64Url, authTagB64Url]);
  if (!secureEqual(signature, expectedSignature)) {
    return {
      valid: false,
      reason: 'invalid_signature',
    };
  }

  let decodedPayload: VaultUnlockTokenPayload | null = null;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getDerivedEncryptionKey(),
      Buffer.from(ivB64Url, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTagB64Url, 'base64url'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64Url, 'base64url')),
      decipher.final(),
    ]);

    decodedPayload = asPayload(JSON.parse(decrypted.toString('utf8')));
  } catch {
    return {
      valid: false,
      reason: 'invalid_ciphertext',
    };
  }

  if (!decodedPayload) {
    return {
      valid: false,
      reason: 'malformed',
    };
  }

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (decodedPayload.exp <= nowSeconds) {
    return {
      valid: false,
      reason: 'expired',
    };
  }

  if (decodedPayload.userId !== input.userId) {
    return {
      valid: false,
      reason: 'subject_mismatch',
    };
  }

  if (decodedPayload.workspaceId !== input.workspaceId) {
    return {
      valid: false,
      reason: 'workspace_mismatch',
    };
  }

  if (input.sessionHash && decodedPayload.sessionHash !== input.sessionHash) {
    return {
      valid: false,
      reason: 'session_mismatch',
    };
  }

  return {
    valid: true,
    payload: decodedPayload,
  };
};
