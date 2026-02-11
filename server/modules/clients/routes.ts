import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../core/response.js';
import {
  CLIENTS_PERMISSIONS,
  ensureClientsAccess,
} from './policies.js';
import { clientsService } from './service.js';

type ClientsListQuery = {
  query?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
};

type ClientParams = {
  id: string;
};

const clientsRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ClientsListQuery }>('/clients', async (request, reply) => {
    const { workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.view);
    const result = await clientsService.listClients(workspace.id, request.query);

    return ok(reply, {
      items: result.items,
      pageInfo: result.pageInfo,
      filters: result.filters,
    });
  });

  app.post<{ Body: unknown }>('/clients', async (request, reply) => {
    const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.create);
    const client = await clientsService.createClient({
      workspaceId: workspace.id,
      actorUserId: user.id,
      body: request.body,
      request,
    });

    return ok(
      reply,
      {
        client,
      },
      201,
    );
  });

  app.get<{ Params: ClientParams }>('/clients/:id', async (request, reply) => {
    const { workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.view);
    const client = await clientsService.getClient(workspace.id, request.params.id);

    return ok(reply, {
      client,
    });
  });

  app.patch<{ Params: ClientParams; Body: unknown }>('/clients/:id', async (request, reply) => {
    const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.edit);
    const client = await clientsService.updateClient({
      workspaceId: workspace.id,
      clientId: request.params.id,
      actorUserId: user.id,
      body: request.body,
      request,
    });

    return ok(reply, {
      client,
    });
  });

  app.delete<{ Params: ClientParams }>('/clients/:id', async (request, reply) => {
    const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.delete);
    await clientsService.deleteClient({
      workspaceId: workspace.id,
      clientId: request.params.id,
      actorUserId: user.id,
      request,
    });

    reply.code(204);
    return reply.send();
  });
};

export default clientsRoute;
