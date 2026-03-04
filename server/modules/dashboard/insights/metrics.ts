import type { DashboardInsightContext, ProductivityInsight, SecuritySummaryPlus } from './types.js';

export const computeProductivityInsights = (context: DashboardInsightContext): ProductivityInsight[] => {
  const insights: ProductivityInsight[] = [];

  if (
    context.checklistCompletionStats
    && context.checklistCompletionStats.avgCompletionHours !== null
  ) {
    insights.push({
      id: 'avg_checklist_closure',
      label: 'Tempo medio chiusura checklist',
      value: `${context.checklistCompletionStats.avgCompletionHours}h`,
      note: `Campione ultimi 90 giorni: ${context.checklistCompletionStats.sampleSize} item`,
    });
  }

  if (context.projectFreshness && context.projectFreshness.activeProjects > 0) {
    const percentage = Math.round(
      (context.projectFreshness.updatedProjects7d / context.projectFreshness.activeProjects) * 100,
    );

    insights.push({
      id: 'projects_freshness_7d',
      label: 'Progetti aggiornati (7g)',
      value: `${percentage}%`,
      note: `${context.projectFreshness.updatedProjects7d}/${context.projectFreshness.activeProjects} progetti attivi`,
    });
  }

  insights.push({
    id: 'quotes_sent_30d',
    label: 'Preventivi inviati (30g)',
    value: String(context.kpis.quotesSent30d),
    note: null,
  });

  const busiestStage = [...context.stageCounts].sort((left, right) => right.count - left.count)[0];
  if (busiestStage) {
    insights.push({
      id: 'busiest_stage',
      label: 'Stage piu affollato',
      value: busiestStage.stageName,
      note: `${busiestStage.count} progetti`,
    });
  }

  return insights.slice(0, 4);
};

export const computeSecuritySummaryPlus = (
  context: DashboardInsightContext,
): SecuritySummaryPlus | null => {
  if (!context.securitySignals) {
    return null;
  }

  const signals = context.securitySignals;
  const flags: SecuritySummaryPlus['flags'] = [];

  if (signals.vaultReveals7d > 20) {
    flags.push({
      label: `Vault reveal elevati negli ultimi 7 giorni (${signals.vaultReveals7d})`,
      severity: 'high',
    });
  }

  if (signals.roleChanges30d > 10) {
    flags.push({
      label: `Molte modifiche ruoli/permessi negli ultimi 30 giorni (${signals.roleChanges30d})`,
      severity: 'medium',
    });
  }

  if (signals.moduleToggles30d > 8) {
    flags.push({
      label: `Frequente toggle moduli negli ultimi 30 giorni (${signals.moduleToggles30d})`,
      severity: 'medium',
    });
  }

  if (signals.auditEvents7d === 0) {
    flags.push({
      label: 'Nessun evento audit negli ultimi 7 giorni',
      severity: 'low',
    });
  }

  return {
    ...signals,
    flags,
  };
};
