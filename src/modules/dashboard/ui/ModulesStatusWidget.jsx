import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';

const SectionSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-16" />
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  </div>
);

const ModulesStatusWidget = ({ title = 'Modules status', data, loading = false }) => {
  const enabled = Array.isArray(data?.enabled) ? data.enabled : [];
  const disabled = Array.isArray(data?.disabled) ? data.disabled : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Stato dei moduli workspace"
      icon={LayoutGrid}
    >
      {loading ? (
        <div className="space-y-5">
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      ) : null}

      {!loading ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="mb-0 text-sm font-medium text-[var(--hk-text-tertiary)]">Enabled</p>
            {enabled.length === 0 ? (
              <WidgetEmptyState className="py-5" message="Nessun modulo abilitato." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {enabled.map((moduleEntry) => (
                  <Badge key={moduleEntry.key} variant="success">
                    {moduleEntry.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="mb-0 text-sm font-medium text-[var(--hk-text-tertiary)]">Disabled</p>
            {disabled.length === 0 ? (
              <WidgetEmptyState className="py-5" message="Nessun modulo disabilitato." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {disabled.map((moduleEntry) => (
                  <Badge key={moduleEntry.key} variant="secondary">
                    {moduleEntry.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </WidgetCard>
  );
};

export default ModulesStatusWidget;

