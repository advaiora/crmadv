import { apiGet, apiPatch } from '../../../utils/apiClient';

export const listWorkspaceModules = () => apiGet('/modules');

export const patchWorkspaceModule = (moduleKey, enabled) =>
  apiPatch(`/modules/${encodeURIComponent(moduleKey)}`, { enabled });
