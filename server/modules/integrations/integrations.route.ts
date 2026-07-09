import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../core/response.js';
import { CLIENTS_PERMISSIONS, ensureClientsAccess } from '../clients/policies.js';
import { integrationsService } from './integrations.service.js';

// Le integrazioni (per ora Brevo) sincronizzano i CLIENTI verso servizi esterni,
// quindi sono protette dai permessi del modulo Clienti: lettura con clients.view,
// configurazione/sync con clients.edit.

type ProviderParams = { provider: string };

const integrationsRoute: FastifyPluginAsync = async (app) => {
  app.get('/integrations', async (request, reply) => {
    const { workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.view);
    const items = await integrationsService.listIntegrations(workspace.id);
    return ok(reply, { items });
  });

  app.get<{ Params: ProviderParams }>('/integrations/:provider', async (request, reply) => {
    const { workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.view);
    const integration = await integrationsService.getIntegration(
      workspace.id,
      request.params.provider,
    );
    return ok(reply, { integration });
  });

  app.put<{ Params: ProviderParams; Body: unknown }>(
    '/integrations/:provider',
    async (request, reply) => {
      const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.edit);
      const integration = await integrationsService.saveIntegration({
        workspaceId: workspace.id,
        providerInput: request.params.provider,
        actorUserId: user.id,
        body: request.body,
        request,
      });
      return ok(reply, { integration });
    },
  );

  app.post<{ Params: ProviderParams }>(
    '/integrations/:provider/test',
    async (request, reply) => {
      const { workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.edit);
      const result = await integrationsService.testConnection(
        workspace.id,
        request.params.provider,
      );
      return ok(reply, result);
    },
  );

  app.post<{ Params: ProviderParams }>(
    '/integrations/:provider/sync',
    async (request, reply) => {
      const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.edit);
      const result = await integrationsService.syncClients({
        workspaceId: workspace.id,
        providerInput: request.params.provider,
        actorUserId: user.id,
        request,
        now: new Date(),
      });
      return ok(reply, result);
    },
  );

  app.delete<{ Params: ProviderParams }>('/integrations/:provider', async (request, reply) => {
    const { user, workspace } = await ensureClientsAccess(request, CLIENTS_PERMISSIONS.edit);
    await integrationsService.deleteIntegration({
      workspaceId: workspace.id,
      providerInput: request.params.provider,
      actorUserId: user.id,
      request,
    });
    reply.code(204);
    return reply.send();
  });
};

export default integrationsRoute;
