import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import { Skeleton } from '../../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from '../WidgetCard';
import ChartSurface from './ChartSurface';

const CHART_COLOR = 'var(--foreground)';
const GRID_COLOR = 'var(--border)';
const AXIS_COLOR = 'var(--muted-foreground)';

const ActivityHistogram = ({ title = 'Activity (14 giorni)', data, loading = false }) => {
  const rows = Array.isArray(data?.points)
    ? data.points.map((point) => ({
        label: point.label,
        count: Number(point.count || 0),
      }))
    : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Intensita attivita giornaliera"
      icon={Activity}
      contentClassName="p-4 pt-4 md:p-6 md:pt-4"
    >
      {loading ? <Skeleton className="h-[220px] w-full rounded-xl" /> : null}

      {!loading && rows.length === 0 ? (
        <WidgetEmptyState icon={Activity} message="Nessuna attivita registrata nel periodo." />
      ) : null}

      {!loading && rows.length > 0 ? (
        <ChartSurface
          className="h-[220px] min-h-[220px]"
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
              <Bar dataKey="count" fill={CHART_COLOR} radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ChartSurface>
      ) : null}
    </WidgetCard>
  );
};

export default ActivityHistogram;
