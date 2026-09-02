import { ApiError } from '../../utils/ApiError.js';

// DAMAGE and RETURN take a positive magnitude from the caller ("2 units
// damaged") and this applies the sign — a UI shouldn't have to know that
// damage is stored as a negative ledger entry. ADJUSTMENT and
// OPENING_BALANCE take the signed delta directly since a correction can
// legitimately go either direction.
const IMPLIED_SIGN = { DAMAGE: -1, RETURN: 1 };

export async function recordMovement(db, { productId, reason, quantity, note, actorUserId }) {
  const product = await db.product.findFirst({ where: { id: productId } });
  if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');

  if (quantity === 0) {
    throw ApiError.badRequest('INVALID_QUANTITY', 'Quantity must not be zero');
  }

  let signedQuantity = quantity;
  if (reason in IMPLIED_SIGN) {
    if (quantity < 0) {
      throw ApiError.badRequest('INVALID_QUANTITY', `Quantity for ${reason} must be given as a positive number`);
    }
    signedQuantity = quantity * IMPLIED_SIGN[reason];
  }

  return db.inventoryMovement.create({
    data: { productId, reason, quantity: signedQuantity, note, createdByUserId: actorUserId },
  });
}

export async function listMovements(db, productId) {
  const product = await db.product.findFirst({ where: { id: productId } });
  if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');

  return db.inventoryMovement.findMany({ where: { productId }, orderBy: { createdAt: 'desc' } });
}

export async function getCurrentStock(db, productId) {
  const result = await db.inventoryMovement.aggregate({ where: { productId }, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}

// Batched for listProducts() — one grouped query instead of one aggregate
// per product avoids an N+1 when rendering a catalog table.
export async function currentStockByProduct(db, productIds) {
  if (productIds.length === 0) return {};

  const grouped = await db.inventoryMovement.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds } },
    _sum: { quantity: true },
  });

  const stockByProduct = {};
  for (const row of grouped) stockByProduct[row.productId] = row._sum.quantity ?? 0;
  return stockByProduct;
}
