import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '../../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from '../WidgetCard';
import ChartSurface from './ChartSurface';

const CHART_COLOR = 'var(--primary)';
const GRID_COLOR = 'var(--border)';
const AXIS_COLOR = 'var(--muted-foreground)';

const PipelineBarChart = ({ title = 'Pipeline overview', data, loading = false }) => {
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const values = Array.isArray(data?.values) ? data.values : [];
  const rows = labels.map((label, index) => ({
    label,
    count: Number(values[index] || 0),
  }));

  return (
    <WidgetCard
      title={title}
      subtitle="Andamento pipeline per stage"
      icon={BarChart3}
      contentClassName="p-4 pt-4 md:p-6 md:pt-4"
    >
      {loading ? <Skeleton className="h-[260px] w-full rounded-xl" /> : null}

      {!loading && rows.length === 0 ? (
        <WidgetEmptyState icon={BarChart3} message="Nessun dato pipeline disponibile." />
      ) : null}

      {!loading && rows.length > 0 ? (
        <ChartSurface
          className="h-[260px] min-h-[260px]"
          fallback={<Skeleton className="h-full w-full rounded-xl" />}
        >
          {({ width, height }) => (
            <BarChart width={width} height={height} data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={{ stroke: GRID_COLOR }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={{ stroke: GRID_COLOR }} />
              <Tooltip
                cursor={{ fill: 'var(--muted)' }}
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <Bar dataKey="count" fill={CHART_COLOR} radius={[8, 8, 0, 0]} />
            </BarChart>
          )}
        </ChartSurface>
      ) : null}
    </WidgetCard>
  );
};

export default PipelineBarChart;
