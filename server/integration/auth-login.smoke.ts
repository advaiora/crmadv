import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../app.js';
import { bootstrapRuntime } from '../bootstrap/startup.js';
import { initializePrisma, prisma, resetPrismaForTests } from '../prisma.js';

const TEST_HOST = '127.0.0.1';

const startTestServer = async () => {
  const app = createApp({ logger: false });
  await app.listen({ host: TEST_HOST, port: 0 });
  const address = app.server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Unable to read test server address');
  }

  return {
    app,
    baseUrl: `http://${TEST_HOST}:${address.port}`,
  };
};

const stopTestServer = async (app: FastifyInstance | null) => {
  if (app) {
    await app.close();
  }

  await resetPrismaForTests();
};

test('POST /auth/login returns 400 (not 500) for invalid payload', async () => {
  let app: FastifyInstance | null = null;

  try {
    const runtimeEnv = bootstrapRuntime();
    initializePrisma(runtimeEnv.databaseUrl);

    const server = await startTestServer();
    app = server.app;

    const response = await fetch(`${server.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email',
        password: '123',
      }),
    });

    assert.notEqual(response.status, 500);
    assert.equal(response.status, 400);
  } finally {
    await stopTestServer(app);
  }
});

test('POST /auth/login returns 401 (or 400) and never 500 when DB is reachable', async (t) => {
  let app: FastifyInstance | null = null;

  try {
    const runtimeEnv = bootstrapRuntime();
    initializePrisma(runtimeEnv.databaseUrl);

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      t.skip(`Database not reachable for reachability smoke test: ${(error as Error).message}`);
      return;
    }

    const server = await startTestServer();
    app = server.app;

    const response = await fetch(`${server.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'does-not-exist@example.com',
        password: 'password123',
      }),
    });

    assert.notEqual(response.status, 500);
    assert.ok(response.status === 401 || response.status === 400);
  } finally {
    await stopTestServer(app);
  }
});

test('POST /auth/login returns 503 with readable error when DB is not reachable', async () => {
  let app: FastifyInstance | null = null;

  try {
    const runtimeEnv = bootstrapRuntime({
      env: {
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/postgres?connect_timeout=1',
        API_HOST: TEST_HOST,
        API_PORT: '4103',
        AUTH_JWT_SECRET: 'integration-test-super-secret',
      },
      loadDotenv: false,
    });
    initializePrisma(runtimeEnv.databaseUrl);

    const server = await startTestServer();
    app = server.app;

    const response = await fetch(`${server.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'does-not-exist@example.com',
        password: 'password123',
      }),
    });

    const payload = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
      };
    };

    assert.equal(response.status, 503);
    assert.equal(payload.error?.code, 'DATABASE_UNAVAILABLE');
    assert.match(String(payload.error?.message ?? ''), /database is unavailable/i);
  } finally {
    await stopTestServer(app);
  }
});
