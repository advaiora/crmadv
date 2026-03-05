import React from 'react';
import { Lightbulb } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';

const InsightSkeleton = () => (
  <div className="space-y-2 rounded-xl border border-cardBorder px-3 py-3">
    <Skeleton className="h-4 w-20" />
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-4 w-full" />
  </div>
);

const ProductivityInsightsWidget = ({ title = 'Productivity insights', data, loading = false }) => {
  const insights = Array.isArray(data?.insights) ? data.insights : [];
  const aiSummary = typeof data?.aiSummary === 'string' ? data.aiSummary : null;

  return (
    <WidgetCard
      title={title}
      subtitle="Insight sintetici su performance e focus"
      icon={Lightbulb}
    >
      {loading ? (
        <div className="space-y-3">
          <InsightSkeleton />
          <InsightSkeleton />
        </div>
      ) : null}

      {!loading && insights.length === 0 ? (
        <WidgetEmptyState icon={Lightbulb} message="Nessun insight disponibile per il periodo." />
      ) : null}

      {!loading && insights.length > 0 ? (
        <div className="space-y-1">
          {insights.map((insight, index) => (
            <div key={`${insight.id || insight.label || 'insight'}-${index}`} className="rounded-xl px-3 py-3 transition-colors hover:bg-hover">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-textMuted">{insight.label}</p>
              <p className="mb-1 text-sm font-semibold">{insight.value}</p>
              {insight.note ? <p className="mb-0 text-sm text-textMuted">{insight.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {!loading && aiSummary ? (
        <details className="mt-4 rounded-xl border border-cardBorder bg-bgSecondary p-3">
          <summary className="cursor-pointer text-sm text-textMuted">AI-ready summary (dev)</summary>
          <pre className="mt-3 mb-0 whitespace-pre-wrap break-words text-xs text-textMuted">{aiSummary}</pre>
        </details>
      ) : null}
    </WidgetCard>
  );
};

export default ProductivityInsightsWidget;

