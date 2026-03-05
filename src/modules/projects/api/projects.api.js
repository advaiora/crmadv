import { apiFetch } from '../../../lib/apiFetch';
import { getDevAuthHeaders } from '../../../utils/devAuthSession';

export class ApiError extends Error {
    constructor(message, { status, code, details } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export const isApiError = (error) => error instanceof ApiError;

const getRequiredHeaders = () => {
    const headers = getDevAuthHeaders();
    if (!headers.Authorization) {
        throw new ApiError('Sessione non disponibile. Effettua il login.', {
            status: 401,
            code: 'UNAUTHORIZED',
        });
    }

    if (!headers['x-workspace-id'] && !headers['x-workspace-slug']) {
        throw new ApiError('Workspace non disponibile nella sessione.', {
            status: 400,
            code: 'WORKSPACE_HEADER_REQUIRED',
        });
    }

    return headers;
};

const mapStatusToCode = (status) => {
    if (status === 400) {
        return 'BAD_REQUEST';
    }
    if (status === 401) {
        return 'UNAUTHORIZED';
    }
    if (status === 403) {
        return 'FORBIDDEN';
    }
    if (status === 404) {
        return 'NOT_FOUND';
    }
    if (status === 409) {
        return 'CONFLICT';
    }
    return 'API_ERROR';
};

const parseJsonSafe = async (response) => {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (_error) {
        throw new ApiError('API response is not valid JSON', {
            status: response.status,
            code: 'INVALID_JSON_RESPONSE',
            details: { text },
        });
    }
};

const normalizeSuccessPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
        return payload.data;
    }

    return payload;
};

export const projectsFetch = async (
    path,
    { method = 'GET', headers = {}, body, signal } = {},
) => {
    const authHeaders = getRequiredHeaders();
    const isFormDataBody = body instanceof FormData;

    const response = await apiFetch(path, {
        method,
        signal,
        headers: {
            Accept: 'application/json',
            ...(body !== undefined && !isFormDataBody ? { 'Content-Type': 'application/json' } : {}),
            ...authHeaders,
            ...headers,
        },
        ...(body !== undefined
            ? {
                body: isFormDataBody ? body : JSON.stringify(body),
            }
            : {}),
    });

    if (response.status === 204) {
        return null;
    }

    const payload = await parseJsonSafe(response);

    if (!response.ok) {
        throw new ApiError(
            payload?.error?.message || `Request failed with status ${response.status}`,
            {
                status: response.status,
                code: payload?.error?.code || mapStatusToCode(response.status),
                details: payload?.error?.details,
            },
        );
    }

    return normalizeSuccessPayload(payload);
};

const withQuery = (path, params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            return;
        }

        query.set(key, String(value));
    });

    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
};

const normalizeList = (payload) => {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (Array.isArray(payload?.items)) {
        return payload.items;
    }
    if (Array.isArray(payload?.categories)) {
        return payload.categories;
    }
    if (Array.isArray(payload?.stages)) {
        return payload.stages;
    }
    if (Array.isArray(payload?.projects)) {
        return payload.projects;
    }
    return [];
};

const normalizeProjectPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }
    if (payload.project) {
        return payload.project;
    }
    return payload;
};

const normalizeCategoryPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    if (payload.category) {
        return payload.category;
    }

    return payload;
};

const normalizeStagePayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    if (payload.stage) {
        return payload.stage;
    }

    return payload;
};

const normalizeHistoryList = (payload) => {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    if (Array.isArray(payload?.history)) {
        return payload.history;
    }

    if (Array.isArray(payload?.stageHistory)) {
        return payload.stageHistory;
    }

    if (Array.isArray(payload?.movements)) {
        return payload.movements;
    }

    return [];
};

const projectHistoryEndpoints = [
    '/projects/:id/history',
    '/projects/:id/stage-history',
];

let resolvedProjectHistoryEndpoint = undefined;
let resolvedStageCreateMode = undefined;
let resolvedStageReorderMode = undefined;

export const listCategories = async ({ signal } = {}) => {
    const result = await projectsFetch('/projects/categories', {
        method: 'GET',
        signal,
    });

    return normalizeList(result);
};

export const listStages = async (categoryId, { signal } = {}) => {
    const result = await projectsFetch(`/projects/categories/${categoryId}/stages`, {
        method: 'GET',
        signal,
    });

    return normalizeList(result);
};

export const listProjects = async (params, { signal } = {}) => {
    const result = await projectsFetch(withQuery('/projects', params), {
        method: 'GET',
        signal,
    });

    return normalizeList(result);
};

export const createCategory = async (input) => {
    const result = await projectsFetch('/projects/categories', {
        method: 'POST',
        body: input,
    });

    return normalizeCategoryPayload(result);
};

export const updateCategory = async (id, patch) => {
    const result = await projectsFetch(`/projects/categories/${id}`, {
        method: 'PATCH',
        body: patch,
    });

    return normalizeCategoryPayload(result);
};

export const deleteCategory = async (id) => {
    const result = await projectsFetch(`/projects/categories/${id}`, {
        method: 'DELETE',
    });

    return result || { ok: true };
};

export const getProject = async (id, { signal } = {}) => {
    const result = await projectsFetch(`/projects/${id}`, {
        method: 'GET',
        signal,
    });

    return normalizeProjectPayload(result);
};

