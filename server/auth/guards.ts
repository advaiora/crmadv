import type { FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth as requireAuthLegacy } from '../guards/requireAuth.js';
import { requireModuleEnabled as requireModuleEnabledLegacy } from '../guards/requireModule.js';
import { requirePermission as requirePermissionLegacy } from '../guards/requirePermission.js';
import { requireWorkspace as requireWorkspaceLegacy } from '../guards/requireWorkspace.js';

type AccessOptions = {
  moduleKey?: string;
  permission?: string;
};

export type GuardAccessContext = {
  user: Awaited<ReturnType<typeof requireAuthLegacy>>;
  workspace: Awaited<ReturnType<typeof requireWorkspaceLegacy>>;
  workspaceId: string;
};

export const requireAuth = (request: FastifyRequest) => requireAuthLegacy(request);

export const requireWorkspace = async (
  request: FastifyRequest,
  user?: Awaited<ReturnType<typeof requireAuthLegacy>>,
) => {
  const resolvedUser = user ?? await requireAuthLegacy(request);
  const workspace = await requireWorkspaceLegacy(request, resolvedUser.id);

  return {
    user: resolvedUser,
    workspace,
    workspaceId: workspace.id,
  };
};

export const requireModuleEnabled = (workspaceId: string, moduleKey: string) =>
  requireModuleEnabledLegacy(workspaceId, moduleKey);

export const requirePermission = (
  workspaceId: string,
  userId: string,
  permissionKey: string,
) => requirePermissionLegacy(userId, workspaceId, permissionKey);

type EnsureAccessDependencies = {
  requireWorkspaceFn: typeof requireWorkspace;
  requireModuleEnabledFn: typeof requireModuleEnabled;
  requirePermissionFn: typeof requirePermission;
};

const defaultEnsureAccessDependencies: EnsureAccessDependencies = {
  requireWorkspaceFn: requireWorkspace,
  requireModuleEnabledFn: requireModuleEnabled,
  requirePermissionFn: requirePermission,
};

export const buildEnsureAccess = (
  dependencies: EnsureAccessDependencies = defaultEnsureAccessDependencies,
) =>
  async (
    request: FastifyRequest,
    options: AccessOptions = {},
  ): Promise<GuardAccessContext> => {
    const auth = await dependencies.requireWorkspaceFn(request);

    if (options.moduleKey) {
      await dependencies.requireModuleEnabledFn(auth.workspaceId, options.moduleKey);
    }

    if (options.permission) {
      await dependencies.requirePermissionFn(auth.workspaceId, auth.user.id, options.permission);
    }

    return auth;
  };

export const ensureAccess = buildEnsureAccess();

type GuardedHandler<TRequest extends FastifyRequest = FastifyRequest> = (
  request: TRequest,
  reply: FastifyReply,
  access: GuardAccessContext,
) => Promise<unknown> | unknown;

export const withGuards = <TRequest extends FastifyRequest = FastifyRequest>(
  handler: GuardedHandler<TRequest>,
  options: AccessOptions = {},
) =>
  async (request: TRequest, reply: FastifyReply) => {
    const access = await ensureAccess(request, options);
    return handler(request, reply, access);
  };
