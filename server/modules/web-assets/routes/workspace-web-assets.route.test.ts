import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { audit } from '../../../audit/audit.js';
import { forbidden } from '../../../core/errors.js';
import { type WebAssetsPermissionKey, WEB_ASSETS_PERMISSIONS } from '../policies.js';
import { webAssetsService } from '../service.js';
import {
  buildWorkspaceWebAssetsRoute,
} from './workspace-web-assets.route.js';

const SAMPLE_ASSET = {
  id: 'asset-1',
  assetType: 'website',
  name: 'Asset one',
  status: 'MAINTENANCE',
};

const buildMockWebAssetsService = (
  overrides: Partial<typeof webAssetsService> = {},
): typeof webAssetsService => ({
  parseListQuery: () => ({}),
  parseLookupQuery: () => ({ limit: 20 }),
  parseCreatePayload: () => ({
    assetType: 'website',
    name: 'New asset',
    url: 'https://example.com',
    status: 'MAINTENANCE',
  }),
  parseUpdatePayload: () => ({ name: 'Updated asset' }),
  parseVersionPayload: () => ({ versionStatus: 'DRAFT' }),
  parseVersionCompareQuery: () => ({ leftVersionId: 'v1', rightVersionId: 'v2' }),
  parseDeploymentPayload: () => ({ environment: 'STAGING' }),
  parseMonitoringHistoryQuery: () => ({ limit: 30 }),
  parseSeoScanPayload: () => ({ keywords: [] }),
  parseAnalyticsSnapshotPayload: () => ({
    provider: 'manual',
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
    sessions: 0,
    users: 0,
    pageViews: 0,
  }),
  parseAnalyticsEventPayload: () => ({ eventName: 'click', count: 1 }),
  parseMaintenancePayload: () => ({
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
  }),
  parseMaintenancePatchPayload: () => ({ status: 'IN_PROGRESS' }),
  parseAlertPatchPayload: () => ({ status: 'ACKNOWLEDGED' }),
  listWebAssets: async () => ({
    items: [],
    pageInfo: {
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
    },
  }),
  getWebAsset: async () => SAMPLE_ASSET as never,
  createWebAsset: async () => SAMPLE_ASSET as never,
  updateWebAsset: async () => SAMPLE_ASSET as never,
  deleteWebAsset: async () => SAMPLE_ASSET as never,
  createWebAssetVersion: async () => ({
    id: 'version-1',
    versionStatus: 'DRAFT',
  }) as never,
  listWebAssetVersions: async () => [],
  getWebAssetVersion: async () => ({
    id: 'version-1',
    snapshot: { status: 'MAINTENANCE' },
  }) as never,
  compareWebAssetVersions: async () => ({
    changes: {},
  }) as never,
  rollbackWebAssetToVersion: async () => ({
    asset: SAMPLE_ASSET,
    sourceVersion: { id: 'version-1' },
    rollbackVersion: { id: 'version-2' },
  }) as never,
  switchWebAssetDeploymentEnvironment: async () => ({
    asset: {
      ...SAMPLE_ASSET,
      deploymentEnvironment: 'STAGING',
    },
    version: { id: 'version-3' },
  }) as never,
  runWebAssetHealthCheck: async () => ({
    check: { status: 'UP', responseTimeMs: 123, httpStatus: 200 },
    summary: {},
    alerts: [],
  }) as never,
  listWebAssetHealth: async () => ({
    checks: [],
    summary: {},
    alerts: [],
  }) as never,
  runWebAssetSeoScan: async () => ({
    report: { id: 'seo-1', score: 88 },
  }) as never,
  listWebAssetSeoReports: async () => ([] as never),
  createWebAssetAnalyticsSnapshot: async () => ({
    id: 'analytics-snap-1',
    provider: 'manual',
    periodEnd: new Date(),
  }) as never,
  createWebAssetAnalyticsEvent: async () => ({
    id: 'analytics-event-1',
    eventName: 'click',
    count: 1,
  }) as never,
  listWebAssetAnalytics: async () => ({
    snapshots: [],
    events: [],
    summary: {},
    topEvents: [],
  }) as never,
  listWebAssetMaintenanceWindows: async () => ([] as never),
  createWebAssetMaintenanceWindow: async () => ({
    id: 'maintenance-1',
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 60_000),
  }) as never,
  updateWebAssetMaintenanceWindow: async () => ({
    id: 'maintenance-1',
    status: 'IN_PROGRESS',
  }) as never,
  listWebAssetAlerts: async () => ([] as never),
  updateWebAssetAlert: async () => ({
    id: 'alert-1',
    status: 'ACKNOWLEDGED',
  }) as never,
  listClientsForPicker: async () => [],
  listProjectsForPicker: async () => [],
  listOwnersForPicker: async () => [],
  ...overrides,
}) as typeof webAssetsService;

