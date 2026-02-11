import { clearSession, readSession, writeSession } from '../lib/session';

const normalizeValue = (value) => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
};

export const getDevAuthSession = () => {
    const session = readSession();
    if (!session) {
        return null;
    }

    return {
        userId: session.userId,
        email: session.userEmail,
        role: session.userRole,
        ...(session.workspaceId ? { workspaceId: session.workspaceId } : {}),
        ...(session.workspaceSlug ? { workspaceSlug: session.workspaceSlug } : {}),
    };
};

export const setDevAuthSession = (nextSession) => {
    const current = getDevAuthSession();

    const userId = normalizeValue(nextSession?.userId) || current?.userId;
    const userEmail =
        normalizeValue(nextSession?.userEmail) ||
        normalizeValue(nextSession?.email) ||
        current?.email;
    const userRole =
        normalizeValue(nextSession?.userRole) ||
        normalizeValue(nextSession?.role) ||
        current?.role ||
        'member';

    const workspaceId = normalizeValue(nextSession?.workspaceId) || current?.workspaceId;
    const workspaceSlug =
        normalizeValue(nextSession?.workspaceSlug) ||
        current?.workspaceSlug ||
        normalizeValue(import.meta.env.VITE_DEV_WORKSPACE_SLUG) ||
        'demo';

    const saved = writeSession({
        userId,
        userEmail,
        userRole,
        workspaceId,
        workspaceSlug,
    });

    if (!saved) {
        return null;
    }

    return {
        userId: saved.userId,
        email: saved.userEmail,
        role: saved.userRole,
        ...(saved.workspaceId ? { workspaceId: saved.workspaceId } : {}),
        ...(saved.workspaceSlug ? { workspaceSlug: saved.workspaceSlug } : {}),
    };
};

export const clearDevAuthSession = () => {
    clearSession();
};

export const getDevAuthHeaders = () => {
    const session = readSession();
    if (!session) {
        return {};
    }
    const fallbackWorkspaceSlug = normalizeValue(import.meta.env.VITE_DEV_WORKSPACE_SLUG) || 'demo';

    return {
        'x-user-id': session.userId,
        'x-user-email': session.userEmail,
        ...(session.workspaceId
            ? { 'x-workspace-id': session.workspaceId }
            : session.workspaceSlug
                ? { 'x-workspace-slug': session.workspaceSlug }
                : fallbackWorkspaceSlug
                    ? { 'x-workspace-slug': fallbackWorkspaceSlug }
                : {}),
    };
};
