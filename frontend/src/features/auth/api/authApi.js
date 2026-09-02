import { apiClient } from '../../../services/apiClient.js';

export const register = (payload) => apiClient.post('/auth/register', payload).then((r) => r.data);
export const login = (payload) => apiClient.post('/auth/login', payload).then((r) => r.data);
export const logout = () => apiClient.post('/auth/logout');
export const fetchMe = () => apiClient.get('/auth/me').then((r) => r.data);
export const forgotPassword = (email) => apiClient.post('/auth/forgot-password', { email }).then((r) => r.data);
export const resetPassword = (token, newPassword) =>
  apiClient.post('/auth/reset-password', { token, newPassword }).then((r) => r.data);
export const verifyEmail = (token) => apiClient.post('/auth/verify-email', { token }).then((r) => r.data);
export const resendVerification = () => apiClient.post('/auth/resend-verification').then((r) => r.data);
