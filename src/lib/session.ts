import {
    normalizeWorkspaceBranding,
    type WorkspaceBrandingState,
} from './workspaceBranding';

export type SessionState = {
    accessToken: string;
    userId: string;
    userEmail: string;
    userRole: string;
    workspaceId?: string;
    workspaceSlug?: string;
    workspaceBranding?: WorkspaceBrandingState;
};

const SESSION_STORAGE_KEY = 'advaiora.session';
export const SESSION_CHANGED_EVENT = 'advaiora:session-changed';

const isBrowser = () => typeof window !== 'undefined';

const notifySessionChanged = () => {
    if (!isBrowser()) {
        return;
    }

    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

const normalizeValue = (value: unknown) => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
};

const normalizeSession = (rawSession: unknown): SessionState | null => {
    if (!rawSession || typeof rawSession !== 'object') {
        return null;
    }

    const source = rawSession as Record<string, unknown>;
    const accessToken = normalizeValue(source.accessToken);
    const userId = normalizeValue(source.userId);
    const userEmail = normalizeValue(source.userEmail);
    const userRole = normalizeValue(source.userRole) || 'member';
    const workspaceId = normalizeValue(source.workspaceId);
    const workspaceSlug = normalizeValue(source.workspaceSlug);
    const workspaceBranding = normalizeWorkspaceBranding(source.workspaceBranding);

    if (!accessToken || !userId || !userEmail) {
        return null;
    }

    return {
        accessToken,
        userId,
        userEmail: userEmail.toLowerCase(),
        userRole,
        ...(workspaceId ? { workspaceId } : {}),
        ...(workspaceSlug ? { workspaceSlug } : {}),
        ...(workspaceBranding ? { workspaceBranding } : {}),
    };
};

export const readSession = (): SessionState | null => {
    if (!isBrowser()) {
        return null;
    }

    const rawValue = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawValue) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawValue) as unknown;
        return normalizeSession(parsed);
    } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        notifySessionChanged();
        return null;
    }
};

export const writeSession = (nextSession: unknown): SessionState | null => {
    const normalized = normalizeSession(nextSession);
    if (!isBrowser()) {
        return normalized;
    }

    if (!normalized) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        notifySessionChanged();
        return null;
    }

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalized));
    notifySessionChanged();
    return normalized;
};

export const clearSession = () => {
    if (!isBrowser()) {
        return;
    }

    localStorage.removeItem(SESSION_STORAGE_KEY);
    notifySessionChanged();
};
