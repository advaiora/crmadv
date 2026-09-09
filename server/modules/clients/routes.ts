import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../core/response.js';
import { readClientImportUpload } from './import-file.js';
import {
  CLIENTS_PERMISSIONS,
  ensureClientsAccess,
} from './policies.js';
import { clientsService } from './service.js';

type ClientsListQuery = {
  query?: string;
  search?: string;
  type?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
};

type ClientsExportQuery = {
  query?: string;
  type?: string;
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

  // Import clienti. Il file arriva come allegato (multipart, CSV o Excel, tetto
  // 20MB gia' registrato in app.ts): e' la strada che regge i volumi grossi.
  // La vecchia forma JSON `{csv, dryRun}` resta accettata finche' il frontend
  // non passa all'allegato, e li' vale ancora il tetto di corpo di Fastify (1MB).
  app.post<{ Body: unknown }>('/clients/import', async (request, reply) => {
    const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.create);
    const upload = request.isMultipart() ? await readClientImportUpload(request) : undefined;
    const result = await clientsService.importClientsFromCsv({
      workspaceId: workspace.id,
      actorUserId: user.id,
      ...(upload ? { upload } : { body: request.body }),
      request,
    });

    return ok(reply, result);
  });

  app.get<{ Querystring: ClientsExportQuery }>('/clients/export', async (request, reply) => {
    const { workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.view);
    const result = await clientsService.exportClientsCsv(workspace.id, request.query);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename=\"${result.filename}\"`);
    return reply.send(result.csv);
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
