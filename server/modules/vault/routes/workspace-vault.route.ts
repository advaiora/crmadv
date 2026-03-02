import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ok } from '../../../core/response.js';
import { ensureVaultAccess } from '../guards.js';
import { VaultPermissions, type VaultPermissionKey } from '../policies.js';
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

export const toVaultMetaResponse = (item: {
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

type WorkspaceVaultRouteDependencies = {
  ensureVaultAccessFn?: (
    request: FastifyRequest,
    permissionKey: VaultPermissionKey,
  ) => Promise<{
    user: { id: string };
    workspace: { id: string };
  }>;
  vaultServiceApi?: typeof vaultService;
};

export const buildWorkspaceVaultRoute = (
  dependencies: WorkspaceVaultRouteDependencies = {},
): FastifyPluginAsync => {
  const ensureVaultAccessFn = dependencies.ensureVaultAccessFn ?? ensureVaultAccess;
  const vaultServiceApi = dependencies.vaultServiceApi ?? vaultService;

  const workspaceVaultRoute: FastifyPluginAsync = async (app) => {
    app.get<{ Querystring: VaultListQuery }>('/vault', async (request, reply) => {
      const { workspace } = await ensureVaultAccessFn(request, VaultPermissions.viewList);
      const parsedQuery = vaultServiceApi.parseListQuery(request.query);
      const result = await vaultServiceApi.listVaultItems(workspace.id, parsedQuery);

      return ok(reply, {
        items: result.items.map(toVaultMetaResponse),
        pageInfo: {
          limit: parsedQuery.limit,
          nextCursor: result.nextCursor,
        },
      });
    });

    app.post<{ Body: unknown }>('/vault', async (request, reply) => {
      const { user, workspace } = await ensureVaultAccessFn(request, VaultPermissions.create);
      const created = await vaultServiceApi.createVaultItem({
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
      const { user, workspace } = await ensureVaultAccessFn(request, VaultPermissions.edit);
      const updated = await vaultServiceApi.updateVaultItem({
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

    app.post<{ Params: VaultItemParams }>('/vault/:id/reveal', async (request, reply) => {
      const { user, workspace } = await ensureVaultAccessFn(request, VaultPermissions.reveal);
      const secret = await vaultServiceApi.revealVaultItem({
        workspaceId: workspace.id,
        actorUserId: user.id,
        vaultItemId: request.params.id,
        request,
      });

      return ok(reply, {
        itemId: secret.id,
        secret: {
          password: secret.password,
          notes: secret.notes,
          extra: secret.extra,
        },
      });
    });

    app.delete<{ Params: VaultItemParams }>('/vault/:id', async (request, reply) => {
      const { user, workspace } = await ensureVaultAccessFn(request, VaultPermissions.delete);
      await vaultServiceApi.deleteVaultItem({
        workspaceId: workspace.id,
        actorUserId: user.id,
        vaultItemId: request.params.id,
        request,
      });

      reply.code(204);
      return reply.send();
    });
  };

  return workspaceVaultRoute;
};

const workspaceVaultRoute = buildWorkspaceVaultRoute();

export default workspaceVaultRoute;
