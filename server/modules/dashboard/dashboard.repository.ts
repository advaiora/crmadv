import { prisma } from '../../prisma.js';

const CHECKLIST_INCOMPLETE_STATES = ['pending', 'not_started', 'in_progress'] as const;

const now = () => new Date();

const toIso = (value: Date) => value.toISOString();

type UrgentItemType =
  | 'blocked_project'
  | 'stale_project'
  | 'unsent_quote'
  | 'overdue_checklist';

type UrgentSeverity = 'high' | 'medium' | 'low';

export type DashboardUrgentRecord = {
  type: UrgentItemType;
  title: string;
  description: string;
  href: string;
  severity: UrgentSeverity;
  createdAt: string;
};

type ActivityRecord = {
  id: string;
  timestamp: string;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string;
};

type TeamWorkloadRecord = {
  range: {
    from: string;
    to: string;
  };
  byUser: Array<{
    userId: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    membershipStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'UNKNOWN';
    assignedOpen: number;
    completedInRange: number;
    overdue: number;
  }>;
  openChecklistByUser: Array<{
    userId: string;
    name: string;
    count: number;
  }>;
  assignableUsers: Array<{
    userId: string;
    name: string;
    email: string;
  }>;
  unassignedItems: Array<{
    itemId: string;
    instanceId: string;
    title: string;
    projectId: string | null;
    projectName: string | null;
    pipelineStageId: string | null;
    updatedAt: string;
  }>;
};

type ModulesStatusRecord = {
  enabled: Array<{ key: string; name: string }>;
  disabled: Array<{ key: string; name: string }>;
};

type QuotesPipelineRecord = {
  byStatus: Array<{ status: string; count: number }>;
};

type MyTaskRecord = {
  items: Array<{
    id: string;
    title: string;
    projectId: string | null;
    href: string;
    due: string | null;
  }>;
};

type MyProjectRecord = {
  items: Array<{
    id: string;
    name: string;
    stage: string;
    updatedAt: string;
    href: string;
  }>;
};

type SecuritySummaryRecord = {
  auditEvents7d: number;
  vaultReveals7d: number;
  vaultReveals30d: number;
};

type PipelineChartRecord = {
  labels: string[];
  values: number[];
};

type QuotesFunnelRecord = {
  steps: Array<{
    label: string;
    count: number;
  }>;
};

type TrendPoint = {
  label: string;
  count: number;
};

type ClientsTrendRecord = {
  points: TrendPoint[];
};

type ActivityHistogramRecord = {
  points: TrendPoint[];
};

type ProjectFreshnessRecord = {
  activeProjects: number;
  updatedProjects7d: number;
};

type ChecklistCompletionStatsRecord = {
  sampleSize: number;
  avgCompletionHours: number | null;
};

type SecuritySignalsRecord = {
  auditEvents7d: number;
  auditEvents30d: number;
  roleChanges30d: number;
  moduleToggles30d: number;
  vaultReveals7d: number;
  vaultReveals30d: number;
};

const safeStringFromMetadata = (metadata: unknown, key: string): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const buildActivitySummary = (input: {
  action: string;
  targetType: string | null;
  metadata: unknown;
}): string => {
  const actionLabel = input.action.replaceAll('.', ' ');
  const isVaultAction = input.action.startsWith('vault.');
  const metadataStatus = safeStringFromMetadata(input.metadata, 'status');
  const metadataName = isVaultAction
    ? null
    : safeStringFromMetadata(input.metadata, 'name')
      ?? safeStringFromMetadata(input.metadata, 'title');

  const parts = [actionLabel];
  if (input.targetType) {
    parts.push(input.targetType);
  }
  if (metadataName) {
    parts.push(metadataName);
  } else if (metadataStatus) {
    parts.push(metadataStatus);
  }

  return parts.join(' - ');
};

const listIncompleteRequiredChecklistItemsWhere = (workspaceId: string) => ({
  workspaceId,
  isRequiredSnapshot: true,
  state: {
    in: CHECKLIST_INCOMPLETE_STATES,
  },
});

