import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { HttpError, forbidden } from '../../core/errors.js';
import {
  DASHBOARD_PERMISSIONS,
  DASHBOARD_ROLE_TIER,
  buildEnsureDashboardAccess,
  resolveRoleTierFromPermissions,
  resolveRoleTierFromRoleNames,
} from './dashboard.policies.js';

test('ensureDashboardAccess returns 403 when dashboard module is disabled', async () => {
  const ensureDashboardAccess = buildEnsureDashboardAccess({
    requireAuthFn: async () => ({ id: 'user-1' } as never),
    requireWorkspaceFn: async () => ({ id: 'workspace-1' } as never),
    requireModuleEnabledFn: async () => {
      throw forbidden('Module is disabled for this workspace');
    },
    requirePermissionFn: async () => undefined,
  });

  await assert.rejects(
    async () => ensureDashboardAccess({} as FastifyRequest, DASHBOARD_PERMISSIONS.view),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  );
});

test('ensureDashboardAccess returns 403 when permission is missing', async () => {
  const ensureDashboardAccess = buildEnsureDashboardAccess({
    requireAuthFn: async () => ({ id: 'user-1' } as never),
    requireWorkspaceFn: async () => ({ id: 'workspace-1' } as never),
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async () => {
      throw forbidden('Permission denied');
    },
  });

  await assert.rejects(
    async () => ensureDashboardAccess({} as FastifyRequest, DASHBOARD_PERMISSIONS.view),
    (error: unknown) => error instanceof HttpError && error.statusCode === 403,
  );
});

test('resolveRoleTierFromRoleNames chooses highest role priority', () => {
  const role = resolveRoleTierFromRoleNames(['Viewer', 'Manager']);
  assert.equal(role, DASHBOARD_ROLE_TIER.manager);
});

test('resolveRoleTierFromPermissions infers superadmin tier from management permissions', () => {
  const role = resolveRoleTierFromPermissions(['modules.manage']);
  assert.equal(role, DASHBOARD_ROLE_TIER.superadmin);
});

test('resolveRoleTierFromPermissions falls back to viewer when permissions are read-only', () => {
  const role = resolveRoleTierFromPermissions(['dashboard.view']);
  assert.equal(role, DASHBOARD_ROLE_TIER.viewer);
});
