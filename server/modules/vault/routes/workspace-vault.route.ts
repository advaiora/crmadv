import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import { stepUpService } from '../../security/stepup/service.js';
import { logVaultAuditEvent, VaultAuditActions } from '../audit.js';
import type { EnsureVaultAccessOptions } from '../guards.js';
import { ensureVaultAccess } from '../guards.js';
import { VaultPermissions, type VaultPermissionKey } from '../policies.js';
import {
  enforceVaultRevealRateLimit,
  enforceVaultStepUpRateLimit,
  resolveRequestClientIp,
} from '../rate-limit.js';
import { vaultPolicyService } from '../vault-policy.service.js';
import { vaultService } from '../service.js';
import { vaultUnlockService } from '../vault-unlock.service.js';

type VaultListQuery = {
  search?: string;
  tag?: string;
  limit?: string;
  cursor?: string;
};

type VaultClientLookupQuery = {
  search?: string;
  limit?: string;
};

type VaultItemParams = {
  id: string;
};

const vaultSetupSchema = z.object({
  password: z.string().min(8).max(1024),
}).strict();

const vaultUnlockSchema = z.object({
  password: z.string().min(1).max(1024),
}).strict();

const parseVaultSetupPayload = (body: unknown) => {
  const parsed = vaultSetupSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('Invalid vault setup payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseVaultUnlockPayload = (body: unknown) => {
  const parsed = vaultUnlockSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('Invalid vault unlock payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

export const toVaultMetaResponse = (item: {
  id: string;
  clientId: string | null;
  client: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  name: string;
  username: string | null;
  url: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  clientId: item.clientId,
  client: item.client
    ? {
        id: item.client.id,
        name: item.client.name,
        email: item.client.email,
      }
    : null,
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
    options?: EnsureVaultAccessOptions,
  ) => Promise<{
    user: { id: string };
    workspace: { id: string };
  }>;
  vaultServiceApi?: typeof vaultService;
  vaultPolicyServiceApi?: typeof vaultPolicyService;
  vaultUnlockServiceApi?: typeof vaultUnlockService;
  stepUpServiceApi?: typeof stepUpService;
  logVaultAuditFn?: typeof logVaultAuditEvent;
};

export const buildWorkspaceVaultRoute = (
  dependencies: WorkspaceVaultRouteDependencies = {},
): FastifyPluginAsync => {
  const ensureVaultAccessFn = dependencies.ensureVaultAccessFn ?? ensureVaultAccess;
  const vaultServiceApi = dependencies.vaultServiceApi ?? vaultService;
  const stepUpServiceApi = dependencies.stepUpServiceApi ?? stepUpService;
  const vaultPolicyServiceApi = dependencies.vaultPolicyServiceApi ?? vaultPolicyService;
  const vaultUnlockServiceApi = dependencies.vaultUnlockServiceApi ?? vaultUnlockService;
  const logVaultAuditFn = dependencies.logVaultAuditFn ?? logVaultAuditEvent;
  const setSensitiveNoStoreHeaders = (reply: { header: (name: string, value: string) => unknown }) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
  };

  const workspaceVaultRoute: FastifyPluginAsync = async (app) => {
    app.get('/vault/status', async (request, reply) => {
      const { user, workspace } = await ensureVaultAccessFn(
        request,
        VaultPermissions.viewList,
        { skipVaultUnlock: true, skipStepUp: true },
      );

      const status = await vaultPolicyServiceApi.getStatus(workspace.id);
      const unlocked = status.exists
        ? vaultUnlockServiceApi.verifyUnlock({
          request,
          userId: user.id,
          workspaceId: workspace.id,
        })
        : false;

      setSensitiveNoStoreHeaders(reply);
      return ok(reply, {
        exists: status.exists,
        unlocked,
      });
    });

    app.post<{ Body: unknown }>('/vault/setup', async (request, reply) => {
      const { user, workspace } = await ensureVaultAccessFn(
        request,
        VaultPermissions.manageSettings,
        { skipVaultUnlock: true, skipStepUp: true },
      );

      const payload = parseVaultSetupPayload(request.body);

      await vaultPolicyServiceApi.setupMasterPassword(
        workspace.id,
        user.id,
        payload.password,
      );

      vaultUnlockServiceApi.issueUnlockToken({
        request,
        reply,
        userId: user.id,
        workspaceId: workspace.id,
      });

      await logVaultAuditFn({
        action: VaultAuditActions.unlockSuccess,
        workspaceId: workspace.id,
        actorUserId: user.id,
        metadata: {
          mode: 'setup',
        },
        request,
      });

      setSensitiveNoStoreHeaders(reply);
      return ok(reply, {
        exists: true,
        unlocked: true,
      }, 201);
    });

    app.post<{ Body: unknown }>('/vault/unlock', async (request, reply) => {
      const { user, workspace } = await ensureVaultAccessFn(
        request,
        VaultPermissions.viewList,
        { skipVaultUnlock: true, skipStepUp: true },
      );

      const payload = parseVaultUnlockPayload(request.body);
      const status = await vaultPolicyServiceApi.getStatus(workspace.id);

      if (!status.exists) {
        throw badRequest('Vault workspace password is not configured');
      }

      const passwordValid = await vaultPolicyServiceApi.verifyPassword(workspace.id, payload.password);
      if (!passwordValid) {
        await logVaultAuditFn({
          action: VaultAuditActions.unlockFail,
          workspaceId: workspace.id,
          actorUserId: user.id,
          metadata: {
            reason: 'invalid_password',
          },
          request,
        });

        throw badRequest('Password Vault errata');
      }

      vaultUnlockServiceApi.issueUnlockToken({
        request,
        reply,
        userId: user.id,
        workspaceId: workspace.id,
      });

      await logVaultAuditFn({
        action: VaultAuditActions.unlockSuccess,
        workspaceId: workspace.id,
        actorUserId: user.id,
        metadata: {
          mode: 'unlock',
        },
        request,
      });

      setSensitiveNoStoreHeaders(reply);
      reply.code(204);
      return reply.send();
    });

    app.post('/vault/lock', async (request, reply) => {
      await ensureVaultAccessFn(
        request,
        VaultPermissions.viewList,
        { skipVaultUnlock: true, skipStepUp: true },
      );

      vaultUnlockServiceApi.clearUnlock(reply);
      setSensitiveNoStoreHeaders(reply);
      reply.code(204);
      return reply.send();
    });

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

    app.get<{ Querystring: VaultClientLookupQuery }>('/vault/lookups/clients', async (request, reply) => {
      const { workspace } = await ensureVaultAccessFn(request, VaultPermissions.viewList);
      const parsedQuery = vaultServiceApi.parseClientLookupQuery(request.query);
      const clients = await vaultServiceApi.listVaultClients(workspace.id, parsedQuery);

      return ok(reply, {
        items: clients,
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

    app.post<{ Body: unknown }>('/vault/stepup', async (request, reply) => {
      const { user, workspace } = await ensureVaultAccessFn(
        request,
        VaultPermissions.reveal,
        { skipStepUp: true },
      );

      enforceVaultStepUpRateLimit({
        userId: user.id,
        workspaceId: workspace.id,
        clientIp: resolveRequestClientIp(request),
      });

      await stepUpServiceApi.issueStepUpGrant({
        request,
        reply,
        userId: user.id,
        workspaceId: workspace.id,
        body: request.body,
      });

      setSensitiveNoStoreHeaders(reply);
      reply.code(204);
      return reply.send();
    });

    app.post<{ Params: VaultItemParams }>('/vault/:id/reveal', async (request, reply) => {
      const { user, workspace } = await ensureVaultAccessFn(
        request,
        VaultPermissions.reveal,
        { skipStepUp: true },
      );

      enforceVaultRevealRateLimit({
        userId: user.id,
        workspaceId: workspace.id,
      });

      const secret = await vaultServiceApi.revealVaultItem({
        workspaceId: workspace.id,
        actorUserId: user.id,
        vaultItemId: request.params.id,
        request,
      });

      setSensitiveNoStoreHeaders(reply);
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
