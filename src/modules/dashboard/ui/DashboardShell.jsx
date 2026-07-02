import React from 'react';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../components/ui/button';

const DashboardShell = ({
  title = 'Dashboard',
  subtitle = '',
  lastUpdatedLabel = 'adesso',
  onRefresh,
  isRefreshing = false,
  onCustomize,
  showCustomize = false,
  quickActions = [],
  children,
}) => (
  <div className="min-h-full bg-bg">
    <div className="mx-auto w-full max-w-7xl px-4 pb-2 pt-6 md:px-6 md:pt-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="space-y-1.5">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-text sm:text-3xl md:text-4xl">{title}</h1>
          {subtitle ? <p className="max-w-2xl text-sm text-textMuted md:text-base">{subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <span className="mr-1 hidden text-xs text-textMuted sm:inline">Aggiornato {lastUpdatedLabel}</span>

          {quickActions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.variant || 'ghost'}
              onClick={action.onClick}
              disabled={Boolean(action.disabled)}
              className="max-sm:flex-1"
            >
              {action.label}
            </Button>
          ))}

          {showCustomize ? (
            <Button size="sm" variant="ghost" onClick={onCustomize} className="max-sm:flex-1">
              <SlidersHorizontal className="h-4 w-4" />
              Customize
            </Button>
          ) : null}

          <Button size="sm" variant="ghost" onClick={onRefresh} disabled={isRefreshing} className="max-sm:flex-1">
            <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        </div>
      </div>
    </div>

    <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 md:px-6 md:pb-10 md:pt-6">
      <div className="space-y-8 md:space-y-10">{children}</div>
    </div>
  </div>
);

export default DashboardShell;

