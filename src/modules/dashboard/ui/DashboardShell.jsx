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
  <div className="min-h-full bg-[var(--background)]">
    <div className="bg-gradient-to-b from-[var(--muted)] to-[var(--background)]">
      <div className="mx-auto w-full max-w-7xl px-4 pb-4 pt-6 md:px-6 md:pb-6 md:pt-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm backdrop-blur md:flex-row md:items-start md:justify-between md:p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            {subtitle ? <p className="text-sm text-[var(--muted-foreground)]">{subtitle}</p> : null}
            <p className="text-sm text-[var(--muted-foreground)]">Aggiornato {lastUpdatedLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.variant || 'ghost'}
                onClick={action.onClick}
                disabled={Boolean(action.disabled)}
              >
                {action.label}
              </Button>
            ))}

            {showCustomize ? (
              <Button size="sm" variant="ghost" onClick={onCustomize}>
                <SlidersHorizontal className="h-4 w-4" />
                Customize
              </Button>
            ) : null}

            <Button size="sm" variant="outline" onClick={onRefresh} disabled={isRefreshing}>
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

