import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadAndValidateRuntimeEnv, validateDatabaseUrl } from './runtime-env.js';

const DATABASE_URL_KEY = 'DATABASE_URL';
const API_HOST_KEY = 'API_HOST';
const API_PORT_KEY = 'API_PORT';
const PRISMA_ENGINE_KEY = 'PRISMA_CLIENT_ENGINE_TYPE';

const restoreEnvValue = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

test('loadAndValidateRuntimeEnv loads variables from .env', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'crm-env-test-'));
  const envPath = path.join(tempDir, '.env');

  const previousDatabaseUrl = process.env[DATABASE_URL_KEY];
  const previousApiHost = process.env[API_HOST_KEY];
  const previousApiPort = process.env[API_PORT_KEY];
  const previousPrismaEngine = process.env[PRISMA_ENGINE_KEY];

  try {
    await writeFile(
      envPath,
      'DATABASE_URL=postgresql://test-user:test-pass@localhost:5432/crm_test\nAPI_HOST=127.0.0.1\nAPI_PORT=4100\n',
      'utf8',
    );

    delete process.env[DATABASE_URL_KEY];
    delete process.env[API_HOST_KEY];
    delete process.env[API_PORT_KEY];
    delete process.env[PRISMA_ENGINE_KEY];

    const runtimeEnv = loadAndValidateRuntimeEnv({
      cwd: tempDir,
      env: process.env,
      loadDotenv: true,
    });

    assert.equal(process.env.DATABASE_URL, 'postgresql://test-user:test-pass@localhost:5432/crm_test');
    assert.equal(process.env.PRISMA_CLIENT_ENGINE_TYPE, 'binary');
    assert.equal(runtimeEnv.apiHost, '127.0.0.1');
    assert.equal(runtimeEnv.apiPort, 4100);
    assert.deepEqual(runtimeEnv.databaseTarget, {
      host: 'localhost',
      port: '5432',
      database: 'crm_test',
    });
    assert.equal(runtimeEnv.prisma.engineType, 'binary');
    assert.equal(runtimeEnv.prisma.previousEngineType, null);
  } finally {
    restoreEnvValue(DATABASE_URL_KEY, previousDatabaseUrl);
    restoreEnvValue(API_HOST_KEY, previousApiHost);
    restoreEnvValue(API_PORT_KEY, previousApiPort);
    restoreEnvValue(PRISMA_ENGINE_KEY, previousPrismaEngine);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('validateDatabaseUrl accepts postgresql URL and rejects invalid schemes', () => {
  assert.equal(
    validateDatabaseUrl('postgresql://user:password@localhost:5432/mydb'),
    'postgresql://user:password@localhost:5432/mydb',
  );

  assert.throws(
    () => validateDatabaseUrl('prisma://localhost:5432/mydb'),
    /expected a URL starting with postgresql:\/\//i,
  );

  assert.throws(
    () => validateDatabaseUrl(undefined),
    /Missing DATABASE_URL/i,
  );
});

test('loadAndValidateRuntimeEnv fails fast when PRISMA_CLIENT_ENGINE_TYPE is dataproxy with postgresql URL', () => {
  assert.throws(
    () =>
      loadAndValidateRuntimeEnv({
        env: {
          DATABASE_URL: 'postgresql://user:password@localhost:5432/mydb',
          PRISMA_CLIENT_ENGINE_TYPE: 'dataproxy',
          API_HOST: '127.0.0.1',
          API_PORT: '4000',
        },
        loadDotenv: false,
      }),
    /PRISMA_CLIENT_ENGINE_TYPE=dataproxy/i,
  );
});

test('loadAndValidateRuntimeEnv fails when .env files contain PRISMA_CLIENT_ENGINE_TYPE=dataproxy', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'crm-env-dataproxy-'));
  const envPath = path.join(tempDir, '.env.local');

  try {
    await writeFile(
      envPath,
      'PRISMA_CLIENT_ENGINE_TYPE=dataproxy\n',
      'utf8',
    );

    assert.throws(
      () =>
        loadAndValidateRuntimeEnv({
          cwd: tempDir,
          env: {
            DATABASE_URL: 'postgresql://user:password@localhost:5432/mydb',
            API_HOST: '127.0.0.1',
            API_PORT: '4000',
          },
          loadDotenv: false,
        }),
      /\.env\.local/i,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
