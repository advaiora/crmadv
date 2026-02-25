import { apiFetch } from '../../../lib/apiFetch';
import {
  ApiRequestError,
  apiDelete,
  apiGet,
  apiPut,
  apiPatch,
  apiPost,
} from '../../../utils/apiClient';
import { getDevAuthHeaders } from '../../../utils/devAuthSession';

const getHeaders = () => {
  const headers = getDevAuthHeaders();
  if (!headers.Authorization) {
    throw new Error('Sessione non disponibile. Effettua il login.');
  }

  return headers;
};

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

const parseExportFilename = (contentDisposition) => {
  if (typeof contentDisposition !== 'string') {
    return 'preventivo.pdf';
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return 'preventivo.pdf';
};

const buildApiErrorFromResponse = async (response) => {
  const fallbackMessage = `Request failed with status ${response.status}`;
  const responseText = await response.text();

  if (!responseText) {
    return new ApiRequestError(fallbackMessage, { status: response.status });
  }

  try {
    const payload = JSON.parse(responseText);
    return new ApiRequestError(payload?.error?.message || fallbackMessage, {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    });
  } catch (_error) {
    return new ApiRequestError(responseText, {
      status: response.status,
      code: 'NON_JSON_ERROR_RESPONSE',
    });
  }
};

export const listQuotes = (params) =>
  apiGet(withQuery('/quotes', params), {
    headers: getHeaders(),
  });

export const getQuote = (quoteId) =>
  apiGet(`/quotes/${quoteId}`, {
    headers: getHeaders(),
  });

export const createQuote = (payload) =>
  apiPost('/quotes', payload, {
    headers: getHeaders(),
  });

export const updateQuote = (quoteId, payload) =>
  apiPatch(`/quotes/${quoteId}`, payload, {
    headers: getHeaders(),
  });

export const replaceQuote = (quoteId, payload) =>
  apiPut(`/quotes/${quoteId}`, payload, {
    headers: getHeaders(),
  });

export const deleteQuote = (quoteId) =>
  apiDelete(`/quotes/${quoteId}`, {
    headers: getHeaders(),
  });

export const sendQuote = (quoteId) =>
  apiPost(`/quotes/${quoteId}/send`, {}, {
    headers: getHeaders(),
  });

export const acceptQuote = (quoteId) =>
  apiPost(`/quotes/${quoteId}/accept`, {}, {
    headers: getHeaders(),
  });

export const rejectQuote = (quoteId) =>
  apiPost(`/quotes/${quoteId}/reject`, {}, {
    headers: getHeaders(),
  });

export const cancelSendQuote = (quoteId) =>
  apiPost(`/quotes/${quoteId}/cancel-send`, {}, {
    headers: getHeaders(),
  });

export const resendQuote = (quoteId) =>
  apiPost(`/quotes/${quoteId}/resend`, {}, {
    headers: getHeaders(),
  });

export const listQuoteTemplates = () =>
  apiGet('/quote-templates', {
    headers: getHeaders(),
  });

export const getQuoteTemplate = (templateId) =>
  apiGet(`/quote-templates/${templateId}`, {
    headers: getHeaders(),
  });

export const createQuoteTemplate = (payload) =>
  apiPost('/quote-templates', payload, {
    headers: getHeaders(),
  });

export const updateQuoteTemplate = (templateId, payload) =>
  apiPatch(`/quote-templates/${templateId}`, payload, {
    headers: getHeaders(),
  });

export const deleteQuoteTemplate = (templateId) =>
  apiDelete(`/quote-templates/${templateId}`, {
    headers: getHeaders(),
  });

export const lookupQuoteClients = (params) =>
  apiGet(withQuery('/quotes/lookups/clients', params), {
    headers: getHeaders(),
  });

export const lookupQuoteProjects = (params) =>
  apiGet(withQuery('/quotes/lookups/projects', params), {
    headers: getHeaders(),
  });

export const getQuoteNotificationTemplates = () =>
  apiGet('/notifications/quotes', {
    headers: getHeaders(),
  });

export const updateQuoteNotificationTemplates = (payload) =>
  apiPut('/notifications/quotes', payload, {
    headers: getHeaders(),
  });

export const downloadQuotePdf = async (quoteId, options = {}) => {
  const response = await apiFetch(withQuery(`/quotes/${quoteId}/pdf`, options), {
    method: 'GET',
    headers: {
      ...getHeaders(),
      Accept: 'application/pdf',
    },
  });

  if (!response.ok) {
    throw await buildApiErrorFromResponse(response);
  }

  const blob = await response.blob();
  const filename = parseExportFilename(response.headers.get('content-disposition'));

  return {
    blob,
    filename,
  };
};
