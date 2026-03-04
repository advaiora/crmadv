import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../core/errors.js';
import {
  enforceTeamInviteAcceptRateLimit,
  enforceTeamInviteCreateRateLimit,
  resetTeamRateLimitStoreForTests,
} from './rate-limit.js';

test.beforeEach(() => {
  resetTeamRateLimitStoreForTests();
});

test('invite create limiter blocks bursts per actor/workspace key', async () => {
  for (let index = 0; index < 12; index += 1) {
    enforceTeamInviteCreateRateLimit({
      workspaceId: 'workspace-1',
      actorUserId: 'user-1',
      clientIp: '127.0.0.1',
      nowMs: 1_000,
    });
  }

  await assert.rejects(
    async () =>
      enforceTeamInviteCreateRateLimit({
        workspaceId: 'workspace-1',
        actorUserId: 'user-1',
        clientIp: '127.0.0.1',
        nowMs: 1_000,
      }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 429,
  );
});

test('invite accept limiter blocks repeated attempts for same tokenHash', async () => {
  for (let index = 0; index < 8; index += 1) {
    enforceTeamInviteAcceptRateLimit({
      clientIp: '127.0.0.1',
      tokenHash: 'token-hash-1',
      nowMs: 1_000,
    });
  }

  await assert.rejects(
    async () =>
      enforceTeamInviteAcceptRateLimit({
        clientIp: '127.0.0.1',
        tokenHash: 'token-hash-1',
        nowMs: 1_000,
      }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 429,
  );
});
