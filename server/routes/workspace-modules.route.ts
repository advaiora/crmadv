import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../audit/audit.js';
import { ok } from '../core/response.js';
import { requireAuth } from '../guards/requireAuth.js';
import { requirePermission } from '../guards/requirePermission.js';
import { requireWorkspaceFromParams } from '../guards/requireWorkspace.js';
import { workspaceModulesService } from '../services/workspace-modules.service.js';

type WorkspaceParams = {
  workspaceId: string;
};

const MANAGE_MODULES_PERMISSION = 'modules.manage';

const workspaceModulesRoute: FastifyPluginAsync = async (app) => {
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
        event: 'modules.update',
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
