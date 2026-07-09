import React from 'react';
import { ArrowUpRight, ListChecks } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';
import { rowActivationProps } from '../../../utils/rowActivation';

const RowSkeleton = () => (
  <div className="space-y-2 rounded-xl border border-cardBorder px-3 py-3">
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-5 w-12" />
    </div>
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-8 w-20" />
  </div>
);

const NextActionsWidget = ({ title = 'Next best actions', data, loading = false }) => {
  const actions = Array.isArray(data?.actions) ? data.actions : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Azioni consigliate per migliorare l'operativita"
      icon={ListChecks}
    >
      {loading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : null}

      {!loading && actions.length === 0 ? (
        <WidgetEmptyState icon={ListChecks} message="Nessuna azione suggerita al momento." />
      ) : null}

      {!loading && actions.length > 0 ? (
        <div className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
          {actions.map((action, index) => (
            <div
              key={`${action.id || action.href || 'action'}-${index}`}
              className={`rounded-xl px-3 py-3 transition-colors hover:bg-hover${action.href ? ' row-clickable' : ''}`}
              aria-label={action.href ? `Apri ${action.title}` : undefined}
              {...(action.href ? rowActivationProps(() => window.location.assign(action.href)) : {})}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="mb-0 text-sm font-medium">{action.title}</p>
                <Badge variant="outline">P{action.priority}</Badge>
              </div>

              <p className="mb-2 text-sm text-textMuted">{action.description}</p>

              <Button size="sm" variant="ghost" onClick={() => window.location.assign(action.href)}>
                {action.ctaLabel || 'Open'}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </WidgetCard>
  );
};

export default NextActionsWidget;

