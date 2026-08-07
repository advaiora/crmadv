import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { audit } from '../../../audit/audit.js';
import { badRequest } from '../../../core/errors.js';
import { ok } from '../../../core/response.js';
import { requirePermission } from '../../../guards/requirePermission.js';
import { auditRepository } from '../../../repositories/audit.repository.js';
import {
  SEO_PERMISSIONS,
  WEB_ASSETS_PERMISSIONS,
  ensureSeoAccess,
  ensureWebAssetsAccess,
} from '../policies.js';
import { webAssetsService } from '../service.js';

const AUDIT_VIEW_PERMISSION = 'audit.view';

const idSchema = z.string().trim().min(1);

const paramsSchema = z.object({
  id: idSchema,
}).strict();

const versionParamsSchema = z.object({
  id: idSchema,
  versionId: idSchema,
}).strict();

const maintenanceParamsSchema = z.object({
  id: idSchema,
  maintenanceId: idSchema,
}).strict();

const alertParamsSchema = z.object({
  id: idSchema,
  alertId: idSchema,
}).strict();

const publishBodySchema = z.object({
  published: z.boolean(),
}).strict();

const versionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(30),
}).strict();

const monitoringQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).optional().default(30),
}).strict();

const analyticsQuerySchema = z.object({
  snapshotsLimit: z.coerce.number().int().min(1).max(200).optional().default(30),
  eventsLimit: z.coerce.number().int().min(1).max(500).optional().default(200),
}).strict();

const alertsQuerySchema = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional().default(100),
}).strict();

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  action: z.string().trim().min(1).max(80).optional()
    .refine(
      (value) => !value || value.startsWith('web.') || value.startsWith('web_assets.'),
      'Audit action must start with web.',
    ),
  assetId: idSchema.optional(),
}).strict();

const PUBLISHABLE_STATUS = 'ACTIVE';
const UNPUBLISHABLE_STATUS = 'PAUSED';

type WorkspaceWebAssetsRouteDependencies = {
  ensureWebAssetsAccessFn: typeof ensureWebAssetsAccess;
  // La scheda SEO ha un cancello suo dal 7/8/2026: prima girava su web.view/web.edit
  // e i permessi seo.* del catalogo non li controllava nessuno.
  ensureSeoAccessFn?: typeof ensureSeoAccess;
  requirePermissionFn: typeof requirePermission;
  webAssetsServiceApi: typeof webAssetsService;
  auditLogFn: typeof audit.log;
};

const defaultDependencies: WorkspaceWebAssetsRouteDependencies = {
  ensureWebAssetsAccessFn: ensureWebAssetsAccess,
  ensureSeoAccessFn: ensureSeoAccess,
  requirePermissionFn: requirePermission,
  webAssetsServiceApi: webAssetsService,
  auditLogFn: audit.log,
};

