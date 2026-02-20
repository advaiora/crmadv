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

export const listProjectChecklistInstances = async (projectId, { includeItems = true, signal } = {}) => {
  const result = await projectsFetch(withQuery(`/projects/${projectId}/checklists`, { includeItems }), {
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

export { isApiError };
