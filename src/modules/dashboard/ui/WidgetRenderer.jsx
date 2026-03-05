import React from 'react';
import { cn } from '../../../lib/cn';
import ActivityFeed from './ActivityFeed';
import KpisWidget from './KpisWidget';
import ModulesStatusWidget from './ModulesStatusWidget';
import MyProjectsWidget from './MyProjectsWidget';
import MyTasksWidget from './MyTasksWidget';
import PipelineSnapshot from './PipelineSnapshot';
import QuotesPipelineWidget from './QuotesPipelineWidget';
import SecuritySummaryWidget from './SecuritySummaryWidget';
import SecuritySummaryPlusWidget from './SecuritySummaryPlusWidget';
import SmartAlertsWidget from './SmartAlertsWidget';
import TeamWorkloadWidget from './TeamWorkloadWidget';
import UrgentList from './UrgentList';
import ActivityHistogram from './charts/ActivityHistogram';
import ClientsTrendLine from './charts/ClientsTrendLine';
import PipelineBarChart from './charts/PipelineBarChart';
import QuotesFunnelChart from './charts/QuotesFunnelChart';
import NextActionsWidget from './NextActionsWidget';
import ProductivityInsightsWidget from './ProductivityInsightsWidget';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';

const DASHBOARD_WIDGET_DISPLAY_ORDER = {
  kpis: 10,
  urgent: 20,
  pipeline: 30,
  pipeline_chart: 40,
  activity: 50,
  quotes_pipeline: 60,
  quotes_funnel: 70,
  clients_trend: 80,
  my_tasks: 90,
  my_projects: 100,
  team_workload: 110,
  activity_histogram: 120,
  smart_alerts: 130,
  next_actions: 140,
  productivity_insights: 150,
  security_summary: 160,
  security_summary_plus: 170,
  modules_status: 180,
};

const PRIMARY_PIPELINE_TYPES = ['pipeline', 'pipeline_chart', 'quotes_pipeline'];
const SECONDARY_FOCUS_TYPES = [
  'pipeline_chart',
  'quotes_funnel',
  'clients_trend',
  'activity_histogram',
  'my_tasks',
  'my_projects',
  'team_workload',
  'quotes_pipeline',
  'next_actions',
  'smart_alerts',
  'productivity_insights',
  'security_summary',
  'security_summary_plus',
  'modules_status',
];

const REMAINING_SPAN_CLASS_BY_TYPE = {
  activity: 'xl:col-span-5',
  pipeline: 'xl:col-span-5',
  quotes_pipeline: 'xl:col-span-5',
  pipeline_chart: 'xl:col-span-6',
  quotes_funnel: 'xl:col-span-6',
  clients_trend: 'xl:col-span-6',
  activity_histogram: 'xl:col-span-6',
  my_tasks: 'xl:col-span-6',
  my_projects: 'xl:col-span-6',
  team_workload: 'xl:col-span-6',
  smart_alerts: 'xl:col-span-6',
  next_actions: 'xl:col-span-6',
  productivity_insights: 'xl:col-span-6',
  security_summary: 'xl:col-span-6',
  security_summary_plus: 'xl:col-span-6',
  modules_status: 'xl:col-span-6',
};

const toSortableOrder = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const sortWidgets = (leftWidget, rightWidget) => {
  const leftOrder = toSortableOrder(leftWidget.order);
  const rightOrder = toSortableOrder(rightWidget.order);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const leftDisplayOrder = DASHBOARD_WIDGET_DISPLAY_ORDER[leftWidget.type] ?? 999;
  const rightDisplayOrder = DASHBOARD_WIDGET_DISPLAY_ORDER[rightWidget.type] ?? 999;
  if (leftDisplayOrder !== rightDisplayOrder) {
    return leftDisplayOrder - rightDisplayOrder;
  }

  return String(leftWidget.title || leftWidget.type).localeCompare(String(rightWidget.title || rightWidget.type), 'it');
};

const UnknownWidget = ({ title, type }) => (
  <WidgetCard title={title || 'Widget'} subtitle={`Tipo: ${type || 'sconosciuto'}`}>
    <WidgetEmptyState message={`Widget non supportato: ${String(type || 'unknown')}`} />
  </WidgetCard>
);

