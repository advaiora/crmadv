import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { HttpError } from '../../../core/errors.js';
import { resetStepUpRuntimeConfigCacheForTests } from './config.js';
import { requireStepUp } from './guards.js';
import { stepUpScopes } from './scopes.js';
import { hashAccessTokenForStepUp, issueStepUpToken } from './token.js';

const withStepUpEnv = async (fn: () => Promise<void> | void) => {
  const previousStepUpSecret = process.env.STEP_UP_TOKEN_SECRET;
  const previousJwtSecret = process.env.AUTH_JWT_SECRET;
  const previousTtl = process.env.STEP_UP_TTL_SECONDS;

  process.env.STEP_UP_TOKEN_SECRET = 'stepup-guard-secret-for-tests-0123456789';
  process.env.AUTH_JWT_SECRET = 'jwt-guard-secret-for-tests-0123456789';
  process.env.STEP_UP_TTL_SECONDS = '120';
  resetStepUpRuntimeConfigCacheForTests();

  try {
    await fn();
  } finally {
    process.env.STEP_UP_TOKEN_SECRET = previousStepUpSecret;
    process.env.AUTH_JWT_SECRET = previousJwtSecret;
    process.env.STEP_UP_TTL_SECONDS = previousTtl;
    resetStepUpRuntimeConfigCacheForTests();
  }
};

const asRequest = (headers: Record<string, string>): FastifyRequest =>
  ({
    headers,
  } as unknown as FastifyRequest);

test('requireStepUp throws STEP_UP_REQUIRED when token is missing', async () => {
  await withStepUpEnv(async () => {
    await assert.rejects(
      () =>
        requireStepUp(
          asRequest({
            authorization: 'Bearer access-token-guard-1',
          }),
          {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            scope: stepUpScopes.vaultReveal,
          },
        ),
      (error) =>
        error instanceof HttpError
        && error.statusCode === 403
        && error.code === 'STEP_UP_REQUIRED',
    );
  });
});

test('requireStepUp throws STEP_UP_INVALID when workspace does not match', async () => {
  await withStepUpEnv(async () => {
    const accessToken = 'access-token-guard-2';
    const sessionHash = hashAccessTokenForStepUp(accessToken);
    const issued = issueStepUpToken({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      scope: stepUpScopes.vaultReveal,
      sessionHash,
      nowMs: Date.now(),
    });

    await assert.rejects(
      () =>
        requireStepUp(
          asRequest({
            authorization: `Bearer ${accessToken}`,
            cookie: `stepup=${encodeURIComponent(issued.token)}`,
          }),
          {
            userId: 'user-1',
            workspaceId: 'workspace-2',
            scope: stepUpScopes.vaultReveal,
          },
        ),
      (error) =>
        error instanceof HttpError
        && error.statusCode === 403
        && error.code === 'STEP_UP_INVALID',
    );
  });
});
