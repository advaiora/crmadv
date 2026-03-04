import type { FastifyRequest } from 'fastify';
import {
  DASHBOARD_MODULE_KEY,
  DASHBOARD_PERMISSIONS,
  type DashboardPermissionKey,
} from '../../auth/rbac-catalog.js';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

type EnsureDashboardAccessDependencies = {
  requireAuthFn: typeof requireAuth;
  requireWorkspaceFn: typeof requireWorkspace;
  requireModuleEnabledFn: typeof requireModuleEnabled;
  requirePermissionFn: typeof requirePermission;
};

const defaultDependencies: EnsureDashboardAccessDependencies = {
  requireAuthFn: requireAuth,
  requireWorkspaceFn: requireWorkspace,
  requireModuleEnabledFn: requireModuleEnabled,
  requirePermissionFn: requirePermission,
};

export const DASHBOARD_ROLE_TIER = {
  superadmin: 'superadmin',
  admin: 'admin',
  manager: 'manager',
  operativo: 'operativo',
  viewer: 'viewer',
} as const;

export type DashboardRoleTier =
  (typeof DASHBOARD_ROLE_TIER)[keyof typeof DASHBOARD_ROLE_TIER];

const DASHBOARD_ROLE_TIER_PRIORITY: Record<DashboardRoleTier, number> = {
  [DASHBOARD_ROLE_TIER.superadmin]: 5,
  [DASHBOARD_ROLE_TIER.admin]: 4,
  [DASHBOARD_ROLE_TIER.manager]: 3,
  [DASHBOARD_ROLE_TIER.operativo]: 2,
  [DASHBOARD_ROLE_TIER.viewer]: 1,
};

const normalizeToken = (value: string) => value.trim().toLowerCase();

export const normalizeRoleTierName = (value: string | null | undefined): DashboardRoleTier | null => {
  if (!value) {
    return null;
  }

  const normalized = normalizeToken(value);
  if (
    normalized !== DASHBOARD_ROLE_TIER.superadmin &&
    normalized !== DASHBOARD_ROLE_TIER.admin &&
    normalized !== DASHBOARD_ROLE_TIER.manager &&
    normalized !== DASHBOARD_ROLE_TIER.operativo &&
    normalized !== DASHBOARD_ROLE_TIER.viewer
  ) {
    return null;
  }

  return normalized;
};

export const resolveRoleTierFromRoleNames = (
  roleNames: string[],
): DashboardRoleTier | null => {
  let highestRole: DashboardRoleTier | null = null;

  for (const roleName of roleNames) {
    const normalizedRole = normalizeRoleTierName(roleName);
    if (!normalizedRole) {
      continue;
    }

    if (!highestRole) {
      highestRole = normalizedRole;
      continue;
    }

    if (DASHBOARD_ROLE_TIER_PRIORITY[normalizedRole] > DASHBOARD_ROLE_TIER_PRIORITY[highestRole]) {
      highestRole = normalizedRole;
    }
  }

  return highestRole;
};

export const hasPermissionKey = (
  permissionKeys: string[],
  requiredPermissionKey: string,
) => permissionKeys.includes(requiredPermissionKey);

export const hasAnyPermissionKey = (
  permissionKeys: string[],
  requiredPermissionKeys: string[],
) => requiredPermissionKeys.some((permissionKey) => permissionKeys.includes(permissionKey));

export const resolveRoleTierFromPermissions = (
  permissionKeys: string[],
): DashboardRoleTier => {
  if (
    hasAnyPermissionKey(permissionKeys, [
      'modules.manage',
      'roles.manage',
      'roles.assign',
      'team.roles_assign',
    ])
  ) {
    return DASHBOARD_ROLE_TIER.superadmin;
  }

  if (
    hasAnyPermissionKey(permissionKeys, [
      'team.edit',
      'projects.edit',
      'projects.move_stage',
      'quotes.send',
      'quotes.accept',
      'checklists.edit',
    ])
  ) {
    return DASHBOARD_ROLE_TIER.manager;
  }

  if (
    hasAnyPermissionKey(permissionKeys, [
      'checklists.complete_item',
      'projects.view',
      'team.view',
    ])
  ) {
    return DASHBOARD_ROLE_TIER.operativo;
  }

  return DASHBOARD_ROLE_TIER.viewer;
};

export const buildEnsureDashboardAccess = (
  dependencies: EnsureDashboardAccessDependencies = defaultDependencies,
) => {
  return async (
    request: FastifyRequest,
    permissionKey: DashboardPermissionKey,
  ) => {
    const user = await dependencies.requireAuthFn(request);
    const workspace = await dependencies.requireWorkspaceFn(request, user.id);

    await dependencies.requireModuleEnabledFn(workspace.id, DASHBOARD_MODULE_KEY);
    await dependencies.requirePermissionFn(user.id, workspace.id, permissionKey);

    return { user, workspace };
  };
};

export const ensureDashboardAccess = buildEnsureDashboardAccess();

export { DASHBOARD_MODULE_KEY, DASHBOARD_PERMISSIONS };
export type { DashboardPermissionKey };
