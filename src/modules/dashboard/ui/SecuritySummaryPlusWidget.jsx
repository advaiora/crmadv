import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';
import { formatNumber } from './formatters';

const flagVariant = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
};

const Stat = ({ label, value, loading = false }) => (
  <div className="rounded-xl border border-cardBorder bg-bgSecondary p-4">
    {loading ? (
      <div className="space-y-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    ) : (
      <>
        <p className="mb-1 text-2xl font-semibold tracking-tight">{formatNumber(value)}</p>
        <p className="mb-0 text-sm text-textMuted">{label}</p>
      </>
    )}
  </div>
);

const SecuritySummaryPlusWidget = ({ title = 'Security & compliance', data, loading = false }) => {
  const summary = data || {
    auditEvents7d: 0,
    auditEvents30d: 0,
    roleChanges30d: 0,
    moduleToggles30d: 0,
    vaultReveals7d: 0,
    vaultReveals30d: 0,
    flags: [],
  };

  const flags = Array.isArray(summary.flags) ? summary.flags : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Vista estesa sicurezza e compliance"
      icon={ShieldAlert}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label="Audit 7g" value={summary.auditEvents7d} loading={loading} />
          <Stat label="Audit 30g" value={summary.auditEvents30d} loading={loading} />
          <Stat label="Role changes 30g" value={summary.roleChanges30d} loading={loading} />
          <Stat label="Module toggles 30g" value={summary.moduleToggles30d} loading={loading} />
          <Stat label="Credenziali viste 7g" value={summary.vaultReveals7d} loading={loading} />
          <Stat label="Credenziali viste 30g" value={summary.vaultReveals30d} loading={loading} />
        </div>

        {!loading && (
          <div className="space-y-2">
            <p className="mb-0 text-sm font-medium text-textMuted">Flags</p>
            {flags.length === 0 ? (
              <WidgetEmptyState className="py-5" message="Nessun flag di sicurezza rilevato." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {flags.map((flag, index) => (
                  <Badge key={`${flag.label}-${index}`} variant={flagVariant[flag.severity] || 'secondary'}>
                    {flag.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </WidgetCard>
  );
};

export default SecuritySummaryPlusWidget;

