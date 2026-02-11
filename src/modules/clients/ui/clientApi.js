import { apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/apiClient';
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
