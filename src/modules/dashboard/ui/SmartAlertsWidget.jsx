import React from 'react';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';

const severityVariant = {
  critical: 'destructive',
  high: 'warning',
  medium: 'default',
  low: 'secondary',
};

const RowSkeleton = () => (
  <div className="space-y-2 rounded-xl border border-[var(--border)] px-3 py-3">
    <div className="flex items-center gap-2">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-5 w-20" />
    </div>
    <Skeleton className="h-5 w-4/5" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-8 w-20" />
  </div>
);

const SmartAlertsWidget = ({ title = 'Smart alerts', data, loading = false }) => {
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Alert intelligenti su rischio e priorita"
      icon={AlertTriangle}
    >
      {loading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : null}

      {!loading && alerts.length === 0 ? (
        <WidgetEmptyState icon={AlertTriangle} message="Nessun alert operativo rilevato." />
      ) : null}

      {!loading && alerts.length > 0 ? (
        <div className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
          {alerts.map((alert, index) => (
            <div key={`${alert.id || alert.href || 'alert'}-${index}`} className="rounded-xl px-3 py-3 transition-colors hover:bg-[var(--muted)]">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={severityVariant[alert.severity] || 'secondary'}>{alert.severity}</Badge>
                <Badge variant="outline">{alert.category}</Badge>
              </div>

              <p className="mb-1 text-sm font-medium">{alert.title}</p>
              <p className="mb-2 text-sm text-[var(--hk-text-tertiary)]">{alert.why}</p>

              <Button size="sm" variant="ghost" onClick={() => window.location.assign(alert.href)}>
                {alert.ctaLabel || 'Open'}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </WidgetCard>
  );
};

export default SmartAlertsWidget;

