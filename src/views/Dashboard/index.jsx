import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LayoutDashboard, Plus } from 'lucide-react';
import { connect } from 'react-redux';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { getDashboardHome } from '../../modules/dashboard/api/dashboardApi';
import DashboardShell from '../../modules/dashboard/ui/DashboardShell';
import DashboardModuleGate from '../../modules/dashboard/ui/DashboardModuleGate';
import { formatRelativeTime } from '../../modules/dashboard/ui/formatters';
import WidgetRenderer from '../../modules/dashboard/ui/WidgetRenderer';
import { DASHBOARD_PERMISSIONS } from '../../modules/dashboard/ui/constants';
import { toggleCollapsedNav } from '../../redux/action/Theme';
import { hasPermission } from '../../utils/workspaceAccess';

const ROLE_LABEL = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  manager: 'Manager',
  operativo: 'Operativo',
  viewer: 'Viewer',
};

const getDashboardErrorMessage = (error) => {
  const status = Number(error?.status);
  if (status === 403) {
    return 'Non hai i permessi necessari per visualizzare la dashboard.';
  }
  if (status === 404) {
    return 'Dashboard non disponibile per questo workspace.';
  }
  if (status >= 500) {
    return 'Errore interno durante il caricamento dashboard. Riprova.';
  }
  return error?.message || 'Impossibile caricare i dati dashboard.';
};

const SkeletonCard = ({ className }) => (
  <Card className={className || 'rounded-2xl border border-cardBorder bg-card shadow-sm transition hover:bg-hover'}>
    <CardContent className="space-y-3 p-4 md:p-6">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-4 w-3/4" />
    </CardContent>
  </Card>
);

const DashboardHomeSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>

    <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
      <SkeletonCard className="rounded-2xl border border-cardBorder bg-card shadow-sm transition hover:bg-hover xl:col-span-7" />
      <SkeletonCard className="rounded-2xl border border-cardBorder bg-card shadow-sm transition hover:bg-hover xl:col-span-5" />
    </div>

    <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
      <SkeletonCard className="rounded-2xl border border-cardBorder bg-card shadow-sm transition hover:bg-hover xl:col-span-7" />
      <SkeletonCard className="rounded-2xl border border-cardBorder bg-card shadow-sm transition hover:bg-hover xl:col-span-5" />
    </div>
  </div>
);

const DashboardWorkspacePage = ({ access, toggleCollapsedNav, reloadWorkspaceAccess }) => {
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    toggleCollapsedNav(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getDashboardHome();
      setHome(data);
      setLastLoadedAt(new Date());
    } catch (apiError) {
      setHome(null);
      setError(getDashboardErrorMessage(apiError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(new Date());
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  const widgets = home?.widgets || [];
  const roleTier = home?.role || 'viewer';
  const roleLabel = ROLE_LABEL[roleTier] || 'Viewer';
  const workspaceName = access?.branding?.workspaceName || access?.workspace?.name || 'Workspace';

  const canViewProjects = hasPermission(access, 'projects.view');
  const canViewClients = hasPermission(access, 'clients.view');

  const subtitle = useMemo(
    () => `Panoramica operativa del workspace ${workspaceName} (${roleLabel}).`,
    [roleLabel, workspaceName],
  );

  const lastUpdatedLabel = useMemo(
    () => formatRelativeTime(lastLoadedAt, nowTick),
    [lastLoadedAt, nowTick],
  );

  return (
    <DashboardShell
      title="Dashboard"
      subtitle={subtitle}
      lastUpdatedLabel={lastUpdatedLabel}
      onRefresh={() => {
        void loadHome();
        if (typeof reloadWorkspaceAccess === 'function') {
          void reloadWorkspaceAccess();
        }
      }}
      isRefreshing={loading}
    >
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="mb-0">{error}</p>
        </div>
      ) : null}

      {!error && loading ? <DashboardHomeSkeleton /> : null}

      {!error && !loading && widgets.length > 0 ? <WidgetRenderer widgets={widgets} /> : null}

      {!error && !loading && widgets.length === 0 ? (
        <Card className="rounded-2xl border border-cardBorder bg-card shadow-sm transition hover:bg-hover">
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-cardBorder bg-bgSecondary px-4 py-8 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-bgSecondary text-primary">
                <LayoutDashboard className="h-4 w-4" />
              </span>
              <p className="mb-0 text-sm text-textMuted">
                Nessun widget disponibile per il tuo profilo nel workspace attuale.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {canViewProjects ? (
                <Button size="sm" variant="outline" onClick={() => window.location.assign('/projects')}>
                  <Plus className="h-4 w-4" />
                  Crea progetto
                </Button>
              ) : null}

              {canViewClients ? (
                <Button size="sm" variant="outline" onClick={() => window.location.assign('/apps/clients/new')}>
                  <Plus className="h-4 w-4" />
                  Nuovo cliente
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </DashboardShell>
  );
};

const DashboardPage = ({ toggleCollapsedNav }) => (
  <DashboardModuleGate requiredPermission={DASHBOARD_PERMISSIONS.view}>
    {({ access, reload }) => (
      <DashboardWorkspacePage
        access={access}
        toggleCollapsedNav={toggleCollapsedNav}
        reloadWorkspaceAccess={reload}
      />
    )}
  </DashboardModuleGate>
);

export default connect(null, { toggleCollapsedNav })(DashboardPage);

