import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { forbidden, isHttpError } from '../core/errors.js';
import { buildEnsureAccess } from './guards.js';

test('ensureAccess returns 403 when module is disabled', async () => {
  const ensureAccess = buildEnsureAccess({
    requireWorkspaceFn: async () => ({
      user: { id: 'user-1' } as never,
      workspace: { id: 'workspace-1' } as never,
      workspaceId: 'workspace-1',
    }),
    requireModuleEnabledFn: async () => {
      throw forbidden('Module disabled');
    },
    requirePermissionFn: async () => undefined,
  });

  await assert.rejects(
    async () => ensureAccess({} as FastifyRequest, { moduleKey: 'projects' }),
    (error) => isHttpError(error) && error.statusCode === 403,
  );
});

test('ensureAccess returns 403 when permission is missing', async () => {
  const ensureAccess = buildEnsureAccess({
    requireWorkspaceFn: async () => ({
      user: { id: 'user-1' } as never,
      workspace: { id: 'workspace-1' } as never,
      workspaceId: 'workspace-1',
    }),
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async () => {
      throw forbidden('Permission denied');
    },
  });

  await assert.rejects(
    async () =>
      ensureAccess({} as FastifyRequest, {
        moduleKey: 'projects',
        permission: 'projects.move_stage',
      }),
    (error) => isHttpError(error) && error.statusCode === 403,
  );
});

test('ensureAccess forwards resolved workspaceId to permission checks', async () => {
  let receivedWorkspaceId = '';

  const ensureAccess = buildEnsureAccess({
    requireWorkspaceFn: async () => ({
      user: { id: 'user-1' } as never,
      workspace: { id: 'workspace-xyz' } as never,
      workspaceId: 'workspace-xyz',
    }),
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async (workspaceId) => {
      receivedWorkspaceId = workspaceId;
    },
  });

  await ensureAccess({} as FastifyRequest, {
    permission: 'clients.view',
  });

  assert.equal(receivedWorkspaceId, 'workspace-xyz');
});
