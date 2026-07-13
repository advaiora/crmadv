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

// Caricamento file (Word/PDF/TXT/CSV/MD) come fonte. Usa FormData: apiClient non
// imposta Content-Type quando il body è FormData (lo fa il browser col boundary).
export const uploadProjectSourceFile = (projectId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiPost(`/projects/${encodeURIComponent(projectId)}/sources/files`, formData, {
    headers: getHeaders(),
  });
};

export const getProjectSource = (id) =>
  apiGet(`/sources/${encodeURIComponent(id)}`, { headers: getHeaders() });

// Reindicizza (vettorizza) tutte le fonti del progetto. Senza body.
export const reindexProjectSources = (projectId) =>
  apiPost(`/projects/${encodeURIComponent(projectId)}/sources/reindex`, undefined, {
    headers: getHeaders(),
  });

// refresh non ha body: passando `undefined` l'apiClient non imposta Content-Type
// (evita il 400 di Fastify sul body vuoto).
export const refreshProjectSource = (id) =>
  apiPost(`/sources/${encodeURIComponent(id)}/refresh`, undefined, { headers: getHeaders() });

export const deleteProjectSource = (id) =>
  apiDelete(`/sources/${encodeURIComponent(id)}`, { headers: getHeaders() });
