import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Funnel } from 'lucide-react';
import { Skeleton } from '../../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from '../WidgetCard';
import ChartSurface from './ChartSurface';

const CHART_COLOR = 'var(--primary)';
const GRID_COLOR = 'var(--border)';
const AXIS_COLOR = 'var(--muted-foreground)';

const QuotesFunnelChart = ({ title = 'Quotes funnel', data, loading = false }) => {
  const rows = Array.isArray(data?.steps)
    ? data.steps.map((step) => ({
        label: step.label,
        count: Number(step.count || 0),
      }))
    : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Funnel conversione preventivi"
      icon={Funnel}
      contentClassName="p-4 pt-4 md:p-6 md:pt-4"
    >
      {loading ? <Skeleton className="h-[260px] w-full rounded-xl" /> : null}

      {!loading && rows.length === 0 ? (
        <WidgetEmptyState icon={Funnel} message="Nessun dato funnel preventivi disponibile." />
      ) : null}

      {!loading && rows.length > 0 ? (
        <ChartSurface
          className="h-[260px] min-h-[260px]"
          fallback={<Skeleton className="h-full w-full rounded-xl" />}
        >
          {({ width, height }) => (
            <BarChart width={width} height={height} data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 12, fill: AXIS_COLOR }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={{ stroke: GRID_COLOR }}
              />
              <YAxis
                dataKey="label"
                type="category"
                width={110}
                tick={{ fontSize: 12, fill: AXIS_COLOR }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={{ stroke: GRID_COLOR }}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)' }}
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <Bar dataKey="count" fill={CHART_COLOR} radius={[0, 8, 8, 0]} />
            </BarChart>
          )}
        </ChartSurface>
      ) : null}
    </WidgetCard>
  );
};

export default QuotesFunnelChart;
