import { apiGet } from './apiClient';
import { readSession, writeSession } from '../lib/session';

export const fetchWorkspaceAccess = async () => {
    const session = readSession();
    if (!session?.accessToken) {
        throw new Error('Sessione non disponibile. Effettua il login.');
    }

    const result = await apiGet('/auth/me');
    if (result?.token || result?.workspace?.id || result?.workspace?.slug) {
        writeSession({
            accessToken: result?.token || session.accessToken,
            userId: result?.user?.id || session.userId,
            userEmail: result?.user?.email || session.userEmail,
            userRole: result?.user?.role || session.userRole,
            workspaceId: result?.workspace?.id || session.workspaceId,
            workspaceSlug: result?.workspace?.slug || session.workspaceSlug,
        });
    }

    return result;
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
