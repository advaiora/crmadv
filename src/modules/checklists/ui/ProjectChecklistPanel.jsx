import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Loader2,
  PlayCircle,
  PlusCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { hasModuleEnabled, hasPermission } from '../../../utils/workspaceAccess';
import { isApiError } from '../api/checklists.api';
import {
  useChecklistTemplates,
  useCreateProjectChecklistInstance,
  useMarkChecklistInstanceItemNotApplicable,
  useProjectChecklistInstances,
  useUpdateChecklistInstanceItemState,
} from '../hooks/useChecklistsQueries';
import '../../../styles/css/checklists-ui.css';

const ITEM_STATE_OPTIONS = [
  { value: 'not_started', label: 'Non iniziato' },
  { value: 'in_progress', label: 'In corso' },
  { value: 'completed', label: 'Completato' },
  { value: 'not_applicable', label: 'Non applicabile' },
];

const MIN_NOT_APPLICABLE_REASON_LENGTH = 5;

const normalizeItemState = (state) => {
  if (state === 'pending') {
    return 'not_started';
  }
  return state;
};

const getItemStateLabel = (state) =>
  ITEM_STATE_OPTIONS.find((option) => option.value === state)?.label || state;

const isItemTerminal = (state) => state === 'completed' || state === 'not_applicable';

const hasItemEvidence = (item) => Boolean(item?.evidenceNote || item?.evidenceUrl);

const getErrorMessage = (error) => {
  if (!error) {
    return 'Errore inatteso';
  }
  if (isApiError(error)) {
    return `${error.message} (${error.code || error.status || 'API_ERROR'})`;
  }
  return error?.message || 'Errore inatteso';
};

const ItemStateIcon = ({ state }) => {
  if (state === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  }
  if (state === 'not_applicable') {
    return <Ban className="h-4 w-4 text-secondary" />;
  }
  if (state === 'in_progress') {
    return <PlayCircle className="h-4 w-4 text-warning" />;
  }
  return <CircleDashed className="h-4 w-4 text-textMuted" />;
};

