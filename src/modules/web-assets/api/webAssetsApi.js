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

export const lookupWebAssetOwners = (params = {}) =>
  apiGet(withQuery('/web-assets/lookups/owners', params));

export const listWebAssetVersions = (assetId, params = {}) =>
  apiGet(withQuery(`/web-assets/${assetId}/versions`, params));

export const createWebAssetVersion = (assetId, payload) =>
  apiPost(`/web-assets/${assetId}/versions`, payload);

export const compareWebAssetVersions = (assetId, params) =>
  apiGet(withQuery(`/web-assets/${assetId}/versions/compare`, params));

export const rollbackWebAssetVersion = (assetId, versionId) =>
  apiPost(`/web-assets/${assetId}/versions/${versionId}/rollback`);

export const listWebAssetAuditLogs = (params = {}) =>
  apiGet(withQuery('/web-assets/audit', params));

export const switchWebAssetDeployment = (assetId, payload) =>
  apiPost(`/web-assets/${assetId}/deployment`, payload);

export const listWebAssetHealth = (assetId, params = {}) =>
  apiGet(withQuery(`/web-assets/${assetId}/health`, params));

export const runWebAssetHealthCheck = (assetId) =>
  apiPost(`/web-assets/${assetId}/health/check`);

export const listWebAssetSeoReports = (assetId, params = {}) =>
  apiGet(withQuery(`/web-assets/${assetId}/seo/reports`, params));

export const runWebAssetSeoScan = (assetId, payload = {}) =>
  apiPost(`/web-assets/${assetId}/seo/scan`, payload);

export const listWebAssetAnalytics = (assetId, params = {}) =>
  apiGet(withQuery(`/web-assets/${assetId}/analytics`, params));

export const createWebAssetAnalyticsSnapshot = (assetId, payload) =>
  apiPost(`/web-assets/${assetId}/analytics/snapshots`, payload);

export const createWebAssetAnalyticsEvent = (assetId, payload) =>
  apiPost(`/web-assets/${assetId}/analytics/events`, payload);

export const listWebAssetMaintenance = (assetId, params = {}) =>
  apiGet(withQuery(`/web-assets/${assetId}/maintenance`, params));

export const createWebAssetMaintenance = (assetId, payload) =>
  apiPost(`/web-assets/${assetId}/maintenance`, payload);

export const updateWebAssetMaintenance = (assetId, maintenanceId, payload) =>
  apiPatch(`/web-assets/${assetId}/maintenance/${maintenanceId}`, payload);

export const listWebAssetAlerts = (assetId, params = {}) =>
  apiGet(withQuery(`/web-assets/${assetId}/alerts`, params));

export const updateWebAssetAlert = (assetId, alertId, payload) =>
  apiPatch(`/web-assets/${assetId}/alerts/${alertId}`, payload);
