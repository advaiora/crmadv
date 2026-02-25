import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { audit } from '../../../audit/audit.js';
import { badRequest } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import { requirePermission } from '../../../guards/requirePermission.js';
import {
  WEB_ASSETS_PERMISSIONS,
  ensureWebAssetsAccess,
} from '../policies.js';
import { webAssetsService } from '../service.js';

const idSchema = z.string().trim().min(1);

const paramsSchema = z.object({
  id: idSchema,
}).strict();

const publishBodySchema = z.object({
  published: z.boolean(),
}).strict();

const PUBLISH_STATUS_SET = new Set(['ACTIVE', 'PAUSED']);

const parseParams = (value: unknown) => {
  const parsed = paramsSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid web asset params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parsePublishBody = (value: unknown) => {
  const parsed = publishBodySchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid publish payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const statusChangeRequiresPublishPermission = (currentStatus: string, nextStatus: string) => {
  if (currentStatus === nextStatus) {
    return false;
  }

  return PUBLISH_STATUS_SET.has(currentStatus) || PUBLISH_STATUS_SET.has(nextStatus);
};

const workspaceWebAssetsRoute: FastifyPluginAsync = async (app) => {
  app.get('/web-assets', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccess(request, WEB_ASSETS_PERMISSIONS.view);
    const query = webAssetsService.parseListQuery(request.query);
    const result = await webAssetsService.listWebAssets(workspace.id, query);

    return ok(reply, result);
  });

  app.get<{ Params: unknown }>('/web-assets/:id', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccess(request, WEB_ASSETS_PERMISSIONS.view);
    const params = parseParams(request.params);
    const asset = await webAssetsService.getWebAsset(workspace.id, params.id);

    return ok(reply, { asset });
  });

  app.get('/web-assets/lookups/clients', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccess(request, WEB_ASSETS_PERMISSIONS.view);
    const query = webAssetsService.parseLookupQuery(request.query);
    const items = await webAssetsService.listClientsForPicker(workspace.id, query);

    return ok(reply, { items });
  });

  app.get('/web-assets/lookups/projects', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccess(request, WEB_ASSETS_PERMISSIONS.view);
    const query = webAssetsService.parseLookupQuery(request.query);
    const items = await webAssetsService.listProjectsForPicker(workspace.id, query);

    return ok(reply, { items });
  });

  app.post<{ Body: unknown }>('/web-assets', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccess(request, WEB_ASSETS_PERMISSIONS.create);
    const payload = webAssetsService.parseCreatePayload(request.body);
    const asset = await webAssetsService.createWebAsset({
      workspaceId: workspace.id,
      actorUserId: user.id,
      payload,
    });

    await audit.log({
      event: 'web_assets.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: asset.id,
      metadata: {
        assetType: asset.assetType,
        name: asset.name,
        status: asset.status,
      },
      request,
    });

    return ok(reply, { asset }, 201);
  });

  app.put<{ Params: unknown; Body: unknown }>('/web-assets/:id', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccess(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseParams(request.params);
    const payload = webAssetsService.parseUpdatePayload(request.body);
    const existingAsset = payload.status !== undefined
      ? await webAssetsService.getWebAsset(workspace.id, params.id)
      : null;

    if (
      payload.status !== undefined &&
      existingAsset &&
      statusChangeRequiresPublishPermission(existingAsset.status, payload.status)
    ) {
      await requirePermission(user.id, workspace.id, WEB_ASSETS_PERMISSIONS.publish);
    }

    const asset = await webAssetsService.updateWebAsset({
      workspaceId: workspace.id,
      assetId: params.id,
      payload,
    });

    await audit.log({
      event: 'web_assets.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: asset.id,
      metadata: {
        assetType: asset.assetType,
        name: asset.name,
        status: asset.status,
      },
      request,
    });

    return ok(reply, { asset });
  });

  app.patch<{ Params: unknown; Body: unknown }>('/web-assets/:id', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccess(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseParams(request.params);
    const payload = webAssetsService.parseUpdatePayload(request.body);
    const existingAsset = payload.status !== undefined
      ? await webAssetsService.getWebAsset(workspace.id, params.id)
      : null;

    if (
      payload.status !== undefined &&
      existingAsset &&
      statusChangeRequiresPublishPermission(existingAsset.status, payload.status)
    ) {
      await requirePermission(user.id, workspace.id, WEB_ASSETS_PERMISSIONS.publish);
    }

    const asset = await webAssetsService.updateWebAsset({
      workspaceId: workspace.id,
      assetId: params.id,
      payload,
    });

    await audit.log({
      event: 'web_assets.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: asset.id,
      metadata: {
        assetType: asset.assetType,
        name: asset.name,
        status: asset.status,
      },
      request,
    });

    return ok(reply, { asset });
  });

  app.delete<{ Params: unknown }>('/web-assets/:id', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccess(request, WEB_ASSETS_PERMISSIONS.delete);
    const params = parseParams(request.params);
    const deleted = await webAssetsService.deleteWebAsset(workspace.id, params.id);

    await audit.log({
      event: 'web_assets.delete',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: deleted.id,
      metadata: {
        assetType: deleted.assetType,
        name: deleted.name,
      },
      request,
    });

    reply.code(204);
    return reply.send();
  });

  app.post<{ Params: unknown; Body: unknown }>('/web-assets/:id/publish', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccess(request, WEB_ASSETS_PERMISSIONS.publish);
    const params = parseParams(request.params);
    const body = parsePublishBody(request.body);
    const nextStatus = body.published ? 'ACTIVE' : 'PAUSED';

    const asset = await webAssetsService.updateWebAsset({
      workspaceId: workspace.id,
      assetId: params.id,
      payload: {
        status: nextStatus,
      },
    });

    await audit.log({
      event: body.published ? 'web_assets.publish' : 'web_assets.unpublish',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: asset.id,
      metadata: {
        assetType: asset.assetType,
        name: asset.name,
        status: asset.status,
      },
      request,
    });

    return ok(reply, { asset });
  });
};

export default workspaceWebAssetsRoute;
