import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/authApi.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await forgotPassword(email);
      setMessage(data.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <h1>Forgot password</h1>
      {message ? (
        <p>{message}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}
      <p>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
