import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { requirePermission } from '../../../auth/guards.js';
import { isHttpError } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import {
  PROJECTS_PERMISSIONS,
  ensureProjectsAccess,
  ensureProjectsMoveStageAccess,
} from '../projects.policies.js';
import { projectsService } from '../projects.service.js';
import { projectAccessService } from '../project-access.service.js';
import { audit } from '../../../audit/audit.js';

type ProjectParams = {
  id: string;
};

type CategoryParams = {
  categoryId: string;
};

type StageParams = {
  id: string;
};

type OverrideGateParams = {
  projectId: string;
  stageId: string;
};

type ProjectsQuery = {
  categoryId?: string;
  stageId?: string;
  pipelineStageId?: string;
  clientId?: string;
  query?: string;
  q?: string;
};

type MoveStageRequestContext = {
  moveStageAccess?: Awaited<ReturnType<typeof ensureProjectsMoveStageAccess>>;
  moveStagePayload?: ReturnType<typeof projectsService.parseMoveStageBody>;
  moveStageContext?: Awaited<ReturnType<typeof projectsService.buildMoveStageContext>>;
};

type OverrideGateBody = {
  reason?: string;
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

const checklistGateMiddleware = async (
  request: FastifyRequest<{ Params: ProjectParams; Body: unknown }>,
) => {
  const access = await ensureProjectsMoveStageAccess(request);
  const payload = projectsService.parseMoveStageBody(request.body);
  const moveStageContext = await projectsService.buildMoveStageContext({
    workspaceId: access.workspace.id,
    actorUserId: access.user.id,
    projectId: request.params.id,
    payload,
    request,
  });

  const requestWithContext = request as typeof request & MoveStageRequestContext;
  requestWithContext.moveStageAccess = access;
  requestWithContext.moveStagePayload = payload;
  requestWithContext.moveStageContext = moveStageContext;
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
    const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
    const projects = await projectsService.listProjects(workspace.id, user.id, request.query);

    return ok(reply, { items: projects });
  });

  app.get<{ Params: ProjectParams }>(
    '/projects/:id/history',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      await projectsService.getProject(workspace.id, user.id, request.params.id);

      // Placeholder endpoint to avoid noisy 404s on clients expecting stage history.
      return ok(reply, { items: [] });
    },
  );

  app.get<{ Params: ProjectParams }>(
    '/projects/:id/stage-history',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      await projectsService.getProject(workspace.id, user.id, request.params.id);

      // Placeholder endpoint to avoid noisy 404s on clients expecting stage history.
      return ok(reply, { items: [] });
    },
  );

  app.get<{ Params: ProjectParams }>(
    '/projects/:id',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const project = await projectsService.getProject(workspace.id, user.id, request.params.id);

      return ok(reply, { project });
    },
  );

  // Reparti e accessi di un progetto (gestione delegata: ruolo alto o capo reparto).
  app.get<{ Params: ProjectParams }>(
    '/projects/:id/access',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const result = await projectAccessService.getProjectAccess(
        workspace.id,
        user.id,
        request.params.id,
      );

      return ok(reply, result);
    },
  );

  app.put<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:id/departments',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const result = await projectAccessService.setProjectDepartments(
        workspace.id,
        user.id,
        request.params.id,
        request.body,
      );

      await audit.log({
        event: 'project.departments_set',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: { projectId: result.projectId, departmentIds: result.departmentIds },
        request,
      });

      return ok(reply, result);
    },
  );

  app.put<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:id/access',
    async (request, reply) => {
      const { user, workspace } = await ensureProjectsAccess(request, PROJECTS_PERMISSIONS.view);
      const result = await projectAccessService.setProjectAccess(
        workspace.id,
        user.id,
        request.params.id,
        request.body,
      );

      await audit.log({
        event: 'project.access_set',
        actorUserId: user.id,
        workspaceId: workspace.id,
        metadata: { projectId: result.projectId, userIds: result.userIds },
        request,
      });

      return ok(reply, result);
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
    { preHandler: checklistGateMiddleware },
    async (request, reply) => {
      const requestWithContext = request as typeof request & MoveStageRequestContext;
      const access = requestWithContext.moveStageAccess;
      const payload = requestWithContext.moveStagePayload;
      const moveStageContext = requestWithContext.moveStageContext;

      if (!access || !payload || !moveStageContext) {
        throw new Error('Move-stage middleware context is missing');
      }

      const result = await projectsService.moveStage({
        workspaceId: access.workspace.id,
        actorUserId: access.user.id,
        projectId: request.params.id,
        payload,
        request,
        prevalidatedContext: moveStageContext,
      });

      return ok(reply, result);
    },
  );

  app.patch<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:id/move-stage',
    { preHandler: checklistGateMiddleware },
    async (request, reply) => {
      const requestWithContext = request as typeof request & MoveStageRequestContext;
      const access = requestWithContext.moveStageAccess;
      const payload = requestWithContext.moveStagePayload;
      const moveStageContext = requestWithContext.moveStageContext;

      if (!access || !payload || !moveStageContext) {
        throw new Error('Move-stage middleware context is missing');
      }

      const result = await projectsService.moveStage({
        workspaceId: access.workspace.id,
        actorUserId: access.user.id,
        projectId: request.params.id,
        payload,
        request,
        prevalidatedContext: moveStageContext,
      });

      return ok(reply, result);
    },
  );

  app.post<{ Params: OverrideGateParams; Body: OverrideGateBody }>(
    '/projects/:projectId/stages/:stageId/override-gate',
    async (request, reply) => {
      const access = await ensureProjectsMoveStageAccess(request);
      await requirePermission(
        access.workspace.id,
        access.user.id,
        'checklists.override_gate',
      );

      const result = await projectsService.moveStage({
        workspaceId: access.workspace.id,
        actorUserId: access.user.id,
        projectId: request.params.projectId,
        payload: {
          toStageId: request.params.stageId,
          overrideGate: true,
          overrideReason: request.body?.reason?.trim() || null,
        },
        request,
      });

      return ok(reply, result);
    },
  );
};

export default workspaceProjectsRoute;
