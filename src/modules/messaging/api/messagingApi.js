import { apiGet, apiPost } from '../../../utils/apiClient';

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
