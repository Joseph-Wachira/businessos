import { z } from 'zod';

const productFields = {
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(100).optional(),
  barcode: z.string().min(1).max(100).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
  costPrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  minStock: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
};

export const createProductSchema = z.object({
  body: z.object(productFields),
  params: z.object({}),
  query: z.object({}),
});

export const updateProductSchema = z.object({
  body: z.object({ ...productFields, name: productFields.name.optional(), status: z.enum(['ACTIVE', 'INACTIVE']).optional() }),
  params: z.object({ productId: z.string().uuid() }),
  query: z.object({}),
});

export const productIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({ productId: z.string().uuid() }),
  query: z.object({}),
});
