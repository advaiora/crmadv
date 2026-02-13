import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPrismaClient, initializePrisma, resetPrismaForTests } from '../prisma.js';
import { bootstrapRuntime } from './startup.js';

test('bootstrapRuntime validates env without initializing Prisma', async () => {
  await resetPrismaForTests();
  assert.equal(hasPrismaClient(), false);

  assert.throws(
    () =>
      bootstrapRuntime({
        env: {
          DATABASE_URL: 'prisma://localhost:5432/test',
          API_HOST: '127.0.0.1',
          API_PORT: '4101',
        },
        loadDotenv: false,
      }),
    /expected a URL starting with postgresql:\/\//i,
  );

  assert.equal(hasPrismaClient(), false);

  const runtimeEnv = bootstrapRuntime({
    env: {
      DATABASE_URL: 'postgresql://test-user:test-pass@localhost:5432/crm_test',
      API_HOST: '127.0.0.1',
      API_PORT: '4102',
    },
    loadDotenv: false,
  });

  assert.equal(runtimeEnv.apiPort, 4102);
  assert.equal(runtimeEnv.prisma.engineType, 'binary');
  assert.equal(hasPrismaClient(), false);

  initializePrisma(runtimeEnv.databaseUrl);
  assert.equal(hasPrismaClient(), true);

  await resetPrismaForTests();
});
