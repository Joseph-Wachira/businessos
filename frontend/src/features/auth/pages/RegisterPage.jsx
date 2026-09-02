import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/authApi.js';
import { useAuthStore } from '../authStore.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ email: '', password: '', firstName: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await register(form);
      if (data.accessToken) {
        setSession({ user: data.user, memberships: data.memberships, accessToken: data.accessToken });
        navigate('/');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <h1>Create your account</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Register'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
