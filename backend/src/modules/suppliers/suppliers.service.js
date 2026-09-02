import { ApiError } from '../../utils/ApiError.js';

export async function listSuppliers(db) {
  return db.supplier.findMany({ orderBy: { name: 'asc' } });
}

export async function getSupplier(db, supplierId) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId } });
  if (!supplier) throw ApiError.notFound('SUPPLIER_NOT_FOUND', 'Supplier not found');
  return supplier;
}

export async function createSupplier(db, data) {
  return db.supplier.create({ data });
}

export async function updateSupplier(db, supplierId, data) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId } });
  if (!supplier) throw ApiError.notFound('SUPPLIER_NOT_FOUND', 'Supplier not found');
  return db.supplier.update({ where: { id: supplierId }, data });
}
