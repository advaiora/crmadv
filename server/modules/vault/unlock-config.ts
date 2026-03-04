const DEFAULT_VAULT_UNLOCK_TTL_SECONDS = 15 * 60;
const DEFAULT_VAULT_UNLOCK_COOKIE_NAME = 'vault_unlock';
const DEFAULT_VAULT_UNLOCK_COOKIE_PATH = '/vault';
const VAULT_UNLOCK_COOKIE_SAMESITE_VALUES = new Set(['lax', 'strict']);

type VaultUnlockSameSite = 'lax' | 'strict';

export type VaultUnlockRuntimeConfig = {
  tokenSecret: string;
  ttlSeconds: number;
  cookieName: string;
  cookiePath: string;
  cookieSameSite: VaultUnlockSameSite;
  cookieSecure: boolean;
};

let cachedConfig: VaultUnlockRuntimeConfig | null = null;

const parsePositiveInt = (rawValue: string | undefined, fallback: number, fieldName: string) => {
  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(rawValue.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return parsed;
};

const parseCookieSameSite = (rawValue: string | undefined): VaultUnlockSameSite => {
  if (!rawValue || rawValue.trim().length === 0) {
    return 'lax';
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!VAULT_UNLOCK_COOKIE_SAMESITE_VALUES.has(normalized)) {
    throw new Error('Invalid VAULT_UNLOCK_COOKIE_SAME_SITE');
  }

  return normalized as VaultUnlockSameSite;
};

const parseBoolean = (rawValue: string | undefined, fallback: boolean) => {
  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error('Invalid VAULT_UNLOCK_COOKIE_SECURE');
};

const normalizeCookiePath = (rawPath: string | undefined) => {
  const trimmed = rawPath?.trim() ?? '';
  if (!trimmed) {
    return DEFAULT_VAULT_UNLOCK_COOKIE_PATH;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const getVaultUnlockSecret = () => {
  const unlockSecret = process.env.VAULT_UNLOCK_TOKEN_SECRET?.trim();
  if (unlockSecret && unlockSecret.length >= 16) {
    return unlockSecret;
  }

  const jwtSecret = process.env.AUTH_JWT_SECRET?.trim();
  if (jwtSecret && jwtSecret.length >= 16) {
    return jwtSecret;
  }

  throw new Error('Missing vault unlock token secret. Configure VAULT_UNLOCK_TOKEN_SECRET or AUTH_JWT_SECRET.');
};

export const getVaultUnlockRuntimeConfig = (): VaultUnlockRuntimeConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    tokenSecret: getVaultUnlockSecret(),
    ttlSeconds: parsePositiveInt(
      process.env.VAULT_UNLOCK_TTL_SECONDS,
      DEFAULT_VAULT_UNLOCK_TTL_SECONDS,
      'VAULT_UNLOCK_TTL_SECONDS',
    ),
    cookieName: process.env.VAULT_UNLOCK_COOKIE_NAME?.trim() || DEFAULT_VAULT_UNLOCK_COOKIE_NAME,
    cookiePath: normalizeCookiePath(process.env.VAULT_UNLOCK_COOKIE_PATH),
    cookieSameSite: parseCookieSameSite(process.env.VAULT_UNLOCK_COOKIE_SAME_SITE),
    cookieSecure: parseBoolean(
      process.env.VAULT_UNLOCK_COOKIE_SECURE,
      process.env.NODE_ENV === 'production',
    ),
  };

  return cachedConfig;
};

export const resetVaultUnlockRuntimeConfigCacheForTests = () => {
  cachedConfig = null;
};
