import assert from 'node:assert/strict';
import test from 'node:test';
import { resetVaultUnlockRuntimeConfigCacheForTests } from './unlock-config.js';
import {
  hashAccessTokenForVaultUnlock,
  issueVaultUnlockToken,
  validateVaultUnlockToken,
} from './unlock-token.js';

const withVaultUnlockEnv = async (fn: () => Promise<void> | void) => {
  const previousUnlockSecret = process.env.VAULT_UNLOCK_TOKEN_SECRET;
  const previousJwtSecret = process.env.AUTH_JWT_SECRET;
  const previousTtl = process.env.VAULT_UNLOCK_TTL_SECONDS;

  process.env.VAULT_UNLOCK_TOKEN_SECRET = 'vault-unlock-token-secret-for-tests-0123456789';
  process.env.AUTH_JWT_SECRET = 'vault-unlock-jwt-fallback-secret-0123456789';
  process.env.VAULT_UNLOCK_TTL_SECONDS = '900';
  resetVaultUnlockRuntimeConfigCacheForTests();

  try {
    await fn();
  } finally {
    process.env.VAULT_UNLOCK_TOKEN_SECRET = previousUnlockSecret;
    process.env.AUTH_JWT_SECRET = previousJwtSecret;
    process.env.VAULT_UNLOCK_TTL_SECONDS = previousTtl;
    resetVaultUnlockRuntimeConfigCacheForTests();
  }
};

test('vault unlock token validates with matching user/workspace/session', async () => {
  await withVaultUnlockEnv(async () => {
    const sessionHash = hashAccessTokenForVaultUnlock('access-token-1');
    const { token } = issueVaultUnlockToken({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      sessionHash,
      nowMs: 1_700_000_000_000,
    });

    const validation = validateVaultUnlockToken({
      token,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      sessionHash,
      nowMs: 1_700_000_050_000,
    });

    assert.equal(validation.valid, true);
  });
});

test('vault unlock token fails with workspace mismatch', async () => {
  await withVaultUnlockEnv(async () => {
    const sessionHash = hashAccessTokenForVaultUnlock('access-token-1');
    const { token } = issueVaultUnlockToken({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      sessionHash,
      nowMs: 1_700_000_000_000,
    });

    const validation = validateVaultUnlockToken({
      token,
      userId: 'user-1',
      workspaceId: 'workspace-2',
      sessionHash,
      nowMs: 1_700_000_010_000,
    });

    assert.equal(validation.valid, false);
    if (!validation.valid) {
      assert.equal(validation.reason, 'workspace_mismatch');
    }
  });
});

test('vault unlock token fails after expiration', async () => {
  await withVaultUnlockEnv(async () => {
    const sessionHash = hashAccessTokenForVaultUnlock('access-token-1');
    const { token } = issueVaultUnlockToken({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      sessionHash,
      ttlSeconds: 60,
      nowMs: 1_700_000_000_000,
    });

    const validation = validateVaultUnlockToken({
      token,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      sessionHash,
      nowMs: 1_700_000_061_000,
    });

    assert.equal(validation.valid, false);
    if (!validation.valid) {
      assert.equal(validation.reason, 'expired');
    }
  });
});