type EnsureWebAssetsAccessFn = (
  request: FastifyRequest,
  permissionKey: WebAssetsPermissionKey,
) => Promise<{
  user: { id: string };
  workspace: { id: string };
}>;

const createTestApp = async (input: {
  ensureWebAssetsAccessFn?: EnsureWebAssetsAccessFn;
  requirePermissionFn?: (userId: string, workspaceId: string, permissionKey: string) => Promise<void>;
  webAssetsServiceApi?: typeof webAssetsService;
  auditLogFn?: typeof audit.log;
}) => {
  const app = Fastify({ logger: false });

  const ensureWebAssetsAccessFn = input.ensureWebAssetsAccessFn
    ?? (async () => ({
      user: { id: 'user-1' },
      workspace: { id: 'workspace-1' },
    }));

  const requirePermissionFn = input.requirePermissionFn ?? (async () => undefined);
  const webAssetsServiceApi = input.webAssetsServiceApi ?? buildMockWebAssetsService();
  const auditLogFn = input.auditLogFn ?? (async () => undefined);

  await app.register(
    buildWorkspaceWebAssetsRoute({
      ensureWebAssetsAccessFn,
      requirePermissionFn,
      webAssetsServiceApi,
      auditLogFn,
    }),
  );

  return app;
};

const closeApp = async (app: FastifyInstance | null) => {
  if (app) {
    await app.close();
  }
};

test('web-assets routes request expected permission for each endpoint', async () => {
  let app: FastifyInstance | null = null;
  const requestedPermissions: string[] = [];

  try {
    app = await createTestApp({
      ensureWebAssetsAccessFn: async (_request, permissionKey) => {
        requestedPermissions.push(permissionKey);
        return {
          user: { id: 'user-1' },
          workspace: { id: 'workspace-1' },
        } as never;
      },
    });

    const responses = [
      await app.inject({ method: 'GET', url: '/web-assets' }),
      await app.inject({ method: 'GET', url: '/web-assets/asset-1' }),
      await app.inject({ method: 'GET', url: '/web-assets/lookups/clients' }),
      await app.inject({ method: 'GET', url: '/web-assets/lookups/projects' }),
      await app.inject({
        method: 'POST',
        url: '/web-assets',
        payload: {
          assetType: 'website',
          name: 'Asset create',
          url: 'https://create.example',
          status: 'MAINTENANCE',
        },
      }),
      await app.inject({
        method: 'PUT',
        url: '/web-assets/asset-1',
        payload: { name: 'Asset update' },
      }),
      await app.inject({
        method: 'PATCH',
        url: '/web-assets/asset-1',
        payload: { name: 'Asset patch' },
      }),
      await app.inject({
        method: 'DELETE',
        url: '/web-assets/asset-1',
      }),
      await app.inject({
        method: 'POST',
        url: '/web-assets/asset-1/publish',
        payload: { published: true },
      }),
      await app.inject({
        method: 'POST',
        url: '/web-assets/asset-1/deployment',
        payload: { environment: 'STAGING' },
      }),
      await app.inject({ method: 'GET', url: '/web-assets/asset-1/health' }),
      await app.inject({ method: 'POST', url: '/web-assets/asset-1/health/check' }),
      await app.inject({ method: 'GET', url: '/web-assets/asset-1/seo/reports' }),
      await app.inject({ method: 'POST', url: '/web-assets/asset-1/seo/scan', payload: {} }),
      await app.inject({ method: 'GET', url: '/web-assets/asset-1/analytics' }),
      await app.inject({
        method: 'POST',
        url: '/web-assets/asset-1/analytics/snapshots',
        payload: {
          provider: 'manual',
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          sessions: 0,
          users: 0,
          pageViews: 0,
        },
      }),
      await app.inject({
        method: 'POST',
        url: '/web-assets/asset-1/analytics/events',
        payload: { eventName: 'click' },
      }),
      await app.inject({ method: 'GET', url: '/web-assets/asset-1/maintenance' }),
      await app.inject({
        method: 'POST',
        url: '/web-assets/asset-1/maintenance',
        payload: {
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 60_000).toISOString(),
        },
      }),
      await app.inject({
        method: 'PATCH',
        url: '/web-assets/asset-1/maintenance/maintenance-1',
        payload: { status: 'IN_PROGRESS' },
      }),
      await app.inject({ method: 'GET', url: '/web-assets/asset-1/alerts' }),
      await app.inject({
        method: 'PATCH',
        url: '/web-assets/asset-1/alerts/alert-1',
        payload: { status: 'ACKNOWLEDGED' },
      }),
    ];

    for (const response of responses) {
      assert.notEqual(response.statusCode, 500);
    }

    assert.deepEqual(
      requestedPermissions,
      [
        WEB_ASSETS_PERMISSIONS.view,
        WEB_ASSETS_PERMISSIONS.view,
        WEB_ASSETS_PERMISSIONS.view,
        WEB_ASSETS_PERMISSIONS.view,
        WEB_ASSETS_PERMISSIONS.create,
        WEB_ASSETS_PERMISSIONS.edit,
        WEB_ASSETS_PERMISSIONS.edit,
        WEB_ASSETS_PERMISSIONS.delete,
        WEB_ASSETS_PERMISSIONS.publish,
        WEB_ASSETS_PERMISSIONS.publish,
        WEB_ASSETS_PERMISSIONS.view,
        WEB_ASSETS_PERMISSIONS.edit,
        WEB_ASSETS_PERMISSIONS.view,
        WEB_ASSETS_PERMISSIONS.edit,
        WEB_ASSETS_PERMISSIONS.view,
        WEB_ASSETS_PERMISSIONS.edit,
        WEB_ASSETS_PERMISSIONS.edit,
        WEB_ASSETS_PERMISSIONS.view,
        WEB_ASSETS_PERMISSIONS.edit,
        WEB_ASSETS_PERMISSIONS.edit,
        WEB_ASSETS_PERMISSIONS.view,
        WEB_ASSETS_PERMISSIONS.edit,
      ],
    );
  } finally {
    await closeApp(app);
  }
});

