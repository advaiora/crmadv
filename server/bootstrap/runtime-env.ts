import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const DEFAULT_ENV_FILE = '.env';
const DATABASE_URL_PREFIX = 'postgresql://';
const PRISMA_ENGINE_ENV_KEY = 'PRISMA_CLIENT_ENGINE_TYPE';
const DEFAULT_PRISMA_ENGINE = 'binary';
const AUTH_JWT_SECRET_KEY = 'AUTH_JWT_SECRET';
const AUTH_JWT_EXPIRES_IN_KEY = 'AUTH_JWT_EXPIRES_IN_SECONDS';
const DEFAULT_AUTH_JWT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

export type RuntimeEnvOptions = {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  envFilePath?: string;
  loadDotenv?: boolean;
};

export type RuntimeEnv = {
  databaseUrl: string;
  apiHost: string;
  apiPort: number;
  auth: {
    jwtSecret: string;
    jwtExpiresInSeconds: number;
  };
  prisma: {
    previousEngineType: string | null;
    engineType: string;
    dotenvPrismaEnv: Array<{ key: string; value: string }>;
    processPrismaEnv: Array<{ key: string; value: string }>;
  };
  databaseTarget: {
    host: string;
    port: string;
    database: string;
  };
};

const isBlank = (value: string | undefined | null) => value === undefined || value === null || value.trim().length === 0;

const toSafeEnvValue = (key: string, value: string) => {
  const keyUpper = key.toUpperCase();
  if (
    keyUpper.includes('PASSWORD') ||
    keyUpper.includes('SECRET') ||
    keyUpper.includes('TOKEN') ||
    keyUpper.includes('KEY')
  ) {
    return '***';
  }

  const raw = String(value);
  try {
    const parsed = new URL(raw);
    if (parsed.password) {
      parsed.password = '***';
    }
    if (parsed.username) {
      parsed.username = '***';
    }
    return parsed.toString();
  } catch {
    return raw;
  }
};

const listDotenvFiles = (cwd: string) =>
  fs
    .readdirSync(cwd)
    .filter((name) => name.startsWith('.env'))
    .sort();

const findDataproxyInEnvFiles = (cwd: string) => {
  const matches: string[] = [];

  for (const envFileName of listDotenvFiles(cwd)) {
    const absolutePath = path.resolve(cwd, envFileName);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/u);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const isDataproxyEntry = /^\s*PRISMA_CLIENT_ENGINE_TYPE\s*=\s*["']?dataproxy["']?\s*$/iu.test(line);
      if (isDataproxyEntry) {
        matches.push(`${envFileName}:${index + 1}`);
      }
    }
  }

  return matches;
};

const collectPrismaEnv = (env: NodeJS.ProcessEnv) =>
  Object.keys(env)
    .filter((key) => key.startsWith('PRISMA_'))
    .sort()
    .map((key) => ({
      key,
      value: toSafeEnvValue(key, String(env[key] ?? '')),
    }));

const normalizePrismaEngineType = (env: NodeJS.ProcessEnv, databaseUrl: string) => {
  const previousEngineTypeRaw = env[PRISMA_ENGINE_ENV_KEY];
  const previousEngineType = previousEngineTypeRaw ? previousEngineTypeRaw.trim() : null;
  const normalizedPreviousEngineType = previousEngineType?.toLowerCase();

  if (previousEngineType === null || normalizedPreviousEngineType === 'dataproxy') {
    env[PRISMA_ENGINE_ENV_KEY] = DEFAULT_PRISMA_ENGINE;
  }

  if (normalizedPreviousEngineType === 'dataproxy' && databaseUrl.startsWith(DATABASE_URL_PREFIX)) {
    throw new Error(
      'Invalid PRISMA_CLIENT_ENGINE_TYPE=dataproxy with DATABASE_URL using postgresql://. Remove dataproxy from your environment and keep a classic Prisma engine (binary or library).',
    );
  }

  return {
    previousEngineType,
    engineType: String(env[PRISMA_ENGINE_ENV_KEY]),
  };
};

export const loadDotenv = (options: Pick<RuntimeEnvOptions, 'cwd' | 'envFilePath'> = {}) => {
  const cwd = options.cwd ?? process.cwd();
  const envFilePath = options.envFilePath ?? path.resolve(cwd, DEFAULT_ENV_FILE);

  return dotenv.config({
    path: envFilePath,
    override: false,
    quiet: true,
  });
};

