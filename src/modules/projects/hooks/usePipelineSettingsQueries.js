import { useCallback, useEffect, useState } from 'react';
import {
    createCategory,
    createStage,
    deleteCategory,
    deleteStage,
    listCategories,
    listStages,
    reorderStages,
    updateCategory,
    updateStage,
} from '../api/projects.api';

const createIdleListState = () => ({
    data: [],
    loading: false,
    error: null,
});

const useListQuery = (loader, { enabled = true, deps = [] } = {}) => {
    const [state, setState] = useState(() => ({
        data: [],
        loading: enabled,
        error: null,
    }));
    const [reloadKey, setReloadKey] = useState(0);

    const refetch = useCallback(() => {
        setReloadKey((current) => current + 1);
    }, []);

    useEffect(() => {
        if (!enabled) {
            setState(createIdleListState());
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
                    data: Array.isArray(data) ? data : [],
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
    }, [enabled, loader, reloadKey, ...deps]);

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

export const usePipelineCategories = () => {
    const loader = useCallback(
        ({ signal }) => listCategories({ signal }),
        [],
    );

    return useListQuery(loader, { enabled: true, deps: [] });
};

export const usePipelineStages = (categoryId) => {
    const loader = useCallback(
        ({ signal }) => listStages(categoryId, { signal }),
        [categoryId],
    );

    return useListQuery(loader, { enabled: Boolean(categoryId), deps: [categoryId] });
};

export const useCreateCategory = () => useMutationAction((input) => createCategory(input));
export const useUpdateCategory = () => useMutationAction((id, patch) => updateCategory(id, patch));
export const useDeleteCategory = () => useMutationAction((id) => deleteCategory(id));

export const useCreateStage = () => useMutationAction((categoryId, input) => createStage(categoryId, input));
export const useUpdateStage = () => useMutationAction((stageId, patch) => updateStage(stageId, patch));
export const useDeleteStage = () => useMutationAction((stageId) => deleteStage(stageId));

export const useReorderStages = () => useMutationAction((categoryId, stageIds) => reorderStages(categoryId, stageIds));
