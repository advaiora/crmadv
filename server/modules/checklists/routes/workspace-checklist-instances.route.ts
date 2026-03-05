import type { FastifyPluginAsync } from 'fastify';
import { badRequest } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import {
  CHECKLISTS_PERMISSIONS,
  ensureChecklistsAccess,
} from '../checklists.policies.js';
import { checklistsService } from '../checklists.service.js';

type ProjectParams = {
  projectId: string;
};

type ChecklistItemParams = {
  itemId: string;
};

type ProjectChecklistQuery = {
  includeItems?: string;
  stageId?: string;
};

type ChecklistInstanceItemParams = {
  id: string;
  itemInstanceId: string;
};

const workspaceChecklistInstancesRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:projectId/checklists',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.completeItem,
      );

      const instance = await checklistsService.createChecklistInstance({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(reply, instance.instance, instance.created ? 201 : 200);
    },
  );

  app.get<{ Params: ProjectParams; Querystring: ProjectChecklistQuery }>(
    '/projects/:projectId/checklists',
    async (request, reply) => {
      const { workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.view,
      );

      const result = await checklistsService.listProjectChecklistInstances(
        workspace.id,
        request.params.projectId,
        request.query,
      );

      return ok(reply, result.items);
    },
  );

  app.post<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:projectId/checklists/ensure',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.completeItem,
      );

      const body = request.body as { stageId?: unknown } | null | undefined;
      if (typeof body?.stageId !== 'string' || body.stageId.trim().length === 0) {
        throw badRequest('Body must include stageId');
      }

      const result = await checklistsService.ensureChecklistInstancesForProjectStage({
        workspaceId: workspace.id,
        projectId: request.params.projectId,
        pipelineStageId: body.stageId,
        actorUserId: user.id,
        request,
      });

      return ok(reply, result);
    },
  );

  app.post<{ Params: ChecklistInstanceItemParams; Body: unknown }>(
    '/checklists/instances/:id/items/:itemInstanceId/complete',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.completeItem,
      );

      const item = await checklistsService.toggleChecklistInstanceItemCompletion({
        workspaceId: workspace.id,
        checklistInstanceId: request.params.id,
        itemId: request.params.itemInstanceId,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(reply, item);
    },
  );

  app.patch<{ Params: ChecklistItemParams; Body: unknown }>(
    '/checklists/items/:itemId/complete',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.completeItem,
      );

      const item = await checklistsService.completeChecklistItem({
        workspaceId: workspace.id,
        itemId: request.params.itemId,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(reply, item);
    },
  );

  app.patch<{ Params: ChecklistItemParams; Body: unknown }>(
    '/checklists/items/:itemId/not-applicable',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.completeItem,
      );

      const item = await checklistsService.markChecklistItemNotApplicable({
        workspaceId: workspace.id,
        itemId: request.params.itemId,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(reply, item);
    },
  );

  app.patch<{ Params: ChecklistItemParams }>(
    '/checklists/items/:itemId/state',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.completeItem,
      );

      const item = await checklistsService.updateChecklistItemState({
        workspaceId: workspace.id,
        itemId: request.params.itemId,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(reply, item);
    },
  );

  app.patch<{ Params: ChecklistItemParams }>(
    '/checklists/items/:itemId/reset',
    async (request, reply) => {
      const { workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.completeItem,
      );

      const item = await checklistsService.resetChecklistItem({
        workspaceId: workspace.id,
        itemId: request.params.itemId,
      });

      return ok(reply, item);
    },
  );
};

export default workspaceChecklistInstancesRoute;
