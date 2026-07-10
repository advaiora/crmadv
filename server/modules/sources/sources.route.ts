import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../core/response.js';
import { PROJECTS_PERMISSIONS, ensureProjectsAccess } from '../projects/projects.policies.js';
import { sourcesService } from './sources.service.js';

// Modulo Fonti (V4). Le fonti appartengono a un progetto, quindi sono protette
// dai permessi del modulo Progetti: lettura projects.view, gestione projects.edit.

type ProjectParams = { projectId: string };
type SourceParams = { id: string };

const sourcesRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Params: ProjectParams }>(
    '/projects/:projectId/sources',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const items = await sourcesService.listSources(workspace.id, request.params.projectId);
      return ok(reply, { items });
    },
  );

  app.post<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:projectId/sources',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
      const source = await sourcesService.createSource({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        actorUserId: user.id,
        body: request.body,
        request,
      });
      return ok(reply, { source }, 201);
    },
  );

  app.get<{ Params: SourceParams }>('/sources/:id', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const source = await sourcesService.getSource(workspace.id, request.params.id);
    return ok(reply, { source });
  });

  app.post<{ Params: SourceParams }>('/sources/:id/refresh', async (request, reply) => {
    const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
    const source = await sourcesService.refreshSource({
      workspaceId: workspace.id,
      id: request.params.id,
      actorUserId: user.id,
      request,
    });
    return ok(reply, { source });
  });

  app.delete<{ Params: SourceParams }>('/sources/:id', async (request, reply) => {
    const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
    await sourcesService.deleteSource({
      workspaceId: workspace.id,
      id: request.params.id,
      actorUserId: user.id,
      request,
    });
    reply.code(204);
    return reply.send();
  });
};

export default sourcesRoute;
