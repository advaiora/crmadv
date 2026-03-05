import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { getDashboardTeamWorkload } from '../api/dashboardApi';
import { assignChecklistItem, isApiError } from '../../checklists/api/checklists.api';
import WidgetCard, { WidgetEmptyState } from './WidgetCard';

const RowSkeleton = () => (
  <div className="flex items-center justify-between rounded-xl border border-cardBorder px-3 py-3">
    <Skeleton className="h-5 w-28" />
    <Skeleton className="h-5 w-20" />
  </div>
);

const getErrorMessage = (error) => {
  if (!error) {
    return 'Errore inatteso';
  }
  if (isApiError(error)) {
    return `${error.message} (${error.code || error.status || 'API_ERROR'})`;
  }
  return error?.message || 'Errore inatteso';
};

const TeamWorkloadWidget = ({ title = 'Team workload', data, loading = false, onRefreshRequested }) => {
  const canAssignChecklistItems = Boolean(data?.canAssignChecklistItems);
  const assignableUsers = useMemo(
    () => (Array.isArray(data?.assignableUsers) ? data.assignableUsers : []),
    [data?.assignableUsers],
  );
  const unassignedItems = useMemo(
    () => (Array.isArray(data?.unassignedItems) ? data.unassignedItems : []),
    [data?.unassignedItems],
  );

  const [selectedByItemId, setSelectedByItemId] = useState({});
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [selectedRange, setSelectedRange] = useState('7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState('');
  const [rangeRows, setRangeRows] = useState(null);

  const fetchWorkloadByRange = useCallback(
    async (rangeConfig) => {
      setRangeLoading(true);
      setRangeError('');
      try {
        const response = await getDashboardTeamWorkload(rangeConfig);
        const rows = Array.isArray(response?.items) ? response.items : [];
        setRangeRows(rows);
      } catch (error) {
        setRangeError(getErrorMessage(error));
      } finally {
        setRangeLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedRange === 'custom') {
      return;
    }

    void fetchWorkloadByRange({
      range: selectedRange,
    });
  }, [fetchWorkloadByRange, selectedRange]);

  const rows = useMemo(() => {
    const baseRows = Array.isArray(rangeRows)
      ? rangeRows
      : (
        Array.isArray(data?.byUser)
          ? data.byUser
          : (Array.isArray(data?.openChecklistByUser)
            ? data.openChecklistByUser
              .filter((entry) => entry.userId !== 'unassigned')
              .map((entry) => ({
                userId: entry.userId,
                name: entry.name,
                assignedOpen: entry.count,
                completedInRange: 0,
                overdue: 0,
              }))
            : [])
      );

    return [...baseRows].sort((left, right) => {
      if ((right.assignedOpen || 0) !== (left.assignedOpen || 0)) {
        return (right.assignedOpen || 0) - (left.assignedOpen || 0);
      }
      if ((right.completedInRange || 0) !== (left.completedInRange || 0)) {
        return (right.completedInRange || 0) - (left.completedInRange || 0);
      }
      return String(left.name || '').localeCompare(String(right.name || ''), 'it');
    });
  }, [data?.byUser, rangeRows]);

  const handleApplyCustomRange = async () => {
    if (!customFrom || !customTo) {
      toast.info('Seleziona data inizio e fine');
      return;
    }

    await fetchWorkloadByRange({
      range: 'custom',
      from: new Date(`${customFrom}T00:00:00.000Z`).toISOString(),
      to: new Date(`${customTo}T23:59:59.999Z`).toISOString(),
    });
  };

  const handleAssign = async (item) => {
    const assignedToUserId = selectedByItemId[item.itemId];
    if (!assignedToUserId) {
      toast.info('Seleziona prima un membro del team');
      return;
    }

    setUpdatingItemId(item.itemId);
    try {
      await assignChecklistItem({
        instanceId: item.instanceId,
        itemInstanceId: item.itemId,
        assignedToUserId,
      });
      toast.success('Checklist assegnata');
      setSelectedByItemId((current) => {
        const next = { ...current };
        delete next[item.itemId];
        return next;
      });
      if (typeof onRefreshRequested === 'function') {
        await onRefreshRequested();
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUpdatingItemId(null);
    }
  };

  return (
    <WidgetCard
      title={title}
      subtitle="Carico checklist aperte per membro"
      icon={Users2}
    >
      <div className="mb-3 space-y-2 rounded-xl border border-cardBorder p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedRange} onChange={(event) => setSelectedRange(event.target.value)} className="w-full sm:w-[180px]">
            <option value="7">Ultimi 7 giorni</option>
            <option value="30">Ultimi 30 giorni</option>
            <option value="custom">Range personalizzato</option>
          </Select>

          {selectedRange === 'custom' ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <input
                type="date"
                className="form-control"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
              <input
                type="date"
                className="form-control"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => void handleApplyCustomRange()}>
                Applica
              </Button>
            </div>
          ) : null}
        </div>

        {rangeError ? (
          <p className="mb-0 text-xs text-destructive">{rangeError}</p>
        ) : null}
      </div>

      {loading || rangeLoading ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : null}

      {!loading && !rangeLoading && rows.length === 0 ? (
        <WidgetEmptyState icon={Users2} message="Nessun carico operativo aperto." />
      ) : null}

      {!loading && !rangeLoading && rows.length > 0 ? (
        <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
          {rows.map((row) => (
            <div
              key={row.userId}
              className="rounded-xl border border-cardBorder px-3 py-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{row.name || 'Utente'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">OPEN: {row.assignedOpen || 0}</Badge>
                <Badge variant="secondary">COMPLETED: {row.completedInRange || 0}</Badge>
                <Badge variant={(row.overdue || 0) > 0 ? 'destructive' : 'outline'}>
                  OVERDUE: {row.overdue || 0}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && canAssignChecklistItems ? (
        <div className="mt-4 space-y-2 border-t border-cardBorder pt-3">
          <p className="mb-0 text-xs font-medium uppercase tracking-wide text-textMuted">
            Checklist non assegnate
          </p>

          {assignableUsers.length === 0 ? (
            <p className="mb-0 text-sm text-textMuted">
              Nessun membro attivo disponibile per assegnazione.
            </p>
          ) : null}

          {assignableUsers.length > 0 && unassignedItems.length === 0 ? (
            <p className="mb-0 text-sm text-textMuted">Nessuna checklist aperta senza assegnatario.</p>
          ) : null}

          {assignableUsers.length > 0 && unassignedItems.length > 0 ? (
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {unassignedItems.map((item) => (
                <div key={item.itemId} className="space-y-2 rounded-xl border border-cardBorder px-3 py-3">
                  <div className="space-y-1">
                    <p className="mb-0 text-sm font-medium text-text">{item.title}</p>
                    <p className="mb-0 text-xs text-textMuted">
                      {item.projectName || 'Progetto non disponibile'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      value={selectedByItemId[item.itemId] || ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSelectedByItemId((current) => ({
                          ...current,
                          [item.itemId]: value,
                        }));
                      }}
                      disabled={updatingItemId === item.itemId}
                      className="w-full"
                    >
                      <option value="">Seleziona membro</option>
                      {assignableUsers.map((user) => (
                        <option key={user.userId} value={user.userId}>
                          {user.name}
                        </option>
                      ))}
                    </Select>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleAssign(item)}
                      disabled={updatingItemId === item.itemId || !selectedByItemId[item.itemId]}
                    >
                      Assegna
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </WidgetCard>
  );
};

export default TeamWorkloadWidget;
