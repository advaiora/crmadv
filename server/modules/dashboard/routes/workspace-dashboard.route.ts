import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../../../core/response.js';
import {
  DASHBOARD_PERMISSIONS,
  ensureDashboardAccess,
  type DashboardPermissionKey,
} from '../dashboard.policies.js';
import { dashboardService } from '../dashboard.service.js';
import { requireModuleEnabled } from '../../../guards/requireModule.js';
import { requirePermission } from '../../../guards/requirePermission.js';
import { TEAM_MODULE_KEY } from '../../../auth/rbac-catalog.js';

// Il catalogo non esporta una costante per i Memo Operativi (rbac-catalog.ts:162 la
// dichiara come chiave letterale), e aggiungercela farebbe di questo lavoro una
// modifica a rbac-catalog.ts, che vuole cancelli diversi da quelli di questo compito.
// Stessa forma usata da dashboard.service.ts, che scrive 'checklists' a mano.
const CHECKLISTS_MODULE_KEY = 'checklists';

type DashboardRouteDependencies = {
  ensureDashboardAccessFn: (
    request: Parameters<typeof ensureDashboardAccess>[0],
    permissionKey: DashboardPermissionKey,
  ) => ReturnType<typeof ensureDashboardAccess>;
  requireModuleEnabledFn: typeof requireModuleEnabled;
  requirePermissionFn: typeof requirePermission;
  dashboardServiceApi: typeof dashboardService;
};

const defaultDependencies: DashboardRouteDependencies = {
  ensureDashboardAccessFn: ensureDashboardAccess,
  requireModuleEnabledFn: requireModuleEnabled,
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
    requireModuleEnabledFn,
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

    // Questa rotta serve solo voci di Memo Operativi, raggruppate per persona del Team
    // (dashboard.repository.ts, getTeamWorkload): sono i dati di due moduli, e finora
    // ne chiedeva i permessi senza mai chiedere se i moduli fossero accesi. A modulo
    // spento la rotta deve smettere di rispondere, non solo sparire dalla Dashboard.
    // Stesso perimetro che CRMA-122 applica al riquadro "Team Workload" (Team acceso
    // + Memo Operativi accesi). Modulo prima del permesso, come in ensureDashboardAccess.
    await requireModuleEnabledFn(workspace.id, TEAM_MODULE_KEY);
    await requirePermissionFn(user.id, workspace.id, 'team.view');
    await requireModuleEnabledFn(workspace.id, CHECKLISTS_MODULE_KEY);
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
