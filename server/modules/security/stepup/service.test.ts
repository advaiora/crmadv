import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from '../../../core/errors.js';
import { resetStepUpRuntimeConfigCacheForTests } from './config.js';
import { buildStepUpService } from './service.js';

const withStepUpEnv = async (fn: () => Promise<void> | void) => {
  const previousStepUpSecret = process.env.STEP_UP_TOKEN_SECRET;
  const previousJwtSecret = process.env.AUTH_JWT_SECRET;
  const previousTtl = process.env.STEP_UP_TTL_SECONDS;
  const previousCookiePath = process.env.STEP_UP_COOKIE_PATH;
  const previousOAuthRecentLoginMaxAge = process.env.STEP_UP_OAUTH_RECENT_LOGIN_MAX_AGE_SECONDS;

  process.env.STEP_UP_TOKEN_SECRET = 'stepup-service-secret-for-tests-0123456789';
  process.env.AUTH_JWT_SECRET = 'jwt-service-secret-for-tests-0123456789';
  process.env.STEP_UP_TTL_SECONDS = '120';
  process.env.STEP_UP_COOKIE_PATH = '/vault';
  process.env.STEP_UP_OAUTH_RECENT_LOGIN_MAX_AGE_SECONDS = '900';
  resetStepUpRuntimeConfigCacheForTests();

  try {
    await fn();
  } finally {
    process.env.STEP_UP_TOKEN_SECRET = previousStepUpSecret;
    process.env.AUTH_JWT_SECRET = previousJwtSecret;
    process.env.STEP_UP_TTL_SECONDS = previousTtl;
    process.env.STEP_UP_COOKIE_PATH = previousCookiePath;
    process.env.STEP_UP_OAUTH_RECENT_LOGIN_MAX_AGE_SECONDS = previousOAuthRecentLoginMaxAge;
    resetStepUpRuntimeConfigCacheForTests();
  }
};

const asRequest = (authorization: string): FastifyRequest =>
  ({
    headers: {
      authorization,
    },
  } as unknown as FastifyRequest);

const createReplyStub = () => {
  const headers = new Map<string, string | string[]>();
  const reply = {
    getHeader(name: string) {
      return headers.get(name);
    },
    header(name: string, value: string | string[]) {
      headers.set(name, value);
      return reply;
    },
  } as unknown as FastifyReply;

  return {
    reply,
    getHeader: (name: string) => headers.get(name),
  };
};

test('issueStepUpGrant rejects oauth-only account when vault password is not set', async () => {
  await withStepUpEnv(async () => {
    const service = buildStepUpService({
      userRepositoryApi: {
        findByIdForLogin: async () => ({
          id: 'user-1',
          email: 'oauth@example.com',
          name: null,
          role: 'member',
          passwordHash: null,
          vaultPasswordHash: null,
        }),
      } as never,
      comparePasswordFn: async () => false,
      hashPasswordFn: async () => 'ignored-hash',
      verifyAccessTokenFn: async () => ({
        sub: 'user-1',
        email: 'oauth@example.com',
        role: 'member',
        type: 'access',
        issuedAt: Math.floor(Date.now() / 1000),
      }),
      nowMsFn: () => Date.now(),
    });

    await assert.rejects(
      () =>
        service.issueStepUpGrant({
          request: asRequest('Bearer access-token-oauth'),
          reply: createReplyStub().reply,
          userId: 'user-1',
          workspaceId: 'workspace-1',
          body: {
            purpose: 'vault.reveal',
          },
        }),
      (error) =>
        error instanceof HttpError
        && error.statusCode === 403
        && error.code === 'STEP_UP_VAULT_PASSWORD_NOT_SET',
    );
  });
});

