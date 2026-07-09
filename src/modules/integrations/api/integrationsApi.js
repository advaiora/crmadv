import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/apiClient';
import { getDevAuthHeaders } from '../../../utils/devAuthSession';

// Client API per il layer integrazioni (V3). Usa gli stessi header workspace
// del modulo Clienti (le integrazioni sincronizzano i clienti).

const getHeaders = () => {
  const headers = getDevAuthHeaders();
  if (Object.keys(headers).length === 0) {
    throw new Error('Sessione non disponibile. Effettua il login.');
  }
  return headers;
};

export const listIntegrations = () => apiGet('/integrations', { headers: getHeaders() });

export const getIntegration = (provider) =>
  apiGet(`/integrations/${encodeURIComponent(provider)}`, { headers: getHeaders() });

export const saveIntegration = (provider, payload) =>
  apiPut(`/integrations/${encodeURIComponent(provider)}`, payload, { headers: getHeaders() });

// Test connessione e sync non hanno body: passando `undefined` come body,
// l'apiClient non imposta Content-Type (evita il 400 su body vuoto).
export const testIntegration = (provider) =>
  apiPost(`/integrations/${encodeURIComponent(provider)}/test`, undefined, {
    headers: getHeaders(),
  });

export const syncIntegration = (provider) =>
  apiPost(`/integrations/${encodeURIComponent(provider)}/sync`, undefined, {
    headers: getHeaders(),
  });

export const deleteIntegration = (provider) =>
  apiDelete(`/integrations/${encodeURIComponent(provider)}`, { headers: getHeaders() });
