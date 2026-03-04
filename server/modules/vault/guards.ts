import type { FastifyRequest } from 'fastify';
import { isHttpError } from '../../core/errors.js';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';
import { requireStepUp } from '../security/stepup/guards.js';
import { stepUpScopes } from '../security/stepup/scopes.js';
import { logVaultAuditEvent, VaultAuditActions } from './audit.js';
import { requireVaultUnlocked } from './unlock.guard.js';
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
  requireVaultUnlockedFn: typeof requireVaultUnlocked;
  requireStepUpFn: typeof requireStepUp;
  logVaultAuditFn: typeof logVaultAuditEvent;
};

const defaultDependencies: EnsureVaultAccessDependencies = {
  requireAuthFn: requireAuth,
  requireWorkspaceFn: requireWorkspace,
  requireModuleEnabledFn: requireModuleEnabled,
  requirePermissionFn: requirePermission,
  requireVaultUnlockedFn: requireVaultUnlocked,
  requireStepUpFn: requireStepUp,
  logVaultAuditFn: logVaultAuditEvent,
};

export type EnsureVaultAccessOptions = {
  skipVaultUnlock?: boolean;
  skipStepUp?: boolean;
};

export const buildEnsureVaultAccess = (
  dependencies: EnsureVaultAccessDependencies = defaultDependencies,
) => {
  return async (
    request: FastifyRequest,
    permissionKey: VaultPermissionKey,
    options?: EnsureVaultAccessOptions,
  ) => {
    const user = await dependencies.requireAuthFn(request);
    const workspace = await dependencies.requireWorkspaceFn(request, user.id);

    // Workspace scope is mandatory: all Vault endpoints are workspace-bound.
    await dependencies.requireModuleEnabledFn(workspace.id, VAULT_MODULE_KEY);
    try {
      await dependencies.requirePermissionFn(user.id, workspace.id, permissionKey);

      if (!options?.skipVaultUnlock) {
        await dependencies.requireVaultUnlockedFn(request, {
          userId: user.id,
          workspaceId: workspace.id,
        });
      }

      if (!options?.skipStepUp && permissionKey === VaultPermissions.reveal) {
        await dependencies.requireStepUpFn(request, {
          userId: user.id,
          workspaceId: workspace.id,
          scope: stepUpScopes.vaultReveal,
        });
      }
    } catch (error) {
      const isRevealDenied =
        permissionKey === VaultPermissions.reveal
        && isHttpError(error)
        && error.statusCode === 403;

      if (isRevealDenied) {
        try {
          await dependencies.logVaultAuditFn({
            action: VaultAuditActions.revealDenied,
            workspaceId: workspace.id,
            actorUserId: user.id,
            metadata: {
              reasonCode: error.code,
            },
            request,
          });
        } catch {
          // Do not mask authorization errors if audit storage is unavailable.
        }
      }

      throw error;
    }

    return { user, workspace };
  };
};

export const ensureVaultAccess = buildEnsureVaultAccess();
