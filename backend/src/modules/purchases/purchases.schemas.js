import { z } from 'zod';

const purchaseItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().min(0),
});

export const createPurchaseSchema = z.object({
  body: z.object({
    supplierId: z.string().uuid(),
    note: z.string().max(500).optional(),
    items: z.array(purchaseItemSchema).min(1),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const purchaseIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({ purchaseId: z.string().uuid() }),
  query: z.object({}),
});
