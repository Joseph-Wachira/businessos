import { useEffect } from 'react';
import { fetchMe } from './api/authApi.js';
import { useAuthStore } from './authStore.js';

/**
 * The access token only ever lives in memory (see apiClient.js), so a hard
 * reload always starts with none — even though the httpOnly refresh cookie
 * is still valid server-side. GET /auth/me with no token 401s, which the
 * apiClient response interceptor already turns into a silent refresh-and-
 * retry; if that fails too, there's genuinely no session and we say so via
 * markInitialized() rather than leaving ProtectedRoute waiting forever.
 */
export function useAuthBootstrap() {
  const initialized = useAuthStore((s) => s.initialized);
  const setSession = useAuthStore((s) => s.setSession);
  const markInitialized = useAuthStore((s) => s.markInitialized);

  useEffect(() => {
    if (initialized) return;
    fetchMe()
      .then(({ user, memberships }) => {
        setSession({ user, memberships, accessToken: useAuthStore.getState().accessToken });
      })
      .catch(() => {
        markInitialized();
      });
  }, [initialized, setSession, markInitialized]);
}
