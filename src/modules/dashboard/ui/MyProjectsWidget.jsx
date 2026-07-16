import React from 'react';
import { ArrowUpRight, FolderOpen } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';
import { formatDateTime } from './formatters';
import { rowActivationProps } from '../../../utils/rowActivation';
import { askAiRowProps } from '../../../views/Agency/chat/askAi';

const RowSkeleton = () => (
  <div className="space-y-2 rounded-xl border border-cardBorder px-3 py-3">
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-5 w-16" />
    </div>
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-8 w-28" />
  </div>
);

const MyProjectsWidget = ({ title = 'My projects', data, loading = false }) => {
  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Progetti assegnati nel workspace"
      icon={FolderOpen}
    >
      {loading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <WidgetEmptyState icon={FolderOpen} message="Nessun progetto attivo assegnato." />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <div
              key={`${item.id || item.href || 'project'}-${index}`}
              className={`rounded-xl px-3 py-3 transition-colors hover:bg-hover${item.href ? ' row-clickable' : ''}`}
              aria-label={item.href ? `Apri ${item.name}` : undefined}
              {...(item.href ? rowActivationProps(() => window.location.assign(item.href)) : {})}
              {...askAiRowProps('project', item)}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{item.name}</span>
                <Badge variant="outline">{item.stage}</Badge>
              </div>

              <p className="mb-2 text-xs text-textMuted">
                Aggiornato {formatDateTime(item.updatedAt)}
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

export default MyProjectsWidget;

