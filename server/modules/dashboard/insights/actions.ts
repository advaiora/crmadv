import type { DashboardInsightContext, NextAction } from './types.js';

export const computeNextActions = (context: DashboardInsightContext): NextAction[] => {
  const actions: NextAction[] = [];

  const blockedCount = context.urgentItems.filter((item) => item.type === 'blocked_project').length;
  const staleCount = context.urgentItems.filter((item) => item.type === 'stale_project').length;
  const draftQuoteAlerts = context.urgentItems.filter((item) => item.type === 'unsent_quote').length;
  const myOpenTasks = context.myTasks.items.length;

  if (myOpenTasks > 0) {
    actions.push({
      id: 'my_tasks_close_3',
      title: 'Chiudi 3 task oggi',
      description: `Hai ${myOpenTasks} task aperti: chiuderne 3 riduce subito il backlog.`,
      ctaLabel: 'Apri i miei task',
      href: '/projects',
      priority: 1,
    });
  }

  if (context.quotesDraftCount > 0 || draftQuoteAlerts > 0) {
    actions.push({
      id: 'send_draft_quotes',
      title: 'Invia i preventivi in bozza',
      description: `Sono presenti ${Math.max(context.quotesDraftCount, draftQuoteAlerts)} preventivi da inviare.`,
      ctaLabel: 'Apri preventivi',
      href: '/apps/quotes',
      priority: 2,
    });
  }

  if (blockedCount > 0) {
    actions.push({
      id: 'unblock_project',
      title: 'Sblocca un progetto gated',
      description: `${blockedCount} progetto/i risultano bloccati da checklist obbligatorie.`,
      ctaLabel: 'Apri progetti',
      href: '/projects',
      priority: 2,
    });
  }

  if (staleCount > 0) {
    actions.push({
      id: 'review_stale_projects',
      title: 'Riattiva progetti stagnanti',
      description: `${staleCount} progetto/i non aggiornati da almeno 7 giorni.`,
      ctaLabel: 'Rivedi progetti',
      href: '/projects',
      priority: 3,
    });
  }

  if (context.canCreateClients && context.clientsCreated14d === 0) {
    actions.push({
      id: 'add_new_lead',
      title: 'Aggiungi un nuovo lead',
      description: 'Nessun cliente creato negli ultimi 14 giorni.',
      ctaLabel: 'Nuovo cliente',
      href: '/apps/clients/new',
      priority: 4,
    });
  }

  return actions
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 6);
};
