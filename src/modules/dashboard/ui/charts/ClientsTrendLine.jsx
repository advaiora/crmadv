import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Skeleton } from '../../../../components/ui/skeleton';
import WidgetCard, { WidgetEmptyState } from '../WidgetCard';
import ChartSurface from './ChartSurface';

const CHART_COLOR = 'var(--primary)';
const GRID_COLOR = 'var(--border)';
const AXIS_COLOR = 'var(--muted-foreground)';

const ClientsTrendLine = ({ title = 'Clients trend', data, loading = false }) => {
  const rows = Array.isArray(data?.points)
    ? data.points.map((point) => ({
        label: point.label,
        count: Number(point.count || 0),
      }))
    : [];

  return (
    <WidgetCard
      title={title}
      subtitle="Trend acquisizione clienti"
      icon={TrendingUp}
      contentClassName="p-4 pt-4 md:p-6 md:pt-4"
    >
      {loading ? <Skeleton className="h-[260px] w-full rounded-xl" /> : null}

      {!loading && rows.length === 0 ? (
        <WidgetEmptyState icon={TrendingUp} message="Nessun dato trend clienti disponibile." />
      ) : null}

      {!loading && rows.length > 0 ? (
        <ChartSurface
          className="h-[260px] min-h-[260px]"
          fallback={<Skeleton className="h-full w-full rounded-xl" />}
        >
          {({ width, height }) => (
            <LineChart width={width} height={height} data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={{ stroke: GRID_COLOR }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={{ stroke: GRID_COLOR }} />
              <Tooltip
                cursor={{ stroke: GRID_COLOR }}
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <Line type="monotone" dataKey="count" stroke={CHART_COLOR} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          )}
        </ChartSurface>
      ) : null}
    </WidgetCard>
  );
};

export default ClientsTrendLine;
