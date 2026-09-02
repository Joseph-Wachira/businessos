import axios from 'axios';
import { env } from '../config/env.js';
import { useAuthStore } from '../features/auth/authStore.js';

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const { accessToken, activeBusinessId } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (activeBusinessId) config.headers['X-Business-Id'] = activeBusinessId;
  return config;
});

let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (response?.status !== 401 || config._retried || config.url === '/auth/refresh') {
      return Promise.reject(error);
    }

    config._retried = true;
    refreshPromise ??= apiClient
      .post('/auth/refresh')
      .then((res) => {
        useAuthStore.getState().setAccessToken(res.data.accessToken);
        return res.data.accessToken;
      })
      .catch((refreshError) => {
        useAuthStore.getState().clear();
        throw refreshError;
      })
      .finally(() => {
        refreshPromise = null;
      });

    try {
      await refreshPromise;
      return apiClient(config);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);
