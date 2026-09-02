import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './features/auth/authStore.js';
import { useAuthBootstrap } from './features/auth/useAuthBootstrap.js';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import RegisterPage from './features/auth/pages/RegisterPage.jsx';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage.jsx';
import CreateBusinessPage from './features/businesses/pages/CreateBusinessPage.jsx';
import MembersPage from './features/businesses/pages/MembersPage.jsx';
import HomePage from './features/dashboard/pages/HomePage.jsx';

function HomeRoute() {
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  return activeBusinessId ? <HomePage /> : <CreateBusinessPage />;
}

function RequireBusiness({ children }) {
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  return activeBusinessId ? children : <Navigate to="/" replace />;
}

export default function App() {
  useAuthBootstrap();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomeRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedRoute>
            <RequireBusiness>
              <MembersPage />
            </RequireBusiness>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
