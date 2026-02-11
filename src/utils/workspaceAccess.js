import { apiGet } from './apiClient';
import { getDevAuthHeaders } from './devAuthSession';

export const fetchWorkspaceAccess = async () => {
    const headers = getDevAuthHeaders();
    if (Object.keys(headers).length === 0) {
        throw new Error('Sessione non disponibile. Effettua il login.');
    }

    return apiGet('/me', { headers });
};

export const hasModuleEnabled = (access, moduleKey) => {
    if (!access || !Array.isArray(access.enabledModules)) {
        return false;
    }

    return access.enabledModules.includes(moduleKey);
};

export const hasPermission = (access, permissionKey) => {
    if (!access || !Array.isArray(access.permissions)) {
        return false;
    }

    return access.permissions.includes(permissionKey);
};
