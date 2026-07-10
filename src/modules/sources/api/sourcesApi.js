import { apiDelete, apiGet, apiPost } from '../../../utils/apiClient';
import { getDevAuthHeaders } from '../../../utils/devAuthSession';

// Client API per il Modulo Fonti (V4). Le fonti appartengono a un progetto e
// usano gli header workspace della sessione, come gli altri moduli.

const getHeaders = () => {
  const headers = getDevAuthHeaders();
  if (Object.keys(headers).length === 0) {
    throw new Error('Sessione non disponibile. Effettua il login.');
  }
  return headers;
};

export const listProjectSources = (projectId) =>
  apiGet(`/projects/${encodeURIComponent(projectId)}/sources`, { headers: getHeaders() });

export const createProjectSource = (projectId, payload) =>
  apiPost(`/projects/${encodeURIComponent(projectId)}/sources`, payload, { headers: getHeaders() });

export const getProjectSource = (id) =>
  apiGet(`/sources/${encodeURIComponent(id)}`, { headers: getHeaders() });

// refresh non ha body: passando `undefined` l'apiClient non imposta Content-Type
// (evita il 400 di Fastify sul body vuoto).
export const refreshProjectSource = (id) =>
  apiPost(`/sources/${encodeURIComponent(id)}/refresh`, undefined, { headers: getHeaders() });

export const deleteProjectSource = (id) =>
  apiDelete(`/sources/${encodeURIComponent(id)}`, { headers: getHeaders() });