test('issueStepUpGrant allows account with configured vault password', async () => {
  await withStepUpEnv(async () => {
    const service = buildStepUpService({
      userRepositoryApi: {
        findByIdForLogin: async () => ({
          id: 'user-1',
          email: 'oauth@example.com',
          name: null,
          role: 'member',
          passwordHash: null,
          vaultPasswordHash: 'vault-password-hash',
        }),
      } as never,
      comparePasswordFn: async () => true,
      hashPasswordFn: async () => 'ignored-hash',
      verifyAccessTokenFn: async () => ({
        sub: 'user-1',
        email: 'oauth@example.com',
        role: 'member',
        type: 'access',
        issuedAt: Math.floor(Date.now() / 1000),
      }),
      nowMsFn: () => Date.now(),
    });
    const response = createReplyStub();

    await service.issueStepUpGrant({
      request: asRequest('Bearer access-token-oauth'),
      reply: response.reply,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      body: {
        purpose: 'vault.reveal',
        password: 'VaultPassw0rd!',
      },
    });

    const setCookie = response.getHeader('Set-Cookie');
    assert.equal(typeof setCookie, 'string');
    assert.match(String(setCookie), /^stepup=/);
    assert.match(String(setCookie), /Path=\/vault/);
  });
});

test('setVaultPassword allows oauth-only account with recent login', async () => {
  await withStepUpEnv(async () => {
    const nowMs = 1_700_000_000_000;
    let updatedHash: string | null = null;
    const service = buildStepUpService({
      userRepositoryApi: {
        findByIdForLogin: async () => ({
          id: 'user-1',
          email: 'oauth@example.com',
          name: null,
          role: 'member',
          passwordHash: null,
          vaultPasswordHash: null,
        }),
        updateVaultPasswordHash: async (_userId: string, vaultPasswordHash: string) => {
          updatedHash = vaultPasswordHash;
          return {
            id: 'user-1',
            email: 'oauth@example.com',
            name: null,
            role: 'member',
            passwordHash: null,
            vaultPasswordHash,
          };
        },
      } as never,
      comparePasswordFn: async () => false,
      hashPasswordFn: async () => 'new-vault-password-hash',
      verifyAccessTokenFn: async () => ({
        sub: 'user-1',
        email: 'oauth@example.com',
        role: 'member',
        type: 'access',
        issuedAt: Math.floor(nowMs / 1000) - 60,
      }),
      nowMsFn: () => nowMs,
    });

    await service.setVaultPassword({
      request: asRequest('Bearer access-token-oauth-recent'),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      body: {
        password: 'VaultPassw0rd!',
      },
    });

    assert.equal(updatedHash, 'new-vault-password-hash');
  });
});

test('setVaultPassword rejects oauth-only account without recent login', async () => {
  await withStepUpEnv(async () => {
    const nowMs = 1_700_000_000_000;
    const service = buildStepUpService({
      userRepositoryApi: {
        findByIdForLogin: async () => ({
          id: 'user-1',
          email: 'oauth@example.com',
          name: null,
          role: 'member',
          passwordHash: null,
          vaultPasswordHash: null,
        }),
        updateVaultPasswordHash: async () => {
          throw new Error('should not be called');
        },
      } as never,
      comparePasswordFn: async () => false,
      hashPasswordFn: async () => 'new-vault-password-hash',
      verifyAccessTokenFn: async () => ({
        sub: 'user-1',
        email: 'oauth@example.com',
        role: 'member',
        type: 'access',
        issuedAt: Math.floor(nowMs / 1000) - 3_600,
      }),
      nowMsFn: () => nowMs,
    });

    await assert.rejects(
      () =>
        service.setVaultPassword({
          request: asRequest('Bearer access-token-oauth-stale'),
          userId: 'user-1',
          workspaceId: 'workspace-1',
          body: {
            password: 'VaultPassw0rd!',
          },
        }),
      (error) =>
        error instanceof HttpError
        && error.statusCode === 403
        && error.code === 'STEP_UP_RECENT_LOGIN_REQUIRED',
    );
  });
});

