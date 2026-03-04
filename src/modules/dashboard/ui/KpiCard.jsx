import React from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { formatNumber } from './formatters';

const KpiCard = ({ title, value, helper, delta = null, icon: Icon = null, loading = false }) => (
  <Card className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm transition-colors hover:bg-[var(--muted)]">
    <CardContent className="space-y-3 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="mb-0 text-xs font-medium uppercase tracking-wide text-[var(--hk-text-tertiary)]">{title}</p>
        {Icon ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--hk-text-tertiary)]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <>
          <div className="text-2xl font-semibold tracking-tight md:text-3xl">{formatNumber(value)}</div>
          {delta ? <p className="mb-0 text-xs font-medium text-[var(--hk-text-tertiary)]">{delta}</p> : null}
          <p className="mb-0 text-sm text-[var(--hk-text-tertiary)]">{helper}</p>
        </>
      )}
    </CardContent>
  </Card>
);

export default KpiCard;

