import type { FastifyPluginAsync } from 'fastify';
import { audit } from '../../audit/audit.js';
import { ok } from '../../core/response.js';
import { CLIENTS_PERMISSIONS, ensureClientsAccess } from '../clients/policies.js';
import { customFieldsService } from './custom-fields.service.js';

type ListQuery = {
  entity?: string;
};

type IdParams = {
  id: string;
};

// Rotte per le definizioni dei campi personalizzati (Custom Fields, V3).
// Per ora riguardano l'entità "client": lettura con clients.view, gestione con
// clients.edit (nessun nuovo permesso da seedare).
const customFieldsRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ListQuery }>('/custom-fields', async (request, reply) => {
    const { workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.view);
    const definitions = await customFieldsService.listDefinitions(workspace.id, request.query?.entity);
    return ok(reply, { definitions });
  });

  app.post<{ Body: unknown }>('/custom-fields', async (request, reply) => {
    const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.edit);
    const definition = await customFieldsService.createDefinition(workspace.id, request.body);

    await audit.log({
      event: 'client.customField.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: { id: definition.id, key: definition.key, type: definition.type },
      request,
    });

    return ok(reply, { definition }, 201);
  });

  app.patch<{ Params: IdParams; Body: unknown }>('/custom-fields/:id', async (request, reply) => {
    const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.edit);
    const definition = await customFieldsService.updateDefinition(workspace.id, request.params.id, request.body);

    await audit.log({
      event: 'client.customField.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: { id: definition.id, key: definition.key },
      request,
    });

    return ok(reply, { definition });
  });

  app.delete<{ Params: IdParams }>('/custom-fields/:id', async (request, reply) => {
    const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.edit);
    await customFieldsService.deleteDefinition(workspace.id, request.params.id);

    await audit.log({
      event: 'client.customField.delete',
      actorUserId: user.id,
      workspaceId: workspace.id,
      metadata: { id: request.params.id },
      request,
    });

    reply.code(204);
    return reply.send();
  });

  app.post<{ Body: unknown }>('/custom-fields/reorder', async (request, reply) => {
    const { workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.edit);
    const definitions = await customFieldsService.reorderDefinitions(workspace.id, request.body);
    return ok(reply, { definitions });
  });
};

export default customFieldsRoute;
