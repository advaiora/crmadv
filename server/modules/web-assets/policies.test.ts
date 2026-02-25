import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { HttpError, forbidden } from '../../core/errors.js';
import {
  WEB_ASSETS_PERMISSIONS,
  buildEnsureWebAssetsAccess,
} from './policies.js';

test('ensureWebAssetsAccess returns 403 when web module is disabled', async () => {
  const ensureWebAssetsAccess = buildEnsureWebAssetsAccess({
    requireAuthFn: async () => ({ id: 'user-1' } as never),
    requireWorkspaceFn: async () => ({ id: 'workspace-1' } as never),
    requireModuleEnabledFn: async () => {
      throw forbidden('Module is disabled for this workspace');
    },
    requirePermissionFn: async () => undefined,
  });

  await assert.rejects(
    async () =>
      ensureWebAssetsAccess({} as FastifyRequest, WEB_ASSETS_PERMISSIONS.view),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  );
});

test('ensureWebAssetsAccess asks for publish permission when required', async () => {
  const permissionCalls: string[] = [];
  const ensureWebAssetsAccess = buildEnsureWebAssetsAccess({
    requireAuthFn: async () => ({ id: 'user-1' } as never),
    requireWorkspaceFn: async () => ({ id: 'workspace-1' } as never),
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async (_userId, _workspaceId, permissionKey) => {
      permissionCalls.push(permissionKey);
    },
  });

  await ensureWebAssetsAccess({} as FastifyRequest, WEB_ASSETS_PERMISSIONS.publish);

  assert.deepEqual(permissionCalls, [WEB_ASSETS_PERMISSIONS.publish]);
});
