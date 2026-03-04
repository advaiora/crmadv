import type { FastifyRequest } from 'fastify';
import { TEAM_MODULE_KEY, TEAM_PERMISSIONS, type TeamPermissionKey } from '../../auth/rbac-catalog.js';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

type EnsureTeamAccessDependencies = {
  requireAuthFn: typeof requireAuth;
  requireWorkspaceFn: typeof requireWorkspace;
  requireModuleEnabledFn: typeof requireModuleEnabled;
  requirePermissionFn: typeof requirePermission;
};

const defaultDependencies: EnsureTeamAccessDependencies = {
  requireAuthFn: requireAuth,
  requireWorkspaceFn: requireWorkspace,
  requireModuleEnabledFn: requireModuleEnabled,
  requirePermissionFn: requirePermission,
};

export const buildEnsureTeamAccess = (
  dependencies: EnsureTeamAccessDependencies = defaultDependencies,
) => {
  return async (
    request: FastifyRequest,
    permissionKey: TeamPermissionKey,
  ) => {
    const user = await dependencies.requireAuthFn(request);
    const workspace = await dependencies.requireWorkspaceFn(request, user.id);

    await dependencies.requireModuleEnabledFn(workspace.id, TEAM_MODULE_KEY);
    await dependencies.requirePermissionFn(user.id, workspace.id, permissionKey);

    return { user, workspace };
  };
};

export const ensureTeamAccess = buildEnsureTeamAccess();
export { TEAM_MODULE_KEY, TEAM_PERMISSIONS };
export type { TeamPermissionKey };
