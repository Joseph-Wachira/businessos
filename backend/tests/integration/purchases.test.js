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

describe('suppliers & purchases', () => {
  let owner;
  let business;
  let client;
  let supplier;
  let productA;
  let productB;

  beforeEach(async () => {
    owner = await register('po-owner@example.com');
    business = await createBusiness(owner.accessToken, 'Purchasing Co');
    client = asMember(owner.accessToken, business.id);

    const supplierRes = await client.post('/api/suppliers').send({ name: 'Acme Supplies', phone: '555-0100' });
    supplier = supplierRes.body;

    productA = (await client.post('/api/products').send({ name: 'Flour 1kg' })).body;
    productB = (await client.post('/api/products').send({ name: 'Sugar 1kg' })).body;
  });

  it('creates a purchase with line items and lists it with supplier/product details', async () => {
    const res = await client.post('/api/purchases').send({
      supplierId: supplier.id,
      items: [
        { productId: productA.id, quantity: 10, unitCost: 2.5 },
        { productId: productB.id, quantity: 5, unitCost: 3 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.items).toHaveLength(2);
    expect(res.body.supplier.name).toBe('Acme Supplies');

    const listRes = await client.get('/api/purchases');
    expect(listRes.body).toHaveLength(1);
  });

  it('receiving a purchase increases stock via PURCHASE-reason movements, and cannot be received twice', async () => {
    const created = await client.post('/api/purchases').send({
      supplierId: supplier.id,
      items: [{ productId: productA.id, quantity: 20, unitCost: 1 }],
    });

    const receiveRes = await client.post(`/api/purchases/${created.body.id}/receive`).send({});
    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.status).toBe('RECEIVED');

    const productRes = await client.get(`/api/products/${productA.id}`);
    expect(productRes.body.currentStock).toBe(20);

    const movements = await client.get(`/api/inventory/${productA.id}/movements`);
    expect(movements.body).toHaveLength(1);
    expect(movements.body[0].reason).toBe('PURCHASE');
    expect(movements.body[0].quantity).toBe(20);

    const secondReceive = await client.post(`/api/purchases/${created.body.id}/receive`).send({});
    expect(secondReceive.status).toBe(409);
    expect(secondReceive.body.error.code).toBe('PURCHASE_NOT_PENDING');
  });

  it('cancels a pending purchase with no inventory effect, and cannot cancel a received one', async () => {
    const created = await client.post('/api/purchases').send({
      supplierId: supplier.id,
      items: [{ productId: productA.id, quantity: 20, unitCost: 1 }],
    });

    const cancelRes = await client.post(`/api/purchases/${created.body.id}/cancel`).send({});
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('CANCELLED');

    const productRes = await client.get(`/api/products/${productA.id}`);
    expect(productRes.body.currentStock).toBe(0);

    const receiveAfterCancel = await client.post(`/api/purchases/${created.body.id}/receive`).send({});
    expect(receiveAfterCancel.status).toBe(409);
  });

  it('rejects purchase creation from CASHIER but allows INVENTORY_MANAGER', async () => {
    const cashier = await register('po-cashier@example.com');
    await client.post(`/api/businesses/${business.id}/invitations`).send({ email: 'po-cashier@example.com', role: 'CASHIER' });

    const invMgr = await register('po-invmgr@example.com');
    await client
      .post(`/api/businesses/${business.id}/invitations`)
      .send({ email: 'po-invmgr@example.com', role: 'INVENTORY_MANAGER' });

    const cashierAttempt = await asMember(cashier.accessToken, business.id)
      .post('/api/purchases')
      .send({ supplierId: supplier.id, items: [{ productId: productA.id, quantity: 1, unitCost: 1 }] });
    expect(cashierAttempt.status).toBe(403);

    const invMgrAttempt = await asMember(invMgr.accessToken, business.id)
      .post('/api/purchases')
      .send({ supplierId: supplier.id, items: [{ productId: productA.id, quantity: 1, unitCost: 1 }] });
    expect(invMgrAttempt.status).toBe(201);
  });

  it('rejects a supplierId or productId belonging to a different business', async () => {
    const otherOwner = await register('po-other@example.com');
    const otherBusiness = await createBusiness(otherOwner.accessToken, 'Other Purchasing Co');
    const otherClient = asMember(otherOwner.accessToken, otherBusiness.id);
    const otherSupplier = (await otherClient.post('/api/suppliers').send({ name: 'Not Yours' })).body;
    const otherProduct = (await otherClient.post('/api/products').send({ name: 'Not Yours Either' })).body;

    const crossSupplier = await client
      .post('/api/purchases')
      .send({ supplierId: otherSupplier.id, items: [{ productId: productA.id, quantity: 1, unitCost: 1 }] });
    expect(crossSupplier.status).toBe(400);
    expect(crossSupplier.body.error.code).toBe('SUPPLIER_NOT_FOUND');

    const crossProduct = await client
      .post('/api/purchases')
      .send({ supplierId: supplier.id, items: [{ productId: otherProduct.id, quantity: 1, unitCost: 1 }] });
    expect(crossProduct.status).toBe(400);
    expect(crossProduct.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});
