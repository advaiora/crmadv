import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton';
import WidgetCard from './WidgetCard';
import { formatNumber } from './formatters';

const Tile = ({ label, value, loading = false }) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
    {loading ? (
      <div className="space-y-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-28" />
      </div>
    ) : (
      <>
        <p className="mb-1 text-2xl font-semibold tracking-tight">{formatNumber(value)}</p>
        <p className="mb-0 text-sm text-[var(--hk-text-tertiary)]">{label}</p>
      </>
    )}
  </div>
);

const SecuritySummaryWidget = ({ title = 'Security summary', data, loading = false }) => {
  const summary = data || {
    auditEvents7d: 0,
    vaultReveals7d: 0,
    vaultReveals30d: 0,
  };

  return (
    <WidgetCard
      title={title}
      subtitle="Metriche audit e segnali vault"
      icon={ShieldCheck}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Tile label="Audit events (7d)" value={summary.auditEvents7d} loading={loading} />
        <Tile label="Vault reveals (7d)" value={summary.vaultReveals7d} loading={loading} />
        <Tile label="Vault reveals (30d)" value={summary.vaultReveals30d} loading={loading} />
      </div>
    </WidgetCard>
  );
};

export default SecuritySummaryWidget;

