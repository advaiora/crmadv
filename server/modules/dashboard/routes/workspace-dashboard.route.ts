import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../../core/response.js';
import {
  DASHBOARD_PERMISSIONS,
  ensureDashboardAccess,
  type DashboardPermissionKey,
} from '../dashboard.policies.js';
import { dashboardService } from '../dashboard.service.js';

type DashboardRouteDependencies = {
  ensureDashboardAccessFn: (
    request: Parameters<typeof ensureDashboardAccess>[0],
    permissionKey: DashboardPermissionKey,
  ) => ReturnType<typeof ensureDashboardAccess>;
  dashboardServiceApi: typeof dashboardService;
};

const defaultDependencies: DashboardRouteDependencies = {
  ensureDashboardAccessFn: ensureDashboardAccess,
  dashboardServiceApi: dashboardService,
};

export const buildWorkspaceDashboardRoute = (
  dependencies: Partial<DashboardRouteDependencies> = {},
): FastifyPluginAsync => async (app) => {
  const {
    ensureDashboardAccessFn,
    dashboardServiceApi,
  } = {
    ...defaultDependencies,
    ...dependencies,
  };

  app.get('/api/dashboard/overview', async (request, reply) => {
    const { workspace } = await ensureDashboardAccessFn(request, DASHBOARD_PERMISSIONS.view);
    const overview = await dashboardServiceApi.getOverview(workspace.id);

    return ok(reply, overview);
  });

  app.get('/api/dashboard/home', async (request, reply) => {
    const { user, workspace } = await ensureDashboardAccessFn(request, DASHBOARD_PERMISSIONS.view);
    const home = await dashboardServiceApi.getHome({
      workspaceId: workspace.id,
      userId: user.id,
    });

    reply.header('Cache-Control', 'private, max-age=30');

    return ok(reply, home);
  });
};

const workspaceDashboardRoute = buildWorkspaceDashboardRoute();

export default workspaceDashboardRoute;
