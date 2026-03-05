import { useCallback, useEffect, useState } from 'react';
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
  const [state, setState] = useState(() => ({
    data: [],
    loading: true,
    error: null,
  }));
  const [reloadKey, setReloadKey] = useState(0);
  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => {
      if (current.loading && current.error === null) {
        return current;
      }
      return {
        ...current,
        loading: true,
        error: null,
      };
    });

    listChecklistTemplates(params, { signal: controller.signal })
      .then((data) => {
        setState({
          data,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data: [],
          loading: false,
          error,
        });
      });

    return () => controller.abort();
  }, [paramsKey, reloadKey]);

  return {
    ...state,
    refetch,
  };
};

export const useChecklistTemplate = (templateId) => {
  const [state, setState] = useState(() => createIdleState(null));
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!templateId) {
      return undefined;
    }

    const controller = new AbortController();
    setState((current) => {
      if (current.loading && current.error === null) {
        return current;
      }
      return {
        ...current,
        loading: true,
        error: null,
      };
    });

    getChecklistTemplate(templateId, { signal: controller.signal })
      .then((data) => {
        setState({
          data,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        setState({
          data: null,
          loading: false,
          error,
        });
      });

    return () => controller.abort();
  }, [templateId, reloadKey]);

  if (!templateId) {
    return {
      ...createIdleState(null),
      refetch,
    };
  }

  return {
    ...state,
    refetch,
  };
};

export const useProjectChecklistInstances = (projectId, { includeItems = true } = {}) => {
  const [state, setState] = useState(() => createIdleState([]));
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    const controller = new AbortController();
    setState((current) => {
      if (current.loading && current.error === null) {
        return current;
      }
      return {
        ...current,
        loading: true,
        error: null,
      };
    });

    listProjectChecklistInstances(projectId, { includeItems, signal: controller.signal })
      .then((data) => {
        setState({
          data,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data: [],
          loading: false,
          error,
        });
      });

    return () => controller.abort();
  }, [includeItems, projectId, reloadKey]);

  if (!projectId) {
    return {
      ...createIdleState([]),
      refetch,
    };
  }

  return {
    ...state,
    refetch,
  };
};

export const useChecklistAssignableUsers = ({ enabled = true } = {}) => {
  const [state, setState] = useState(() => createIdleState([]));
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState(createIdleState([]));
      return undefined;
    }

    const controller = new AbortController();
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    listChecklistAssignableUsers({ signal: controller.signal })
      .then((data) => {
        setState({
          data,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data: [],
          loading: false,
          error,
        });
      });

    return () => controller.abort();
  }, [enabled, reloadKey]);

  return {
    ...state,
    refetch,
  };
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
