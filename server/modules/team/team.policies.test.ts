import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { HttpError, forbidden } from '../../core/errors.js';
import { TEAM_PERMISSIONS, buildEnsureTeamAccess } from './team.policies.js';

test('ensureTeamAccess returns 403 when team module is disabled', async () => {
  const ensureTeamAccess = buildEnsureTeamAccess({
    requireAuthFn: async () => ({ id: 'user-1' } as never),
    requireWorkspaceFn: async () => ({ id: 'workspace-1' } as never),
    requireModuleEnabledFn: async () => {
      throw forbidden('Module is disabled for this workspace');
    },
    requirePermissionFn: async () => undefined,
  });

  await assert.rejects(
    async () => ensureTeamAccess({} as FastifyRequest, TEAM_PERMISSIONS.view),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  );
});

test('ensureTeamAccess returns 403 when permission is missing', async () => {
  const ensureTeamAccess = buildEnsureTeamAccess({
    requireAuthFn: async () => ({ id: 'user-1' } as never),
    requireWorkspaceFn: async () => ({ id: 'workspace-1' } as never),
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async () => {
      throw forbidden('Permission denied');
    },
  });

  await assert.rejects(
    async () => ensureTeamAccess({} as FastifyRequest, TEAM_PERMISSIONS.view),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  );
});
