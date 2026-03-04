import type { DashboardInsightContext, SmartAlert } from './types.js';

const severityPriority: Record<SmartAlert['severity'], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const computeAlerts = (context: DashboardInsightContext): SmartAlert[] => {
  const alerts: SmartAlert[] = [];

  for (const item of context.urgentItems) {
    if (item.type === 'blocked_project') {
      alerts.push({
        id: `blocked:${item.href}`,
        severity: item.severity === 'high' ? 'critical' : 'high',
        category: 'pipeline',
        title: item.title,
        why: 'Lo stage corrente resta bloccato finche gli item obbligatori non vengono completati.',
        ctaLabel: 'Apri checklist',
        href: item.href,
        createdAt: item.createdAt,
      });
      continue;
    }

    if (item.type === 'stale_project') {
      alerts.push({
        id: `stale:${item.href}`,
        severity: 'high',
        category: 'pipeline',
        title: item.title,
        why: 'Nessun aggiornamento da oltre 7 giorni: rischio ritardi operativi.',
        ctaLabel: 'Apri progetto',
        href: item.href,
        createdAt: item.createdAt,
      });
      continue;
    }

    if (item.type === 'unsent_quote') {
      alerts.push({
        id: `quote:${item.href}`,
        severity: 'medium',
        category: 'quotes',
        title: item.title,
        why: 'Preventivo in bozza non inviato: puo rallentare la conversione del lead.',
        ctaLabel: 'Apri preventivo',
        href: item.href,
        createdAt: item.createdAt,
      });
      continue;
    }

    if (item.type === 'overdue_checklist') {
      alerts.push({
        id: `checklist:${item.href}:${item.createdAt}`,
        severity: 'high',
        category: 'checklists',
        title: item.title,
        why: 'Elemento checklist obbligatorio in ritardo oltre 7 giorni.',
        ctaLabel: 'Apri checklist',
        href: item.href,
        createdAt: item.createdAt,
      });
    }
  }

  const overloadedUser = [...context.teamWorkload.openChecklistByUser]
    .sort((left, right) => right.count - left.count)[0];
  if (overloadedUser && overloadedUser.count > 15) {
    alerts.push({
      id: `workload:${overloadedUser.userId}`,
      severity: 'medium',
      category: 'checklists',
      title: 'Carico operativo sbilanciato',
      why: `${overloadedUser.name} ha ${overloadedUser.count} task checklist aperti.`,
      ctaLabel: 'Vedi team',
      href: '/apps/team',
      createdAt: context.nowIso,
    });
  }

  if (context.securitySignals) {
    const { vaultReveals7d, roleChanges30d } = context.securitySignals;
    const highVaultActivity = vaultReveals7d > 20;
    const highRoleChanges = roleChanges30d > 10;

    if (highVaultActivity || highRoleChanges) {
      alerts.push({
        id: 'security:unusual_activity',
        severity: highVaultActivity && highRoleChanges ? 'high' : 'medium',
        category: 'security',
        title: 'Attivita di sicurezza da verificare',
        why: `Vault reveals 7g: ${vaultReveals7d}, cambi ruoli 30g: ${roleChanges30d}.`,
        ctaLabel: 'Apri audit',
        href: '/dashboard',
        createdAt: context.nowIso,
      });
    }
  }

  return alerts
    .sort((left, right) => {
      const severityGap = severityPriority[right.severity] - severityPriority[left.severity];
      if (severityGap !== 0) {
        return severityGap;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, 10);
};
