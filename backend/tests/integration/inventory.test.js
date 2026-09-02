import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

async function register(email) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password123' });
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
  };
}

describe('inventory movements', () => {
  let owner;
  let business;
  let product;

  beforeEach(async () => {
    owner = await register('inv-owner@example.com');
    business = await createBusiness(owner.accessToken, 'Stocked Co');
    const productRes = await asMember(owner.accessToken, business.id).post('/api/products').send({ name: 'Widget' });
    product = productRes.body;
  });

  it('follows the master-plan worked example: +50 purchase-equivalent, -5 sale-equivalent, -2 damaged, +1 return = 44', async () => {
    const client = asMember(owner.accessToken, business.id);

    await client.post(`/api/inventory/${product.id}/movements`).send({ reason: 'OPENING_BALANCE', quantity: 50 });
    await client.post(`/api/inventory/${product.id}/movements`).send({ reason: 'ADJUSTMENT', quantity: -5 });
    await client.post(`/api/inventory/${product.id}/movements`).send({ reason: 'DAMAGE', quantity: 2 });
    await client.post(`/api/inventory/${product.id}/movements`).send({ reason: 'RETURN', quantity: 1 });

    const getRes = await client.get(`/api/products/${product.id}`);
    expect(getRes.body.currentStock).toBe(44);

    const movements = await client.get(`/api/inventory/${product.id}/movements`);
    expect(movements.body).toHaveLength(4);
    const damageMovement = movements.body.find((m) => m.reason === 'DAMAGE');
    expect(damageMovement.quantity).toBe(-2); // stored signed, even though the request sent a positive magnitude
  });

  it('rejects a negative quantity for DAMAGE/RETURN (sign is implied, not client-supplied)', async () => {
    const client = asMember(owner.accessToken, business.id);
    const res = await client.post(`/api/inventory/${product.id}/movements`).send({ reason: 'DAMAGE', quantity: -2 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUANTITY');
  });

  it('rejects a zero quantity', async () => {
    const client = asMember(owner.accessToken, business.id);
    const res = await client.post(`/api/inventory/${product.id}/movements`).send({ reason: 'ADJUSTMENT', quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects PURCHASE/SALE/TRANSFER on the manual endpoint (reserved for future automated modules)', async () => {
    const client = asMember(owner.accessToken, business.id);
    const res = await client.post(`/api/inventory/${product.id}/movements`).send({ reason: 'PURCHASE', quantity: 10 });
    expect(res.status).toBe(400);
  });

  it('allows INVENTORY_MANAGER but rejects CASHIER', async () => {
    const invMgr = await register('invmgr@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'invmgr@example.com', role: 'INVENTORY_MANAGER' });

    const cashier = await register('inv-cashier@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'inv-cashier@example.com', role: 'CASHIER' });

    const invMgrAttempt = await asMember(invMgr.accessToken, business.id)
      .post(`/api/inventory/${product.id}/movements`)
      .send({ reason: 'ADJUSTMENT', quantity: 5 });
    expect(invMgrAttempt.status).toBe(201);

    const cashierAttempt = await asMember(cashier.accessToken, business.id)
      .post(`/api/inventory/${product.id}/movements`)
      .send({ reason: 'ADJUSTMENT', quantity: 5 });
    expect(cashierAttempt.status).toBe(403);
  });

  it('404s recording a movement for a nonexistent (or cross-tenant) product', async () => {
    const otherOwner = await register('inv-other@example.com');
    const otherBusiness = await createBusiness(otherOwner.accessToken, 'Other Stock Co');
    const otherProduct = await asMember(otherOwner.accessToken, otherBusiness.id)
      .post('/api/products')
      .send({ name: 'Not yours' });

    const res = await asMember(owner.accessToken, business.id)
      .post(`/api/inventory/${otherProduct.body.id}/movements`)
      .send({ reason: 'ADJUSTMENT', quantity: 5 });
    expect(res.status).toBe(404);
  });

  it('reports currentStock: 0 for a product with no movements yet, in both list and detail', async () => {
    const client = asMember(owner.accessToken, business.id);
    const listRes = await client.get('/api/products');
    expect(listRes.body.find((p) => p.id === product.id).currentStock).toBe(0);

    const getRes = await client.get(`/api/products/${product.id}`);
    expect(getRes.body.currentStock).toBe(0);
  });
});
