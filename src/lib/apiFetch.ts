import { clearSession, readSession } from './session';

const API_BASE_URL = (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    '/api'
).replace(/\/$/, '');
const DEFAULT_WORKSPACE_SLUG =
    import.meta.env.DEV && typeof import.meta.env.VITE_DEV_WORKSPACE_SLUG === 'string'
        ? import.meta.env.VITE_DEV_WORKSPACE_SLUG.trim()
        : '';

const isAbsoluteUrl = (path: string) => /^https?:\/\//i.test(path);

const normalizeString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
};

const decodeBase64Url = (input: string): string | null => {
    if (!input) {
        return null;
    }

    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

    try {
        if (typeof window !== 'undefined' && typeof window.atob === 'function') {
            const binary = window.atob(padded);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        }

        return Buffer.from(padded, 'base64').toString('utf8');
    } catch {
        return null;
    }
};

const readWorkspaceClaimsFromToken = (accessToken?: string): {
    workspaceId?: string;
    workspaceSlug?: string;
} => {
    if (!accessToken) {
        return {};
    }

    const parts = accessToken.split('.');
    if (parts.length < 2) {
        return {};
    }

    const payload = decodeBase64Url(parts[1]);
    if (!payload) {
        return {};
    }

    try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        return {
            workspaceId: normalizeString(parsed.workspaceId),
            workspaceSlug: normalizeString(parsed.workspaceSlug),
        };
    } catch {
        return {};
    }
};

export const buildApiUrl = (path: string) => {
    if (isAbsoluteUrl(path)) {
        return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
};

type ApiFetchOptions = RequestInit & {
    skipAuthHeaders?: boolean;
};

export const apiFetch = async (path: string, options: ApiFetchOptions = {}) => {
    const { skipAuthHeaders = false, headers, ...restOptions } = options;
    const requestHeaders = new Headers(headers || {});

    if (!requestHeaders.has('Accept')) {
        requestHeaders.set('Accept', 'application/json');
    }

    if (!skipAuthHeaders) {
        const session = readSession();
        const tokenWorkspaceClaims = readWorkspaceClaimsFromToken(session?.accessToken);
        if (session?.accessToken) {
            requestHeaders.set('Authorization', `Bearer ${session.accessToken}`);
        }
        if (session?.workspaceId) {
            requestHeaders.set('x-workspace-id', session.workspaceId);
        } else if (session?.workspaceSlug) {
            requestHeaders.set('x-workspace-slug', session.workspaceSlug);
        } else if (tokenWorkspaceClaims.workspaceId) {
            requestHeaders.set('x-workspace-id', tokenWorkspaceClaims.workspaceId);
        } else if (tokenWorkspaceClaims.workspaceSlug) {
            requestHeaders.set('x-workspace-slug', tokenWorkspaceClaims.workspaceSlug);
        } else if (import.meta.env.DEV && DEFAULT_WORKSPACE_SLUG) {
            requestHeaders.set('x-workspace-slug', DEFAULT_WORKSPACE_SLUG);
        }
    }

    const response = await fetch(buildApiUrl(path), {
        ...restOptions,
        headers: requestHeaders,
    });

    if (response.status === 401) {
        clearSession();

        if (typeof window !== 'undefined') {
            window.location.assign('/login');
        }
    }

    return response;
};
