import { apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/apiClient';
import { getDevAuthHeaders } from '../../../utils/devAuthSession';

// Client API per le definizioni dei campi personalizzati (Custom Fields, V3).
// Usa gli stessi header workspace del modulo Clienti.

const getHeaders = () => {
  const headers = getDevAuthHeaders();
  if (Object.keys(headers).length === 0) {
    throw new Error('Sessione non disponibile. Effettua il login.');
  }
  return headers;
};

export const listCustomFields = (entity = 'client') =>
  apiGet(`/custom-fields?entity=${encodeURIComponent(entity)}`, { headers: getHeaders() });

export const createCustomField = (payload) =>
  apiPost('/custom-fields', payload, { headers: getHeaders() });

export const updateCustomField = (id, payload) =>
  apiPatch(`/custom-fields/${id}`, payload, { headers: getHeaders() });

export const deleteCustomField = (id) =>
  apiDelete(`/custom-fields/${id}`, { headers: getHeaders() });

export const reorderCustomFields = (ids, entity = 'client') =>
  apiPost('/custom-fields/reorder', { entity, ids }, { headers: getHeaders() });
