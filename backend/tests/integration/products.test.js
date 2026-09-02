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
    patch: (path) => withAuth(request(app).patch(path)),
    delete: (path) => withAuth(request(app).delete(path)),
  };
}

describe('products & categories', () => {
  let owner;
  let business;

  beforeEach(async () => {
    owner = await register('cat-owner@example.com');
    business = await createBusiness(owner.accessToken, 'Catalog Co');
  });

  it('creates a category and a product in it', async () => {
    const catRes = await asMember(owner.accessToken, business.id).post('/api/categories').send({ name: 'Beverages' });
    expect(catRes.status).toBe(201);

    const productRes = await asMember(owner.accessToken, business.id)
      .post('/api/products')
      .send({ name: 'Cola 500ml', sku: 'COLA-500', categoryId: catRes.body.id, sellingPrice: 1.5, costPrice: 1 });
    expect(productRes.status).toBe(201);
    expect(productRes.body.categoryId).toBe(catRes.body.id);
    expect(productRes.body.status).toBe('ACTIVE');
  });

  it('rejects product creation from CASHIER but allows MANAGER', async () => {
    const cashier = await register('cashier2@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'cashier2@example.com', role: 'CASHIER' });

    const manager = await register('manager2@example.com');
    await asMember(owner.accessToken, business.id)
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'manager2@example.com', role: 'MANAGER' });

    const cashierAttempt = await asMember(cashier.accessToken, business.id)
      .post('/api/products')
      .send({ name: 'Blocked Product' });
    expect(cashierAttempt.status).toBe(403);

    const managerAttempt = await asMember(manager.accessToken, business.id)
      .post('/api/products')
      .send({ name: 'Allowed Product' });
    expect(managerAttempt.status).toBe(201);
  });

  it('rejects a duplicate SKU within the same business but allows it across businesses', async () => {
    await asMember(owner.accessToken, business.id).post('/api/products').send({ name: 'Widget', sku: 'WID-1' });

    const dup = await asMember(owner.accessToken, business.id).post('/api/products').send({ name: 'Widget 2', sku: 'WID-1' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SKU_TAKEN');

    const otherOwner = await register('other-owner@example.com');
    const otherBusiness = await createBusiness(otherOwner.accessToken, 'Other Co');
    const otherProduct = await asMember(otherOwner.accessToken, otherBusiness.id)
      .post('/api/products')
      .send({ name: 'Widget', sku: 'WID-1' });
    expect(otherProduct.status).toBe(201);
  });

  it('rejects a categoryId that belongs to a different business', async () => {
    const otherOwner = await register('other-owner2@example.com');
    const otherBusiness = await createBusiness(otherOwner.accessToken, 'Other Co 2');
    const otherCategory = await asMember(otherOwner.accessToken, otherBusiness.id)
      .post('/api/categories')
      .send({ name: 'Not Yours' });

    const res = await asMember(owner.accessToken, business.id)
      .post('/api/products')
      .send({ name: 'Cross-tenant Product', categoryId: otherCategory.body.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('cannot see or fetch another business\'s product (tenant isolation)', async () => {
    const otherOwner = await register('other-owner3@example.com');
    const otherBusiness = await createBusiness(otherOwner.accessToken, 'Other Co 3');
    const otherProduct = await asMember(otherOwner.accessToken, otherBusiness.id)
      .post('/api/products')
      .send({ name: 'Secret Product' });

    const listRes = await asMember(owner.accessToken, business.id).get('/api/products');
    expect(listRes.body.find((p) => p.id === otherProduct.body.id)).toBeUndefined();

    const getRes = await asMember(owner.accessToken, business.id).get(`/api/products/${otherProduct.body.id}`);
    expect(getRes.status).toBe(404);
  });

  it('updates a product, including archiving it via status', async () => {
    const created = await asMember(owner.accessToken, business.id).post('/api/products').send({ name: 'Gadget' });

    const updated = await asMember(owner.accessToken, business.id)
      .patch(`/api/products/${created.body.id}`)
      .send({ status: 'INACTIVE', sellingPrice: 9.99 });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('INACTIVE');
  });

  it('un-sets category on its products when the category is deleted, without deleting the products', async () => {
    const category = await asMember(owner.accessToken, business.id).post('/api/categories').send({ name: 'Temp' });
    const product = await asMember(owner.accessToken, business.id)
      .post('/api/products')
      .send({ name: 'Orphan-to-be', categoryId: category.body.id });

    const del = await asMember(owner.accessToken, business.id).delete(`/api/categories/${category.body.id}`);
    expect(del.status).toBe(204);

    const getRes = await asMember(owner.accessToken, business.id).get(`/api/products/${product.body.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.categoryId).toBeNull();
  });
});
