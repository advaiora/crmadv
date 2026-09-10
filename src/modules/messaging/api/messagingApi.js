import { apiGet, apiPost } from '../../../utils/apiClient';

// Tetto vero della lista contatti: il server lo accetta fino a qui
// (MAX_CONTACTS_LIMIT in server/modules/messaging/service.ts). Oltre, la
// ricerca testuale (gia' presente nel selettore) e' la via — non ha senso
// alzarlo ulteriormente senza una paginazione vera della lista.
export const MESSAGING_CONTACTS_LIMIT = 100;

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
