import { ApiError } from '../../utils/ApiError.js';

// db is always the tenant-scoped client (req.context.db). Category lookups
// below go through it too, not just Product writes — without that, a
// categoryId belonging to a DIFFERENT business would still pass Postgres's
// FK check (some category row with that id exists, just not one this
// tenant owns) and silently link this product to another tenant's category.

async function assertCategoryBelongsToTenant(db, categoryId) {
  if (!categoryId) return;
  const category = await db.category.findFirst({ where: { id: categoryId } });
  if (!category) throw ApiError.badRequest('CATEGORY_NOT_FOUND', 'Category not found');
}

export async function listProducts(db) {
  return db.product.findMany({ orderBy: { name: 'asc' } });
}

export async function getProduct(db, productId) {
  const product = await db.product.findFirst({ where: { id: productId } });
  if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');
  return product;
}

export async function createProduct(db, data) {
  await assertCategoryBelongsToTenant(db, data.categoryId);

  if (data.sku) {
    const existing = await db.product.findFirst({ where: { sku: data.sku } });
    if (existing) throw ApiError.conflict('SKU_TAKEN', 'A product with this SKU already exists');
  }

  return db.product.create({ data });
}

export async function updateProduct(db, productId, data) {
  const product = await db.product.findFirst({ where: { id: productId } });
  if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');

  await assertCategoryBelongsToTenant(db, data.categoryId);

  if (data.sku && data.sku !== product.sku) {
    const existing = await db.product.findFirst({ where: { sku: data.sku } });
    if (existing) throw ApiError.conflict('SKU_TAKEN', 'A product with this SKU already exists');
  }

  return db.product.update({ where: { id: productId }, data });
}
