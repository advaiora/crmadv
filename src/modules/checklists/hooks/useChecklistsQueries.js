import { useCallback, useEffect, useRef, useState } from 'react';
import {
  archiveChecklistTemplate,
  assignChecklistItem,
  createChecklistTemplate,
  createChecklistTemplateItem,
  createProjectChecklistInstance,
  ensureProjectStageChecklistInstances,
  completeChecklistInstanceItem,
  deleteChecklistTemplatePermanently,
  deleteChecklistTemplateItem,
  getChecklistTemplate,
  listChecklistAssignableUsers,
  listStageChecklistRules,
  listChecklistTemplates,
  listProjectChecklistInstances,
  markChecklistItemNotApplicable,
  replaceStageChecklistRules,
  reorderChecklistTemplateItems,
  resetChecklistItem,
  updateChecklistItemState,
  updateChecklistTemplate,
  updateChecklistTemplateItem,
} from '../api/checklists.api';

const createIdleState = (initialData) => ({
  data: initialData,
  loading: false,
  error: null,
});

// La promessa di refetch si scioglie quando i dati (o l'errore) sono
// ARRIVATI, non quando la richiesta e' solo partita: chi fa
// `await refetch()` puo' contare su un elenco gia' aggiornato — e' cio'
// che permette di selezionare il memo appena creato senza che la
// validazione della selezione lo scarti perche' "non ancora in lista".
// Stesso contratto di usePipelineSettingsQueries (modulo projects).
// Se il componente si smonta prima della risposta, la promessa resta in
// sospeso apposta: la continuazione non deve girare su uno stato morto.
// A query spenta (enabled falso) la promessa si scioglie comunque, con lo
// stato a riposo: niente attese appese sui rami disabilitati.
// Limite noto del contratto: un refetch chiesto MENTRE un caricamento e'
// gia' in volo viene sciolto da QUEL caricamento (dati piu' vecchi della
// richiesta). Oggi nessun chiamante sovrappone azioni; se succedesse,
// servirebbe legare ogni resolver al proprio giro di reloadKey.
const useChecklistQuery = (loader, { enabled = true, initialData = null } = {}) => {
  const initialDataRef = useRef(initialData);
  const [state, setState] = useState(() => ({
    data: initialDataRef.current,
    loading: enabled,
    error: null,
  }));
  const [reloadKey, setReloadKey] = useState(0);
  const pendingRefetchesRef = useRef([]);

  const settlePendingRefetches = useCallback(() => {
    const pending = pendingRefetchesRef.current;
    pendingRefetchesRef.current = [];
    pending.forEach((resolve) => resolve());
  }, []);

  const refetch = useCallback(() => {
    return new Promise((resolve) => {
      pendingRefetchesRef.current.push(resolve);
      setReloadKey((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState(createIdleState(initialDataRef.current));
      settlePendingRefetches();
      return undefined;
    }

    const controller = new AbortController();

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    loader({ signal: controller.signal })
      .then((data) => {
        setState({
          data,
          loading: false,
          error: null,
        });
        settlePendingRefetches();
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data: initialDataRef.current,
          loading: false,
          error,
        });
        settlePendingRefetches();
      });

    return () => controller.abort();
  }, [enabled, loader, reloadKey, settlePendingRefetches]);

  return {
    ...state,
    refetch,
  };
};

const useMutationAction = (action) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const mutate = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        return await action(...args);
      } catch (mutationError) {
        setError(mutationError);
        throw mutationError;
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  return {
    mutate,
    loading,
    error,
    reset,
  };
};

export const useChecklistTemplates = (params = {}) => {
  // La chiave serializzata e' l'identita' dei parametri: il loader riparte
  // solo quando cambia davvero il contenuto, non l'oggetto letterale.
  const paramsKey = JSON.stringify(params);
  const loader = useCallback(
    ({ signal }) => listChecklistTemplates(JSON.parse(paramsKey ?? '{}'), { signal }),
    [paramsKey],
  );

  return useChecklistQuery(loader, { enabled: true, initialData: [] });
};

export const useChecklistTemplate = (templateId) => {
  const loader = useCallback(
    ({ signal }) => getChecklistTemplate(templateId, { signal }),
    [templateId],
  );

  return useChecklistQuery(loader, { enabled: Boolean(templateId), initialData: null });
};

export const useProjectChecklistInstances = (projectId, { includeItems = true } = {}) => {
  const loader = useCallback(
    ({ signal }) => listProjectChecklistInstances(projectId, { includeItems, signal }),
    [includeItems, projectId],
  );

  return useChecklistQuery(loader, { enabled: Boolean(projectId), initialData: [] });
};

export const useChecklistAssignableUsers = ({ enabled = true } = {}) => {
  const loader = useCallback(
    ({ signal }) => listChecklistAssignableUsers({ signal }),
    [],
  );

  return useChecklistQuery(loader, { enabled, initialData: [] });
};

export const useCreateChecklistTemplate = () => useMutationAction((input) => createChecklistTemplate(input));
export const useUpdateChecklistTemplate = () => useMutationAction((templateId, patch) => updateChecklistTemplate(templateId, patch));
export const useArchiveChecklistTemplate = () => useMutationAction((templateId) => archiveChecklistTemplate(templateId));
export const useDeleteChecklistTemplatePermanently = () =>
  useMutationAction((templateId) => deleteChecklistTemplatePermanently(templateId));
export const useCreateChecklistTemplateItem = () => useMutationAction((templateId, input) => createChecklistTemplateItem(templateId, input));
export const useUpdateChecklistTemplateItem = () => useMutationAction((templateId, itemId, patch) => updateChecklistTemplateItem(templateId, itemId, patch));
export const useDeleteChecklistTemplateItem = () => useMutationAction((templateId, itemId) => deleteChecklistTemplateItem(templateId, itemId));
export const useReorderChecklistTemplateItems = () =>
  useMutationAction((templateId, orderedItemIds) => reorderChecklistTemplateItems(templateId, orderedItemIds));
export const useCreateProjectChecklistInstance = () => useMutationAction((projectId, input) => createProjectChecklistInstance(projectId, input));
export const useEnsureProjectStageChecklistInstances = () =>
  useMutationAction((projectId, stageId) => ensureProjectStageChecklistInstances(projectId, stageId));
export const useCompleteChecklistInstanceItem = () =>
  useMutationAction((instanceId, itemInstanceId, input) => completeChecklistInstanceItem(instanceId, itemInstanceId, input));
export const useUpdateChecklistInstanceItemState = () => useMutationAction((itemId, input) => updateChecklistItemState(itemId, input));
export const useMarkChecklistInstanceItemNotApplicable = () =>
  useMutationAction((itemId, input) => markChecklistItemNotApplicable(itemId, input));
export const useResetChecklistInstanceItem = () =>
  useMutationAction((itemId) => resetChecklistItem(itemId));
export const useAssignChecklistInstanceItem = () =>
  useMutationAction((payload) => assignChecklistItem(payload));
export const useListStageChecklistRules = () =>
  useMutationAction((categoryId, stageId) => listStageChecklistRules(categoryId, stageId));
export const useReplaceStageChecklistRules = () =>
  useMutationAction((categoryId, stageId, rules) => replaceStageChecklistRules(categoryId, stageId, rules));
