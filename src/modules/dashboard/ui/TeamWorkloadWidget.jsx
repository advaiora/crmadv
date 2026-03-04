import React from 'react';
import { Users2 } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';

const RowSkeleton = () => (
  <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-3">
    <Skeleton className="h-5 w-28" />
    <Skeleton className="h-5 w-10" />
  </div>
);

const TeamWorkloadWidget = ({ title = 'Team workload', data, loading = false }) => {
  const rows = Array.isArray(data?.openChecklistByUser) ? data.openChecklistByUser : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Carico checklist aperte per membro"
      icon={Users2}
    >
      {loading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <WidgetEmptyState icon={Users2} message="Nessun carico operativo aperto." />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
          {rows.map((row, index) => (
            <div
              key={`${row.userId}-${index}`}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--muted)]"
            >
              <span className="text-sm font-medium">{row.name || 'Utente'}</span>
              <Badge variant="outline">{row.count}</Badge>
            </div>
          ))}
        </div>
      ) : null}
    </WidgetCard>
  );
};

export default TeamWorkloadWidget;

