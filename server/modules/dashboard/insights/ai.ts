import type { DashboardInsightContext } from './types.js';

export const buildAiPromptSummary = (context: DashboardInsightContext): string => {
  const blockedCount = context.urgentItems.filter((item) => item.type === 'blocked_project').length;
  const staleCount = context.urgentItems.filter((item) => item.type === 'stale_project').length;
  const draftQuoteCount = context.quotesDraftCount;
  const openTaskCount = context.myTasks.items.length;
  const busiestStage = [...context.stageCounts].sort((left, right) => right.count - left.count)[0];

  const lines = [
    `Workspace: ${context.workspaceId}`,
    `User: ${context.userId}`,
    `KPI clients=${context.kpis.clientsActive}, projects=${context.kpis.projectsActive}, quotesSent30d=${context.kpis.quotesSent30d}, checklistOpen=${context.kpis.checklistOpenItems}`,
    `Operational risks: blockedProjects=${blockedCount}, staleProjects=${staleCount}, draftQuotes=${draftQuoteCount}, myOpenTasks=${openTaskCount}`,
    `Busiest stage: ${busiestStage ? `${busiestStage.stageName} (${busiestStage.count})` : 'n/a'}`,
  ];

  if (context.securitySignals) {
    lines.push(
      `Security: audit7d=${context.securitySignals.auditEvents7d}, roleChanges30d=${context.securitySignals.roleChanges30d}, moduleToggles30d=${context.securitySignals.moduleToggles30d}, vaultReveals7d=${context.securitySignals.vaultReveals7d}`,
    );
  }

  lines.push('Note: summary intentionally excludes Vault secret contents and sensitive payloads.');

  return lines.join('\n');
};
