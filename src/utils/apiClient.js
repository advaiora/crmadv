import { apiFetch } from '../lib/apiFetch';

export class ApiRequestError extends Error {
    constructor(message, { status, code, details } = {}) {
        super(message);
        this.name = 'ApiRequestError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

const buildRequestBody = (body) => {
    if (body === undefined) {
        return undefined;
    }

    if (body instanceof FormData) {
        return body;
    }

    return JSON.stringify(body);
};

const parseResponsePayload = async (response) => {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new ApiRequestError('API response is not valid JSON', {
            status: response.status,
            code: 'INVALID_JSON_RESPONSE',
            details: { text },
        });
    }
};

const apiRequest = async (
    path,
    {
        method = 'GET',
        headers = {},
        body,
        signal,
        expectData = true,
        skipAuthHeaders = false,
        ...requestOptions
    } = {},
) => {
    const isFormDataBody = body instanceof FormData;
    const response = await apiFetch(path, {
        ...requestOptions,
        method,
        skipAuthHeaders,
        headers: {
            ...(body !== undefined && !isFormDataBody ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
        },
        ...(body !== undefined ? { body: buildRequestBody(body) } : {}),
        signal,
    });

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
        throw new ApiRequestError(
            payload?.error?.message || `Request failed with status ${response.status}`,
            {
                status: response.status,
                code: payload?.error?.code,
                details: payload?.error?.details,
            },
        );
    }

    if (!expectData) {
        return payload?.data ?? null;
    }

    if (!payload || typeof payload !== 'object' || !('data' in payload)) {
        throw new ApiRequestError('Malformed success payload from API', {
            status: response.status,
            code: 'INVALID_SUCCESS_PAYLOAD',
            details: payload,
        });
    }

    return payload.data;
};

export const apiGet = (path, options = {}) => apiRequest(path, { ...options, method: 'GET' });

export const apiPost = (path, body, options = {}) =>
    apiRequest(path, { ...options, method: 'POST', body });

export const apiPut = (path, body, options = {}) =>
    apiRequest(path, { ...options, method: 'PUT', body });

export const apiPatch = (path, body, options = {}) =>
    apiRequest(path, { ...options, method: 'PATCH', body });

export const apiDelete = (path, options = {}) =>
    apiRequest(path, { ...options, method: 'DELETE', expectData: false });