export const validateDatabaseUrl = (value: string | undefined | null) => {
  if (isBlank(value)) {
    throw new Error('Missing DATABASE_URL. Define DATABASE_URL in .env using the postgresql:// scheme.');
  }

  const databaseUrl = String(value).trim();

  if (!databaseUrl.startsWith(DATABASE_URL_PREFIX)) {
    throw new Error(
      'Invalid DATABASE_URL: expected a URL starting with postgresql:// (example: postgresql://user:pass@host:5432/dbname).',
    );
  }

  try {
    void new URL(databaseUrl);
  } catch {
    throw new Error('Invalid DATABASE_URL: malformed URL.');
  }

  return databaseUrl;
};

const validateApiPort = (rawPort: string | undefined) => {
  if (isBlank(rawPort)) {
    return 4000;
  }

  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid API_PORT: "${rawPort}". Expected an integer between 1 and 65535.`);
  }

  return parsed;
};

const validateAuthJwtSecret = (rawSecret: string | undefined | null) => {
  if (isBlank(rawSecret)) {
    throw new Error('Missing AUTH_JWT_SECRET. Define a strong JWT secret in .env.');
  }

  const secret = String(rawSecret).trim();
  if (secret.length < 16) {
    throw new Error('Invalid AUTH_JWT_SECRET: expected at least 16 characters.');
  }

  return secret;
};

const validateAuthJwtExpiresInSeconds = (rawValue: string | undefined | null) => {
  if (isBlank(rawValue)) {
    return DEFAULT_AUTH_JWT_EXPIRES_IN_SECONDS;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 60 || parsed > 60 * 60 * 24 * 30) {
    throw new Error(
      `Invalid ${AUTH_JWT_EXPIRES_IN_KEY}: "${rawValue}". Expected an integer between 60 and 2592000.`,
    );
  }

  return parsed;
};

export const getSafeDatabaseTarget = (databaseUrl: string) => {
  const parsed = new URL(databaseUrl);
  const database = parsed.pathname.replace(/^\/+/, '') || '(default)';

  return {
    host: parsed.hostname || '(unknown)',
    port: parsed.port || '(default)',
    database,
  };
};

export const loadAndValidateRuntimeEnv = (options: RuntimeEnvOptions = {}): RuntimeEnv => {
  const shouldLoadDotenv = options.loadDotenv ?? true;
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const dataproxyFileMatches = findDataproxyInEnvFiles(cwd);
  if (dataproxyFileMatches.length > 0) {
    throw new Error(
      `Invalid Prisma engine configuration in .env files. Remove PRISMA_CLIENT_ENGINE_TYPE=dataproxy from: ${dataproxyFileMatches.join(', ')}`,
    );
  }

  const dotenvResult = shouldLoadDotenv ? loadDotenv(options) : undefined;
  if (shouldLoadDotenv) {
    const dotenvError = dotenvResult?.error;
    if (dotenvError) {
      throw dotenvError;
    }
  }

  const databaseUrl = validateDatabaseUrl(env.DATABASE_URL);
  const apiHost = isBlank(env.API_HOST) ? '0.0.0.0' : String(env.API_HOST).trim();
  const apiPort = validateApiPort(env.API_PORT);
  const authJwtSecret = validateAuthJwtSecret(env[AUTH_JWT_SECRET_KEY]);
  const authJwtExpiresInSeconds = validateAuthJwtExpiresInSeconds(env[AUTH_JWT_EXPIRES_IN_KEY]);
  const prismaEngine = normalizePrismaEngineType(env, databaseUrl);

  const dotenvParsed = dotenvResult?.parsed ?? {};
  const dotenvPrismaEnv = Object.keys(dotenvParsed)
    .filter((key) => key.startsWith('PRISMA_'))
    .sort()
    .map((key) => ({
      key,
      value: toSafeEnvValue(key, String(dotenvParsed[key] ?? '')),
    }));

  return {
    databaseUrl,
    apiHost,
    apiPort,
    auth: {
      jwtSecret: authJwtSecret,
      jwtExpiresInSeconds: authJwtExpiresInSeconds,
    },
    prisma: {
      previousEngineType: prismaEngine.previousEngineType,
      engineType: prismaEngine.engineType,
      dotenvPrismaEnv,
      processPrismaEnv: collectPrismaEnv(env),
    },
    databaseTarget: getSafeDatabaseTarget(databaseUrl),
  };
};
