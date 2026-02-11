import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../../core/response.js';
import {
  ensureChecklistsOverridePermission,
  ensureProjectsMoveStageAccess,
} from '../projects.policies.js';
import { projectsService } from '../projects.service.js';

type ProjectParams = {
  id: string;
};

const workspaceProjectsRoute: FastifyPluginAsync = async (app) => {
  app.patch<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:id/move-stage',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsMoveStageAccess(request);
      const payload = projectsService.parseMoveStageBody(request.body);

      if (payload.overrideGate) {
        await ensureChecklistsOverridePermission(user.id, workspace.id);
      }

      const result = await projectsService.moveStage({
        workspaceId: workspace.id,
        actorUserId: user.id,
        projectId: request.params.id,
        payload,
        request,
      });

      return ok(reply, result);
    },
  );
};

export default workspaceProjectsRoute;
