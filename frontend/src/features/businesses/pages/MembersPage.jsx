import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listMembers,
  listInvitations,
  inviteMember,
  revokeInvitation,
  updateMemberRole,
  removeMember,
} from '../api/businessesApi.js';
import { useAuthStore } from '../../auth/authStore.js';

const ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'INVENTORY_MANAGER', 'ACCOUNTANT'];

export default function MembersPage() {
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const activeRole = useAuthStore((s) => s.getActiveRole());
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Mirrors backend/src/rbac/rolePermissions.js — client-side only, so the
  // UI doesn't offer actions the API will just reject; the API call itself
  // is still the real enforcement.
  const canInvite = activeRole === 'OWNER' || activeRole === 'MANAGER';
  const canManage = activeRole === 'OWNER';

  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('CASHIER');
  const [inviting, setInviting] = useState(false);

  // Bumping this re-runs the effect below, which owns the actual fetch —
  // mutation handlers ask for a reload this way instead of calling an
  // async fetcher directly, so the only code that ever sets members/
  // invitations/error state from a fetch is the effect that also guards
  // against a stale response landing after the business/role changed.
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const [membersData, invitationsData] = await Promise.all([
          listMembers(activeBusinessId),
          canInvite ? listInvitations(activeBusinessId) : Promise.resolve([]),
        ]);
        if (ignore) return;
        setMembers(membersData);
        setInvitations(invitationsData);
        setError(null);
      } catch (err) {
        if (!ignore) setError(err.response?.data?.error?.message ?? 'Could not load team');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [activeBusinessId, canInvite, reloadToken]);

  async function handleInvite(e) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await inviteMember(activeBusinessId, { email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(invitationId) {
    setError(null);
    try {
      await revokeInvitation(activeBusinessId, invitationId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not revoke invitation');
    }
  }

  async function handleRoleChange(membershipId, role) {
    setError(null);
    try {
      await updateMemberRole(activeBusinessId, membershipId, role);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not update role');
    }
  }

  async function handleRemove(membershipId) {
    setError(null);
    try {
      await removeMember(activeBusinessId, membershipId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not remove member');
    }
  }

  return (
    <div>
      <p>
        <Link to="/">&larr; Back</Link>
      </p>
      <h1>Team</h1>
      {error && <p className="error-text">{error}</p>}

      {canInvite && (
        <form onSubmit={handleInvite}>
          <div className="field">
            <label htmlFor="inviteEmail">Invite by email</label>
            <input
              id="inviteEmail"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="inviteRole">Role</label>
            <select id="inviteRole" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {ROLES.filter((role) => role !== 'OWNER' || activeRole === 'OWNER').map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={inviting}>
            {inviting ? 'Sending...' : 'Invite'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <h2>Members</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.membershipId}>
                  <td>
                    {m.firstName} {m.lastName}
                  </td>
                  <td>{m.email}</td>
                  <td>
                    {canManage ? (
                      <select value={m.role} onChange={(e) => handleRoleChange(m.membershipId, e.target.value)}>
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      m.role
                    )}
                  </td>
                  {canManage && (
                    <td>
                      {m.userId !== currentUserId && (
                        <button onClick={() => handleRemove(m.membershipId)}>Remove</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {canInvite && invitations.length > 0 && (
            <>
              <h2>Pending invitations</h2>
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.email}</td>
                      <td>{inv.role}</td>
                      <td>
                        <button onClick={() => handleRevoke(inv.id)}>Revoke</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
