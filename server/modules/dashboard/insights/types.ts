export type SmartAlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SmartAlertCategory = 'pipeline' | 'checklists' | 'quotes' | 'clients' | 'security';

export type SmartAlert = {
  id: string;
  severity: SmartAlertSeverity;
  category: SmartAlertCategory;
  title: string;
  why: string;
  ctaLabel: string;
  href: string;
  createdAt: string;
};

export type NextAction = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  priority: number;
};

export type ProductivityInsight = {
  id: string;
  label: string;
  value: string;
  note: string | null;
};

export type SecuritySummaryPlus = {
  auditEvents7d: number;
  auditEvents30d: number;
  roleChanges30d: number;
  moduleToggles30d: number;
  vaultReveals7d: number;
  vaultReveals30d: number;
  flags: Array<{
    label: string;
    severity: 'high' | 'medium' | 'low';
  }>;
};

export type DashboardInsightContext = {
  workspaceId: string;
  userId: string;
  nowIso: string;
  canCreateClients: boolean;
  kpis: {
    clientsActive: number;
    projectsActive: number;
    quotesSent30d: number;
    checklistOpenItems: number;
  };
  urgentItems: Array<{
    type: 'blocked_project' | 'stale_project' | 'unsent_quote' | 'overdue_checklist';
    title: string;
    description: string;
    href: string;
    severity: 'high' | 'medium' | 'low';
    createdAt: string;
  }>;
  stageCounts: Array<{
    stageId: string;
    stageName: string;
    count: number;
  }>;
  teamWorkload: {
    openChecklistByUser: Array<{
      userId: string;
      name: string;
      count: number;
    }>;
  };
  myTasks: {
    items: Array<{
      id: string;
      title: string;
      projectId: string | null;
      href: string;
      due: string | null;
    }>;
  };
  clientsCreated14d: number;
  projectFreshness: {
    activeProjects: number;
    updatedProjects7d: number;
  } | null;
  checklistCompletionStats: {
    sampleSize: number;
    avgCompletionHours: number | null;
  } | null;
  securitySignals: {
    auditEvents7d: number;
    auditEvents30d: number;
    roleChanges30d: number;
    moduleToggles30d: number;
    vaultReveals7d: number;
    vaultReveals30d: number;
  } | null;
  quotesDraftCount: number;
};
