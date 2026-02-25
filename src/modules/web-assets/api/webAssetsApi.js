import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../../utils/apiClient';

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

export const listWebAssets = (params = {}) =>
  apiGet(withQuery('/web-assets', params));

export const getWebAsset = (assetId) =>
  apiGet(`/web-assets/${assetId}`);

export const createWebAsset = (payload) =>
  apiPost('/web-assets', payload);

export const updateWebAsset = (assetId, payload) =>
  apiPut(`/web-assets/${assetId}`, payload);

export const patchWebAsset = (assetId, payload) =>
  apiPatch(`/web-assets/${assetId}`, payload);

export const deleteWebAsset = (assetId) =>
  apiDelete(`/web-assets/${assetId}`);

export const setWebAssetPublished = (assetId, published) =>
  apiPost(`/web-assets/${assetId}/publish`, { published: Boolean(published) });

export const lookupWebAssetClients = (params = {}) =>
  apiGet(withQuery('/web-assets/lookups/clients', params));

export const lookupWebAssetProjects = (params = {}) =>
  apiGet(withQuery('/web-assets/lookups/projects', params));
