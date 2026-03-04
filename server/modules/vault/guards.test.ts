import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { HttpError } from '../../core/errors.js';
import { buildEnsureVaultAccess } from './guards.js';
import { VaultPermissions } from './policies.js';

const mockRequest = {} as FastifyRequest;
const mockUser = {
  id: 'user-1',
  email: 'user-1@example.com',
  name: 'User One',
  role: 'admin',
};
const mockWorkspace = {
  id: 'workspace-1',
  name: 'Workspace One',
  slug: 'workspace-one',
};
const mockStepUpPayload = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  scope: 'vault:reveal' as const,
  iat: 1,
  exp: 2,
};

test('ensureVaultAccess requires step-up for vault.reveal', async () => {
  let stepUpCalls = 0;
  const ensureVaultAccess = buildEnsureVaultAccess({
    requireAuthFn: async () => mockUser,
    requireWorkspaceFn: async () => mockWorkspace,
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async () => undefined,
    requireVaultUnlockedFn: async () => undefined,
    logVaultAuditFn: async () => undefined as never,
    requireStepUpFn: async (_request, input) => {
      stepUpCalls += 1;
      assert.equal(input.userId, 'user-1');
      assert.equal(input.workspaceId, 'workspace-1');
      assert.equal(input.scope, 'vault:reveal');
      return mockStepUpPayload;
    },
  });

  await ensureVaultAccess(mockRequest, VaultPermissions.reveal);
  assert.equal(stepUpCalls, 1);
});

test('ensureVaultAccess skips step-up when explicit skipStepUp is true', async () => {
  let stepUpCalls = 0;
  const ensureVaultAccess = buildEnsureVaultAccess({
    requireAuthFn: async () => mockUser,
    requireWorkspaceFn: async () => mockWorkspace,
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async () => undefined,
    requireVaultUnlockedFn: async () => undefined,
    logVaultAuditFn: async () => undefined as never,
    requireStepUpFn: async () => {
      stepUpCalls += 1;
      return mockStepUpPayload;
    },
  });

  await ensureVaultAccess(mockRequest, VaultPermissions.reveal, { skipStepUp: true });
  assert.equal(stepUpCalls, 0);
});

test('ensureVaultAccess does not require step-up for non-reveal permissions', async () => {
  let stepUpCalls = 0;
  const ensureVaultAccess = buildEnsureVaultAccess({
    requireAuthFn: async () => mockUser,
    requireWorkspaceFn: async () => mockWorkspace,
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async () => undefined,
    requireVaultUnlockedFn: async () => undefined,
    logVaultAuditFn: async () => undefined as never,
    requireStepUpFn: async () => {
      stepUpCalls += 1;
      return mockStepUpPayload;
    },
  });

  await ensureVaultAccess(mockRequest, VaultPermissions.viewList);
  assert.equal(stepUpCalls, 0);
});

test('ensureVaultAccess enforces vault unlock before authorization-sensitive operations', async () => {
  const ensureVaultAccess = buildEnsureVaultAccess({
    requireAuthFn: async () => mockUser,
    requireWorkspaceFn: async () => mockWorkspace,
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async () => undefined,
    requireVaultUnlockedFn: async () => {
      throw new HttpError(423, 'VAULT_LOCKED', 'Vault is locked for this workspace');
    },
    requireStepUpFn: async () => mockStepUpPayload,
    logVaultAuditFn: async () => undefined as never,
  });

  await assert.rejects(
    () => ensureVaultAccess(mockRequest, VaultPermissions.viewList),
    (error) => error instanceof HttpError && error.code === 'VAULT_LOCKED',
  );
});

test('ensureVaultAccess writes reveal_denied audit on reveal authorization failures', async () => {
  const auditCalls: Array<Record<string, unknown>> = [];
  const ensureVaultAccess = buildEnsureVaultAccess({
    requireAuthFn: async () => mockUser,
    requireWorkspaceFn: async () => mockWorkspace,
    requireModuleEnabledFn: async () => undefined,
    requirePermissionFn: async () => undefined,
    requireVaultUnlockedFn: async () => undefined,
    requireStepUpFn: async () => {
      throw new HttpError(403, 'STEP_UP_REQUIRED', 'Step-up required');
    },
    logVaultAuditFn: async (input) => {
      auditCalls.push(input as unknown as Record<string, unknown>);
      return undefined as never;
    },
  });

  await assert.rejects(
    () => ensureVaultAccess(mockRequest, VaultPermissions.reveal),
    (error) => error instanceof HttpError && error.code === 'STEP_UP_REQUIRED',
  );

  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'vault.reveal_denied');
  assert.equal(auditCalls[0].workspaceId, 'workspace-1');
});
