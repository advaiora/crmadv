import { useCallback, useEffect, useState } from 'react';
import { getProject, listCategories, listProjects, listStages } from '../api/projects.api';

const createIdleState = (initialData) => ({
    data: initialData,
    loading: false,
    error: null,
});

export const useCategories = () => {
    const [state, setState] = useState(() => ({
        data: [],
        loading: true,
        error: null,
    }));
    const [reloadKey, setReloadKey] = useState(0);

    const refetch = useCallback(() => {
        setReloadKey((current) => current + 1);
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        setState((current) => ({
            ...current,
            loading: true,
            error: null,
        }));

        listCategories({ signal: controller.signal })
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
    }, [reloadKey]);

    return {
        ...state,
        refetch,
    };
};

export const useStages = (categoryId) => {
    const [state, setState] = useState(() => createIdleState([]));
    const [reloadKey, setReloadKey] = useState(0);

    const refetch = useCallback(() => {
        setReloadKey((current) => current + 1);
    }, []);

    useEffect(() => {
        if (!categoryId) {
            setState(createIdleState([]));
            return undefined;
        }

        const controller = new AbortController();

        setState((current) => ({
            ...current,
            loading: true,
            error: null,
        }));

        listStages(categoryId, { signal: controller.signal })
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
    }, [categoryId, reloadKey]);

    return {
        ...state,
        refetch,
    };
};

export const useProjects = (categoryId, filters = {}) => {
    const [state, setState] = useState(() => createIdleState([]));
    const [reloadKey, setReloadKey] = useState(0);
    const filtersKey = JSON.stringify(filters || {});

    const refetch = useCallback(() => {
        setReloadKey((current) => current + 1);
    }, []);

    useEffect(() => {
        if (!categoryId) {
            setState(createIdleState([]));
            return undefined;
        }

        const controller = new AbortController();

        setState((current) => ({
            ...current,
            loading: true,
            error: null,
        }));

        listProjects(
            {
                categoryId,
                ...filters,
            },
            { signal: controller.signal },
        )
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
    }, [categoryId, filtersKey, reloadKey]);

    return {
        ...state,
        refetch,
    };
};

export const useProject = (projectId) => {
    const [state, setState] = useState(() => createIdleState(null));
    const [reloadKey, setReloadKey] = useState(0);

    const refetch = useCallback(() => {
        setReloadKey((current) => current + 1);
    }, []);

    useEffect(() => {
        if (!projectId) {
            setState(createIdleState(null));
            return undefined;
        }

        const controller = new AbortController();

        setState((current) => ({
            ...current,
            loading: true,
            error: null,
        }));

        getProject(projectId, { signal: controller.signal })
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
    }, [projectId, reloadKey]);

    return {
        ...state,
        refetch,
    };
};
