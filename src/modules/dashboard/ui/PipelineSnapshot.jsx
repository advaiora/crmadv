import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../lib/cn';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';

const PipelineRowSkeleton = () => (
  <div className="space-y-2 rounded-xl border border-[var(--border)] px-3 py-3">
    <div className="flex items-center justify-between gap-3">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-5 w-10" />
    </div>
    <Skeleton className="h-2 w-full" />
  </div>
);

const PipelineSnapshot = ({ title = 'Pipeline snapshot', items = [], loading = false }) => {
  const maxCount = Math.max(1, ...items.map((item) => Number(item.count) || 0));

  return (
    <WidgetCard
      title={title}
      subtitle="Distribuzione dei progetti per stage"
      icon={BarChart3}
    >
      {loading ? (
        <div className="space-y-3">
          <PipelineRowSkeleton />
          <PipelineRowSkeleton />
          <PipelineRowSkeleton />
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <WidgetEmptyState
          icon={BarChart3}
          message="Nessun progetto attivo in pipeline."
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {items.map((stage) => {
            const count = Number(stage.count) || 0;
            const widthPercent = Math.min(100, Math.round((count / maxCount) * 100));

            return (
              <div
                key={stage.stageId}
                className="rounded-xl px-3 py-3 transition-colors hover:bg-[var(--muted)]"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="mb-0 text-sm font-medium">{stage.stageName}</p>
                  <Badge variant="outline">{count}</Badge>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className={cn(
                      'h-full rounded-full bg-[var(--primary)] transition-all duration-500',
                      widthPercent === 0 ? 'w-0' : '',
                    )}
                    style={widthPercent > 0 ? { width: `${widthPercent}%` } : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </WidgetCard>
  );
};

export default PipelineSnapshot;