const getRecentProjectIdsForUser = async (workspaceId: string, userId: string) => {
  const audits = await prisma.auditLog.findMany({
    where: {
      workspaceId,
      actorUserId: userId,
      OR: [
        { entityType: 'Project' },
        { entityType: 'ChecklistInstanceItem' },
        { entityType: 'ChecklistInstance' },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 80,
    select: {
      entityType: true,
      entityId: true,
      metadata: true,
    },
  });

  const projectIds = new Set<string>();

  for (const auditEntry of audits) {
    if (auditEntry.entityType === 'Project' && typeof auditEntry.entityId === 'string') {
      projectIds.add(auditEntry.entityId);
      continue;
    }

    const metadataProjectId = safeStringFromMetadata(auditEntry.metadata, 'projectId');
    if (metadataProjectId) {
      projectIds.add(metadataProjectId);
    }
  }

  return [...projectIds];
};

const toStartOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const buildRollingWeeklyBuckets = (weeks: number) => {
  const todayStart = toStartOfDay(now());
  const endExclusive = new Date(todayStart);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const buckets: Array<{ label: string; start: Date; end: Date }> = [];

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const start = new Date(endExclusive);
    start.setDate(start.getDate() - (offset + 1) * 7);

    const end = new Date(endExclusive);
    end.setDate(end.getDate() - offset * 7);
    const labelDate = new Date(end.getTime() - 1);

    buckets.push({
      label: new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: 'short',
      }).format(labelDate),
      start,
      end,
    });
  }

  return buckets;
};

const buildDailyBuckets = (days: number) => {
  const todayStart = toStartOfDay(now());
  const buckets: Array<{ label: string; start: Date; end: Date }> = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - offset);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    buckets.push({
      label: new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: '2-digit',
      }).format(start),
      start,
      end,
    });
  }

  return buckets;
};

