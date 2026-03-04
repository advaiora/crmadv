import React from 'react';
import { ArrowUpRight, CheckSquare } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';
import { formatDate } from './formatters';

const RowSkeleton = () => (
  <div className="space-y-2 rounded-xl border border-[var(--border)] px-3 py-3">
    <Skeleton className="h-5 w-4/5" />
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-8 w-24" />
  </div>
);

const MyTasksWidget = ({ title = 'My tasks', data, loading = false }) => {
  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Task assegnati all'utente corrente"
      icon={CheckSquare}
    >
      {loading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <WidgetEmptyState icon={CheckSquare} message="Nessun task aperto assegnato." />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <div key={`${item.id || item.href || 'task'}-${index}`} className="rounded-xl px-3 py-3 transition-colors hover:bg-[var(--muted)]">
              <p className="mb-1 text-sm font-medium">{item.title}</p>
              <p className="mb-2 text-xs text-[var(--hk-text-tertiary)]">
                {item.due ? `Scadenza: ${formatDate(item.due)}` : 'Nessuna scadenza'}
              </p>

              <Button size="sm" variant="ghost" onClick={() => window.location.assign(item.href)}>
                Open
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </WidgetCard>
  );
};

export default MyTasksWidget;

