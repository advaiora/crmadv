import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/apiClient';
import { readSession } from '../../../lib/session';

// I ruoli sono esposti dal backend in stile /workspaces/:workspaceId/... .
// Il workspaceId lo leggiamo dalla sessione, come fa apiFetch per gli header.
const requireWorkspaceId = () => {
  const workspaceId = readSession()?.workspaceId;
  if (!workspaceId) {
    throw new Error('Workspace non disponibile. Effettua di nuovo il login.');
  }

  return workspaceId;
};

const rolesBase = () => `/workspaces/${requireWorkspaceId()}/roles`;

export const getRolesCatalog = () => apiGet(`${rolesBase()}/catalog`);

export const listWorkspaceRoles = () => apiGet(rolesBase());

export const createWorkspaceRole = ({ name, permissions }) =>
  apiPost(rolesBase(), { name, permissions });

export const updateWorkspaceRole = (roleId, { name, permissions }) =>
  apiPut(`${rolesBase()}/${roleId}`, { name, permissions });

export const deleteWorkspaceRole = (roleId) => apiDelete(`${rolesBase()}/${roleId}`);

export const assignUserCustomRoles = (userId, roleIds) =>
  apiPut(`/workspaces/${requireWorkspaceId()}/users/${userId}/custom-roles`, { roleIds });
