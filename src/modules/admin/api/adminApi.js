import { apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/apiClient';

// Client per la Console Super Admin di piattaforma (rotte cross-workspace /admin/*).
// Non serve il workspace corrente: il backend autorizza in base al flag isPlatformAdmin.

export const listAdminWorkspaces = () => apiGet('/admin/workspaces');

export const createAdminWorkspace = ({ name, slug }) =>
  apiPost('/admin/workspaces', { name, ...(slug ? { slug } : {}) });

export const updateAdminWorkspace = (workspaceId, { name, slug }) =>
  apiPatch(`/admin/workspaces/${workspaceId}`, {
    ...(name !== undefined ? { name } : {}),
    ...(slug !== undefined ? { slug } : {}),
  });

export const suspendAdminWorkspace = (workspaceId) =>
  apiPost(`/admin/workspaces/${workspaceId}/suspend`);

export const activateAdminWorkspace = (workspaceId) =>
  apiPost(`/admin/workspaces/${workspaceId}/activate`);

export const listPlatformAdmins = () => apiGet('/admin/platform-admins');

export const searchAdminUsers = (query) =>
  apiGet(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);

export const promotePlatformAdmin = (userId) =>
  apiPost('/admin/platform-admins', { userId });

export const demotePlatformAdmin = (userId) =>
  apiDelete(`/admin/platform-admins/${userId}`);

export const getAiUsage = (days = 30) => apiGet(`/admin/ai-usage?days=${days}`);

export const getAiConfig = () => apiGet('/admin/ai-config');