const ChecklistInstanceCard = ({
  instance,
  canCompleteItem,
  onToggleItemDone,
  onToggleInProgress,
  onToggleNotApplicable,
  updatingItemId,
  currentStageId,
  showOnlyOpenItems,
}) => {
  const requiredItems = instance.items.filter((item) => item.isRequired);
  const completedItems = instance.items.filter((item) => isItemTerminal(normalizeItemState(item.state)));
  const completedRequiredItems = requiredItems.filter((item) =>
    isItemTerminal(normalizeItemState(item.state)),
  );
  const missingRequiredCount = Math.max(requiredItems.length - completedRequiredItems.length, 0);
  const completionPercent =
    requiredItems.length === 0
      ? 100
      : Math.round((completedRequiredItems.length / requiredItems.length) * 100);
  const visibleItems = showOnlyOpenItems
    ? instance.items.filter((item) => !isItemTerminal(normalizeItemState(item.state)))
    : instance.items;

  return (
    <Card className="border-cardBorder bg-bgSecondary/40 checklist-instance-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{instance.checklistTemplateName || 'Memo operativo'}</CardTitle>
            <CardDescription>
              Stage: <span className="font-medium">{instance.pipelineStageId}</span>
              {currentStageId && instance.pipelineStageId === currentStageId && (
                <span className="ms-2 checklists-current-stage-pill">
                  Stage corrente
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={missingRequiredCount > 0 ? 'destructive' : 'success'}>
              {missingRequiredCount > 0 ? 'Gate bloccato' : 'Gate pronto'}
            </Badge>
            <Badge variant="secondary">
              {completedItems.length}/{instance.items.length} completati
            </Badge>
          </div>
        </div>
        <div className="checklists-instance-meta">
          <span>{requiredItems.length} obbligatori</span>
          <span>{completionPercent}% obbligatori completati</span>
        </div>
        <div className="checklists-progress-track mt-2">
          <div
            className={`checklists-progress-fill ${missingRequiredCount > 0 ? 'is-warning' : 'is-ready'}`}
            style={{ width: `${Math.max(0, Math.min(100, completionPercent))}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {instance.items.length === 0 && (
          <p className="rounded-md border border-dashed border-cardBorder px-3 py-2 text-sm text-textMuted">
            Nessuno step disponibile.
          </p>
        )}

        {instance.items.length > 0 && visibleItems.length === 0 && showOnlyOpenItems && (
          <p className="rounded-md border border-dashed border-cardBorder px-3 py-2 text-sm text-textMuted">
            Nessuno step aperto in questo memo.
          </p>
        )}

        {visibleItems.map((item) => {
          const normalizedState = normalizeItemState(item.state);
          const stateLabel = getItemStateLabel(normalizedState);
          const isDone = normalizedState === 'completed';
          const isInProgress = normalizedState === 'in_progress';
          const isNotApplicable = normalizedState === 'not_applicable';
          return (
            <div
              key={item.id}
              className={`flex flex-col gap-2 rounded-md border border-cardBorder bg-card px-3 py-3 md:flex-row md:items-center md:justify-between checklist-project-item ${
                item.isRequired ? 'is-required' : ''
              } ${normalizedState === 'not_applicable' ? 'is-not-applicable' : ''}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ItemStateIcon state={normalizedState} />
                  <p className={`mb-0 text-sm font-medium text-text ${isDone ? 'line-through opacity-70' : ''}`}>
                    {item.title}
                  </p>
                  {item.isRequired ? <Badge variant="warning">Obbligatorio</Badge> : <Badge variant="outline">Facoltativo</Badge>}
                  <Badge variant={normalizedState === 'completed' ? 'success' : normalizedState === 'not_applicable' ? 'secondary' : 'outline'}>
                    {stateLabel}
                  </Badge>
                </div>
                {item.description && <p className="mt-1 mb-0 text-xs text-textMuted">{item.description}</p>}
                {item.requiresEvidenceSnapshot && (
                  <p className="mt-1 mb-0 text-xs text-textMuted">
                    Richiede evidenza (nota o URL) per il completamento.
                  </p>
                )}
                {item.notApplicableReason && (
                  <p className="mt-1 mb-0 text-xs text-secondary">
                    Non applicabile: {item.notApplicableReason}
                  </p>
                )}
                {item.evidenceNote && (
                  <p className="mt-1 mb-0 text-xs text-textMuted">
                    Evidenza nota: {item.evidenceNote}
                  </p>
                )}
                {item.evidenceUrl && (
                  <p className="mt-1 mb-0 text-xs text-textMuted">
                    Evidenza URL: {item.evidenceUrl}
                  </p>
                )}
              </div>

              <div className="w-full md:w-[240px]">
                {canCompleteItem ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between rounded-md border border-cardBorder bg-card px-3 py-2">
                      <label className="inline-flex items-center gap-2 text-sm checklists-checkbox-label">
                        <input
                          type="checkbox"
                          className="checklists-checkbox"
                          checked={isDone}
                          onChange={(event) => onToggleItemDone(item, event.target.checked)}
                          disabled={updatingItemId === item.id}
                          aria-label={`Segna lo step "${item.title}" come completato`}
                        />
                        <span className="font-medium">{isDone ? 'Fatto' : 'Da fare'}</span>
                      </label>
                      {updatingItemId === item.id && <Loader2 className="h-4 w-4 animate-spin text-textMuted" />}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isInProgress ? 'default' : 'outline'}
                        onClick={() => onToggleInProgress(item)}
                        disabled={updatingItemId === item.id}
                      >
                        In corso
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={isNotApplicable ? 'secondary' : 'outline'}
                        onClick={() => onToggleNotApplicable(item)}
                        disabled={updatingItemId === item.id}
                      >
                        N/A
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Badge variant={isItemTerminal(normalizedState) ? 'success' : 'secondary'}>
                    {stateLabel}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

const ProjectChecklistPanel = ({ project, access }) => {
  const checklistModuleEnabled = hasModuleEnabled(access, 'checklists');
  const canViewChecklists = hasPermission(access, 'checklists.view');
  const canCreateInstances = hasPermission(access, 'checklists.complete_item')
    || hasPermission(access, 'checklists.manage_templates')
    || hasPermission(access, 'checklists.create');
  const canCompleteItems = hasPermission(access, 'checklists.complete_item');

  const currentStageId = project?.stageId || project?.pipelineStageId || '';
  const checklistsQuery = useProjectChecklistInstances(project?.id, { includeItems: true });
  const templatesQuery = useChecklistTemplates();
  const createInstanceMutation = useCreateProjectChecklistInstance();
  const updateItemStateMutation = useUpdateChecklistInstanceItemState();
  const markNotApplicableMutation = useMarkChecklistInstanceItemNotApplicable();

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [transitionState, setTransitionState] = useState(null);
  const [showOnlyOpenItems, setShowOnlyOpenItems] = useState(false);

  const activeTemplates = useMemo(
    () => (templatesQuery.data || []).filter((template) => !template.isArchived),
    [templatesQuery.data],
  );

  const checklistInstances = useMemo(() => {
    const items = [...(checklistsQuery.data || [])];
    return items.sort((left, right) => {
      const leftIsCurrent = left.pipelineStageId === currentStageId ? 1 : 0;
      const rightIsCurrent = right.pipelineStageId === currentStageId ? 1 : 0;
      if (leftIsCurrent !== rightIsCurrent) {
        return rightIsCurrent - leftIsCurrent;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [checklistsQuery.data, currentStageId]);

  const currentStageTemplateIds = useMemo(
    () =>
      new Set(
        checklistInstances
          .filter((instance) => instance.pipelineStageId === currentStageId)
          .map((instance) => instance.checklistTemplateId),
      ),
    [checklistInstances, currentStageId],
  );

  const currentStageGateStatus = useMemo(() => {
    const stageInstances = checklistInstances.filter((instance) => instance.pipelineStageId === currentStageId);
    const missingRequiredItems = stageInstances.reduce((count, instance) => {
      const missingForInstance = (instance.items || []).reduce((instanceCount, item) => {
        const state = normalizeItemState(item.state);
        const isDone = state === 'completed' || state === 'not_applicable';
        return item.isRequired && !isDone ? instanceCount + 1 : instanceCount;
      }, 0);
      return count + missingForInstance;
    }, 0);

    return {
      stageInstancesCount: stageInstances.length,
      missingRequiredItems,
    };
  }, [checklistInstances, currentStageId]);

  const selectedTemplateAlreadyLinked = Boolean(
    selectedTemplateId && currentStageId && currentStageTemplateIds.has(selectedTemplateId),
  );

  React.useEffect(() => {
    if (activeTemplates.length === 0) {
      if (selectedTemplateId) {
        setSelectedTemplateId('');
      }
      return;
    }

    const isSelectedStillValid = activeTemplates.some((template) => template.id === selectedTemplateId);
    if (!isSelectedStillValid) {
      setSelectedTemplateId(activeTemplates[0].id);
    }
  }, [activeTemplates, selectedTemplateId]);

  if (!checklistModuleEnabled || !canViewChecklists) {
    return null;
  }

  const handleCreateInstance = async () => {
    if (!project?.id || !selectedTemplateId || !currentStageId) {
      return;
    }

    if (selectedTemplateAlreadyLinked) {
      toast.info('Questo memo e gia collegato allo stage corrente');
      return;
    }

    try {
      await createInstanceMutation.mutate(project.id, {
        checklistTemplateId: selectedTemplateId,
        pipelineStageId: currentStageId,
      });
      await checklistsQuery.refetch();
      toast.success('Memo associato al progetto');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const runStateTransition = async (input) => {
    const { item, nextState, evidenceNote, evidenceUrl, reason } = input;

    setUpdatingItemId(item.id);
    try {
      if (nextState === 'not_applicable') {
        await markNotApplicableMutation.mutate(item.id, { reason });
      } else {
        const payload = { state: nextState };
        if (nextState === 'completed') {
          payload.evidenceNote = evidenceNote || undefined;
          payload.evidenceUrl = evidenceUrl || undefined;
        }
        await updateItemStateMutation.mutate(item.id, payload);
      }
      await checklistsQuery.refetch();
      toast.success('Stato step aggiornato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleSelectItemState = (item, nextState) => {
    if (!canCompleteItems) {
      return;
    }

    const normalizedCurrent = normalizeItemState(item.state);
    if (normalizedCurrent === nextState) {
      return;
    }

    if (nextState === 'not_applicable') {
      setTransitionState({
        item,
        nextState,
        reason: item.notApplicableReason || '',
        evidenceNote: item.evidenceNote || '',
        evidenceUrl: item.evidenceUrl || '',
        error: '',
      });
      return;
    }

    if (nextState === 'completed' && item.requiresEvidenceSnapshot && !hasItemEvidence(item)) {
      setTransitionState({
        item,
        nextState,
        reason: '',
        evidenceNote: item.evidenceNote || '',
        evidenceUrl: item.evidenceUrl || '',
        error: '',
      });
      return;
    }

    void runStateTransition({ item, nextState });
  };

  const handleToggleItemDone = (item, shouldBeCompleted) => {
    if (!canCompleteItems) {
      return;
    }

    const nextState = shouldBeCompleted ? 'completed' : 'not_started';
    handleSelectItemState(item, nextState);
  };

  const handleToggleInProgress = (item) => {
    if (!canCompleteItems) {
      return;
    }

    const currentState = normalizeItemState(item.state);
    const nextState = currentState === 'in_progress' ? 'not_started' : 'in_progress';
    handleSelectItemState(item, nextState);
  };

  const handleToggleNotApplicable = (item) => {
    if (!canCompleteItems) {
      return;
    }

    const currentState = normalizeItemState(item.state);
    const nextState = currentState === 'not_applicable' ? 'not_started' : 'not_applicable';
    handleSelectItemState(item, nextState);
  };

  const handleConfirmTransition = async () => {
    if (!transitionState?.item?.id) {
      return;
    }

    const isNotApplicable = transitionState.nextState === 'not_applicable';
    const isCompleted = transitionState.nextState === 'completed';
    const reason = String(transitionState.reason || '').trim();
    const evidenceNote = String(transitionState.evidenceNote || '').trim();
    const evidenceUrl = String(transitionState.evidenceUrl || '').trim();

    if (isNotApplicable && reason.length < MIN_NOT_APPLICABLE_REASON_LENGTH) {
      setTransitionState((current) => ({
        ...current,
        error: `La motivazione deve avere almeno ${MIN_NOT_APPLICABLE_REASON_LENGTH} caratteri`,
      }));
      return;
    }

    if (
      isCompleted &&
      transitionState.item.requiresEvidenceSnapshot &&
      !evidenceNote &&
      !evidenceUrl
    ) {
      setTransitionState((current) => ({
        ...current,
        error: 'Inserisci almeno una evidenza (nota o URL) prima di completare',
      }));
      return;
    }

    await runStateTransition({
      item: transitionState.item,
      nextState: transitionState.nextState,
      reason: isNotApplicable ? reason : undefined,
      evidenceNote: evidenceNote || undefined,
      evidenceUrl: evidenceUrl || undefined,
    });

    setTransitionState(null);
  };

  return (
    <Card className="mt-4 border-cardBorder checklist-project-panel checklists-shell">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Memo Operativo</CardTitle>
            <CardDescription>
              Guida step-by-step per il team: consulta, esegui e spunta gli step.
            </CardDescription>
          </div>
          {canCreateInstances && (
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row">
              <Select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="sm:min-w-[220px]"
                disabled={templatesQuery.loading || activeTemplates.length === 0 || !currentStageId}
              >
                {activeTemplates.length === 0 && <option value="">Nessun memo attivo</option>}
                {activeTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                className="whitespace-nowrap"
                onClick={() => void handleCreateInstance()}
                disabled={
                  !selectedTemplateId ||
                  !currentStageId ||
                  createInstanceMutation.loading ||
                  selectedTemplateAlreadyLinked
                }
              >
                {createInstanceMutation.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Associa memo
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="mb-0 text-xs text-textMuted">
            Usa la spunta per segnare gli step completati.
          </p>
          <Button
            type="button"
            size="sm"
            variant={showOnlyOpenItems ? 'secondary' : 'outline'}
            onClick={() => setShowOnlyOpenItems((current) => !current)}
          >
            {showOnlyOpenItems ? 'Mostra tutti gli step' : 'Solo step aperti'}
          </Button>
        </div>

        {selectedTemplateAlreadyLinked && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            Il memo selezionato e gia collegato allo stage corrente.
          </div>
        )}

        {currentStageId && currentStageGateStatus.stageInstancesCount > 0 && currentStageGateStatus.missingRequiredItems > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            Gate attivo: {currentStageGateStatus.missingRequiredItems} item obbligatori mancanti nello stage corrente.
          </div>
        )}

        {transitionState && (
          <div className="space-y-2 rounded-md border p-3 checklists-transition-box">
            <p className="mb-0 text-sm font-semibold text-text">
              {transitionState.nextState === 'not_applicable'
                ? `Segna "${transitionState.item.title}" come non applicabile`
                : `Completa "${transitionState.item.title}"`}
            </p>

            {transitionState.nextState === 'not_applicable' && (
              <Textarea
                rows={3}
                value={transitionState.reason}
                onChange={(event) =>
                  setTransitionState((current) => ({ ...current, reason: event.target.value, error: '' }))
                }
                placeholder="Motivazione non applicabile (obbligatoria)"
              />
            )}

            {transitionState.nextState === 'completed' && (
              <>
                <Textarea
                  rows={3}
                  value={transitionState.evidenceNote}
                  onChange={(event) =>
                    setTransitionState((current) => ({ ...current, evidenceNote: event.target.value, error: '' }))
                  }
                  placeholder="Nota evidenza (opzionale)"
                />
                <Input
                  value={transitionState.evidenceUrl}
                  onChange={(event) =>
                    setTransitionState((current) => ({ ...current, evidenceUrl: event.target.value, error: '' }))
                  }
                  placeholder="https://link-evidenza.example (opzionale)"
                />
              </>
            )}

            {transitionState.error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {transitionState.error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleConfirmTransition()}
                disabled={updatingItemId === transitionState.item.id}
              >
                {updatingItemId === transitionState.item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Conferma
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setTransitionState(null)}
                disabled={updatingItemId === transitionState.item.id}
              >
                Annulla
              </Button>
            </div>
          </div>
        )}

        {currentStageId ? null : (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            Questo progetto non ha uno stage associato. Imposta uno stage prima di collegare un memo.
          </div>
        )}

        {checklistsQuery.loading && (
          <div className="flex items-center gap-2 text-sm text-textMuted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Caricamento memo...
          </div>
        )}

        {checklistsQuery.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {getErrorMessage(checklistsQuery.error)}
          </div>
        )}

        {!checklistsQuery.loading && !checklistsQuery.error && checklistInstances.length === 0 && (
          <div className="rounded-md border border-dashed border-cardBorder bg-card p-4">
            <div className="flex items-center gap-2 text-text">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Nessun memo collegato a questo progetto/stage.</span>
            </div>
          </div>
        )}

        {!checklistsQuery.loading && !checklistsQuery.error && checklistInstances.length > 0 && (
          <div className="space-y-3">
            {checklistInstances.map((instance) => (
              <ChecklistInstanceCard
                key={instance.id}
                instance={instance}
                canCompleteItem={canCompleteItems}
                updatingItemId={updatingItemId}
                currentStageId={currentStageId}
                showOnlyOpenItems={showOnlyOpenItems}
                onToggleItemDone={(item, checked) => handleToggleItemDone(item, checked)}
                onToggleInProgress={(item) => handleToggleInProgress(item)}
                onToggleNotApplicable={(item) => handleToggleNotApplicable(item)}
              />
            ))}
          </div>
        )}

        {!canCompleteItems && (
          <div className="flex items-center gap-2 rounded-md border border-cardBorder bg-bgSecondary p-3 text-xs text-textMuted">
            <CheckCircle2 className="h-4 w-4" />
            Hai accesso in sola lettura ai memo di progetto.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectChecklistPanel;
