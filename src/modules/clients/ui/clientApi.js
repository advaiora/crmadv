import { apiFetch } from '../../../lib/apiFetch';
import { ApiRequestError, apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/apiClient';
import { getDevAuthHeaders } from '../../../utils/devAuthSession';

const getHeaders = () => {
    const headers = getDevAuthHeaders();
    if (Object.keys(headers).length === 0) {
        throw new Error('Sessione non disponibile. Effettua il login.');
    }

    return headers;
};

const withQuery = (path, params) => {
    const query = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            return;
        }

        query.set(key, String(value));
    });

    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
};

const parseExportFilename = (contentDisposition) => {
    if (typeof contentDisposition !== 'string') {
        return 'clients-export.csv';
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const asciiMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    if (asciiMatch?.[1]) {
        return asciiMatch[1];
    }

    return 'clients-export.csv';
};

const buildApiErrorFromResponse = async (response) => {
    const fallbackMessage = `Request failed with status ${response.status}`;
    const responseText = await response.text();

    if (!responseText) {
        return new ApiRequestError(fallbackMessage, { status: response.status });
    }

    try {
        const payload = JSON.parse(responseText);
        return new ApiRequestError(payload?.error?.message || fallbackMessage, {
            status: response.status,
            code: payload?.error?.code,
            details: payload?.error?.details,
        });
    } catch (_error) {
        return new ApiRequestError(responseText, {
            status: response.status,
            code: 'NON_JSON_ERROR_RESPONSE',
        });
    }
};

export const listClients = (params) =>
    apiGet(withQuery('/clients', params), {
        headers: getHeaders(),
    });

export const getClient = (clientId) =>
    apiGet(`/clients/${clientId}`, {
        headers: getHeaders(),
    });

export const createClient = (payload) =>
    apiPost('/clients', payload, {
        headers: getHeaders(),
    });

export const updateClient = (clientId, payload) =>
    apiPatch(`/clients/${clientId}`, payload, {
        headers: getHeaders(),
    });

export const deleteClient = (clientId) =>
    apiDelete(`/clients/${clientId}`, {
        headers: getHeaders(),
    });

export const importClients = (payload) =>
    apiPost('/clients/import', payload, {
        headers: getHeaders(),
    });

export const exportClients = async (params) => {
    const response = await apiFetch(withQuery('/clients/export', params), {
        method: 'GET',
        headers: {
            ...getHeaders(),
            Accept: 'text/csv',
        },
    });

    if (!response.ok) {
        throw await buildApiErrorFromResponse(response);
    }

    const blob = await response.blob();
    const filename = parseExportFilename(response.headers.get('content-disposition'));

    return {
        blob,
        filename,
    };
};
