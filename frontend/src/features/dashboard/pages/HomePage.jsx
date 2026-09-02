import { useNavigate, Link } from 'react-router-dom';
import { logout as logoutApi } from '../../auth/api/authApi.js';
import { useAuthStore } from '../../auth/authStore.js';

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const clear = useAuthStore((s) => s.clear);

  const activeMembership = memberships.find((m) => m.businessId === activeBusinessId);

  async function handleLogout() {
    try {
      await logoutApi();
    } finally {
      clear();
      navigate('/login');
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <h2>{activeMembership?.businessName ?? 'BusinessOS'}</h2>
        <p>{activeMembership?.role}</p>
        <p>
          <Link to="/team">Team</Link>
        </p>
        <button onClick={handleLogout}>Log out</button>
      </aside>
      <main className="app-main">
        <h1>Welcome{user?.firstName ? `, ${user.firstName}` : ''}</h1>
        <p>The dashboard isn&rsquo;t built yet &mdash; sales, inventory, and reports land in later stages.</p>
      </main>
    </div>
  );
}
