import { ApiError } from '../../utils/ApiError.js';

// db is always the tenant-scoped client (req.context.db) — this module has
// no legitimate reason to ever import the raw prisma singleton, and the
// ESLint rule for modules/**/*.service.js enforces that.

export async function listCategories(db) {
  return db.category.findMany({ orderBy: { name: 'asc' } });
}

export async function createCategory(db, { name }) {
  return db.category.create({ data: { name } });
}

export async function updateCategory(db, categoryId, { name }) {
  const category = await db.category.findFirst({ where: { id: categoryId } });
  if (!category) throw ApiError.notFound('CATEGORY_NOT_FOUND', 'Category not found');
  return db.category.update({ where: { id: categoryId }, data: { name } });
}

export async function deleteCategory(db, categoryId) {
  const category = await db.category.findFirst({ where: { id: categoryId } });
  if (!category) throw ApiError.notFound('CATEGORY_NOT_FOUND', 'Category not found');
  // Products in this category are not deleted or blocked — they just lose
  // their category (see Product.category onDelete: SetNull in schema.prisma).
  await db.category.delete({ where: { id: categoryId } });
}
