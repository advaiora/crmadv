import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../../core/response.js';
import { ensureVaultAccess } from '../guards.js';
import { VaultPermissions } from '../policies.js';
import { vaultService } from '../service.js';

type VaultListQuery = {
  search?: string;
  tag?: string;
  limit?: string;
  cursor?: string;
};

type VaultItemParams = {
  id: string;
};

const toVaultMetaResponse = (item: {
  id: string;
  name: string;
  username: string | null;
  url: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  name: item.name,
  username: item.username,
  url: item.url,
  tags: item.tags,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const workspaceVaultRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: VaultListQuery }>('/vault', async (request, reply) => {
    const { workspace } = await ensureVaultAccess(request, VaultPermissions.viewList);
    const parsedQuery = vaultService.parseListQuery(request.query);
    const result = await vaultService.listVaultItems(workspace.id, parsedQuery);

    return ok(reply, {
      items: result.items.map(toVaultMetaResponse),
      pageInfo: {
        limit: parsedQuery.limit,
        nextCursor: result.nextCursor,
      },
    });
  });

  app.post<{ Body: unknown }>('/vault', async (request, reply) => {
    const { user, workspace } = await ensureVaultAccess(request, VaultPermissions.create);
    const created = await vaultService.createVaultItem({
      workspaceId: workspace.id,
      actorUserId: user.id,
      body: request.body,
      request,
    });

    return ok(
      reply,
      {
        item: toVaultMetaResponse(created),
      },
      201,
    );
  });

  app.patch<{ Params: VaultItemParams; Body: unknown }>('/vault/:id', async (request, reply) => {
    const { user, workspace } = await ensureVaultAccess(request, VaultPermissions.edit);
    const updated = await vaultService.updateVaultItem({
      workspaceId: workspace.id,
      actorUserId: user.id,
      vaultItemId: request.params.id,
      body: request.body,
      request,
    });

    return ok(reply, {
      item: toVaultMetaResponse(updated),
    });
  });

  app.delete<{ Params: VaultItemParams }>('/vault/:id', async (request, reply) => {
    const { user, workspace } = await ensureVaultAccess(request, VaultPermissions.delete);
    await vaultService.deleteVaultItem({
      workspaceId: workspace.id,
      actorUserId: user.id,
      vaultItemId: request.params.id,
      request,
    });

    reply.code(204);
    return reply.send();
  });
};

export default workspaceVaultRoute;
