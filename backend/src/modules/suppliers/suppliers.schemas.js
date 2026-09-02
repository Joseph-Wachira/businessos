import { z } from 'zod';

const supplierFields = {
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
};

export const createSupplierSchema = z.object({
  body: z.object(supplierFields),
  params: z.object({}),
  query: z.object({}),
});

export const updateSupplierSchema = z.object({
  body: z.object({ ...supplierFields, name: supplierFields.name.optional() }),
  params: z.object({ supplierId: z.string().uuid() }),
  query: z.object({}),
});

export const supplierIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({ supplierId: z.string().uuid() }),
  query: z.object({}),
});
