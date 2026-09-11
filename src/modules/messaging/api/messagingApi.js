import { ApiRequestError, apiDelete, apiGet, apiPost } from '../../../utils/apiClient';
import { apiFetch } from '../../../lib/apiFetch';

const withQuery = (path, params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export const listMessagingUsers = (params = {}) =>
  apiGet(withQuery('/messages/users', params));

export const listMessagingConversation = (userId, params = {}) =>
  apiGet(withQuery(`/messages/conversations/${userId}`, params));

export const sendMessagingMessage = (userId, payload) =>
  apiPost(`/messages/conversations/${userId}/messages`, payload);

export const markMessagingConversationRead = (userId) =>
  apiPost(`/messages/conversations/${userId}/read`, {});

// Allegati ai messaggi (A1 punto 8a-bis). L'upload va come multipart, non dentro
// il corpo JSON: apiPost/apiClient riconoscono gia' un FormData e lasciano che sia
// il browser a mettere il boundary.
export const uploadMessagingAttachment = (messageId, file) => {
  const form = new FormData();
  form.append('file', file);
  return apiPost(`/messages/${messageId}/attachments`, form);
};

export const deleteMessagingAttachment = (attachmentId) =>
  apiDelete(`/messages/attachments/${attachmentId}`);

// Scarica l'originale (byte veri): non passa da apiGet, che si aspetta l'involucro
// JSON { data }. Stessa autenticazione di ogni altra chiamata (apiFetch la
// inietta da sola), poi si apre il "salva file" del browser via blob.
export const downloadMessagingAttachment = async (attachment) => {
  const response = await apiFetch(`/messages/attachments/${attachment.id}/file`);

  if (!response.ok) {
    let message = "Scaricamento dell'allegato non riuscito.";
    try {
      const payload = await response.json();
      message = payload?.error?.message || message;
    } catch {
      // risposta non JSON (es. body vuoto): resta il messaggio di default
    }
    throw new ApiRequestError(message, { status: response.status });
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.label || 'allegato';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Revocato dopo un attimo: subito romperebbe il download appena avviato.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
};
