import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { forbidden } from '../../../core/errors.js';
import { buildWorkspaceDashboardRoute } from './workspace-dashboard.route.js';

// Il parametro di buildWorkspaceDashboardRoute ha un valore di default, quindi il suo
// tipo comprende `undefined`: senza NonNullable, leggerci dentro una singola dipendenza
// non compila (TS2339).
type RouteDependencies = NonNullable<Parameters<typeof buildWorkspaceDashboardRoute>[0]>;

const createTestApp = async (input?: {
  ensureDashboardAccessFn?: RouteDependencies['ensureDashboardAccessFn'];
  requireModuleEnabledFn?: RouteDependencies['requireModuleEnabledFn'];
  requirePermissionFn?: RouteDependencies['requirePermissionFn'];
}) => {
  const app = Fastify({ logger: false });

  await app.register(
    buildWorkspaceDashboardRoute({
      // Il doppione restituisce i soli campi che la rotta legge (user.id e workspace.id),
      // non l'utente e il workspace interi di ensureDashboardAccess: da qui il cast.
      ensureDashboardAccessFn: input?.ensureDashboardAccessFn
        ?? ((async () => ({
          user: { id: 'user-1' },
          workspace: { id: 'workspace-1' },
        })) as unknown as RouteDependencies['ensureDashboardAccessFn']),
      requireModuleEnabledFn: input?.requireModuleEnabledFn ?? (async () => undefined),
      requirePermissionFn: input?.requirePermissionFn ?? (async () => undefined),
      dashboardServiceApi: {
        getOverview: async () => ({
          kpis: {
            clientsActive: 0,
            projectsActive: 0,
            quotesSent30d: 0,
            checklistOpenItems: 0,
          },
          urgent: [],
          pipeline: [],
          activity: [],
        }),
        getHome: async () => ({
          role: 'viewer',
          widgets: [],
        }),
        getTeamWorkload: async () => ({
          range: {
            from: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            to: new Date('2026-01-08T00:00:00.000Z').toISOString(),
          },
          items: [],
        }),
      },
    }),
  );

  return app;
};

const closeApp = async (app: FastifyInstance | null) => {
  if (app) {
    await app.close();
  }
};

test('dashboard route returns 403 when module is disabled', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      ensureDashboardAccessFn: async () => {
        throw forbidden('Module is disabled for this workspace');
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/overview',
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('dashboard route returns 403 when permission is missing', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      ensureDashboardAccessFn: async () => {
        throw forbidden('Permission denied');
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/overview',
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('dashboard home route returns 403 when permission is missing', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      ensureDashboardAccessFn: async () => {
        throw forbidden('Permission denied');
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/home',
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('dashboard home route sets private cache header', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/home',
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'private, max-age=30');
  } finally {
    await closeApp(app);
  }
});

test('dashboard team workload route returns 403 when permission is missing', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      requirePermissionFn: async () => {
        throw forbidden('Permission denied');
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/team-workload',
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('dashboard team workload route returns 403 when checklists module is disabled', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      requireModuleEnabledFn: async (_workspaceId: string, moduleKey: string) => {
        if (moduleKey === 'checklists') {
          throw forbidden('Module is disabled for this workspace');
        }
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/team-workload',
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('dashboard team workload route returns 403 when team module is disabled', async () => {
  let app: FastifyInstance | null = null;

  try {
    app = await createTestApp({
      requireModuleEnabledFn: async (_workspaceId: string, moduleKey: string) => {
        if (moduleKey === 'team') {
          throw forbidden('Module is disabled for this workspace');
        }
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/team-workload',
    });

    assert.equal(response.statusCode, 403);
  } finally {
    await closeApp(app);
  }
});

test('dashboard team workload route checks both modules and answers when they are enabled', async () => {
  let app: FastifyInstance | null = null;
  const checkedModuleKeys: string[] = [];

  try {
    app = await createTestApp({
      requireModuleEnabledFn: async (_workspaceId: string, moduleKey: string) => {
        checkedModuleKeys.push(moduleKey);
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/team-workload',
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(checkedModuleKeys, ['team', 'checklists']);
  } finally {
    await closeApp(app);
  }
});
