import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../audit/audit.js';
import { badRequest } from '../core/errors.js';
import { ok } from '../core/response.js';
import { requireAuth } from '../guards/requireAuth.js';
import { requirePermission } from '../guards/requirePermission.js';
import { requireWorkspace, requireWorkspaceFromParams } from '../guards/requireWorkspace.js';
import { workspaceModulesService } from '../services/workspace-modules.service.js';

type WorkspaceParams = {
  workspaceId: string;
};

type ModuleParams = {
  key: string;
};

const MANAGE_MODULES_PERMISSION = 'modules.manage';
const MODULES_AUDIT_ACTION = 'modules.manage';

const workspaceModulesRoute: FastifyPluginAsync = async (app) => {
  app.get('/modules', async (request, reply) => {
    const user = await requireAuth(request);
    const workspace = await requireWorkspace(request, user.id);
    await requirePermission(user.id, workspace.id, MANAGE_MODULES_PERMISSION);

    const modules = await workspaceModulesService.getWorkspaceModules(workspace.id);

    return ok(reply, {
      workspace,
      modules,
    });
  });

  app.patch<{ Params: ModuleParams; Body: unknown }>(
    '/modules/:key',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspace(request, user.id);
      await requirePermission(user.id, workspace.id, MANAGE_MODULES_PERMISSION);

      const body = request.body as { enabled?: unknown } | null | undefined;
      if (typeof body?.enabled !== 'boolean') {
        throw badRequest('Body must include boolean enabled');
      }

      const moduleState = await workspaceModulesService.updateWorkspaceModuleByKey(
        workspace.id,
        request.params.key,
        body.enabled,
      );

      await audit.log({
        event: MODULES_AUDIT_ACTION,
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'module',
        entityId: moduleState.key,
        metadata: {
          moduleKey: moduleState.key,
          enabled: moduleState.enabled,
        },
        request,
      });

      return ok(reply, {
        workspace,
        module: moduleState,
      });
    },
  );

  app.get<{ Params: WorkspaceParams }>(
    '/workspaces/:workspaceId/modules',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_MODULES_PERMISSION);
      const modules = await workspaceModulesService.getWorkspaceModules(workspace.id);

      return ok(reply, {
        workspace,
        modules,
      });
    },
  );

  app.put<{ Params: WorkspaceParams; Body: unknown }>(
    '/workspaces/:workspaceId/modules',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_MODULES_PERMISSION);

      const { modules, changes } = await workspaceModulesService.updateWorkspaceModules(
        workspace.id,
        request.body,
      );

      await audit.log({
        event: MODULES_AUDIT_ACTION,
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          changes,
        },
        request,
      });

      return ok(reply, {
        workspace,
        modules,
      });
    },
  );
};

export default workspaceModulesRoute;
