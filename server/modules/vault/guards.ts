import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';
import {
  VAULT_MODULE_KEY,
  VaultPermissions,
  type VaultPermissionKey,
} from './policies.js';

type EnsureVaultAccessDependencies = {
  requireAuthFn: typeof requireAuth;
  requireWorkspaceFn: typeof requireWorkspace;
  requireModuleEnabledFn: typeof requireModuleEnabled;
  requirePermissionFn: typeof requirePermission;
};

const defaultDependencies: EnsureVaultAccessDependencies = {
  requireAuthFn: requireAuth,
  requireWorkspaceFn: requireWorkspace,
  requireModuleEnabledFn: requireModuleEnabled,
  requirePermissionFn: requirePermission,
};

const assertRevealStepUpStub = async (
  _request: FastifyRequest,
  permissionKey: VaultPermissionKey,
) => {
  if (permissionKey !== VaultPermissions.reveal) {
    return;
  }

  // TODO(vault-phase-4): enforce step-up authentication (re-auth) before vault.reveal.
};

export const buildEnsureVaultAccess = (
  dependencies: EnsureVaultAccessDependencies = defaultDependencies,
) => {
  return async (
    request: FastifyRequest,
    permissionKey: VaultPermissionKey,
  ) => {
    const user = await dependencies.requireAuthFn(request);
    const workspace = await dependencies.requireWorkspaceFn(request, user.id);

    // Workspace scope is mandatory: all Vault endpoints are workspace-bound.
    await dependencies.requireModuleEnabledFn(workspace.id, VAULT_MODULE_KEY);
    await dependencies.requirePermissionFn(user.id, workspace.id, permissionKey);
    await assertRevealStepUpStub(request, permissionKey);

    return { user, workspace };
  };
};

export const ensureVaultAccess = buildEnsureVaultAccess();

