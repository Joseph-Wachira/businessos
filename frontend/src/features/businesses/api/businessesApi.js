import { apiClient } from '../../../services/apiClient.js';

export const createBusiness = (payload) => apiClient.post('/businesses', payload).then((r) => r.data);
export const listMyBusinesses = () => apiClient.get('/businesses').then((r) => r.data);
