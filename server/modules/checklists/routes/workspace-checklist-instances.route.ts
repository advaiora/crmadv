import type { FastifyPluginAsync } from 'fastify';
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
};

const workspaceChecklistInstancesRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Params: ProjectParams; Body: unknown }>(
    '/projects/:projectId/checklists',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.create,
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
