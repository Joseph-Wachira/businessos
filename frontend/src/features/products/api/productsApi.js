import { apiClient } from '../../../services/apiClient.js';

export const listProducts = () => apiClient.get('/products').then((r) => r.data);
export const createProduct = (payload) => apiClient.post('/products', payload).then((r) => r.data);
export const updateProduct = (productId, payload) =>
  apiClient.patch(`/products/${productId}`, payload).then((r) => r.data);

export const listCategories = () => apiClient.get('/categories').then((r) => r.data);
export const createCategory = (payload) => apiClient.post('/categories', payload).then((r) => r.data);
export const deleteCategory = (categoryId) => apiClient.delete(`/categories/${categoryId}`).then((r) => r.data);

export const recordStockMovement = (productId, payload) =>
  apiClient.post(`/inventory/${productId}/movements`, payload).then((r) => r.data);
