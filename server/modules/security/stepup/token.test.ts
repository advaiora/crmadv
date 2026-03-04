import assert from 'node:assert/strict';
import test from 'node:test';
import { resetStepUpRuntimeConfigCacheForTests } from './config.js';
import { stepUpScopes } from './scopes.js';
import { hashAccessTokenForStepUp, issueStepUpToken, validateStepUpToken } from './token.js';

const withStepUpEnv = async (fn: () => Promise<void> | void) => {
  const previousStepUpSecret = process.env.STEP_UP_TOKEN_SECRET;
  const previousJwtSecret = process.env.AUTH_JWT_SECRET;
  const previousTtl = process.env.STEP_UP_TTL_SECONDS;

  process.env.STEP_UP_TOKEN_SECRET = 'stepup-secret-for-tests-0123456789';
  process.env.AUTH_JWT_SECRET = 'jwt-secret-for-tests-0123456789';
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

test('step-up token validates with matching user, workspace, scope and session binding', async () => {
  await withStepUpEnv(async () => {
    const sessionHash = hashAccessTokenForStepUp('access-token-1');
    const issued = issueStepUpToken({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      scope: stepUpScopes.vaultReveal,
      sessionHash,
      nowMs: 1_700_000_000_000,
    });

    const validation = validateStepUpToken({
      token: issued.token,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      scope: stepUpScopes.vaultReveal,
      sessionHash,
      nowMs: 1_700_000_030_000,
    });

    assert.equal(validation.valid, true);
  });
});

test('step-up token fails when workspace is different', async () => {
  await withStepUpEnv(async () => {
    const sessionHash = hashAccessTokenForStepUp('access-token-2');
    const issued = issueStepUpToken({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      scope: stepUpScopes.vaultReveal,
      sessionHash,
      nowMs: 1_700_000_000_000,
    });

    const validation = validateStepUpToken({
      token: issued.token,
      userId: 'user-1',
      workspaceId: 'workspace-2',
      scope: stepUpScopes.vaultReveal,
      sessionHash,
      nowMs: 1_700_000_020_000,
    });

    assert.equal(validation.valid, false);
    if (!validation.valid) {
      assert.equal(validation.reason, 'workspace_mismatch');
    }
  });
});

test('step-up token fails after expiration', async () => {
  await withStepUpEnv(async () => {
    const sessionHash = hashAccessTokenForStepUp('access-token-3');
    const issued = issueStepUpToken({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      scope: stepUpScopes.vaultReveal,
      sessionHash,
      nowMs: 1_700_000_000_000,
    });

    const validation = validateStepUpToken({
      token: issued.token,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      scope: stepUpScopes.vaultReveal,
      sessionHash,
      nowMs: 1_700_000_200_000,
    });

    assert.equal(validation.valid, false);
    if (!validation.valid) {
      assert.equal(validation.reason, 'expired');
    }
  });
});
