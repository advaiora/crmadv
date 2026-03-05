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
    <div className="bg-gradient-to-b from-bgSecondary to-bg">
      <div className="mx-auto w-full max-w-7xl px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-cardBorder bg-card p-4 shadow-sm backdrop-blur transition hover:bg-hover md:flex-row md:items-start md:justify-between md:gap-4 md:p-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl md:text-3xl">{title}</h1>
            {subtitle ? <p className="text-sm text-textMuted">{subtitle}</p> : null}
            <p className="text-sm text-textMuted">Aggiornato {lastUpdatedLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
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

            <Button size="sm" variant="outline" onClick={onRefresh} disabled={isRefreshing} className="max-sm:flex-1">
              <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Refresh
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-6 md:pb-10">
      <div className="space-y-6">{children}</div>
    </div>
  </div>
);

export default DashboardShell;