export const createProject = async (input) => {
    const result = await projectsFetch('/projects', {
        method: 'POST',
        body: input,
    });

    return normalizeProjectPayload(result);
};

export const updateProject = async (id, patch) => {
    const result = await projectsFetch(`/projects/${id}`, {
        method: 'PATCH',
        body: patch,
    });

    return normalizeProjectPayload(result);
};

export const createStage = async (categoryId, input) => {
    if (resolvedStageCreateMode === 'global') {
        const result = await projectsFetch('/projects/stages', {
            method: 'POST',
            body: {
                categoryId,
                ...input,
            },
        });

        return normalizeStagePayload(result);
    }

    if (resolvedStageCreateMode === 'scoped') {
        const result = await projectsFetch(`/projects/categories/${categoryId}/stages`, {
            method: 'POST',
            body: input,
        });

        return normalizeStagePayload(result);
    }

    try {
        const result = await projectsFetch(`/projects/categories/${categoryId}/stages`, {
            method: 'POST',
            body: input,
        });

        resolvedStageCreateMode = 'scoped';
        return normalizeStagePayload(result);
    } catch (error) {
        if (!isApiError(error) || error.status !== 404) {
            throw error;
        }
    }

    const fallbackResult = await projectsFetch('/projects/stages', {
        method: 'POST',
        body: {
            categoryId,
            ...input,
        },
    });
    resolvedStageCreateMode = 'global';
    return normalizeStagePayload(fallbackResult);
};

export const updateStage = async (stageId, patch) => {
    const result = await projectsFetch(`/projects/stages/${stageId}`, {
        method: 'PATCH',
        body: patch,
    });

    return normalizeStagePayload(result);
};

export const deleteStage = async (stageId) => {
    const result = await projectsFetch(`/projects/stages/${stageId}`, {
        method: 'DELETE',
    });

    return result || { ok: true };
};

export const reorderStages = async (categoryId, orderedStageIds) => {
    if (resolvedStageReorderMode === 'global') {
        const result = await projectsFetch('/projects/stages/reorder', {
            method: 'POST',
            body: {
                categoryId,
                stageIds: orderedStageIds,
            },
        });

        return result || { ok: true };
    }

    if (resolvedStageReorderMode === 'scoped') {
        const result = await projectsFetch(`/projects/categories/${categoryId}/stages/reorder`, {
            method: 'POST',
            body: {
                stageIds: orderedStageIds,
            },
        });

        return result || { ok: true };
    }

    try {
        const result = await projectsFetch(`/projects/categories/${categoryId}/stages/reorder`, {
            method: 'POST',
            body: {
                stageIds: orderedStageIds,
            },
        });

        resolvedStageReorderMode = 'scoped';
        return result || { ok: true };
    } catch (error) {
        if (!isApiError(error) || error.status !== 404) {
            throw error;
        }
    }

    const fallbackResult = await projectsFetch('/projects/stages/reorder', {
        method: 'POST',
        body: {
            categoryId,
            stageIds: orderedStageIds,
        },
    });
    resolvedStageReorderMode = 'global';
    return fallbackResult || { ok: true };
};

export const deleteProject = async (id) => {
    await projectsFetch(`/projects/${id}`, {
        method: 'DELETE',
    });
};

export const getProjectStageHistory = async (id, { signal } = {}) => {
    if (resolvedProjectHistoryEndpoint === null) {
        return null;
    }

    if (typeof resolvedProjectHistoryEndpoint === 'string') {
        try {
            const result = await projectsFetch(
                resolvedProjectHistoryEndpoint.replace(':id', id),
                {
                    method: 'GET',
                    signal,
                },
            );

            return normalizeHistoryList(result);
        } catch (error) {
            if (isApiError(error) && error.status === 404) {
                resolvedProjectHistoryEndpoint = null;
                return null;
            }

            throw error;
        }
    }

    for (const endpointTemplate of projectHistoryEndpoints) {
        try {
            const result = await projectsFetch(endpointTemplate.replace(':id', id), {
                method: 'GET',
                signal,
            });

            resolvedProjectHistoryEndpoint = endpointTemplate;
            return normalizeHistoryList(result);
        } catch (error) {
            if (isApiError(error) && error.status === 404) {
                continue;
            }

            throw error;
        }
    }

    resolvedProjectHistoryEndpoint = null;
    return null;
};

const normalizeMoveResponse = (payload) => {
    if (!payload) {
        return { ok: true };
    }

    if (payload.ok === true) {
        return payload;
    }

    if (payload.project) {
        return payload.project;
    }

    return payload;
};

export const moveProject = async (id, input) => {
    try {
        const result = await projectsFetch(`/projects/${id}/move`, {
            method: 'POST',
            body: input,
        });

        return normalizeMoveResponse(result);
    } catch (error) {
        // TODO: remove fallback once the move endpoint is finalized backend-side.
        if (!isApiError(error) || error.status !== 404) {
            throw error;
        }

        const fallbackResult = await projectsFetch(`/projects/${id}/move-stage`, {
            method: 'PATCH',
            body: {
                toStageId: input.toStageId,
                overrideGate: Boolean(input.overrideGate),
                ...(input.overrideReason ? { overrideReason: input.overrideReason } : {}),
            },
        });

        return normalizeMoveResponse(fallbackResult);
    }
};