const parseParams = (value: unknown) => {
  const parsed = paramsSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid web asset params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseVersionParams = (value: unknown) => {
  const parsed = versionParamsSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid version params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseMaintenanceParams = (value: unknown) => {
  const parsed = maintenanceParamsSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid maintenance params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseAlertParams = (value: unknown) => {
  const parsed = alertParamsSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Invalid alert params', {
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

const parseVersionListQuery = (value: unknown) => {
  const parsed = versionListQuerySchema.safeParse(value ?? {});
  if (!parsed.success) {
    throw badRequest('Invalid versions query params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseMonitoringQuery = (value: unknown) => {
  const parsed = monitoringQuerySchema.safeParse(value ?? {});
  if (!parsed.success) {
    throw badRequest('Invalid monitoring query params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseAnalyticsQuery = (value: unknown) => {
  const parsed = analyticsQuerySchema.safeParse(value ?? {});
  if (!parsed.success) {
    throw badRequest('Invalid analytics query params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseAlertsQuery = (value: unknown) => {
  const parsed = alertsQuerySchema.safeParse(value ?? {});
  if (!parsed.success) {
    throw badRequest('Invalid alerts query params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseAuditQuery = (value: unknown) => {
  const parsed = auditQuerySchema.safeParse(value ?? {});
  if (!parsed.success) {
    throw badRequest('Invalid audit query params', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

export const statusRequiresPublishPermission = (status: string) =>
  status === PUBLISHABLE_STATUS;

export const statusRequiresUnpublishPermission = (status: string) =>
  status === UNPUBLISHABLE_STATUS;

export const statusChangePermissionKeys = (currentStatus: string, nextStatus: string) => {
  if (currentStatus === nextStatus) {
    return [] as string[];
  }

  const statuses = new Set([currentStatus, nextStatus]);
  const permissions: string[] = [];

  if (statuses.has(PUBLISHABLE_STATUS)) {
    permissions.push(WEB_ASSETS_PERMISSIONS.publish);
  }

  if (statuses.has(UNPUBLISHABLE_STATUS)) {
    permissions.push(WEB_ASSETS_PERMISSIONS.unpublish);
  }

  return permissions;
};

const getStatusFromSnapshot = (snapshot: unknown): string | null => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  const statusValue = (snapshot as { status?: unknown }).status;
  return typeof statusValue === 'string' ? statusValue : null;
};

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export const buildWorkspaceWebAssetsRoute = (
  dependencies: WorkspaceWebAssetsRouteDependencies = defaultDependencies,
): FastifyPluginAsync => async (app) => {
  const {
    ensureWebAssetsAccessFn,
    ensureSeoAccessFn = ensureSeoAccess,
    requirePermissionFn,
    webAssetsServiceApi,
    auditLogFn,
  } = dependencies;

  app.get('/web-assets', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const query = webAssetsServiceApi.parseListQuery(request.query);
    const result = await webAssetsServiceApi.listWebAssets(workspace.id, query);

    return ok(reply, result);
  });

  app.get<{ Params: unknown }>('/web-assets/:id', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const params = parseParams(request.params);
    const asset = await webAssetsServiceApi.getWebAsset(workspace.id, params.id);

    return ok(reply, { asset });
  });

  app.get('/web-assets/lookups/clients', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const query = webAssetsServiceApi.parseLookupQuery(request.query);
    const items = await webAssetsServiceApi.listClientsForPicker(workspace.id, query);

    return ok(reply, { items });
  });

  app.get('/web-assets/lookups/projects', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const query = webAssetsServiceApi.parseLookupQuery(request.query);
    const items = await webAssetsServiceApi.listProjectsForPicker(workspace.id, query);

    return ok(reply, { items });
  });

  app.get('/web-assets/lookups/owners', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const query = webAssetsServiceApi.parseLookupQuery(request.query);
    const items = await webAssetsServiceApi.listOwnersForPicker(workspace.id, query);

    return ok(reply, { items });
  });

  app.post<{ Body: unknown }>('/web-assets', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.create);
    const payload = webAssetsServiceApi.parseCreatePayload(request.body);
    const requestedStatus = payload.status ?? 'ACTIVE';
    if (statusRequiresPublishPermission(requestedStatus)) {
      await requirePermissionFn(user.id, workspace.id, WEB_ASSETS_PERMISSIONS.publish);
    }
    if (statusRequiresUnpublishPermission(requestedStatus)) {
      await requirePermissionFn(user.id, workspace.id, WEB_ASSETS_PERMISSIONS.unpublish);
    }

    const asset = await webAssetsServiceApi.createWebAsset({
      workspaceId: workspace.id,
      actorUserId: user.id,
      payload,
    });

    await webAssetsServiceApi.createWebAssetVersion({
      workspaceId: workspace.id,
      asset,
      actorUserId: user.id,
      sourceAction: 'create',
    });

    await auditLogFn({
      event: 'web.asset.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: asset.id,
      metadata: {
        assetType: asset.assetType,
        name: asset.name,
        newStatus: asset.status,
      },
      request,
    });

    if (asset.clientId) {
      await auditLogFn({
        event: 'web.asset.link_client',
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'web_asset',
        entityId: asset.id,
        metadata: {
          oldClientId: null,
          newClientId: asset.clientId,
          linkedOnCreate: true,
        },
        request,
      });
    }

    if (asset.projectId) {
      await auditLogFn({
        event: 'web.asset.link_project',
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'web_asset',
        entityId: asset.id,
        metadata: {
          oldProjectId: null,
          newProjectId: asset.projectId,
          linkedOnCreate: true,
        },
        request,
      });
    }

    return ok(reply, { asset }, 201);
  });

  app.put<{ Params: unknown; Body: unknown }>('/web-assets/:id', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseParams(request.params);
    const payload = webAssetsServiceApi.parseUpdatePayload(request.body);
    const existingAsset = await webAssetsServiceApi.getWebAsset(workspace.id, params.id);

    if (
      payload.status !== undefined &&
      payload.status !== existingAsset.status
    ) {
      const permissionKeys = statusChangePermissionKeys(existingAsset.status, payload.status);
      for (const permissionKey of permissionKeys) {
        await requirePermissionFn(user.id, workspace.id, permissionKey);
      }
    }

    const asset = await webAssetsServiceApi.updateWebAsset({
      workspaceId: workspace.id,
      assetId: params.id,
      payload,
    });

    await webAssetsServiceApi.createWebAssetVersion({
      workspaceId: workspace.id,
      asset,
      actorUserId: user.id,
      sourceAction: 'update',
    });

    await auditLogFn({
      event: 'web.asset.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: asset.id,
      metadata: {
        assetType: asset.assetType,
        name: asset.name,
        oldStatus: existingAsset.status,
        newStatus: asset.status,
      },
      request,
    });

    if (hasOwn(payload as object, 'clientId') && asset.clientId !== existingAsset.clientId) {
      await auditLogFn({
        event: 'web.asset.link_client',
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'web_asset',
        entityId: asset.id,
        metadata: {
          oldClientId: existingAsset.clientId,
          newClientId: asset.clientId,
        },
        request,
      });
    }

    if (hasOwn(payload as object, 'projectId') && asset.projectId !== existingAsset.projectId) {
      await auditLogFn({
        event: 'web.asset.link_project',
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'web_asset',
        entityId: asset.id,
        metadata: {
          oldProjectId: existingAsset.projectId,
          newProjectId: asset.projectId,
        },
        request,
      });
    }

    return ok(reply, { asset });
  });

  app.patch<{ Params: unknown; Body: unknown }>('/web-assets/:id', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseParams(request.params);
    const payload = webAssetsServiceApi.parseUpdatePayload(request.body);
    const existingAsset = await webAssetsServiceApi.getWebAsset(workspace.id, params.id);

    if (
      payload.status !== undefined &&
      payload.status !== existingAsset.status
    ) {
      const permissionKeys = statusChangePermissionKeys(existingAsset.status, payload.status);
      for (const permissionKey of permissionKeys) {
        await requirePermissionFn(user.id, workspace.id, permissionKey);
      }
    }

    const asset = await webAssetsServiceApi.updateWebAsset({
      workspaceId: workspace.id,
      assetId: params.id,
      payload,
    });

    await webAssetsServiceApi.createWebAssetVersion({
      workspaceId: workspace.id,
      asset,
      actorUserId: user.id,
      sourceAction: 'update',
    });

    await auditLogFn({
      event: 'web.asset.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: asset.id,
      metadata: {
        assetType: asset.assetType,
        name: asset.name,
        oldStatus: existingAsset.status,
        newStatus: asset.status,
      },
      request,
    });

    if (hasOwn(payload as object, 'clientId') && asset.clientId !== existingAsset.clientId) {
      await auditLogFn({
        event: 'web.asset.link_client',
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'web_asset',
        entityId: asset.id,
        metadata: {
          oldClientId: existingAsset.clientId,
          newClientId: asset.clientId,
        },
        request,
      });
    }

    if (hasOwn(payload as object, 'projectId') && asset.projectId !== existingAsset.projectId) {
      await auditLogFn({
        event: 'web.asset.link_project',
        actorUserId: user.id,
        workspaceId: workspace.id,
        entityType: 'web_asset',
        entityId: asset.id,
        metadata: {
          oldProjectId: existingAsset.projectId,
          newProjectId: asset.projectId,
        },
        request,
      });
    }

    return ok(reply, { asset });
  });

  app.delete<{ Params: unknown }>('/web-assets/:id', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.delete);
    const params = parseParams(request.params);
    const deleted = await webAssetsServiceApi.deleteWebAsset(workspace.id, params.id);

    await auditLogFn({
      event: 'web.asset.delete',
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
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseParams(request.params);
    const body = parsePublishBody(request.body);
    await requirePermissionFn(
      user.id,
      workspace.id,
      body.published ? WEB_ASSETS_PERMISSIONS.publish : WEB_ASSETS_PERMISSIONS.unpublish,
    );
    const nextStatus = body.published ? 'ACTIVE' : 'PAUSED';
    const currentAsset = await webAssetsServiceApi.getWebAsset(workspace.id, params.id);

    const asset = await webAssetsServiceApi.updateWebAsset({
      workspaceId: workspace.id,
      assetId: params.id,
      payload: {
        status: nextStatus,
      },
    });

    await webAssetsServiceApi.createWebAssetVersion({
      workspaceId: workspace.id,
      asset,
      actorUserId: user.id,
      sourceAction: body.published ? 'publish' : 'unpublish',
      payload: {
        versionStatus: body.published ? 'LIVE' : 'STAGED',
        changelog: body.published ? 'Published to production' : 'Unpublished from production',
      },
    });

    await auditLogFn({
      event: body.published ? 'web.asset.publish' : 'web.asset.unpublish',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: asset.id,
      metadata: {
        assetType: asset.assetType,
        name: asset.name,
        oldStatus: currentAsset.status,
        newStatus: asset.status,
      },
      request,
    });

    return ok(reply, { asset });
  });

  app.post<{ Params: unknown; Body: unknown }>('/web-assets/:id/deployment', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.publish);
    const params = parseParams(request.params);
    const payload = webAssetsServiceApi.parseDeploymentPayload(request.body);
    const result = await webAssetsServiceApi.switchWebAssetDeploymentEnvironment({
      workspaceId: workspace.id,
      assetId: params.id,
      actorUserId: user.id,
      payload,
    });

    await auditLogFn({
      event: 'web.deployment.switch',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: result.asset.id,
      metadata: {
        environment: result.asset.deploymentEnvironment,
        versionId: result.version?.id ?? null,
      },
      request,
    });

    return ok(reply, result);
  });

  app.get<{ Params: unknown; Querystring: unknown }>('/web-assets/:id/versions', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const params = parseParams(request.params);
    const query = parseVersionListQuery(request.query);
    const items = await webAssetsServiceApi.listWebAssetVersions(workspace.id, params.id, query.limit);

    return ok(reply, { items });
  });

  app.post<{ Params: unknown; Body: unknown }>('/web-assets/:id/versions', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.versionCreate);
    const params = parseParams(request.params);
    const payload = webAssetsServiceApi.parseVersionPayload(request.body);
    const asset = await webAssetsServiceApi.getWebAsset(workspace.id, params.id);

    const version = await webAssetsServiceApi.createWebAssetVersion({
      workspaceId: workspace.id,
      asset,
      actorUserId: user.id,
      sourceAction: 'manual_version',
      payload,
    });

    await auditLogFn({
      event: 'web.version.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: asset.id,
      metadata: {
        assetType: asset.assetType,
        versionId: version.id,
        versionNumber: version.versionNumber,
        versionStatus: version.versionStatus,
      },
      request,
    });

    return ok(reply, { version }, 201);
  });

  app.get<{ Params: unknown; Querystring: unknown }>('/web-assets/:id/versions/compare', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const params = parseParams(request.params);
    const query = webAssetsServiceApi.parseVersionCompareQuery(request.query);
    const comparison = await webAssetsServiceApi.compareWebAssetVersions({
      workspaceId: workspace.id,
      assetId: params.id,
      leftVersionId: query.leftVersionId,
      rightVersionId: query.rightVersionId,
    });

    return ok(reply, comparison);
  });

  app.post<{ Params: unknown }>('/web-assets/:id/versions/:versionId/rollback', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.versionRollback);
    const params = parseVersionParams(request.params);
    const [currentAsset, sourceVersion] = await Promise.all([
      webAssetsServiceApi.getWebAsset(workspace.id, params.id),
      webAssetsServiceApi.getWebAssetVersion(workspace.id, params.id, params.versionId),
    ]);

    const sourceStatus = getStatusFromSnapshot(sourceVersion.snapshot);
    if (sourceStatus) {
      const permissionKeys = statusChangePermissionKeys(currentAsset.status, sourceStatus);
      for (const permissionKey of permissionKeys) {
        await requirePermissionFn(user.id, workspace.id, permissionKey);
      }
    }

    const rollback = await webAssetsServiceApi.rollbackWebAssetToVersion({
      workspaceId: workspace.id,
      assetId: params.id,
      versionId: params.versionId,
      actorUserId: user.id,
    });

    await auditLogFn({
      event: 'web.version.rollback',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: rollback.asset.id,
      metadata: {
        versionFrom: rollback.sourceVersion.id,
        versionTo: rollback.rollbackVersion.id,
      },
      request,
    });

    return ok(reply, rollback);
  });

  app.get<{ Params: unknown; Querystring: unknown }>('/web-assets/:id/health', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const params = parseParams(request.params);
    const query = parseMonitoringQuery(request.query);
    const result = await webAssetsServiceApi.listWebAssetHealth({
      workspaceId: workspace.id,
      assetId: params.id,
      limit: query.limit,
    });

    return ok(reply, result);
  });

  app.post<{ Params: unknown }>('/web-assets/:id/health/check', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseParams(request.params);
    const result = await webAssetsServiceApi.runWebAssetHealthCheck({
      workspaceId: workspace.id,
      assetId: params.id,
      actorUserId: user.id,
    });

    await auditLogFn({
      event: 'web.health.check',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: params.id,
      metadata: {
        status: result.check.status,
        responseTimeMs: result.check.responseTimeMs,
        httpStatus: result.check.httpStatus,
      },
      request,
    });

    return ok(reply, result);
  });

  app.get<{ Params: unknown; Querystring: unknown }>('/web-assets/:id/seo/reports', async (request, reply) => {
    const { workspace } = await ensureSeoAccessFn(request, SEO_PERMISSIONS.view);
    const params = parseParams(request.params);
    const query = parseMonitoringQuery(request.query);
    const items = await webAssetsServiceApi.listWebAssetSeoReports({
      workspaceId: workspace.id,
      assetId: params.id,
      limit: query.limit,
    });

    return ok(reply, { items });
  });

  app.post<{ Params: unknown; Body: unknown }>('/web-assets/:id/seo/scan', async (request, reply) => {
    const { user, workspace } = await ensureSeoAccessFn(request, SEO_PERMISSIONS.runScan);
    const params = parseParams(request.params);
    const payload = webAssetsServiceApi.parseSeoScanPayload(request.body);
    const result = await webAssetsServiceApi.runWebAssetSeoScan({
      workspaceId: workspace.id,
      assetId: params.id,
      actorUserId: user.id,
      payload,
    });

    await auditLogFn({
      event: 'web.seo.scan',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: params.id,
      metadata: {
        score: result.report.score,
        reportId: result.report.id,
      },
      request,
    });

    return ok(reply, result, 201);
  });

  app.get<{ Params: unknown; Querystring: unknown }>('/web-assets/:id/analytics', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const params = parseParams(request.params);
    const query = parseAnalyticsQuery(request.query);
    const result = await webAssetsServiceApi.listWebAssetAnalytics({
      workspaceId: workspace.id,
      assetId: params.id,
      snapshotsLimit: query.snapshotsLimit,
      eventsLimit: query.eventsLimit,
    });

    return ok(reply, result);
  });

  app.post<{ Params: unknown; Body: unknown }>('/web-assets/:id/analytics/snapshots', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseParams(request.params);
    const payload = webAssetsServiceApi.parseAnalyticsSnapshotPayload(request.body);
    const snapshot = await webAssetsServiceApi.createWebAssetAnalyticsSnapshot({
      workspaceId: workspace.id,
      assetId: params.id,
      actorUserId: user.id,
      payload,
    });

    await auditLogFn({
      event: 'web.analytics.snapshot.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: params.id,
      metadata: {
        snapshotId: snapshot.id,
        provider: snapshot.provider,
        periodEnd: snapshot.periodEnd.toISOString(),
      },
      request,
    });

    return ok(reply, { snapshot }, 201);
  });

  app.post<{ Params: unknown; Body: unknown }>('/web-assets/:id/analytics/events', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseParams(request.params);
    const payload = webAssetsServiceApi.parseAnalyticsEventPayload(request.body);
    const eventRecord = await webAssetsServiceApi.createWebAssetAnalyticsEvent({
      workspaceId: workspace.id,
      assetId: params.id,
      actorUserId: user.id,
      payload,
    });

    await auditLogFn({
      event: 'web.analytics.event.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: params.id,
      metadata: {
        analyticsEventId: eventRecord.id,
        eventName: eventRecord.eventName,
        count: eventRecord.count,
      },
      request,
    });

    return ok(reply, { event: eventRecord }, 201);
  });

  app.get<{ Params: unknown; Querystring: unknown }>('/web-assets/:id/maintenance', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const params = parseParams(request.params);
    const query = parseMonitoringQuery(request.query);
    const items = await webAssetsServiceApi.listWebAssetMaintenanceWindows({
      workspaceId: workspace.id,
      assetId: params.id,
      actorUserId: user.id,
      limit: query.limit,
    });

    return ok(reply, { items });
  });

  app.post<{ Params: unknown; Body: unknown }>('/web-assets/:id/maintenance', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseParams(request.params);
    const payload = webAssetsServiceApi.parseMaintenancePayload(request.body);
    const maintenanceWindow = await webAssetsServiceApi.createWebAssetMaintenanceWindow({
      workspaceId: workspace.id,
      assetId: params.id,
      actorUserId: user.id,
      payload,
    });

    await auditLogFn({
      event: 'web.maintenance.create',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: params.id,
      metadata: {
        maintenanceId: maintenanceWindow.id,
        startsAt: maintenanceWindow.startsAt.toISOString(),
        endsAt: maintenanceWindow.endsAt.toISOString(),
      },
      request,
    });

    return ok(reply, { maintenanceWindow }, 201);
  });

  app.patch<{ Params: unknown; Body: unknown }>('/web-assets/:id/maintenance/:maintenanceId', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseMaintenanceParams(request.params);
    const payload = webAssetsServiceApi.parseMaintenancePatchPayload(request.body);
    const maintenanceWindow = await webAssetsServiceApi.updateWebAssetMaintenanceWindow({
      workspaceId: workspace.id,
      assetId: params.id,
      maintenanceId: params.maintenanceId,
      actorUserId: user.id,
      payload,
    });

    await auditLogFn({
      event: 'web.maintenance.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: params.id,
      metadata: {
        maintenanceId: maintenanceWindow.id,
        status: maintenanceWindow.status,
      },
      request,
    });

    return ok(reply, { maintenanceWindow });
  });

  app.get<{ Params: unknown; Querystring: unknown }>('/web-assets/:id/alerts', async (request, reply) => {
    const { workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    const params = parseParams(request.params);
    const query = parseAlertsQuery(request.query);
    const items = await webAssetsServiceApi.listWebAssetAlerts({
      workspaceId: workspace.id,
      assetId: params.id,
      status: query.status,
      limit: query.limit,
    });

    return ok(reply, { items });
  });

  app.patch<{ Params: unknown; Body: unknown }>('/web-assets/:id/alerts/:alertId', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.edit);
    const params = parseAlertParams(request.params);
    const payload = webAssetsServiceApi.parseAlertPatchPayload(request.body);
    const alert = await webAssetsServiceApi.updateWebAssetAlert({
      workspaceId: workspace.id,
      assetId: params.id,
      alertId: params.alertId,
      payload,
    });

    await auditLogFn({
      event: 'web.alert.update',
      actorUserId: user.id,
      workspaceId: workspace.id,
      entityType: 'web_asset',
      entityId: params.id,
      metadata: {
        alertId: alert.id,
        status: alert.status,
      },
      request,
    });

    return ok(reply, { alert });
  });

  app.get<{ Querystring: unknown }>('/web-assets/audit', async (request, reply) => {
    const { user, workspace } = await ensureWebAssetsAccessFn(request, WEB_ASSETS_PERMISSIONS.view);
    await requirePermissionFn(user.id, workspace.id, AUDIT_VIEW_PERMISSION);
    const query = parseAuditQuery(request.query);
    const result = await auditRepository.listWebAssetActivityByWorkspace({
      workspaceId: workspace.id,
      page: query.page,
      pageSize: query.pageSize,
      action: query.action,
      assetId: query.assetId,
    });

    return ok(reply, {
      items: result.items.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
        actor: item.actorUser
          ? {
              id: item.actorUser.id,
              email: item.actorUser.email,
              ...(item.actorUser.name ? { name: item.actorUser.name } : {}),
            }
          : null,
      })),
      pageInfo: result.pageInfo,
    });
  });
};

const workspaceWebAssetsRoute = buildWorkspaceWebAssetsRoute();

export default workspaceWebAssetsRoute;
