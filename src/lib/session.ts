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

// Tutte le cache di dati di workspace (agency-os/data/agencyDataAdapter.js:
// discovery, ads, web, reports, client-report, diagnosis, projects) usano
// questo prefisso. Le preferenze d'interfaccia (tema, profilo, modello AI)
// hanno chiavi che non lo condividono: la pulizia per prefisso non le tocca.
const WORKSPACE_CACHE_KEY_PREFIX = 'agency-os.';

const clearWorkspaceCaches = () => {
    const keysToRemove: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith(WORKSPACE_CACHE_KEY_PREFIX)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
};

const isBrowser = () => typeof window !== 'undefined';

const notifySessionChanged = () => {
    if (!isBrowser()) {
        return;
    }

    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

// Unico punto che smonta la sessione sul browser: usato da clearSession() e
// dai due punti dove una sessione illeggibile o non valida va scartata allo
// stesso modo (CRMA-164 — un solo ramo che pulisce non basta, la fuga era
// proprio in un secondo ramo dimenticato).
const wipeStoredSession = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    clearWorkspaceCaches();
    notifySessionChanged();
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
        wipeStoredSession();
        return null;
    }
};

export const writeSession = (nextSession: unknown): SessionState | null => {
    const normalized = normalizeSession(nextSession);
    if (!isBrowser()) {
        return normalized;
    }

    if (!normalized) {
        wipeStoredSession();
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

    wipeStoredSession();
};
