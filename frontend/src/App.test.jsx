import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { useAuthStore } from './features/auth/authStore.js';

vi.mock('./features/auth/api/authApi.js', () => ({
  fetchMe: vi.fn(() => Promise.reject(new Error('not logged in'))),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      memberships: [],
      accessToken: null,
      activeBusinessId: null,
      initialized: false,
    });
  });

  it('renders the login page at /login', async () => {
    renderAt('/login');
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });

  it('renders the register page at /register', async () => {
    renderAt('/register');
    expect(await screen.findByRole('heading', { name: /create your account/i })).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor from / to the login page', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows the create-business page when authenticated with no business yet', () => {
    useAuthStore.setState({
      user: { firstName: 'Jane' },
      memberships: [],
      accessToken: 'token123',
      activeBusinessId: null,
      initialized: true,
    });
    renderAt('/');
    expect(screen.getByRole('heading', { name: /welcome, jane/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
  });

  it('redirects /team to the create-business page when there is no active business yet', () => {
    useAuthStore.setState({
      user: { firstName: 'Jane' },
      memberships: [],
      accessToken: 'token123',
      activeBusinessId: null,
      initialized: true,
    });
    renderAt('/team');
    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
  });

  it('shows the home page when authenticated with an active business', () => {
    useAuthStore.setState({
      user: { firstName: 'Jane' },
      memberships: [{ businessId: 'biz1', businessName: 'Demo Shop', businessSlug: 'demo-shop', role: 'OWNER' }],
      accessToken: 'token123',
      activeBusinessId: 'biz1',
      initialized: true,
    });
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Demo Shop' })).toBeInTheDocument();
  });
});
