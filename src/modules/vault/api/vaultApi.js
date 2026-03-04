import { apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/apiClient';

const vaultRequestOptions = {
    credentials: 'include',
    cache: 'no-store',
};

const withQuery = (path, params = {}) => {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            return;
        }

        searchParams.set(key, String(value));
    });

    const queryString = searchParams.toString();
    return queryString ? `${path}?${queryString}` : path;
};

export const listVaultItems = (params = {}) =>
    apiGet(withQuery('/vault', params), vaultRequestOptions);

export const listVaultClients = (params = {}) =>
    apiGet(withQuery('/vault/lookups/clients', params), vaultRequestOptions);

export const getVaultStatus = () =>
    apiGet('/vault/status', vaultRequestOptions);

export const setupVaultWorkspacePassword = (password) =>
    apiPost(
        '/vault/setup',
        { password },
        vaultRequestOptions,
    );

export const unlockVaultWorkspace = (password) =>
    apiPost(
        '/vault/unlock',
        { password },
        {
            ...vaultRequestOptions,
            expectData: false,
        },
    );

export const lockVaultWorkspace = () =>
    apiPost(
        '/vault/lock',
        undefined,
        {
            ...vaultRequestOptions,
            expectData: false,
        },
    );

export const createVaultItem = (payload) =>
    apiPost('/vault', payload, vaultRequestOptions);

export const updateVaultItem = (itemId, payload) =>
    apiPatch(`/vault/${itemId}`, payload, vaultRequestOptions);

export const deleteVaultItem = (itemId) =>
    apiDelete(`/vault/${itemId}`, vaultRequestOptions);

export const stepUpVaultReveal = (password) =>
    apiPost(
        '/vault/stepup',
        {
            purpose: 'vault.reveal',
            ...(password ? { password } : {}),
        },
        {
            ...vaultRequestOptions,
            expectData: false,
        },
    );

export const revealVaultItem = (itemId) =>
    apiPost(
        `/vault/${itemId}/reveal`,
        undefined,
        vaultRequestOptions,
    );
