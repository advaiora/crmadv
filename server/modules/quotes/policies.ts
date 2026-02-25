import type { FastifyRequest } from 'fastify';
import { requireAuth } from '../../guards/requireAuth.js';
import { requireModuleEnabled } from '../../guards/requireModule.js';
import { requirePermission } from '../../guards/requirePermission.js';
import { requireWorkspace } from '../../guards/requireWorkspace.js';

export const QUOTES_MODULE_KEY = 'quotes';

export const QUOTES_PERMISSIONS = {
  view: 'quotes.view',
  create: 'quotes.create',
  edit: 'quotes.edit',
  delete: 'quotes.delete',
  send: 'quotes.send',
  accept: 'quotes.accept',
  manageTemplates: 'quotes.manage_templates',
} as const;

export type QuotesPermissionKey =
  (typeof QUOTES_PERMISSIONS)[keyof typeof QUOTES_PERMISSIONS];

type EnsureQuotesAccessDependencies = {
  requireAuthFn: typeof requireAuth;
  requireWorkspaceFn: typeof requireWorkspace;
  requireModuleEnabledFn: typeof requireModuleEnabled;
  requirePermissionFn: typeof requirePermission;
};

const defaultDependencies: EnsureQuotesAccessDependencies = {
  requireAuthFn: requireAuth,
  requireWorkspaceFn: requireWorkspace,
  requireModuleEnabledFn: requireModuleEnabled,
  requirePermissionFn: requirePermission,
};

export const buildEnsureQuotesAccess = (
  dependencies: EnsureQuotesAccessDependencies = defaultDependencies,
) => {
  return async (
    request: FastifyRequest,
    permissionKey: QuotesPermissionKey,
  ) => {
    const user = await dependencies.requireAuthFn(request);
    const workspace = await dependencies.requireWorkspaceFn(request, user.id);

    await dependencies.requireModuleEnabledFn(workspace.id, QUOTES_MODULE_KEY);
    await dependencies.requirePermissionFn(user.id, workspace.id, permissionKey);

    return { user, workspace };
  };
};

export const ensureQuotesAccess = buildEnsureQuotesAccess();
