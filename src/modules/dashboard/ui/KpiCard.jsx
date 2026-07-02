import React from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { formatNumber } from './formatters';

const KpiCard = ({ title, value, helper, delta = null, icon: Icon = null, loading = false }) => (
  <Card className="rounded-2xl border-cardBorder/60 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-card hover:shadow-md">
    <CardContent className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="mb-0 text-sm font-medium text-textMuted">{title}</p>
        {Icon ? (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <>
          <div className="mt-4 text-3xl font-bold tracking-tight text-text md:text-4xl">{formatNumber(value)}</div>
          {delta ? <p className="mb-0 mt-2 text-xs font-medium text-textMuted">{delta}</p> : null}
          {helper ? <p className="mb-0 mt-1.5 text-[13px] text-textMuted">{helper}</p> : null}
        </>
      )}
    </CardContent>
  </Card>
);

export default KpiCard;

