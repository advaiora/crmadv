const DEFAULT_STEP_UP_TTL_SECONDS = 120;
const DEFAULT_STEP_UP_COOKIE_NAME = 'stepup';
const DEFAULT_STEP_UP_COOKIE_PATH = '/vault';
const DEFAULT_OAUTH_RECENT_LOGIN_MAX_AGE_SECONDS = 15 * 60;
const STEP_UP_COOKIE_SAMESITE_VALUES = new Set(['lax', 'strict']);

type StepUpSameSite = 'lax' | 'strict';

export type StepUpRuntimeConfig = {
  tokenSecret: string;
  ttlSeconds: number;
  cookieName: string;
  cookiePath: string;
  cookieSameSite: StepUpSameSite;
  cookieSecure: boolean;
  oauthRecentLoginMaxAgeSeconds: number;
};

let cachedConfig: StepUpRuntimeConfig | null = null;

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

const parseCookieSameSite = (rawValue: string | undefined): StepUpSameSite => {
  if (!rawValue || rawValue.trim().length === 0) {
    return 'lax';
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!STEP_UP_COOKIE_SAMESITE_VALUES.has(normalized)) {
    throw new Error('Invalid STEP_UP_COOKIE_SAME_SITE');
  }

  return normalized as StepUpSameSite;
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

  throw new Error('Invalid STEP_UP_COOKIE_SECURE');
};

const normalizeCookiePath = (rawPath: string | undefined) => {
  const trimmed = rawPath?.trim() ?? '';
  if (!trimmed) {
    return DEFAULT_STEP_UP_COOKIE_PATH;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const getStepUpSecret = () => {
  const stepUpSecret = process.env.STEP_UP_TOKEN_SECRET?.trim();
  if (stepUpSecret && stepUpSecret.length >= 16) {
    return stepUpSecret;
  }

  const jwtSecret = process.env.AUTH_JWT_SECRET?.trim();
  if (jwtSecret && jwtSecret.length >= 16) {
    return jwtSecret;
  }

  throw new Error('Missing step-up token secret. Configure STEP_UP_TOKEN_SECRET or AUTH_JWT_SECRET.');
};

export const getStepUpRuntimeConfig = (): StepUpRuntimeConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const ttlSeconds = parsePositiveInt(
    process.env.STEP_UP_TTL_SECONDS,
    DEFAULT_STEP_UP_TTL_SECONDS,
    'STEP_UP_TTL_SECONDS',
  );

  cachedConfig = {
    tokenSecret: getStepUpSecret(),
    ttlSeconds,
    cookieName: process.env.STEP_UP_COOKIE_NAME?.trim() || DEFAULT_STEP_UP_COOKIE_NAME,
    cookiePath: normalizeCookiePath(process.env.STEP_UP_COOKIE_PATH),
    cookieSameSite: parseCookieSameSite(process.env.STEP_UP_COOKIE_SAME_SITE),
    cookieSecure: parseBoolean(process.env.STEP_UP_COOKIE_SECURE, process.env.NODE_ENV === 'production'),
    oauthRecentLoginMaxAgeSeconds: parsePositiveInt(
      process.env.STEP_UP_OAUTH_RECENT_LOGIN_MAX_AGE_SECONDS,
      DEFAULT_OAUTH_RECENT_LOGIN_MAX_AGE_SECONDS,
      'STEP_UP_OAUTH_RECENT_LOGIN_MAX_AGE_SECONDS',
    ),
  };

  return cachedConfig;
};

export const resetStepUpRuntimeConfigCacheForTests = () => {
  cachedConfig = null;
};
