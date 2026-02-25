import { apiDelete, apiGet, apiPatch, apiPost } from '../../../utils/apiClient';

const withQuery = (path, params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `${path}?${serialized}` : path;
};

export const listCalendarEvents = (params = {}) =>
  apiGet(withQuery('/calendar/events', params));

export const createCalendarEvent = (payload) =>
  apiPost('/calendar/events', payload);

export const updateCalendarEvent = (eventId, payload) =>
  apiPatch(`/calendar/events/${eventId}`, payload);

export const deleteCalendarEvent = (eventId) =>
  apiDelete(`/calendar/events/${eventId}`);
