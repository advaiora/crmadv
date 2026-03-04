import { z } from 'zod';
import { moduleRepository } from '../../repositories/module.repository.js';
import { rbacRepository } from '../../repositories/rbac.repository.js';
import { dashboardRepository, type DashboardUrgentRecord } from './dashboard.repository.js';
import {
  DASHBOARD_ROLE_TIER,
  hasAnyPermissionKey,
  hasPermissionKey,
  resolveRoleTierFromPermissions,
  resolveRoleTierFromRoleNames,
  type DashboardRoleTier,
} from './dashboard.policies.js';
import { computeAlerts } from './insights/alerts.js';
import { computeNextActions } from './insights/actions.js';
import { buildAiPromptSummary } from './insights/ai.js';
import { computeProductivityInsights, computeSecuritySummaryPlus } from './insights/metrics.js';

const urgentSeverityOrder: Record<'high' | 'medium' | 'low', number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const urgentTypePriority: Record<DashboardUrgentRecord['type'], number> = {
  blocked_project: 4,
  overdue_checklist: 3,
  unsent_quote: 2,
  stale_project: 1,
};

const sortUrgent = (items: DashboardUrgentRecord[]) =>
  [...items].sort((left, right) => {
    const severityGap = urgentSeverityOrder[right.severity] - urgentSeverityOrder[left.severity];
    if (severityGap !== 0) {
      return severityGap;
    }

    const typeGap = urgentTypePriority[right.type] - urgentTypePriority[left.type];
    if (typeGap !== 0) {
      return typeGap;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

const dashboardOverviewSchema = z.object({
  kpis: z.object({
    clientsActive: z.number().int().nonnegative(),
    projectsActive: z.number().int().nonnegative(),
    quotesSent30d: z.number().int().nonnegative(),
    checklistOpenItems: z.number().int().nonnegative(),
  }),
  urgent: z.array(z.object({
    type: z.enum(['blocked_project', 'stale_project', 'unsent_quote', 'overdue_checklist']),
    title: z.string(),
    description: z.string(),
    href: z.string(),
    severity: z.enum(['high', 'medium', 'low']),
    createdAt: z.string().datetime(),
  })),
  pipeline: z.array(z.object({
    stageId: z.string(),
    stageName: z.string(),
    count: z.number().int().nonnegative(),
  })),
  activity: z.array(z.object({
    id: z.string(),
    timestamp: z.string().datetime(),
    actorName: z.string().nullable(),
    action: z.string(),
    targetType: z.string().nullable(),
    targetId: z.string().nullable(),
    summary: z.string(),
  })),
});

const dashboardWidgetTypeSchema = z.enum([
  'kpis',
  'urgent',
  'pipeline',
  'pipeline_chart',
  'activity',
  'activity_histogram',
  'team_workload',
  'modules_status',
  'quotes_pipeline',
  'quotes_funnel',
  'clients_trend',
  'my_tasks',
  'my_projects',
  'security_summary',
  'smart_alerts',
  'next_actions',
  'productivity_insights',
  'security_summary_plus',
]);

const dashboardHomeSchema = z.object({
  role: z.enum([
    DASHBOARD_ROLE_TIER.superadmin,
    DASHBOARD_ROLE_TIER.admin,
    DASHBOARD_ROLE_TIER.manager,
    DASHBOARD_ROLE_TIER.operativo,
    DASHBOARD_ROLE_TIER.viewer,
  ]),
  widgets: z.array(z.object({
    id: z.string(),
    type: dashboardWidgetTypeSchema,
    title: z.string(),
    order: z.number().int().positive(),
    data: z.unknown(),
  })),
});

export type DashboardOverviewDto = z.infer<typeof dashboardOverviewSchema>;
export type DashboardHomeDto = z.infer<typeof dashboardHomeSchema>;

type DashboardWidgetType = z.infer<typeof dashboardWidgetTypeSchema>;

type DashboardServiceDependencies = {
  dashboardRepositoryApi: typeof dashboardRepository;
  rbacRepositoryApi: typeof rbacRepository;
  moduleRepositoryApi: typeof moduleRepository;
};

const defaultDependencies: DashboardServiceDependencies = {
  dashboardRepositoryApi: dashboardRepository,
  rbacRepositoryApi: rbacRepository,
  moduleRepositoryApi: moduleRepository,
};

type HomeContext = {
  workspaceId: string;
  userId: string;
  role: DashboardRoleTier;
  permissionKeys: string[];
  enabledModuleKeys: Set<string>;
};

const buildUrgentForContext = async (
  repository: typeof dashboardRepository,
  context: HomeContext,
) => {
  const urgentItems: DashboardUrgentRecord[] = [];
  const canViewProjects = hasPermissionKey(context.permissionKeys, 'projects.view');
  const canViewChecklists = hasPermissionKey(context.permissionKeys, 'checklists.view');
  const canViewQuotes = hasPermissionKey(context.permissionKeys, 'quotes.view');

  if (canViewProjects && canViewChecklists) {
    const [blocked, overdue] = await Promise.all([
      repository.getUrgentBlockedProjects(context.workspaceId),
      repository.getUrgentOverdueChecklistItems(context.workspaceId),
    ]);
    urgentItems.push(...blocked, ...overdue);
  }

  if (canViewProjects) {
    urgentItems.push(...(await repository.getUrgentStaleProjects(context.workspaceId)));
  }

  if (canViewQuotes) {
    urgentItems.push(...(await repository.getUrgentUnsentQuotes(context.workspaceId)));
  }

  if (urgentItems.length === 0) {
    return null;
  }

  return {
    items: sortUrgent(urgentItems).slice(0, 8),
  };
};

const resolveRoleTier = (
  roleNames: string[],
  permissionKeys: string[],
): DashboardRoleTier => {
  const roleFromPermissions = resolveRoleTierFromPermissions(permissionKeys);
  const roleFromNames = resolveRoleTierFromRoleNames(roleNames);

  if (!roleFromNames) {
    return roleFromPermissions;
  }

  const priorityByRole: Record<DashboardRoleTier, number> = {
    [DASHBOARD_ROLE_TIER.superadmin]: 5,
    [DASHBOARD_ROLE_TIER.admin]: 4,
    [DASHBOARD_ROLE_TIER.manager]: 3,
    [DASHBOARD_ROLE_TIER.operativo]: 2,
    [DASHBOARD_ROLE_TIER.viewer]: 1,
  };

  return priorityByRole[roleFromPermissions] > priorityByRole[roleFromNames]
    ? roleFromPermissions
    : roleFromNames;
};

const widget = (
  id: string,
  type: DashboardWidgetType,
  title: string,
  order: number,
  data: unknown,
) => ({
  id,
  type,
  title,
  order,
  data,
});

export const buildDashboardService = (
  dependencies: DashboardServiceDependencies = defaultDependencies,
) => {
  const {
    dashboardRepositoryApi,
    rbacRepositoryApi,
    moduleRepositoryApi,
  } = dependencies;

  return {
    async getOverview(workspaceId: string): Promise<DashboardOverviewDto> {
      const [kpis, pipeline, activity, blockedProjects, staleProjects, unsentQuotes, overdueChecklist] = await Promise.all([
        dashboardRepositoryApi.getKpis(workspaceId),
        dashboardRepositoryApi.getPipelineSnapshot(workspaceId),
        dashboardRepositoryApi.getRecentActivity(workspaceId),
        dashboardRepositoryApi.getUrgentBlockedProjects(workspaceId),
        dashboardRepositoryApi.getUrgentStaleProjects(workspaceId),
        dashboardRepositoryApi.getUrgentUnsentQuotes(workspaceId),
        dashboardRepositoryApi.getUrgentOverdueChecklistItems(workspaceId),
      ]);

      const urgent = sortUrgent([
        ...blockedProjects,
        ...staleProjects,
        ...unsentQuotes,
        ...overdueChecklist,
      ]).slice(0, 8);

      return dashboardOverviewSchema.parse({
        kpis,
        urgent,
        pipeline,
        activity,
      });
    },

    async getHome(input: {
      workspaceId: string;
      userId: string;
    }): Promise<DashboardHomeDto> {
      const [permissionKeys, roleNames, enabledModuleKeys] = await Promise.all([
        rbacRepositoryApi.listUserPermissions(input.userId, input.workspaceId),
        rbacRepositoryApi.listUserRoles(input.userId, input.workspaceId),
        moduleRepositoryApi.listEnabledModules(input.workspaceId),
      ]);

      const role = resolveRoleTier(roleNames, permissionKeys);
      const context: HomeContext = {
        workspaceId: input.workspaceId,
        userId: input.userId,
        role,
        permissionKeys,
        enabledModuleKeys: new Set(enabledModuleKeys),
      };

      const widgets: DashboardHomeDto['widgets'] = [];
      const canSeeKpis = true;
      const canSeeActivity = true;
      const canViewProjects = hasPermissionKey(permissionKeys, 'projects.view');
      const canViewQuotes = hasPermissionKey(permissionKeys, 'quotes.view');
      const canViewClients = hasPermissionKey(permissionKeys, 'clients.view');
      const canViewChecklists = hasPermissionKey(permissionKeys, 'checklists.view');
      const canViewTeam = hasPermissionKey(permissionKeys, 'team.view');
      const canViewModules = hasAnyPermissionKey(permissionKeys, ['modules.manage', 'modules.view']);
      const canViewAudit = hasPermissionKey(permissionKeys, 'audit.view');
      const canViewVaultSignals = hasAnyPermissionKey(permissionKeys, ['vault.view_list', 'vault.reveal']);
      const canViewSecuritySummary = (
        canViewAudit
        && canViewVaultSignals
        && context.enabledModuleKeys.has('vault')
      );
      const canViewSecuritySummaryPlus = (
        canViewAudit
        && hasAnyPermissionKey(permissionKeys, [
          'modules.manage',
          'branding.manage',
          'roles.manage',
          'roles.assign',
          'team.roles_assign',
        ])
      );
      const canCreateClients = hasPermissionKey(permissionKeys, 'clients.create');

      let kpisPromise: Promise<Awaited<ReturnType<typeof dashboardRepositoryApi.getKpis>>> | null = null;
      let urgentPromise: Promise<Awaited<ReturnType<typeof buildUrgentForContext>>> | null = null;
      let pipelineSnapshotPromise:
        Promise<Awaited<ReturnType<typeof dashboardRepositoryApi.getPipelineSnapshot>>> | null = null;
      let quotesPipelinePromise:
        Promise<Awaited<ReturnType<typeof dashboardRepositoryApi.getQuotesPipeline>>> | null = null;
      let recentActivityPromise:
        Promise<Awaited<ReturnType<typeof dashboardRepositoryApi.getRecentActivity>>> | null = null;
      let myTasksPromise:
        Promise<Awaited<ReturnType<typeof dashboardRepositoryApi.getMyTasks>>> | null = null;
      let teamWorkloadPromise:
        Promise<Awaited<ReturnType<typeof dashboardRepositoryApi.getTeamWorkload>>> | null = null;
      let projectFreshnessPromise:
        Promise<Awaited<ReturnType<typeof dashboardRepositoryApi.getProjectFreshness>>> | null = null;
      let checklistCompletionStatsPromise:
        Promise<Awaited<ReturnType<typeof dashboardRepositoryApi.getChecklistCompletionStats>>> | null = null;
      let securitySignalsPromise:
        Promise<Awaited<ReturnType<typeof dashboardRepositoryApi.getSecuritySignals>>> | null = null;
      let clientsCreated14dPromise: Promise<number> | null = null;

      const loadKpis = () => {
        if (!kpisPromise) {
          kpisPromise = dashboardRepositoryApi.getKpis(context.workspaceId);
        }

        return kpisPromise;
      };

      const loadUrgent = () => {
        if (!urgentPromise) {
          urgentPromise = buildUrgentForContext(dashboardRepositoryApi, context);
        }

        return urgentPromise;
      };

      const loadPipelineSnapshot = () => {
        if (!pipelineSnapshotPromise) {
          pipelineSnapshotPromise = dashboardRepositoryApi.getPipelineSnapshot(context.workspaceId);
        }

        return pipelineSnapshotPromise;
      };

      const loadQuotesPipeline = () => {
        if (!quotesPipelinePromise) {
          quotesPipelinePromise = dashboardRepositoryApi.getQuotesPipeline(context.workspaceId);
        }

        return quotesPipelinePromise;
      };

      const loadRecentActivity = () => {
        if (!recentActivityPromise) {
          recentActivityPromise = dashboardRepositoryApi.getRecentActivity(context.workspaceId);
        }

        return recentActivityPromise;
      };

      const loadMyTasks = () => {
        if (!myTasksPromise) {
          myTasksPromise = dashboardRepositoryApi.getMyTasks(context.workspaceId, context.userId);
        }

        return myTasksPromise;
      };

      const loadTeamWorkload = () => {
        if (!teamWorkloadPromise) {
          teamWorkloadPromise = dashboardRepositoryApi.getTeamWorkload(context.workspaceId);
        }

        return teamWorkloadPromise;
      };

      const loadProjectFreshness = () => {
        if (!projectFreshnessPromise) {
          projectFreshnessPromise = dashboardRepositoryApi.getProjectFreshness(context.workspaceId);
        }

        return projectFreshnessPromise;
      };

      const loadChecklistCompletionStats = () => {
        if (!checklistCompletionStatsPromise) {
          checklistCompletionStatsPromise = dashboardRepositoryApi.getChecklistCompletionStats(context.workspaceId);
        }

        return checklistCompletionStatsPromise;
      };

      const loadSecuritySignals = () => {
        if (!securitySignalsPromise) {
          securitySignalsPromise = dashboardRepositoryApi.getSecuritySignals(context.workspaceId);
        }

        return securitySignalsPromise;
      };

      const loadClientsCreated14d = () => {
        if (!clientsCreated14dPromise) {
          const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          clientsCreated14dPromise = dashboardRepositoryApi.getClientsCreatedSince(
            context.workspaceId,
            since,
          );
        }

        return clientsCreated14dPromise;
      };

      const loadPipelineChart = async () => {
        const snapshot = await loadPipelineSnapshot();
        return {
          labels: snapshot.map((entry) => entry.stageName),
          values: snapshot.map((entry) => entry.count),
        };
      };

      const loadQuotesFunnel = async () => {
        const pipeline = await loadQuotesPipeline();
        const countByStatus = new Map(
          pipeline.byStatus.map((entry) => [entry.status, entry.count]),
        );

        return {
          steps: [
            { label: 'Draft', count: countByStatus.get('DRAFT') ?? 0 },
            { label: 'Sent', count: countByStatus.get('SENT') ?? 0 },
            { label: 'Accepted', count: countByStatus.get('ACCEPTED') ?? 0 },
            {
              label: 'Rejected/Expired',
              count: (countByStatus.get('REJECTED') ?? 0) + (countByStatus.get('EXPIRED') ?? 0),
            },
          ],
        };
      };

      if (role === DASHBOARD_ROLE_TIER.superadmin) {
        let order = 1;

        if (canSeeKpis) {
          widgets.push(widget('kpis', 'kpis', 'KPI Operativi', order, await loadKpis()));
          order += 1;
        }

        const urgentData = await loadUrgent();
        if (urgentData) {
          widgets.push(widget('urgent', 'urgent', 'Urgent / Needs Attention', order, urgentData));
          order += 1;
        }

        if (canViewProjects) {
          widgets.push(widget(
            'pipeline',
            'pipeline',
            'Pipeline Snapshot',
            order,
            { items: await loadPipelineSnapshot() },
          ));
          order += 1;

          widgets.push(widget(
            'pipeline_chart',
            'pipeline_chart',
            'Pipeline Overview',
            order,
            await loadPipelineChart(),
          ));
          order += 1;
        }

        if (canViewQuotes) {
          widgets.push(widget(
            'quotes_pipeline',
            'quotes_pipeline',
            'Quotes Pipeline',
            order,
            await loadQuotesPipeline(),
          ));
          order += 1;

          widgets.push(widget(
            'quotes_funnel',
            'quotes_funnel',
            'Revenue Funnel',
            order,
            await loadQuotesFunnel(),
          ));
          order += 1;
        }

        if (canViewClients) {
          widgets.push(widget(
            'clients_trend',
            'clients_trend',
            'Clients Trend (8 settimane)',
            order,
            await dashboardRepositoryApi.getClientsTrend(context.workspaceId),
          ));
          order += 1;
        }

        if (canViewTeam) {
          widgets.push(widget(
            'team_workload',
            'team_workload',
            'Team Workload',
            order,
            await loadTeamWorkload(),
          ));
          order += 1;
        }

        if (canViewModules) {
          widgets.push(widget(
            'modules_status',
            'modules_status',
            'Modules Status',
            order,
            await dashboardRepositoryApi.getModulesStatus(context.workspaceId),
          ));
          order += 1;
        }

        if (canSeeActivity) {
          widgets.push(widget(
            'activity',
            'activity',
            'Recent Activity',
            order,
            { items: await loadRecentActivity() },
          ));
          order += 1;
        }

        if (canViewAudit) {
          widgets.push(widget(
            'activity_histogram',
            'activity_histogram',
            'Activity (14 giorni)',
            order,
            await dashboardRepositoryApi.getActivityHistogram(context.workspaceId),
          ));
          order += 1;
        }

        if (canViewSecuritySummary) {
          widgets.push(widget(
            'security_summary',
            'security_summary',
            'Security Summary',
            order,
            await dashboardRepositoryApi.getSecuritySummary(context.workspaceId),
          ));
        }
      } else if (role === DASHBOARD_ROLE_TIER.admin || role === DASHBOARD_ROLE_TIER.manager) {
        let order = 1;

        if (canSeeKpis) {
          widgets.push(widget('kpis', 'kpis', 'Operational Overview', order, await loadKpis()));
          order += 1;
        }

        const urgentData = await loadUrgent();
        if (urgentData) {
          widgets.push(widget('urgent', 'urgent', 'Blocked / Needs Attention', order, urgentData));
          order += 1;
        }

        if (canViewProjects) {
          widgets.push(widget(
            'pipeline_chart',
            'pipeline_chart',
            'Pipeline Chart',
            order,
            await loadPipelineChart(),
          ));
          order += 1;
        }

        if (canViewQuotes) {
          widgets.push(widget(
            'quotes_pipeline',
            'quotes_pipeline',
            'Quotes Pipeline',
            order,
            await loadQuotesPipeline(),
          ));
          order += 1;

          widgets.push(widget(
            'quotes_funnel',
            'quotes_funnel',
            'Quotes Funnel',
            order,
            await loadQuotesFunnel(),
          ));
          order += 1;
        }

        if (canViewTeam) {
          widgets.push(widget(
            'team_workload',
            'team_workload',
            'Team Workload',
            order,
            await loadTeamWorkload(),
          ));
          order += 1;
        }

        if (canViewClients) {
          widgets.push(widget(
            'clients_trend',
            'clients_trend',
            'Clients Trend (8 settimane)',
            order,
            await dashboardRepositoryApi.getClientsTrend(context.workspaceId),
          ));
          order += 1;
        }

        if (canSeeActivity) {
          widgets.push(widget(
            'activity',
            'activity',
            'Recent Activity',
            order,
            { items: await loadRecentActivity() },
          ));
        }
      } else if (role === DASHBOARD_ROLE_TIER.operativo) {
        let order = 1;

        if (canViewChecklists) {
          widgets.push(widget(
            'my_tasks',
            'my_tasks',
            'My Tasks',
            order,
            await loadMyTasks(),
          ));
          order += 1;
        }

        if (canViewProjects) {
          widgets.push(widget(
            'my_projects',
            'my_projects',
            'My Projects',
            order,
            await dashboardRepositoryApi.getMyProjects(context.workspaceId, context.userId),
          ));
          order += 1;
        }

        const urgentData = await loadUrgent();
        if (urgentData) {
          widgets.push(widget('urgent', 'urgent', 'What is urgent for me', order, urgentData));
          order += 1;
        }

        if (canSeeActivity) {
          widgets.push(widget(
            'activity',
            'activity',
            'Recent Activity',
            order,
            { items: await loadRecentActivity() },
          ));
          order += 1;
        }

        if (canViewProjects) {
          widgets.push(widget(
            'pipeline_chart',
            'pipeline_chart',
            'Pipeline Snapshot',
            order,
            await loadPipelineChart(),
          ));
          order += 1;
        }

        if (canSeeKpis) {
          widgets.push(widget('kpis', 'kpis', 'KPI Operativi', order, await loadKpis()));
        }
      } else {
        let order = 1;

        if (canSeeKpis) {
          widgets.push(widget('kpis', 'kpis', 'Read-only Overview', order, await loadKpis()));
          order += 1;
        }

        if (canViewProjects) {
          widgets.push(widget(
            'pipeline_chart',
            'pipeline_chart',
            'Pipeline Snapshot',
            order,
            await loadPipelineChart(),
          ));
          order += 1;
        }

        if (canViewClients) {
          widgets.push(widget(
            'clients_trend',
            'clients_trend',
            'Clients Trend (8 settimane)',
            order,
            await dashboardRepositoryApi.getClientsTrend(context.workspaceId),
          ));
          order += 1;
        }

        if (canSeeActivity) {
          widgets.push(widget(
            'activity',
            'activity',
            'Recent Activity',
            order,
            { items: await loadRecentActivity() },
          ));
          order += 1;
        }

        if (canViewAudit) {
          widgets.push(widget(
            'activity_histogram',
            'activity_histogram',
            'Activity (14 giorni)',
            order,
            await dashboardRepositoryApi.getActivityHistogram(context.workspaceId),
          ));
        }
      }

      const shouldIncludeSmartAlerts = (
        (canViewProjects && canViewChecklists)
        || canViewQuotes
        || canViewAudit
      );
      const shouldIncludeNextActions = (
        canViewChecklists
        || canViewProjects
        || canViewQuotes
        || canCreateClients
      );
      const shouldIncludeProductivityInsights = true;

      if (shouldIncludeSmartAlerts || shouldIncludeNextActions || shouldIncludeProductivityInsights || canViewSecuritySummaryPlus) {
        const [urgentData, kpisData, stageCounts, teamWorkload, myTasks, projectFreshness, checklistCompletionStats, rawSecuritySignals, clientsCreated14d, quotesPipeline] = await Promise.all([
          loadUrgent(),
          loadKpis(),
          canViewProjects ? loadPipelineSnapshot() : Promise.resolve([]),
          canViewTeam ? loadTeamWorkload() : Promise.resolve({ openChecklistByUser: [] }),
          canViewChecklists ? loadMyTasks() : Promise.resolve({ items: [] }),
          canViewProjects ? loadProjectFreshness() : Promise.resolve(null),
          canViewChecklists ? loadChecklistCompletionStats() : Promise.resolve(null),
          canViewAudit ? loadSecuritySignals() : Promise.resolve(null),
          canCreateClients ? loadClientsCreated14d() : Promise.resolve(0),
          canViewQuotes ? loadQuotesPipeline() : Promise.resolve({ byStatus: [] }),
        ]);

        const quotesDraftCount = quotesPipeline.byStatus.find((entry) => entry.status === 'DRAFT')?.count ?? 0;
        const securitySignals = rawSecuritySignals
          ? {
              ...rawSecuritySignals,
              vaultReveals7d: canViewVaultSignals ? rawSecuritySignals.vaultReveals7d : 0,
              vaultReveals30d: canViewVaultSignals ? rawSecuritySignals.vaultReveals30d : 0,
            }
          : null;

        const insightsContext = {
          workspaceId: context.workspaceId,
          userId: context.userId,
          nowIso: new Date().toISOString(),
          canCreateClients,
          kpis: kpisData,
          urgentItems: urgentData?.items ?? [],
          stageCounts,
          teamWorkload,
          myTasks,
          clientsCreated14d,
          projectFreshness,
          checklistCompletionStats,
          securitySignals,
          quotesDraftCount,
        };

        if (shouldIncludeSmartAlerts) {
          const smartAlerts = computeAlerts(insightsContext);
          if (smartAlerts.length > 0) {
            widgets.push(widget(
              'smart_alerts',
              'smart_alerts',
              'Smart Alerts',
              widgets.length + 1,
              {
                alerts: smartAlerts,
              },
            ));
          }
        }

        if (shouldIncludeNextActions) {
          const nextActions = computeNextActions(insightsContext);
          if (nextActions.length > 0) {
            widgets.push(widget(
              'next_actions',
              'next_actions',
              'Next Best Actions',
              widgets.length + 1,
              {
                actions: nextActions,
              },
            ));
          }
        }

        if (shouldIncludeProductivityInsights) {
          const productivityInsights = computeProductivityInsights(insightsContext);
          if (productivityInsights.length > 0) {
            const data = {
              insights: productivityInsights,
              ...(role === DASHBOARD_ROLE_TIER.superadmin && process.env.NODE_ENV !== 'production'
                ? { aiSummary: buildAiPromptSummary(insightsContext) }
                : {}),
            };

            widgets.push(widget(
              'productivity_insights',
              'productivity_insights',
              'Productivity Insights',
              widgets.length + 1,
              data,
            ));
          }
        }

        if (canViewSecuritySummaryPlus) {
          const securitySummaryPlus = computeSecuritySummaryPlus(insightsContext);
          if (securitySummaryPlus) {
            widgets.push(widget(
              'security_summary_plus',
              'security_summary_plus',
              'Security & Compliance',
              widgets.length + 1,
              securitySummaryPlus,
            ));
          }
        }
      }

      const sortedWidgets = [...widgets].sort((left, right) => left.order - right.order);

      return dashboardHomeSchema.parse({
        role,
        widgets: sortedWidgets,
      });
    },
  };
};

export const dashboardService = buildDashboardService();
