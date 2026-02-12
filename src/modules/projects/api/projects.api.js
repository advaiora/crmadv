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
    if (!headers['x-user-id'] || !headers['x-user-email']) {
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
            },
        });

        return normalizeMoveResponse(fallbackResult);
    }
};
