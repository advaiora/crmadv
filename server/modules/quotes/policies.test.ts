import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { HttpError, forbidden } from '../../core/errors.js';
import { QUOTES_PERMISSIONS, buildEnsureQuotesAccess } from './policies.js';

test('ensureQuotesAccess returns 403 when quotes module is disabled', async () => {
  const ensureQuotesAccess = buildEnsureQuotesAccess({
    requireAuthFn: async () => ({ id: 'user-1' } as never),
    requireWorkspaceFn: async () => ({ id: 'workspace-1' } as never),
    requireModuleEnabledFn: async () => {
      throw forbidden('Module is disabled for this workspace');
    },
    requirePermissionFn: async () => undefined,
  });

  await assert.rejects(
    async () =>
      ensureQuotesAccess({} as FastifyRequest, QUOTES_PERMISSIONS.view),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  );
});
