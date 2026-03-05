import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../../core/response.js';
import {
  DASHBOARD_PERMISSIONS,
  ensureDashboardAccess,
  type DashboardPermissionKey,
} from '../dashboard.policies.js';
import { dashboardService } from '../dashboard.service.js';
import { requirePermission } from '../../../guards/requirePermission.js';

type DashboardRouteDependencies = {
  ensureDashboardAccessFn: (
    request: Parameters<typeof ensureDashboardAccess>[0],
    permissionKey: DashboardPermissionKey,
  ) => ReturnType<typeof ensureDashboardAccess>;
  requirePermissionFn: typeof requirePermission;
  dashboardServiceApi: typeof dashboardService;
};

const defaultDependencies: DashboardRouteDependencies = {
  ensureDashboardAccessFn: ensureDashboardAccess,
  requirePermissionFn: requirePermission,
  dashboardServiceApi: dashboardService,
};

type TeamWorkloadQuery = {
  range?: string;
  from?: string;
  to?: string;
  includeAllUsers?: string;
};

export const buildWorkspaceDashboardRoute = (
  dependencies: Partial<DashboardRouteDependencies> = {},
): FastifyPluginAsync => async (app) => {
  const {
    ensureDashboardAccessFn,
    requirePermissionFn,
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

  app.get<{ Querystring: TeamWorkloadQuery }>('/api/dashboard/team-workload', async (request, reply) => {
    const { user, workspace } = await ensureDashboardAccessFn(request, DASHBOARD_PERMISSIONS.view);
    await requirePermissionFn(user.id, workspace.id, 'team.view');
    await requirePermissionFn(user.id, workspace.id, 'checklists.view');

    const workload = await dashboardServiceApi.getTeamWorkload({
      workspaceId: workspace.id,
      query: request.query,
    });

    return ok(reply, workload);
  });
};

const workspaceDashboardRoute = buildWorkspaceDashboardRoute();

export default workspaceDashboardRoute;
