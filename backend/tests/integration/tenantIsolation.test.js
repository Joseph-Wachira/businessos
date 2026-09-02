import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

async function registerAndLogin(email) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password123' });
  return res.body.accessToken;
}

async function createBusiness(accessToken, name) {
  const res = await request(app)
    .post('/api/businesses')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name });
  return res.body;
}

describe('tenant isolation', () => {
  let ownerAToken;
  let businessA;
  let ownerBToken;

  beforeEach(async () => {
    ownerAToken = await registerAndLogin('owner-a@example.com');
    businessA = await createBusiness(ownerAToken, 'Business A');
    ownerBToken = await registerAndLogin('owner-b@example.com');
  });

  it('lets an owner access their own business', async () => {
    const res = await request(app)
      .get(`/api/businesses/${businessA.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Business-Id', businessA.id);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(businessA.id);
  });

  it('returns 404 (not 403) when a user without membership requests another business by id', async () => {
    const res = await request(app)
      .get(`/api/businesses/${businessA.id}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .set('X-Business-Id', businessA.id);

    expect(res.status).toBe(404);
  });

  it('requires the X-Business-Id header for tenant-scoped routes', async () => {
    const res = await request(app)
      .get(`/api/businesses/${businessA.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BUSINESS_CONTEXT_REQUIRED');
  });

  it('does not list another user\'s business in "my businesses"', async () => {
    const res = await request(app)
      .get('/api/businesses')
      .set('Authorization', `Bearer ${ownerBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.find((b) => b.id === businessA.id)).toBeUndefined();
  });
});
