import { apiClient } from '../../../services/apiClient.js';

export const listSuppliers = () => apiClient.get('/suppliers').then((r) => r.data);
export const createSupplier = (payload) => apiClient.post('/suppliers', payload).then((r) => r.data);

export const listPurchases = () => apiClient.get('/purchases').then((r) => r.data);
export const createPurchase = (payload) => apiClient.post('/purchases', payload).then((r) => r.data);
export const receivePurchase = (purchaseId) => apiClient.post(`/purchases/${purchaseId}/receive`).then((r) => r.data);
export const cancelPurchase = (purchaseId) => apiClient.post(`/purchases/${purchaseId}/cancel`).then((r) => r.data);
