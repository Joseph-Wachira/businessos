import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

async function register(email, extra = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password123', ...extra });
  return res.body;
}

async function createBusiness(accessToken, name) {
  const res = await request(app)
    .post('/api/businesses')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name });
  return res.body;
}

function asMember(accessToken, businessId) {
  const withAuth = (req) => req.set('Authorization', `Bearer ${accessToken}`).set('X-Business-Id', businessId);
  return {
    get: (path) => withAuth(request(app).get(path)),
    post: (path) => withAuth(request(app).post(path)),
    patch: (path) => withAuth(request(app).patch(path)),
    delete: (path) => withAuth(request(app).delete(path)),
  };
}

describe('business members & invitations', () => {
  let owner;
  let business;

  beforeEach(async () => {
    owner = await register('owner@example.com');
    business = await createBusiness(owner.accessToken, 'Acme Retail');
  });

  it('adds an already-registered user immediately, with an ACCEPTED invitation record', async () => {
    const invitee = await register('carla@example.com');

    const inviteRes = await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'carla@example.com', role: 'CASHIER' });
    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.status).toBe('ACCEPTED');

    const membersRes = await asMember(owner.accessToken, business.id).get(`/api/businesses/${business.id}/members`);
    expect(membersRes.status).toBe(200);
    expect(membersRes.body.find((m) => m.email === 'carla@example.com')?.role).toBe('CASHIER');

    // The invitee can now act in this business right away.
    const meInBusiness = await asMember(invitee.accessToken, business.id).get(`/api/businesses/${business.id}`);
    expect(meInBusiness.status).toBe(200);
  });

  it('leaves a PENDING invitation for a not-yet-registered email, then auto-joins them on registration', async () => {
    const inviteRes = await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'newhire@example.com', role: 'MANAGER' });
    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.status).toBe('PENDING');

    const registerRes = await register('newhire@example.com');
    expect(registerRes.memberships).toHaveLength(1);
    expect(registerRes.memberships[0]).toMatchObject({ businessId: business.id, role: 'MANAGER' });

    const membersRes = await asMember(owner.accessToken, business.id).get(`/api/businesses/${business.id}/members`);
    expect(membersRes.body.find((m) => m.email === 'newhire@example.com')?.role).toBe('MANAGER');
  });

  it('does not auto-join a revoked invitation', async () => {
    const inviteRes = await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'revoked@example.com', role: 'CASHIER' });

    const revokeRes = await asMember(owner.accessToken, business.id).delete(
      `/api/businesses/${business.id}/invitations/${inviteRes.body.id}`,
    );
    expect(revokeRes.status).toBe(204);

    const registerRes = await register('revoked@example.com');
    expect(registerRes.memberships).toHaveLength(0);
  });

  it('rejects inviting someone who is already a member', async () => {
    await register('dupe@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'dupe@example.com', role: 'CASHIER' });

    const secondInvite = await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'dupe@example.com', role: 'MANAGER' });
    expect(secondInvite.status).toBe(409);
    expect(secondInvite.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('rejects a second invitation while one is still pending for the same email', async () => {
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'pending@example.com', role: 'CASHIER' });

    const secondInvite = await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'pending@example.com', role: 'MANAGER' });
    expect(secondInvite.status).toBe(409);
    expect(secondInvite.body.error.code).toBe('INVITATION_PENDING');
  });

  it('rejects a non-owner assigning the OWNER role via invitation', async () => {
    const manager = await register('manager@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'manager@example.com', role: 'MANAGER' });

    const res = await asMember(manager.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'wannabe-owner@example.com', role: 'OWNER' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CANNOT_ASSIGN_OWNER');
  });

  it('rejects invitation attempts from a role without BUSINESS_INVITE_MEMBER', async () => {
    const cashier = await register('cashier@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'cashier@example.com', role: 'CASHIER' });

    const res = await asMember(cashier.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'someone@example.com', role: 'CASHIER' });
    expect(res.status).toBe(403);
  });

  it('lets any member (including CASHIER) list members, with no special permission required', async () => {
    const cashier = await register('viewer@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'viewer@example.com', role: 'CASHIER' });

    const res = await asMember(cashier.accessToken, business.id).get(`/api/businesses/${business.id}/members`);
    expect(res.status).toBe(200);
  });

  it('updates a member role, and blocks demoting the last remaining owner', async () => {
    await register('man2@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'man2@example.com', role: 'CASHIER' });

    const members = await asMember(owner.accessToken, business.id).get(`/api/businesses/${business.id}/members`);
    const managerMembership = members.body.find((m) => m.email === 'man2@example.com');

    const promote = await asMember(owner.accessToken, business.id)
      .patch(`/api/businesses/${business.id}/members/${managerMembership.membershipId}`)
      .send({ role: 'MANAGER' });
    expect(promote.status).toBe(200);
    expect(promote.body.role).toBe('MANAGER');

    const ownerMembership = members.body.find((m) => m.email === 'owner@example.com');
    const demoteOwner = await asMember(owner.accessToken, business.id)
      .patch(`/api/businesses/${business.id}/members/${ownerMembership.membershipId}`)
      .send({ role: 'MANAGER' });
    expect(demoteOwner.status).toBe(409);
    expect(demoteOwner.body.error.code).toBe('LAST_OWNER');
  });

  it('removes a member, and blocks removing the last remaining owner', async () => {
    const cashier = await register('leaver@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'leaver@example.com', role: 'CASHIER' });

    const members = await asMember(owner.accessToken, business.id).get(`/api/businesses/${business.id}/members`);
    const cashierMembership = members.body.find((m) => m.email === 'leaver@example.com');

    const remove = await asMember(owner.accessToken, business.id).delete(
      `/api/businesses/${business.id}/members/${cashierMembership.membershipId}`,
    );
    expect(remove.status).toBe(204);

    // The removed member's next request for this business is now a 404,
    // same as any other non-member (requireTenant re-checks live membership).
    const afterRemoval = await asMember(cashier.accessToken, business.id).get(`/api/businesses/${business.id}`);
    expect(afterRemoval.status).toBe(404);

    const ownerMembership = members.body.find((m) => m.email === 'owner@example.com');
    const removeLastOwner = await asMember(owner.accessToken, business.id).delete(
      `/api/businesses/${business.id}/members/${ownerMembership.membershipId}`,
    );
    expect(removeLastOwner.status).toBe(409);
    expect(removeLastOwner.body.error.code).toBe('LAST_OWNER');
  });

  it('rejects a malformed businessId with 400 instead of a raw DB error', async () => {
    const res = await asMember(owner.accessToken, 'not-a-uuid').get('/api/businesses/not-a-uuid/members');
    expect(res.status).toBe(400);
  });
});
