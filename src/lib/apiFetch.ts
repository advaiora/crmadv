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
        if (session?.accessToken) {
            requestHeaders.set('Authorization', `Bearer ${session.accessToken}`);
        }
        if (session?.workspaceId) {
            requestHeaders.set('x-workspace-id', session.workspaceId);
        } else if (session?.workspaceSlug) {
            requestHeaders.set('x-workspace-slug', session.workspaceSlug);
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
