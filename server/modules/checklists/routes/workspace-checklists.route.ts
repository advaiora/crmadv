import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../../core/response.js';
import {
  CHECKLISTS_PERMISSIONS,
  ensureChecklistsAccess,
} from '../checklists.policies.js';
import { checklistsService } from '../checklists.service.js';

type ListTemplatesQuery = {
  includeItems?: string;
  archived?: string;
};

type GetTemplateQuery = {
  includeItems?: string;
};

type TemplateParams = {
  id: string;
};

type TemplateItemParams = {
  templateId: string;
  itemId: string;
};

type TemplateOnlyParams = {
  templateId: string;
};

const workspaceChecklistsRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ListTemplatesQuery }>(
    '/checklists/templates',
    async (request, reply) => {
      const { workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.view,
      );

      const result = await checklistsService.listTemplates(workspace.id, request.query);
      return ok(reply, {
        items: result.items,
      });
    },
  );

  app.post<{ Body: unknown }>('/checklists/templates', async (request, reply) => {
    const { user, workspace } = await ensureChecklistsAccess(
      request,
      CHECKLISTS_PERMISSIONS.manageTemplates,
    );

    const template = await checklistsService.createTemplate({
      workspaceId: workspace.id,
      actorUserId: user.id,
      body: request.body,
      request,
    });

    return ok(
      reply,
      {
        template,
      },
      201,
    );
  });

  app.get<{ Params: TemplateParams; Querystring: GetTemplateQuery }>(
    '/checklists/templates/:id',
    async (request, reply) => {
      const { workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.view,
      );

      const template = await checklistsService.getTemplate(
        workspace.id,
        request.params.id,
        request.query,
      );

      return ok(reply, {
        template,
      });
    },
  );

  app.patch<{ Params: TemplateParams; Body: unknown }>(
    '/checklists/templates/:id',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.manageTemplates,
      );

      const template = await checklistsService.updateTemplate({
        workspaceId: workspace.id,
        templateId: request.params.id,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(reply, {
        template,
      });
    },
  );

  app.delete<{ Params: TemplateParams }>(
    '/checklists/templates/:id',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.manageTemplates,
      );

      await checklistsService.archiveTemplate({
        workspaceId: workspace.id,
        templateId: request.params.id,
        actorUserId: user.id,
        request,
      });

      reply.code(204);
      return reply.send();
    },
  );

  app.post<{ Params: TemplateOnlyParams; Body: unknown }>(
    '/checklists/templates/:templateId/items',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.manageTemplates,
      );

      const item = await checklistsService.createTemplateItem({
        workspaceId: workspace.id,
        templateId: request.params.templateId,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(
        reply,
        {
          item,
        },
        201,
      );
    },
  );

  app.patch<{ Params: TemplateItemParams; Body: unknown }>(
    '/checklists/templates/:templateId/items/:itemId',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.manageTemplates,
      );

      const item = await checklistsService.updateTemplateItem({
        workspaceId: workspace.id,
        templateId: request.params.templateId,
        itemId: request.params.itemId,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(reply, {
        item,
      });
    },
  );

  app.delete<{ Params: TemplateItemParams }>(
    '/checklists/templates/:templateId/items/:itemId',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.manageTemplates,
      );

      await checklistsService.deleteTemplateItem({
        workspaceId: workspace.id,
        templateId: request.params.templateId,
        itemId: request.params.itemId,
        actorUserId: user.id,
        request,
      });

      reply.code(204);
      return reply.send();
    },
  );

  app.post<{ Params: TemplateOnlyParams; Body: unknown }>(
    '/checklists/templates/:templateId/items/reorder',
    async (request, reply) => {
      const { user, workspace } = await ensureChecklistsAccess(
        request,
        CHECKLISTS_PERMISSIONS.manageTemplates,
      );

      const result = await checklistsService.reorderTemplateItems({
        workspaceId: workspace.id,
        templateId: request.params.templateId,
        actorUserId: user.id,
        body: request.body,
        request,
      });

      return ok(reply, {
        items: result.items,
      });
    },
  );
};

export default workspaceChecklistsRoute;
