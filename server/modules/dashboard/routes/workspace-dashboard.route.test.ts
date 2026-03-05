import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { forbidden } from '../../../core/errors.js';
import { buildWorkspaceDashboardRoute } from './workspace-dashboard.route.js';

const createTestApp = async (input?: {
  ensureDashboardAccessFn?: Parameters<typeof buildWorkspaceDashboardRoute>[0]['ensureDashboardAccessFn'];
  requirePermissionFn?: Parameters<typeof buildWorkspaceDashboardRoute>[0]['requirePermissionFn'];
}) => {
  const app = Fastify({ logger: false });

  await app.register(
    buildWorkspaceDashboardRoute({
      ensureDashboardAccessFn: input?.ensureDashboardAccessFn
        ?? (async () => ({
          user: { id: 'user-1' },
          workspace: { id: 'workspace-1' },
        })),
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
