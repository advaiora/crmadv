import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

export const WEB_ASSETS_MODULE_KEY = 'web';

export const WEB_ASSETS_PERMISSIONS = {
  view: 'web.view',
  create: 'web.create',
  edit: 'web.edit',
  delete: 'web.delete',
  publish: 'web.publish',
  unpublish: 'web.unpublish',
  versionCreate: 'web.version.create',
  versionRollback: 'web.version.rollback',
} as const;

export type WebAssetsPermissionKey =
  (typeof WEB_ASSETS_PERMISSIONS)[keyof typeof WEB_ASSETS_PERMISSIONS];

type EnsureWebAssetsAccessDependencies = {
  requireAuthFn: typeof requireAuth;
  requireWorkspaceFn: typeof requireWorkspace;
  requireModuleEnabledFn: typeof requireModuleEnabled;
  requirePermissionFn: typeof requirePermission;
};

const defaultDependencies: EnsureWebAssetsAccessDependencies = {
  requireAuthFn: requireAuth,
  requireWorkspaceFn: requireWorkspace,
  requireModuleEnabledFn: requireModuleEnabled,
  requirePermissionFn: requirePermission,
};

export const buildEnsureWebAssetsAccess = (
  dependencies: EnsureWebAssetsAccessDependencies = defaultDependencies,
) => {
  return async (
    request: FastifyRequest,
    permissionKey: WebAssetsPermissionKey,
  ) => {
    const user = await dependencies.requireAuthFn(request);
    const workspace = await dependencies.requireWorkspaceFn(request, user.id);

    await dependencies.requireModuleEnabledFn(workspace.id, WEB_ASSETS_MODULE_KEY);
    await dependencies.requirePermissionFn(user.id, workspace.id, permissionKey);

    return { user, workspace };
  };
};

export const ensureWebAssetsAccess = buildEnsureWebAssetsAccess();
