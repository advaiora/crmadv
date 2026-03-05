import { isApiError, projectsFetch } from '../../projects/api/projects.api';

const withQuery = (path, params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  if (Array.isArray(payload?.templates)) {
    return payload.templates;
  }
  return [];
};

export const listChecklistTemplates = async (params = {}, { signal } = {}) => {
  const result = await projectsFetch(withQuery('/checklists/templates', params), {
    method: 'GET',
    signal,
  });

  return normalizeList(result);
};

export const getChecklistTemplate = async (templateId, { signal } = {}) => {
  return projectsFetch(`/checklists/templates/${templateId}`, {
    method: 'GET',
    signal,
  });
};

export const createChecklistTemplate = async (input) => {
  return projectsFetch('/checklists/templates', {
    method: 'POST',
    body: input,
  });
};

export const updateChecklistTemplate = async (templateId, patch) => {
  return projectsFetch(`/checklists/templates/${templateId}`, {
    method: 'PATCH',
    body: patch,
  });
};

export const archiveChecklistTemplate = async (templateId) => {
  const result = await projectsFetch(`/checklists/templates/${templateId}`, {
    method: 'DELETE',
  });

  return result || { ok: true };
};

export const deleteChecklistTemplatePermanently = async (templateId) => {
  const result = await projectsFetch(`/checklists/templates/${templateId}/permanent`, {
    method: 'DELETE',
  });

  return result || { ok: true };
};

export const createChecklistTemplateItem = async (templateId, input) => {
  return projectsFetch(`/checklists/templates/${templateId}/items`, {
    method: 'POST',
    body: input,
  });
};

export const updateChecklistTemplateItem = async (templateId, itemId, patch) => {
  return projectsFetch(`/checklists/templates/${templateId}/items/${itemId}`, {
    method: 'PATCH',
    body: patch,
  });
};

export const deleteChecklistTemplateItem = async (templateId, itemId) => {
  const result = await projectsFetch(`/checklists/templates/${templateId}/items/${itemId}`, {
    method: 'DELETE',
  });

  return result || { ok: true };
};

export const reorderChecklistTemplateItems = async (templateId, orderedItemIds) => {
  return projectsFetch(`/checklists/templates/${templateId}/items/reorder`, {
    method: 'POST',
    body: {
      orderedItemIds,
    },
  });
};

export const listProjectChecklistInstances = async (projectId, { includeItems = true, stageId, signal } = {}) => {
  const result = await projectsFetch(withQuery(`/projects/${projectId}/checklists`, { includeItems, stageId }), {
    method: 'GET',
    signal,
  });

  return normalizeList(result);
};

export const listChecklistAssignableUsers = async ({ signal } = {}) => {
  const result = await projectsFetch('/checklists/assignable-users', {
    method: 'GET',
    signal,
  });

  return normalizeList(result);
};

export const createProjectChecklistInstance = async (projectId, input) => {
  return projectsFetch(`/projects/${projectId}/checklists`, {
    method: 'POST',
    body: input,
  });
};

export const ensureProjectStageChecklistInstances = async (projectId, stageId) =>
  projectsFetch(`/projects/${projectId}/checklists/ensure`, {
    method: 'POST',
    body: { stageId },
  });

export const completeChecklistInstanceItem = async (instanceId, itemInstanceId, input) =>
  projectsFetch(`/checklists/instances/${instanceId}/items/${itemInstanceId}/complete`, {
    method: 'POST',
    body: input,
  });

export const listStageChecklistRules = async (categoryId, stageId) =>
  projectsFetch(`/projects/categories/${categoryId}/pipeline/stages/${stageId}/checklist-rules`, {
    method: 'GET',
  });

export const replaceStageChecklistRules = async (categoryId, stageId, rules) =>
  projectsFetch(`/projects/categories/${categoryId}/pipeline/stages/${stageId}/checklist-rules`, {
    method: 'PUT',
    body: { rules },
  });

export const updateChecklistItemState = async (itemId, input) => {
  return projectsFetch(`/checklists/items/${itemId}/state`, {
    method: 'PATCH',
    body: input,
  });
};

export const markChecklistItemNotApplicable = async (itemId, input) => {
  return projectsFetch(`/checklists/items/${itemId}/not-applicable`, {
    method: 'PATCH',
    body: input,
  });
};

export const resetChecklistItem = async (itemId) => {
  return projectsFetch(`/checklists/items/${itemId}/reset`, {
    method: 'PATCH',
  });
};

export const assignChecklistItem = async (
  arg1,
  arg2,
) => {
  if (typeof arg1 === 'object' && arg1 !== null && 'instanceId' in arg1 && 'itemInstanceId' in arg1) {
    const payload = arg1;
    return projectsFetch(
      `/checklists/instances/${payload.instanceId}/items/${payload.itemInstanceId}/assignee`,
      {
        method: 'PATCH',
        body: {
          assignedToUserId: payload.assignedToUserId ?? null,
        },
      },
    );
  }

  return projectsFetch(`/checklists/items/${arg1}/assignee`, {
    method: 'PATCH',
    body: arg2,
  });
};

export { isApiError };
