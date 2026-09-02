import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore.js';

export function ProtectedRoute({ children }) {
  const initialized = useAuthStore((s) => s.initialized);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!initialized) return null;
  if (!accessToken) return <Navigate to="/login" replace />;
  return children;
}
