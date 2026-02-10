import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../audit/audit.js';
import { ok } from '../core/response.js';
import { requireAuth } from '../guards/requireAuth.js';
import { requirePermission } from '../guards/requirePermission.js';
import { requireWorkspaceFromParams } from '../guards/requireWorkspace.js';
import { workspaceBrandingService } from '../services/workspace-branding.service.js';

type WorkspaceParams = {
  workspaceId: string;
};

const MANAGE_BRANDING_PERMISSION = 'branding.manage';

const workspaceBrandingRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Params: WorkspaceParams }>(
    '/workspaces/:workspaceId/branding',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_BRANDING_PERMISSION);
      const branding = await workspaceBrandingService.getWorkspaceBranding(workspace);

      return ok(reply, {
        workspace,
        branding,
      });
    },
  );

  app.put<{ Params: WorkspaceParams; Body: unknown }>(
    '/workspaces/:workspaceId/branding',
    async (request, reply) => {
      const user = await requireAuth(request);
      const workspace = await requireWorkspaceFromParams(
        request,
        user.id,
        request.params.workspaceId,
      );

      await requirePermission(user.id, workspace.id, MANAGE_BRANDING_PERMISSION);

      const { branding, changes } = await workspaceBrandingService.updateWorkspaceBranding(
        workspace,
        request.body,
      );

      await audit.log({
        event: 'branding.update',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: {
          changes,
        },
        request,
      });

      return ok(reply, {
        workspace,
        branding,
      });
    },
  );
};

export default workspaceBrandingRoute;
