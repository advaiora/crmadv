import React from 'react';
import { Clock3, History } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';
import { formatDateTime } from './formatters';

const ActivityRowSkeleton = () => (
  <div className="relative rounded-xl px-3 py-3">
    <Skeleton className="mb-2 h-5 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
  </div>
);

const ActivityFeed = ({ title = 'Activity feed', items = [], loading = false }) => (
  <WidgetCard
    title={title}
    subtitle="Timeline eventi recenti del workspace"
    icon={History}
  >
    {loading ? (
      <div className="space-y-3">
        <ActivityRowSkeleton />
        <ActivityRowSkeleton />
        <ActivityRowSkeleton />
      </div>
    ) : null}

    {!loading && items.length === 0 ? (
      <WidgetEmptyState
        icon={Clock3}
        message="Nessuna attivita recente da mostrare."
      />
    ) : null}

    {!loading && items.length > 0 ? (
      <div className="relative max-h-[360px] space-y-1 overflow-y-auto pr-1 pl-5 before:absolute before:left-[9px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-cardBorder">
        {items.map((item, index) => (
          <div
            key={`${item.id || item.timestamp || 'activity'}-${index}`}
            className="relative rounded-xl px-3 py-3 transition-colors hover:bg-hover"
          >
            <span className="absolute -left-[16px] top-4 inline-flex h-3 w-3 rounded-full border-2 border-card bg-primary" />

            <p className="mb-1 text-sm font-medium leading-tight">
              {item.summary || item.action}
            </p>

            <p className="mb-0 text-xs text-textMuted">
              {(item.actorName || 'Sistema')}
              {item.targetType ? ` - ${item.targetType}` : ''}
              {item.targetId ? ` - ${item.targetId.slice(0, 8)}` : ''}
              {item.timestamp ? ` - ${formatDateTime(item.timestamp)}` : ''}
            </p>
          </div>
        ))}
      </div>
    ) : null}
  </WidgetCard>
);

export default ActivityFeed;

