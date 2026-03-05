import { apiGet } from '../../../utils/apiClient';

export const getDashboardOverview = () => apiGet('/api/dashboard/overview');
export const getDashboardHome = () => apiGet('/api/dashboard/home');

const withQuery = (path, params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    search.set(key, String(value));
  });

  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export const getDashboardTeamWorkload = (params = {}) =>
  apiGet(withQuery('/api/dashboard/team-workload', params));
