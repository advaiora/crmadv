import React from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';

const RowSkeleton = () => (
  <div className="space-y-2 rounded-xl border border-[var(--border)] px-3 py-3">
    <div className="flex items-center justify-between gap-3">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-5 w-10" />
    </div>
    <Skeleton className="h-2 w-full" />
  </div>
);

const QuotesPipelineWidget = ({ title = 'Quotes pipeline', data, loading = false }) => {
  const rows = Array.isArray(data?.byStatus) ? data.byStatus : [];
  const maxCount = Math.max(1, ...rows.map((row) => Number(row.count) || 0));

  return (
    <WidgetCard
      title={title}
      subtitle="Stato dei preventivi in corso"
      icon={FileText}
    >
      {loading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <WidgetEmptyState icon={FileText} message="Nessun preventivo presente." />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
          {rows.map((row) => {
            const count = Number(row.count) || 0;
            const widthPercent = Math.min(100, Math.round((count / maxCount) * 100));

            return (
              <div key={row.status} className="rounded-xl px-3 py-3 transition-colors hover:bg-[var(--muted)]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{row.status}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${widthPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </WidgetCard>
  );
};

export default QuotesPipelineWidget;

