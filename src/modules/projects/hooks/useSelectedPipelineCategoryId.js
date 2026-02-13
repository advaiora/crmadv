import { useCallback, useEffect, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

const STORAGE_KEY = 'projects.pipelineCategoryId';
const QUERY_KEY = 'pipelineCategoryId';

const readStoredCategoryId = () => {
    if (typeof window === 'undefined') {
        return '';
    }

    return window.localStorage.getItem(STORAGE_KEY) || '';
};

const writeStoredCategoryId = (categoryId) => {
    if (typeof window === 'undefined') {
        return;
    }

    if (!categoryId) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
    }

    window.localStorage.setItem(STORAGE_KEY, categoryId);
};

export const useSelectedPipelineCategoryId = (categories = []) => {
    const history = useHistory();
    const location = useLocation();

    const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const categoryIdFromUrl = params.get(QUERY_KEY) || '';
    const categoryIdFromStorage = readStoredCategoryId();
    const availableIds = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);

    const setCategoryId = useCallback(
        (nextId) => {
            const nextParams = new URLSearchParams(location.search);

            if (nextId) {
                nextParams.set(QUERY_KEY, nextId);
            } else {
                nextParams.delete(QUERY_KEY);
            }

            history.replace({
                pathname: location.pathname,
                search: nextParams.toString(),
            });

            writeStoredCategoryId(nextId);
        },
        [history, location.pathname, location.search],
    );

    const categoryId = useMemo(() => {
        if (categoryIdFromUrl) {
            return categoryIdFromUrl;
        }

        if (categoryIdFromStorage) {
            return categoryIdFromStorage;
        }

        return '';
    }, [categoryIdFromStorage, categoryIdFromUrl]);

    useEffect(() => {
        if (!categories.length) {
            return;
        }

        if (categoryId && availableIds.has(categoryId)) {
            writeStoredCategoryId(categoryId);
            if (!categoryIdFromUrl) {
                setCategoryId(categoryId);
            }
            return;
        }

        const fallbackCategoryId = categories[0].id;
        setCategoryId(fallbackCategoryId);
    }, [availableIds, categories, categoryId, categoryIdFromUrl, setCategoryId]);

    return {
        categoryId: availableIds.has(categoryId) ? categoryId : '',
        setCategoryId,
    };
};
