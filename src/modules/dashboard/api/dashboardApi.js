import { apiGet } from '../../../utils/apiClient';

export const getDashboardOverview = () => apiGet('/api/dashboard/overview');
export const getDashboardHome = () => apiGet('/api/dashboard/home');
