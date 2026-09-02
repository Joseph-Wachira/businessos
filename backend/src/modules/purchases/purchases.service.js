import { ApiError } from '../../utils/ApiError.js';

const PURCHASE_INCLUDE = {
  supplier: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
};

export async function listPurchases(db) {
  return db.purchase.findMany({ include: PURCHASE_INCLUDE, orderBy: { createdAt: 'desc' } });
}

export async function getPurchase(db, purchaseId) {
  const purchase = await db.purchase.findFirst({ where: { id: purchaseId }, include: PURCHASE_INCLUDE });
  if (!purchase) throw ApiError.notFound('PURCHASE_NOT_FOUND', 'Purchase not found');
  return purchase;
}

export async function createPurchase(db, { supplierId, note, items, actorUserId }) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId } });
  if (!supplier) throw ApiError.badRequest('SUPPLIER_NOT_FOUND', 'Supplier not found');

  for (const item of items) {
    const product = await db.product.findFirst({ where: { id: item.productId } });
    if (!product) throw ApiError.badRequest('PRODUCT_NOT_FOUND', `Product ${item.productId} not found`);
  }

  // Line items are created as their own top-level operations (not a nested
  // `items: { create: [...] }` write) so each one independently passes
  // through the tenant-scoping extension — a nested write on this model
  // would bypass it, since the extension only sees the outer purchase.
  // create call, not the relation writes inside it.
  const purchase = await db.purchase.create({ data: { supplierId, note, createdByUserId: actorUserId } });
  await db.$transaction(
    items.map((item) =>
      db.purchaseItem.create({
        data: { purchaseId: purchase.id, productId: item.productId, quantity: item.quantity, unitCost: item.unitCost },
      }),
    ),
  );

  return getPurchase(db, purchase.id);
}

export async function receivePurchase(db, purchaseId, actorUserId) {
  const purchase = await db.purchase.findFirst({ where: { id: purchaseId }, include: { items: true } });
  if (!purchase) throw ApiError.notFound('PURCHASE_NOT_FOUND', 'Purchase not found');
  if (purchase.status !== 'PENDING') {
    throw ApiError.conflict('PURCHASE_NOT_PENDING', `Purchase is already ${purchase.status}`);
  }

  await db.$transaction([
    db.purchase.update({ where: { id: purchaseId }, data: { status: 'RECEIVED', receivedAt: new Date() } }),
    ...purchase.items.map((item) =>
      db.inventoryMovement.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          reason: 'PURCHASE',
          note: `Received from purchase ${purchaseId}`,
          createdByUserId: actorUserId,
        },
      }),
    ),
  ]);

  return getPurchase(db, purchaseId);
}

export async function cancelPurchase(db, purchaseId) {
  const purchase = await db.purchase.findFirst({ where: { id: purchaseId } });
  if (!purchase) throw ApiError.notFound('PURCHASE_NOT_FOUND', 'Purchase not found');
  if (purchase.status !== 'PENDING') {
    throw ApiError.conflict('PURCHASE_NOT_PENDING', `Purchase is already ${purchase.status}`);
  }

  return db.purchase.update({ where: { id: purchaseId }, data: { status: 'CANCELLED' } });
}
