import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../core/errors.js';
import {
  enforceVaultStepUpRateLimit,
  enforceVaultUnlockRateLimit,
  registerVaultUnlockFailure,
  resetVaultRateLimitStoreForTests,
} from './rate-limit.js';

const UNLOCK_WINDOW_MS = 5 * 60 * 1000;
const actor = { userId: 'user-1', workspaceId: 'workspace-1' };

const expectRateLimited = (run: () => void) => {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.statusCode, 429);
    assert.equal(error.code, 'RATE_LIMITED');
    return true;
  });
};

test('vault unlock rate limit lets a clean actor through', () => {
  resetVaultRateLimitStoreForTests();

  assert.doesNotThrow(() => enforceVaultUnlockRateLimit({ ...actor, nowMs: 1_000 }));
});

test('vault unlock rate limit blocks the sixth attempt after five failures', () => {
  resetVaultRateLimitStoreForTests();

  for (let index = 0; index < 5; index += 1) {
    assert.doesNotThrow(() => enforceVaultUnlockRateLimit({ ...actor, nowMs: 1_000 + index }));
    registerVaultUnlockFailure({ ...actor, nowMs: 1_000 + index });
  }

  expectRateLimited(() => enforceVaultUnlockRateLimit({ ...actor, nowMs: 1_010 }));
});

test('vault unlock rate limit opens a new window once the old one expires', () => {
  resetVaultRateLimitStoreForTests();

  for (let index = 0; index < 5; index += 1) {
    registerVaultUnlockFailure({ ...actor, nowMs: 1_000 });
  }

  expectRateLimited(() => enforceVaultUnlockRateLimit({ ...actor, nowMs: 1_000 + UNLOCK_WINDOW_MS - 1 }));
  assert.doesNotThrow(() => enforceVaultUnlockRateLimit({ ...actor, nowMs: 1_000 + UNLOCK_WINDOW_MS }));
});

test('vault unlock rate limit keeps one bucket per user and per workspace', () => {
  resetVaultRateLimitStoreForTests();

  for (let index = 0; index < 5; index += 1) {
    registerVaultUnlockFailure({ ...actor, nowMs: 1_000 });
  }

  expectRateLimited(() => enforceVaultUnlockRateLimit({ ...actor, nowMs: 1_000 }));
  assert.doesNotThrow(() => enforceVaultUnlockRateLimit({
    userId: 'user-2',
    workspaceId: 'workspace-1',
    nowMs: 1_000,
  }));
  assert.doesNotThrow(() => enforceVaultUnlockRateLimit({
    userId: 'user-1',
    workspaceId: 'workspace-2',
    nowMs: 1_000,
  }));
});

// Lo step-up conta ogni richiesta, non solo quelle fallite: la prova serve a tenere fermo
// quel comportamento ora che il contatore e il controllo della finestra sono due funzioni.
test('vault step-up rate limit still counts every request and resets after the window', () => {
  resetVaultRateLimitStoreForTests();
  const stepUpActor = { ...actor, clientIp: '203.0.113.7' };

  for (let index = 0; index < 5; index += 1) {
    assert.doesNotThrow(() => enforceVaultStepUpRateLimit({ ...stepUpActor, nowMs: 1_000 }));
  }

  expectRateLimited(() => enforceVaultStepUpRateLimit({ ...stepUpActor, nowMs: 1_000 }));
  assert.doesNotThrow(() => enforceVaultStepUpRateLimit({
    ...stepUpActor,
    nowMs: 1_000 + 5 * 60 * 1000,
  }));
});
