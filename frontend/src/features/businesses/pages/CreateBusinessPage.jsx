import { useState } from 'react';
import { createBusiness } from '../api/businessesApi.js';
import { useAuthStore } from '../../auth/authStore.js';

export default function CreateBusinessPage() {
  const user = useAuthStore((s) => s.user);
  const addBusiness = useAuthStore((s) => s.addBusiness);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const business = await createBusiness({ name });
      addBusiness(business);
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not create business');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <h1>Welcome{user?.firstName ? `, ${user.firstName}` : ''}</h1>
      <p>Create your business to get started.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Business name</label>
          <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? 'Creating...' : 'Create business'}
        </button>
      </form>
    </div>
  );
}