const renderWidgetContent = (widget) => {
  const loading = widget?.data == null;

  if (widget.type === 'kpis') {
    return <KpisWidget data={widget.data} loading={loading} />;
  }

  if (widget.type === 'urgent') {
    return <UrgentList title={widget.title} items={widget.data?.items || []} loading={loading} />;
  }

  if (widget.type === 'pipeline') {
    return <PipelineSnapshot title={widget.title} items={widget.data?.items || []} loading={loading} />;
  }

  if (widget.type === 'activity') {
    return <ActivityFeed title={widget.title} items={widget.data?.items || []} loading={loading} />;
  }

  if (widget.type === 'pipeline_chart') {
    return <PipelineBarChart title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'quotes_funnel') {
    return <QuotesFunnelChart title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'clients_trend') {
    return <ClientsTrendLine title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'activity_histogram') {
    return <ActivityHistogram title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'team_workload') {
    return <TeamWorkloadWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'modules_status') {
    return <ModulesStatusWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'quotes_pipeline') {
    return <QuotesPipelineWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'my_tasks') {
    return <MyTasksWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'my_projects') {
    return <MyProjectsWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'security_summary') {
    return <SecuritySummaryWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'smart_alerts') {
    return <SmartAlertsWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'next_actions') {
    return <NextActionsWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'productivity_insights') {
    return <ProductivityInsightsWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  if (widget.type === 'security_summary_plus') {
    return <SecuritySummaryPlusWidget title={widget.title} data={widget.data} loading={loading} />;
  }

  return <UnknownWidget title={widget.title} type={widget.type} />;
};

const pickFirstByType = (widgets, usedIds, types) => {
  const selected = widgets.find((widget) => !usedIds.has(widget.id) && types.includes(widget.type));
  if (!selected) {
    return null;
  }

  usedIds.add(selected.id);
  return selected;
};

const renderCell = (widget, className, idPrefix = 'dashboard-widget') => (
  <div
    key={widget.id}
    id={`${idPrefix}-${widget.id}`}
    className={cn('col-span-12 min-w-0', className)}
  >
    {renderWidgetContent(widget)}
  </div>
);

const WidgetRenderer = ({ widgets = [] }) => {
  const sortedWidgets = [...widgets].sort(sortWidgets);
  const usedIds = new Set();

  const kpiWidgets = sortedWidgets.filter((widget) => widget.type === 'kpis');
  kpiWidgets.forEach((widget) => usedIds.add(widget.id));

  const urgentWidget = pickFirstByType(sortedWidgets, usedIds, ['urgent', 'smart_alerts']);
  const pipelineWidget = pickFirstByType(sortedWidgets, usedIds, PRIMARY_PIPELINE_TYPES);
  const activityWidget = pickFirstByType(sortedWidgets, usedIds, ['activity']);
  const secondaryFocusWidget = pickFirstByType(sortedWidgets, usedIds, SECONDARY_FOCUS_TYPES);

  const remainingWidgets = sortedWidgets.filter((widget) => !usedIds.has(widget.id));

  return (
    <div className="space-y-6">
      {kpiWidgets.length > 0 ? (
        <section id="dashboard-section-overview" className="space-y-3">
          <p className="text-sm font-medium text-textMuted">Panoramica</p>
          <div className="grid grid-cols-1 gap-4 md:gap-6">
            {kpiWidgets.map((widget) => renderCell(widget, 'col-span-12', 'dashboard-kpi'))}
          </div>
        </section>
      ) : null}

      {urgentWidget || pipelineWidget ? (
        <section id="dashboard-section-main" className="space-y-3">
          <p className="text-sm font-medium text-textMuted">Priorita operative</p>
          <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
            {urgentWidget
              ? renderCell(urgentWidget, pipelineWidget ? 'xl:col-span-7' : 'xl:col-span-12', 'dashboard-main')
              : null}
            {pipelineWidget
              ? renderCell(pipelineWidget, urgentWidget ? 'xl:col-span-5' : 'xl:col-span-12', 'dashboard-main')
              : null}
          </div>
        </section>
      ) : null}

      {secondaryFocusWidget || activityWidget ? (
        <section id="dashboard-section-insights" className="space-y-3">
          <p className="text-sm font-medium text-textMuted">Operativita e attivita</p>
          <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
            {secondaryFocusWidget
              ? renderCell(
                secondaryFocusWidget,
                activityWidget ? 'xl:col-span-7' : 'xl:col-span-12',
                'dashboard-insight',
              )
              : null}
            {activityWidget
              ? renderCell(activityWidget, secondaryFocusWidget ? 'xl:col-span-5' : 'xl:col-span-12', 'dashboard-insight')
              : null}
          </div>
        </section>
      ) : null}

      {remainingWidgets.length > 0 ? (
        <section id="dashboard-section-more" className="space-y-3">
          <p className="text-sm font-medium text-textMuted">Approfondimenti</p>
          <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
            {remainingWidgets.map((widget) => renderCell(
              widget,
              REMAINING_SPAN_CLASS_BY_TYPE[widget.type] || 'xl:col-span-6',
              'dashboard-extra',
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default WidgetRenderer;

