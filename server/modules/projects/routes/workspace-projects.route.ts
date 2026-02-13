import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { isHttpError } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import {
  PROJECTS_PERMISSIONS,
  ensureProjectsAccess,
  ensureProjectsMoveStageAccess,
} from '../projects.policies.js';
import { projectsService } from '../projects.service.js';

type ProjectParams = {
  id: string;
};

type CategoryParams = {
  categoryId: string;
};

type StageParams = {
  id: string;
};

type ProjectsQuery = {
  categoryId?: string;
  stageId?: string;
  pipelineStageId?: string;
  query?: string;
  q?: string;
};

const ensureProjectsCreateAccess = async (
  request: FastifyRequest,
) => {
  try {
    return await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.create);
  } catch (error) {
    if (!isHttpError(error) || error.statusCode !== 403) {
      throw error;
    }

    return ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
  }
};

const ensureProjectsPipelineManageAccess = async (
  request: FastifyRequest,
) => {
  // TODO: replace fallback with a dedicated projects.pipeline.manage permission when available.
  return ensureProjectsAccess(request, PROJECTS_PERMISSIONS.edit);
};

const workspaceProjectsRoute: FastifyPluginAsync = async (app) => {
  app.get('/projects/categories', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const categories = await projectsService.listCategories(workspace.id);

    return ok(reply, { categories });
  });

  app.post<{ Body: unknown }>('/projects/categories', async (request, reply) => {
    const { user, workspace } = await ensureProjectsPipelineManageAccess(request);
    const category = await projectsService.createCategory({
      workspaceId: workspace.id,
      actorUserId: user.id,
      body: request.body,
      request,
    });

    return ok(reply, { category }, 201);
  });

  app.patch<{ Params: CategoryParams; Body: unknown }>(
    '/projects/categories/:categoryId',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsPipelineManageAccess(request);
      const category = await projectsService.updateCategory({
        workspaceId: workspace.id,
        actorUserId: user.id,
        categoryId: request.params.categoryId,
        body: request.body,
        request,
      });

      return ok(reply, { category });
    },
  );

  app.delete<{ Params: CategoryParams }>(
    '/projects/categories/:categoryId',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsPipelineManageAccess(request);
      await projectsService.deleteCategory({
        workspaceId: workspace.id,
        actorUserId: user.id,
        categoryId: request.params.categoryId,
        request,
      });

      reply.code(204);
      return reply.send();
    },
  );

  app.get<{ Params: CategoryParams }>(
    '/projects/categories/:categoryId/stages',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const stages = await projectsService.listStages(workspace.id, request.params.categoryId);

      return ok(reply, { stages });
    },
  );

  app.post<{ Params: CategoryParams; Body: unknown }>(
    '/projects/categories/:categoryId/stages',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsPipelineManageAccess(request);
      const stage = await projectsService.createStage({
        workspaceId: workspace.id,
        actorUserId: user.id,
        categoryId: request.params.categoryId,
        body: request.body,
        request,
      });

      return ok(reply, { stage }, 201);
    },
  );

  app.post<{ Params: CategoryParams; Body: unknown }>(
    '/projects/categories/:categoryId/stages/reorder',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsPipelineManageAccess(request);
      const result = await projectsService.reorderStages({
        workspaceId: workspace.id,
        actorUserId: user.id,
        categoryId: request.params.categoryId,
        body: request.body,
        request,
      });

      return ok(reply, result);
    },
  );

  // Fallback endpoint for clients using global stage-create shape.
  app.post<{ Body: unknown }>('/projects/stages', async (request, reply) => {
    const { user, workspace } = await ensureProjectsPipelineManageAccess(request);
    const stage = await projectsService.createStage({
      workspaceId: workspace.id,
      actorUserId: user.id,
      body: request.body,
      request,
    });

    return ok(reply, { stage }, 201);
  });

  app.patch<{ Params: StageParams; Body: unknown }>(
    '/projects/stages/:id',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsPipelineManageAccess(request);
      const stage = await projectsService.updateStage({
        workspaceId: workspace.id,
        actorUserId: user.id,
        stageId: request.params.id,
        body: request.body,
        request,
      });

      return ok(reply, { stage });
    },
  );

  app.delete<{ Params: StageParams }>(
    '/projects/stages/:id',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsPipelineManageAccess(request);
      await projectsService.deleteStage({
        workspaceId: workspace.id,
        actorUserId: user.id,
        stageId: request.params.id,
        request,
      });

      reply.code(204);
      return reply.send();
    },
  );

  // Fallback endpoint for clients using global reorder shape.
  app.post<{ Body: unknown }>(
    '/projects/stages/reorder',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsPipelineManageAccess(request);
      const result = await projectsService.reorderStages({
        workspaceId: workspace.id,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(reply, result);
    },
  );

  app.get<{ Querystring: ProjectsQuery }>('/projects', async (request, reply) => {
    const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const projects = await projectsService.listProjects(workspace.id, request.query);

    return ok(reply, { items: projects });
  });

  app.get<{ Params: ProjectParams }>(
    '/projects/:id',
    async (request, reply) => {
      const { workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const project = await projectsService.getProject(workspace.id, request.params.id);

      return ok(reply, { project });
    },
  );

  app.post<{ Body: unknown }>('/projects', async (request, reply) => {
    const { user, workspace } = await ensureProjectsCreateAccess(request);
    const project = await projectsService.createProject({
      workspaceId: workspace.id,
      actorUserId: user.id,
      body: request.body,
      request,
    });

    return ok(reply, { project }, 201);
  });

  app.patch<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:id',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(
        request,
        PROJECTS_PERMISSIONS.edit,
      );
      const project = await projectsService.updateProject({
        workspaceId: workspace.id,
        actorUserId: user.id,
        projectId: request.params.id,
        body: request.body,
        request,
      });

      return ok(reply, { project });
    },
  );

  app.delete<{ Params: ProjectParams }>(
    '/projects/:id',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(
        request,
        PROJECTS_PERMISSIONS.delete,
      );

      await projectsService.deleteProject({
        workspaceId: workspace.id,
        actorUserId: user.id,
        projectId: request.params.id,
        request,
      });

      reply.code(204);
      return reply.send();
    },
  );

  app.post<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:id/move',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsMoveStageAccess(request);
      const payload = projectsService.parseMoveStageBody(request.body);

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

  app.patch<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:id/move-stage',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsMoveStageAccess(request);
      const payload = projectsService.parseMoveStageBody(request.body);

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
