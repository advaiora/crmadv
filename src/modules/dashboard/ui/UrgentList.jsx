import React from 'react';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';
import { formatDateTime } from './formatters';

const severityVariant = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
};

const severityIcon = {
  high: AlertOctagon,
  medium: AlertCircle,
  low: Info,
};

const UrgentRowSkeleton = () => (
  <div className="space-y-2 rounded-xl border border-[var(--border)] px-3 py-3">
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-5 w-16" />
    </div>
    <Skeleton className="h-5 w-4/5" />
    <Skeleton className="h-4 w-full" />
  </div>
);

const UrgentList = ({ title = 'Needs attention', items = [], loading = false }) => (
  <WidgetCard
    title={title}
    subtitle="Priorita operative che richiedono intervento rapido"
    icon={AlertTriangle}
  >
    {loading ? (
      <div className="space-y-3">
        <UrgentRowSkeleton />
        <UrgentRowSkeleton />
        <UrgentRowSkeleton />
      </div>
    ) : null}

    {!loading && items.length === 0 ? (
      <WidgetEmptyState
        icon={AlertTriangle}
        message="Nessun elemento urgente al momento."
      />
    ) : null}

    {!loading && items.length > 0 ? (
      <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
        {items.map((item, index) => {
          const Icon = severityIcon[item.severity] || Info;
          const createdAt = formatDateTime(item.createdAt);

          return (
            <div
              key={`${item.type}-${item.href}-${index}`}
              className="group flex items-start justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--muted)]"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--muted)] text-[var(--hk-text-tertiary)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="mb-0 text-sm font-semibold leading-tight">{item.title}</p>
                </div>

                {item.description ? (
                  <p className="mb-0 text-sm text-[var(--hk-text-tertiary)]">{item.description}</p>
                ) : null}

                {createdAt ? <p className="mb-0 text-xs text-[var(--hk-text-tertiary)]">{createdAt}</p> : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={severityVariant[item.severity] || 'secondary'}>
                  {item.severity || 'low'}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[var(--hk-text-tertiary)] hover:text-[var(--foreground)]"
                  onClick={() => window.location.assign(item.href)}
                >
                  Open
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    ) : null}
  </WidgetCard>
);

export default UrgentList;

