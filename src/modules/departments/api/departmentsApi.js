import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/apiClient';
import { readSession } from '../../../lib/session';

const requireWorkspaceId = () => {
  const workspaceId = readSession()?.workspaceId;
  if (!workspaceId) {
    throw new Error('Workspace non disponibile. Effettua di nuovo il login.');
  }

  return workspaceId;
};

const departmentsBase = () => `/workspaces/${requireWorkspaceId()}/departments`;

export const listDepartments = () => apiGet(departmentsBase());

export const getDepartmentMembers = (departmentId) =>
  apiGet(`${departmentsBase()}/${departmentId}/members`);

export const createDepartment = ({ name, description }) =>
  apiPost(departmentsBase(), { name, description });

export const updateDepartment = (departmentId, { name, description }) =>
  apiPut(`${departmentsBase()}/${departmentId}`, { name, description });

export const deleteDepartment = (departmentId) =>
  apiDelete(`${departmentsBase()}/${departmentId}`);

export const assignDepartmentMembers = (departmentId, userIds) =>
  apiPut(`${departmentsBase()}/${departmentId}/members`, { userIds });