export const dashboardRepository = {
  async getKpis(workspaceId: string) {
    const thirtyDaysAgo = new Date(now().getTime() - 30 * 24 * 60 * 60 * 1000);

    const [clientsActive, projectsActive, quotesSent30d, checklistOpenItems] = await Promise.all([
      prisma.client.count({
        where: {
          workspaceId,
        },
      }),
      prisma.project.count({
        where: {
          workspaceId,
          OR: [
            { pipelineStageId: null },
            {
              pipelineStage: {
                isClosed: false,
              },
            },
          ],
        },
      }),
      prisma.quote.count({
        where: {
          workspaceId,
          status: 'SENT',
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      prisma.checklistInstanceItem.count({
        where: listIncompleteRequiredChecklistItemsWhere(workspaceId),
      }),
    ]);

    return {
      clientsActive,
      projectsActive,
      quotesSent30d,
      checklistOpenItems,
    };
  },

  async getPipelineSnapshot(workspaceId: string) {
    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        OR: [
          { pipelineStageId: null },
          {
            pipelineStage: {
              isClosed: false,
            },
          },
        ],
      },
      select: {
        pipelineStageId: true,
        pipelineStage: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const grouped = new Map<string, { stageId: string; stageName: string; count: number }>();
    for (const project of projects) {
      const stageId = project.pipelineStageId ?? 'unassigned';
      const stageName = project.pipelineStage?.name ?? 'Senza stage';
      const current = grouped.get(stageId);

      if (!current) {
        grouped.set(stageId, {
          stageId,
          stageName,
          count: 1,
        });
        continue;
      }

      current.count += 1;
    }

    return [...grouped.values()].sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }

      return left.stageName.localeCompare(right.stageName, 'it');
    });
  },

  async getPipelineChart(workspaceId: string): Promise<PipelineChartRecord> {
    const snapshot = await this.getPipelineSnapshot(workspaceId);

    return {
      labels: snapshot.map((entry) => entry.stageName),
      values: snapshot.map((entry) => entry.count),
    };
  },

  async getRecentActivity(workspaceId: string): Promise<ActivityRecord[]> {
    const entries = await prisma.auditLog.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 15,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        actorUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return entries.map((entry) => ({
      id: entry.id,
      timestamp: toIso(entry.createdAt),
      actorName: entry.actorUser?.name ?? entry.actorUser?.email ?? null,
      action: entry.action,
      targetType: entry.entityType,
      targetId: entry.entityId,
      summary: buildActivitySummary({
        action: entry.action,
        targetType: entry.entityType,
        metadata: entry.metadata,
      }),
    }));
  },

  async getUrgentBlockedProjects(workspaceId: string): Promise<DashboardUrgentRecord[]> {
    const gatedStages = await prisma.pipelineStage.findMany({
      where: {
        workspaceId,
        isGated: true,
      },
      select: {
        id: true,
      },
    });

    if (gatedStages.length === 0) {
      return [];
    }

    const gatedStageIds = gatedStages.map((stage) => stage.id);

    const instances = await prisma.checklistInstance.findMany({
      where: {
        workspaceId,
        pipelineStageId: {
          in: gatedStageIds,
        },
        items: {
          some: {
            isRequiredSnapshot: true,
            state: {
              in: CHECKLIST_INCOMPLETE_STATES,
            },
          },
        },
      },
      select: {
        projectId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (instances.length === 0) {
      return [];
    }

    const projectIds = [...new Set(instances.map((entry) => entry.projectId))];
    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        id: {
          in: projectIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });
    const projectById = new Map(projects.map((project) => [project.id, project]));

    const deduped = new Set<string>();
    const urgent: DashboardUrgentRecord[] = [];
    for (const instance of instances) {
      if (deduped.has(instance.projectId)) {
        continue;
      }
      deduped.add(instance.projectId);

      const project = projectById.get(instance.projectId);
      if (!project) {
        continue;
      }

      urgent.push({
        type: 'blocked_project',
        title: `Progetto bloccato: ${project.name}`,
        description: 'Checklist obbligatoria incompleta in uno stage gated.',
        href: `/projects/${project.id}`,
        severity: 'high',
        createdAt: toIso(instance.createdAt),
      });
    }

    return urgent;
  },

  async getUrgentStaleProjects(workspaceId: string): Promise<DashboardUrgentRecord[]> {
    const sevenDaysAgo = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        updatedAt: {
          lt: sevenDaysAgo,
        },
        OR: [
          { pipelineStageId: null },
          {
            pipelineStage: {
              isClosed: false,
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'asc',
      },
      take: 12,
    });

    return projects.map((project) => ({
      type: 'stale_project',
      title: `Progetto fermo: ${project.name}`,
      description: 'Nessun aggiornamento negli ultimi 7 giorni.',
      href: `/projects/${project.id}`,
      severity: 'medium',
      createdAt: toIso(project.updatedAt),
    }));
  },

  async getUrgentUnsentQuotes(workspaceId: string): Promise<DashboardUrgentRecord[]> {
    const threeDaysAgo = new Date(now().getTime() - 3 * 24 * 60 * 60 * 1000);
    const quotes = await prisma.quote.findMany({
      where: {
        workspaceId,
        status: 'DRAFT',
        createdAt: {
          lt: threeDaysAgo,
        },
      },
      select: {
        id: true,
        createdAt: true,
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 12,
    });

    return quotes.map((quote) => ({
      type: 'unsent_quote',
      title: `Preventivo bozza ${quote.client?.name ? `(${quote.client.name})` : ''}`.trim(),
      description: 'Preventivo in bozza da piu di 3 giorni.',
      href: `/apps/quotes/${quote.id}`,
      severity: 'medium',
      createdAt: toIso(quote.createdAt),
    }));
  },

  async getUrgentOverdueChecklistItems(workspaceId: string): Promise<DashboardUrgentRecord[]> {
    const sevenDaysAgo = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
    const items = await prisma.checklistInstanceItem.findMany({
      where: {
        workspaceId,
        isRequiredSnapshot: true,
        createdAt: {
          lt: sevenDaysAgo,
        },
        state: {
          in: CHECKLIST_INCOMPLETE_STATES,
        },
      },
      select: {
        id: true,
        titleSnapshot: true,
        createdAt: true,
        instance: {
          select: {
            projectId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 12,
    });

    return items.map((item) => ({
      type: 'overdue_checklist',
      title: `Checklist in ritardo: ${item.titleSnapshot}`,
      description: 'Elemento obbligatorio incompleto da oltre 7 giorni.',
      href: `/projects/${item.instance.projectId}`,
      severity: 'high',
      createdAt: toIso(item.createdAt),
    }));
  },

  async getTeamWorkload(
    workspaceId: string,
    options?: {
      includeAssignmentData?: boolean;
      includeAllUsers?: boolean;
      from?: Date;
      to?: Date;
      overdueSlaDays?: number;
    },
  ): Promise<TeamWorkloadRecord> {
    const includeAssignmentData = Boolean(options?.includeAssignmentData);
    const includeAllUsers = options?.includeAllUsers ?? true;
    const to = options?.to ?? now();
    const from = options?.from ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const overdueSlaDays = options?.overdueSlaDays ?? 7;
    const overdueThreshold = new Date(now().getTime() - overdueSlaDays * 24 * 60 * 60 * 1000);

    const [
      openByAssignee,
      completedByAssignee,
      overdueByAssignee,
      unassignedOpenCount,
      activeMembers,
    ] = await Promise.all([
      prisma.checklistInstanceItem.groupBy({
        by: ['assignedToUserId'],
        where: {
          ...listIncompleteRequiredChecklistItemsWhere(workspaceId),
          assignedToUserId: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.checklistInstanceItem.groupBy({
        by: ['assignedToUserId'],
        where: {
          workspaceId,
          assignedToUserId: {
            not: null,
          },
          state: 'completed',
          completedAt: {
            gte: from,
            lt: to,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.checklistInstanceItem.groupBy({
        by: ['assignedToUserId'],
        where: {
          workspaceId,
          assignedToUserId: {
            not: null,
          },
          isRequiredSnapshot: true,
          createdAt: {
            lt: overdueThreshold,
          },
          state: {
            in: CHECKLIST_INCOMPLETE_STATES,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.checklistInstanceItem.count({
        where: {
          ...listIncompleteRequiredChecklistItemsWhere(workspaceId),
          assignedToUserId: null,
        },
      }),
      (includeAllUsers || includeAssignmentData)
        ? prisma.membership.findMany({
            where: {
              workspaceId,
              status: 'ACTIVE',
            },
            select: {
              userId: true,
              status: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: [
              {
                createdAt: 'asc',
              },
              {
                id: 'asc',
              },
            ],
          })
        : Promise.resolve([]),
    ]);

    const trackedUserIds = new Set<string>();
    for (const group of openByAssignee) {
      if (group.assignedToUserId) {
        trackedUserIds.add(group.assignedToUserId);
      }
    }
    for (const group of completedByAssignee) {
      if (group.assignedToUserId) {
        trackedUserIds.add(group.assignedToUserId);
      }
    }
    for (const group of overdueByAssignee) {
      if (group.assignedToUserId) {
        trackedUserIds.add(group.assignedToUserId);
      }
    }
    if (includeAllUsers) {
      for (const member of activeMembers) {
        trackedUserIds.add(member.userId);
      }
    }

    const trackedUserIdList = Array.from(trackedUserIds);
    const memberships = trackedUserIdList.length > 0
      ? await prisma.membership.findMany({
          where: {
            workspaceId,
            userId: {
              in: trackedUserIdList,
            },
          },
          select: {
            userId: true,
            status: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        })
      : [];
    const membershipByUserId = new Map(
      memberships.map((entry) => [entry.userId, entry]),
    );
    const activeMemberByUserId = new Map(
      activeMembers.map((entry) => [entry.userId, entry]),
    );

    const openCountByUserId = new Map(
      openByAssignee
        .filter((entry) => typeof entry.assignedToUserId === 'string' && entry.assignedToUserId.length > 0)
        .map((entry) => [entry.assignedToUserId as string, entry._count._all]),
    );
    const completedCountByUserId = new Map(
      completedByAssignee
        .filter((entry) => typeof entry.assignedToUserId === 'string' && entry.assignedToUserId.length > 0)
        .map((entry) => [entry.assignedToUserId as string, entry._count._all]),
    );
    const overdueCountByUserId = new Map(
      overdueByAssignee
        .filter((entry) => typeof entry.assignedToUserId === 'string' && entry.assignedToUserId.length > 0)
        .map((entry) => [entry.assignedToUserId as string, entry._count._all]),
    );

    const byUser = trackedUserIdList
      .map((userId) => {
        const membership = membershipByUserId.get(userId) ?? null;
        const activeMembership = activeMemberByUserId.get(userId) ?? null;
        const userName = membership?.user.name
          ?? membership?.user.email
          ?? activeMembership?.user.name
          ?? activeMembership?.user.email
          ?? 'Utente non disponibile';
        const membershipStatus = membership?.status ?? 'UNKNOWN';

        return {
          userId,
          name: membershipStatus === 'INACTIVE' ? `${userName} (disattivato)` : userName,
          email: membership?.user.email ?? activeMembership?.user.email ?? null,
          avatarUrl: null,
          membershipStatus,
          assignedOpen: openCountByUserId.get(userId) ?? 0,
          completedInRange: completedCountByUserId.get(userId) ?? 0,
          overdue: overdueCountByUserId.get(userId) ?? 0,
        };
      })
      .sort((left, right) => {
        if (left.assignedOpen !== right.assignedOpen) {
          return right.assignedOpen - left.assignedOpen;
        }
        if (left.completedInRange !== right.completedInRange) {
          return right.completedInRange - left.completedInRange;
        }
        return left.name.localeCompare(right.name, 'it');
      });

    const openChecklistByUser = byUser
      .filter((entry) => entry.assignedOpen > 0)
      .map((entry) => ({
        userId: entry.userId,
        name: entry.name,
        count: entry.assignedOpen,
      }));
    if (unassignedOpenCount > 0) {
      openChecklistByUser.push({
        userId: 'unassigned',
        name: 'Non assegnato',
        count: unassignedOpenCount,
      });
    }

    if (!includeAssignmentData) {
      return {
        range: {
          from: toIso(from),
          to: toIso(to),
        },
        byUser,
        openChecklistByUser,
        assignableUsers: [],
        unassignedItems: [],
      };
    }

    const unassignedItemsRaw = await prisma.checklistInstanceItem.findMany({
      where: {
        ...listIncompleteRequiredChecklistItemsWhere(workspaceId),
        assignedToUserId: null,
      },
      select: {
        id: true,
        instanceId: true,
        titleSnapshot: true,
        updatedAt: true,
        instance: {
          select: {
            projectId: true,
            pipelineStageId: true,
          },
        },
      },
      orderBy: [
        {
          updatedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      take: 12,
    });

    const projectIds = Array.from(
      new Set(
        unassignedItemsRaw
          .map((item) => item.instance.projectId)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    );
    const projects = projectIds.length > 0
      ? await prisma.project.findMany({
          where: {
            workspaceId,
            id: {
              in: projectIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [];
    const projectById = new Map(projects.map((project) => [project.id, project.name]));

    return {
      range: {
        from: toIso(from),
        to: toIso(to),
      },
      byUser,
      openChecklistByUser,
      assignableUsers: activeMembers.map((entry) => ({
        userId: entry.userId,
        name: entry.user.name ?? entry.user.email,
        email: entry.user.email,
      })),
      unassignedItems: unassignedItemsRaw.map((item) => ({
        itemId: item.id,
        instanceId: item.instanceId,
        title: item.titleSnapshot,
        projectId: item.instance.projectId,
        projectName: item.instance.projectId ? (projectById.get(item.instance.projectId) ?? null) : null,
        pipelineStageId: item.instance.pipelineStageId,
        updatedAt: toIso(item.updatedAt),
      })),
    };
  },

  async getModulesStatus(workspaceId: string): Promise<ModulesStatusRecord> {
    const modules = await prisma.module.findMany({
      orderBy: {
        key: 'asc',
      },
      select: {
        key: true,
        name: true,
        workspaceModules: {
          where: {
            workspaceId,
          },
          select: {
            enabled: true,
          },
          take: 1,
        },
      },
    });

    const enabled: ModulesStatusRecord['enabled'] = [];
    const disabled: ModulesStatusRecord['disabled'] = [];

    for (const moduleEntry of modules) {
      const isEnabled = moduleEntry.workspaceModules[0]?.enabled ?? false;
      if (isEnabled) {
        enabled.push({
          key: moduleEntry.key,
          name: moduleEntry.name,
        });
        continue;
      }

      disabled.push({
        key: moduleEntry.key,
        name: moduleEntry.name,
      });
    }

    return { enabled, disabled };
  },

  async getQuotesPipeline(workspaceId: string): Promise<QuotesPipelineRecord> {
    const grouped = await prisma.quote.groupBy({
      by: ['status'],
      where: {
        workspaceId,
      },
      _count: {
        _all: true,
      },
    });

    const defaultStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
    const countByStatus = new Map<string, number>(
      grouped.map((entry) => [entry.status, entry._count._all]),
    );

    return {
      byStatus: defaultStatuses.map((status) => ({
        status,
        count: countByStatus.get(status) ?? 0,
      })),
    };
  },

  async getQuotesFunnel(workspaceId: string): Promise<QuotesFunnelRecord> {
    const grouped = await this.getQuotesPipeline(workspaceId);
    const countByStatus = new Map(
      grouped.byStatus.map((entry) => [entry.status, entry.count]),
    );

    const rejectedExpired =
      (countByStatus.get('REJECTED') ?? 0)
      + (countByStatus.get('EXPIRED') ?? 0);

    return {
      steps: [
        { label: 'Draft', count: countByStatus.get('DRAFT') ?? 0 },
        { label: 'Sent', count: countByStatus.get('SENT') ?? 0 },
        { label: 'Accepted', count: countByStatus.get('ACCEPTED') ?? 0 },
        { label: 'Rejected/Expired', count: rejectedExpired },
      ],
    };
  },

  async getMyTasks(workspaceId: string, userId: string): Promise<MyTaskRecord> {
    const projectIds = await getRecentProjectIdsForUser(workspaceId, userId);
    if (projectIds.length === 0) {
      return { items: [] };
    }

    const items = await prisma.checklistInstanceItem.findMany({
      where: {
        workspaceId,
        isRequiredSnapshot: true,
        state: {
          in: CHECKLIST_INCOMPLETE_STATES,
        },
        instance: {
          projectId: {
            in: projectIds,
          },
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 12,
      select: {
        id: true,
        titleSnapshot: true,
        instance: {
          select: {
            projectId: true,
          },
        },
      },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.titleSnapshot,
        projectId: item.instance.projectId,
        href: item.instance.projectId ? `/projects/${item.instance.projectId}` : '/projects',
        due: null,
      })),
    };
  },

  async getMyProjects(workspaceId: string, userId: string): Promise<MyProjectRecord> {
    const projectIds = await getRecentProjectIdsForUser(workspaceId, userId);
    if (projectIds.length === 0) {
      return { items: [] };
    }

    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        id: {
          in: projectIds,
        },
        OR: [
          { pipelineStageId: null },
          {
            pipelineStage: {
              isClosed: false,
            },
          },
        ],
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 12,
      select: {
        id: true,
        name: true,
        updatedAt: true,
        pipelineStage: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      items: projects.map((project) => ({
        id: project.id,
        name: project.name,
        stage: project.pipelineStage?.name ?? 'Senza stage',
        updatedAt: toIso(project.updatedAt),
        href: `/projects/${project.id}`,
      })),
    };
  },

  async getClientsTrend(workspaceId: string): Promise<ClientsTrendRecord> {
    const buckets = buildRollingWeeklyBuckets(8);
    const firstBucketStart = buckets[0]?.start;
    const lastBucketEnd = buckets[buckets.length - 1]?.end;
    if (!firstBucketStart) {
      return { points: [] };
    }

    const clients = await prisma.client.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: firstBucketStart,
          ...(lastBucketEnd
            ? {
                lt: lastBucketEnd,
              }
            : {}),
        },
      },
      select: {
        createdAt: true,
      },
    });

    const points = buckets.map((bucket) => ({
      label: bucket.label,
      count: 0,
    }));

    for (const client of clients) {
      const createdAtMs = client.createdAt.getTime();
      const bucketIndex = buckets.findIndex((bucket) => (
        createdAtMs >= bucket.start.getTime()
        && createdAtMs < bucket.end.getTime()
      ));

      if (bucketIndex >= 0) {
        points[bucketIndex].count += 1;
      }
    }

    return { points };
  },

  async getClientsCreatedSince(workspaceId: string, since: Date): Promise<number> {
    return prisma.client.count({
      where: {
        workspaceId,
        createdAt: {
          gte: since,
        },
      },
    });
  },

  async getProjectFreshness(workspaceId: string): Promise<ProjectFreshnessRecord> {
    const sevenDaysAgo = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
    const baseWhere = {
      workspaceId,
      OR: [
        { pipelineStageId: null },
        {
          pipelineStage: {
            isClosed: false,
          },
        },
      ],
    } as const;

    const [activeProjects, updatedProjects7d] = await Promise.all([
      prisma.project.count({
        where: baseWhere,
      }),
      prisma.project.count({
        where: {
          ...baseWhere,
          updatedAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
    ]);

    return {
      activeProjects,
      updatedProjects7d,
    };
  },

  async getChecklistCompletionStats(workspaceId: string): Promise<ChecklistCompletionStatsRecord> {
    const ninetyDaysAgo = new Date(now().getTime() - 90 * 24 * 60 * 60 * 1000);
    const completedItems = await prisma.checklistInstanceItem.findMany({
      where: {
        workspaceId,
        completedAt: {
          not: null,
          gte: ninetyDaysAgo,
        },
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: 500,
    });

    if (completedItems.length === 0) {
      return {
        sampleSize: 0,
        avgCompletionHours: null,
      };
    }

    const totalHours = completedItems.reduce((accumulator, item) => {
      if (!item.completedAt) {
        return accumulator;
      }

      const durationMs = Math.max(0, item.completedAt.getTime() - item.createdAt.getTime());
      return accumulator + durationMs / (1000 * 60 * 60);
    }, 0);

    return {
      sampleSize: completedItems.length,
      avgCompletionHours: Number((totalHours / completedItems.length).toFixed(1)),
    };
  },

  async getActivityHistogram(workspaceId: string): Promise<ActivityHistogramRecord> {
    const buckets = buildDailyBuckets(14);
    const firstBucketStart = buckets[0]?.start;
    if (!firstBucketStart) {
      return { points: [] };
    }

    const entries = await prisma.auditLog.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: firstBucketStart,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const points = buckets.map((bucket) => ({
      label: bucket.label,
      count: 0,
    }));

    for (const entry of entries) {
      const createdAtMs = entry.createdAt.getTime();
      const bucketIndex = buckets.findIndex((bucket) => (
        createdAtMs >= bucket.start.getTime()
        && createdAtMs < bucket.end.getTime()
      ));

      if (bucketIndex >= 0) {
        points[bucketIndex].count += 1;
      }
    }

    return { points };
  },

  async getSecuritySignals(workspaceId: string): Promise<SecuritySignalsRecord> {
    const sevenDaysAgo = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now().getTime() - 30 * 24 * 60 * 60 * 1000);

    const [auditEvents7d, auditEvents30d, roleChanges30d, moduleToggles30d, vaultReveals7d, vaultReveals30d] = await Promise.all([
      prisma.auditLog.count({
        where: {
          workspaceId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          workspaceId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          workspaceId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
          OR: [
            { action: { startsWith: 'role.' } },
            { action: { startsWith: 'roles.' } },
            { action: { startsWith: 'team.roles_' } },
            { action: 'rbac.role.permissions.synced' },
          ],
        },
      }),
      prisma.auditLog.count({
        where: {
          workspaceId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
          action: {
            startsWith: 'modules.',
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          workspaceId,
          action: 'vault.reveal',
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          workspaceId,
          action: 'vault.reveal',
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
    ]);

    return {
      auditEvents7d,
      auditEvents30d,
      roleChanges30d,
      moduleToggles30d,
      vaultReveals7d,
      vaultReveals30d,
    };
  },

  async getSecuritySummary(workspaceId: string): Promise<SecuritySummaryRecord> {
    const sevenDaysAgo = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now().getTime() - 30 * 24 * 60 * 60 * 1000);

    const [auditEvents7d, vaultReveals7d, vaultReveals30d] = await Promise.all([
      prisma.auditLog.count({
        where: {
          workspaceId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          workspaceId,
          action: 'vault.reveal',
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          workspaceId,
          action: 'vault.reveal',
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
    ]);

    return {
      auditEvents7d,
      vaultReveals7d,
      vaultReveals30d,
    };
  },
};