test('create route requires web.publish when requested status is publish-controlled', async () => {
  let app: FastifyInstance | null = null;
  const requiredPermissionCalls: string[] = [];

  try {
    app = await createTestApp({
      requirePermissionFn: async (_userId, _workspaceId, permissionKey) => {
        requiredPermissionCalls.push(permissionKey);
      },
      webAssetsServiceApi: buildMockWebAssetsService({
        parseCreatePayload: () => ({
          assetType: 'website',
          name: 'Asset create',
          url: 'https://create.example',
          status: 'ACTIVE',
        }),
      }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/web-assets',
      payload: {
        assetType: 'website',
        name: 'Asset create',
        url: 'https://create.example',
        status: 'ACTIVE',
      },
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(requiredPermissionCalls, [WEB_ASSETS_PERMISSIONS.publish]);
  } finally {
    await closeApp(app);
  }
});

test('create route does not require web.publish when requested status is not publish-controlled', async () => {
  let app: FastifyInstance | null = null;
  const requiredPermissionCalls: string[] = [];

  try {
    app = await createTestApp({
      requirePermissionFn: async (_userId, _workspaceId, permissionKey) => {
        requiredPermissionCalls.push(permissionKey);
      },
      webAssetsServiceApi: buildMockWebAssetsService({
        parseCreatePayload: () => ({
          assetType: 'website',
          name: 'Asset create',
          url: 'https://create.example',
          status: 'MAINTENANCE',
        }),
      }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/web-assets',
      payload: {
        assetType: 'website',
        name: 'Asset create',
        url: 'https://create.example',
        status: 'MAINTENANCE',
      },
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(requiredPermissionCalls, []);
  } finally {
    await closeApp(app);
  }
});

test('update route requires web.publish when changing publish-controlled status', async () => {
  let app: FastifyInstance | null = null;
  const requiredPermissionCalls: string[] = [];

  try {
    app = await createTestApp({
      requirePermissionFn: async (_userId, _workspaceId, permissionKey) => {
        requiredPermissionCalls.push(permissionKey);
      },
      webAssetsServiceApi: buildMockWebAssetsService({
        parseUpdatePayload: () => ({ status: 'PAUSED' }),
        getWebAsset: async () => ({
          ...SAMPLE_ASSET,
          status: 'ACTIVE',
        }) as never,
      }),
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/web-assets/asset-1',
      payload: {
        status: 'PAUSED',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(requiredPermissionCalls, [WEB_ASSETS_PERMISSIONS.publish]);
  } finally {
    await closeApp(app);
  }
});

test('update route does not require web.publish when publish-controlled status does not change', async () => {
  let app: FastifyInstance | null = null;
  const requiredPermissionCalls: string[] = [];

  try {
    app = await createTestApp({
      requirePermissionFn: async (_userId, _workspaceId, permissionKey) => {
        requiredPermissionCalls.push(permissionKey);
      },
      webAssetsServiceApi: buildMockWebAssetsService({
        parseUpdatePayload: () => ({ status: 'ACTIVE' }),
        getWebAsset: async () => ({
          ...SAMPLE_ASSET,
          status: 'ACTIVE',
        }) as never,
      }),
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/web-assets/asset-1',
      payload: {
        status: 'ACTIVE',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(requiredPermissionCalls, []);
  } finally {
    await closeApp(app);
  }
});

test('workspace isolation: user cannot read or modify an asset from another workspace (403)', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      webAssetsServiceApi: buildMockWebAssetsService({
        getWebAsset: async (_workspaceId, assetId) => {
          if (assetId === 'asset-b') {
            throw forbidden('Asset belongs to another workspace');
          }

          return SAMPLE_ASSET as never;
        },
        updateWebAsset: async ({ assetId }) => {
          if (assetId === 'asset-b') {
            throw forbidden('Asset belongs to another workspace');
          }

          return SAMPLE_ASSET as never;
        },
      }),
    });

    const readResponse = await app.inject({
      method: 'GET',
      url: '/web-assets/asset-b',
    });
    const updateResponse = await app.inject({
      method: 'PUT',
      url: '/web-assets/asset-b',
      payload: { name: 'Blocked update' },
    });

    assert.equal(readResponse.statusCode, 403);
    assert.equal(updateResponse.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('module enforcement: disabled web module blocks endpoint with 403', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      ensureWebAssetsAccessFn: async () => {
        throw forbidden('Module is disabled for this workspace');
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/web-assets',
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('permission enforcement: viewer without web.edit gets 403 on PUT', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      ensureWebAssetsAccessFn: async (_request, permissionKey) => {
        if (permissionKey === WEB_ASSETS_PERMISSIONS.edit) {
          throw forbidden('Permission denied', { permissionKey });
        }

        return {
          user: { id: 'viewer-1' },
          workspace: { id: 'workspace-1' },
        };
      },
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/web-assets/asset-1',
      payload: { name: 'Attempted update' },
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('audit creation: creating an asset writes expected audit entries', async () => {
  let app: FastifyInstance | null = null;
  const auditCalls: Array<Record<string, unknown>> = [];

  try {
    app = await createTestApp({
      webAssetsServiceApi: buildMockWebAssetsService({
        createWebAsset: async () => ({
          ...SAMPLE_ASSET,
          status: 'MAINTENANCE',
          clientId: 'client-1',
          projectId: 'project-1',
        }) as never,
      }),
      auditLogFn: async (payload) => {
        auditCalls.push(payload);
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/web-assets',
      payload: {
        assetType: 'website',
        name: 'Asset create',
        url: 'https://create.example',
        status: 'MAINTENANCE',
      },
    });

    assert.equal(response.statusCode, 201);

    const createAudit = auditCalls.find((entry) => entry.event === 'web.asset.create');
    assert.ok(createAudit);
    assert.equal(createAudit?.workspaceId, 'workspace-1');
    assert.equal(createAudit?.actorUserId, 'user-1');
    assert.equal(createAudit?.entityType, 'web_asset');
    assert.equal(createAudit?.entityId, 'asset-1');

    const linkClientAudit = auditCalls.find((entry) => entry.event === 'web.asset.link_client');
    const linkProjectAudit = auditCalls.find((entry) => entry.event === 'web.asset.link_project');
    assert.ok(linkClientAudit);
    assert.ok(linkProjectAudit);
  } finally {
    await closeApp(app);
  }
});

test('publish, unpublish and rollback generate audit events', async () => {
  let app: FastifyInstance | null = null;
  const events: string[] = [];

  try {
    app = await createTestApp({
      webAssetsServiceApi: buildMockWebAssetsService({
        getWebAsset: async (_workspaceId, assetId) => ({
          ...SAMPLE_ASSET,
          id: assetId,
          status: 'ACTIVE',
        }) as never,
        updateWebAsset: async ({ payload }) => ({
          ...SAMPLE_ASSET,
          status: payload.status ?? SAMPLE_ASSET.status,
        }) as never,
      }),
      auditLogFn: async (payload) => {
        events.push(String(payload.event));
      },
    });

    const publishResponse = await app.inject({
      method: 'POST',
      url: '/web-assets/asset-1/publish',
      payload: { published: true },
    });
    const unpublishResponse = await app.inject({
      method: 'POST',
      url: '/web-assets/asset-1/publish',
      payload: { published: false },
    });
    const rollbackResponse = await app.inject({
      method: 'POST',
      url: '/web-assets/asset-1/versions/version-1/rollback',
    });

    assert.equal(publishResponse.statusCode, 200);
    assert.equal(unpublishResponse.statusCode, 200);
    assert.equal(rollbackResponse.statusCode, 200);
    assert.ok(events.includes('web.asset.publish'));
    assert.ok(events.includes('web.asset.unpublish'));
    assert.ok(events.includes('web.version.rollback'));
  } finally {
    await closeApp(app);
  }
});
