import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardService } from './dashboard.service.js';

const buildMockDashboardRepository = () => ({
  getKpis: async () => ({
    clientsActive: 5,
    projectsActive: 7,
    quotesSent30d: 3,
    checklistOpenItems: 9,
  }),
  getPipelineSnapshot: async () => ([
    { stageId: 'stage-1', stageName: 'Todo', count: 4 },
  ]),
  getRecentActivity: async () => ([
    {
      id: 'act-1',
      timestamp: new Date().toISOString(),
      actorName: 'User',
      action: 'projects.update',
      targetType: 'Project',
      targetId: 'project-1',
      summary: 'projects update',
    },
  ]),
  getUrgentBlockedProjects: async () => ([
    {
      type: 'blocked_project',
      title: 'blocked',
      description: 'blocked',
      href: '/projects/project-1',
      severity: 'high',
      createdAt: new Date().toISOString(),
    },
  ]),
  getUrgentStaleProjects: async () => ([]),
  getUrgentUnsentQuotes: async () => ([]),
  getUrgentOverdueChecklistItems: async () => ([]),
  getTeamWorkload: async () => ({
    openChecklistByUser: [{ userId: 'unassigned', name: 'Non assegnato', count: 2 }],
  }),
  getModulesStatus: async () => ({
    enabled: [{ key: 'dashboard', name: 'Dashboard' }],
    disabled: [],
  }),
  getQuotesPipeline: async () => ({
    byStatus: [{ status: 'DRAFT', count: 2 }],
  }),
  getClientsTrend: async () => ({
    points: [{ label: '01 gen', count: 1 }],
  }),
  getActivityHistogram: async () => ({
    points: [{ label: '01/01', count: 2 }],
  }),
  getMyTasks: async () => ({
    items: [{ id: 'task-1', title: 'Task', projectId: 'project-1', href: '/projects/project-1', due: null }],
  }),
  getMyProjects: async () => ({
    items: [{ id: 'project-1', name: 'Project', stage: 'Todo', updatedAt: new Date().toISOString(), href: '/projects/project-1' }],
  }),
  getProjectFreshness: async () => ({
    activeProjects: 7,
    updatedProjects7d: 4,
  }),
  getChecklistCompletionStats: async () => ({
    sampleSize: 12,
    avgCompletionHours: 6.5,
  }),
  getSecuritySignals: async () => ({
    auditEvents7d: 4,
    auditEvents30d: 16,
    roleChanges30d: 2,
    moduleToggles30d: 1,
    vaultReveals7d: 1,
    vaultReveals30d: 2,
  }),
  getClientsCreatedSince: async () => 0,
  getSecuritySummary: async () => ({
    auditEvents7d: 4,
    vaultReveals7d: 1,
    vaultReveals30d: 2,
  }),
});

test('dashboard home for superadmin includes management and security widgets', async () => {
  const service = buildDashboardService({
    dashboardRepositoryApi: buildMockDashboardRepository() as never,
    rbacRepositoryApi: {
      listUserPermissions: async () => ([
        'dashboard.view',
        'modules.manage',
        'team.view',
        'quotes.view',
        'audit.view',
        'vault.reveal',
        'projects.view',
        'checklists.view',
      ]),
      listUserRoles: async () => (['Superadmin']),
    } as never,
    moduleRepositoryApi: {
      listEnabledModules: async () => (['dashboard', 'vault']),
    } as never,
  });

  const result = await service.getHome({
    workspaceId: 'workspace-1',
    userId: 'user-1',
  });

  assert.equal(result.role, 'superadmin');
  const widgetTypes = new Set(result.widgets.map((widget) => widget.type));
  assert.equal(widgetTypes.has('modules_status'), true);
  assert.equal(widgetTypes.has('team_workload'), true);
  assert.equal(widgetTypes.has('quotes_pipeline'), true);
  assert.equal(widgetTypes.has('pipeline_chart'), true);
  assert.equal(widgetTypes.has('quotes_funnel'), true);
  assert.equal(widgetTypes.has('activity_histogram'), true);
  assert.equal(widgetTypes.has('security_summary'), true);
  assert.equal(widgetTypes.has('smart_alerts'), true);
  assert.equal(widgetTypes.has('next_actions'), true);
  assert.equal(widgetTypes.has('productivity_insights'), true);
  assert.equal(widgetTypes.has('security_summary_plus'), true);
});

test('dashboard home for operativo includes personal widgets', async () => {
  const service = buildDashboardService({
    dashboardRepositoryApi: buildMockDashboardRepository() as never,
    rbacRepositoryApi: {
      listUserPermissions: async () => ([
        'dashboard.view',
        'projects.view',
        'checklists.view',
      ]),
      listUserRoles: async () => ([]),
    } as never,
    moduleRepositoryApi: {
      listEnabledModules: async () => (['dashboard']),
    } as never,
  });

  const result = await service.getHome({
    workspaceId: 'workspace-1',
    userId: 'user-2',
  });

  assert.equal(result.role, 'operativo');
  const widgetTypes = new Set(result.widgets.map((widget) => widget.type));
  assert.equal(widgetTypes.has('my_tasks'), true);
  assert.equal(widgetTypes.has('my_projects'), true);
  assert.equal(widgetTypes.has('activity'), true);
  assert.equal(widgetTypes.has('smart_alerts'), true);
  assert.equal(widgetTypes.has('next_actions'), true);
  assert.equal(widgetTypes.has('productivity_insights'), true);
});

test('dashboard home resolves tier from permissions when role name is lower', async () => {
  const service = buildDashboardService({
    dashboardRepositoryApi: buildMockDashboardRepository() as never,
    rbacRepositoryApi: {
      listUserPermissions: async () => ([
        'dashboard.view',
        'modules.manage',
      ]),
      listUserRoles: async () => (['Viewer']),
    } as never,
    moduleRepositoryApi: {
      listEnabledModules: async () => (['dashboard']),
    } as never,
  });

  const result = await service.getHome({
    workspaceId: 'workspace-1',
    userId: 'user-3',
  });

  assert.equal(result.role, 'superadmin');
  const widgetTypes = new Set(result.widgets.map((widget) => widget.type));
  assert.equal(widgetTypes.has('modules_status'), true);
});
