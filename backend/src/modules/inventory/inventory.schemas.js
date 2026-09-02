import { z } from 'zod';

// PURCHASE/SALE/TRANSFER are reserved for the future Purchases and
// Sales/POS modules to create programmatically alongside their own
// records — a movement of that reason with no purchase/sale behind it
// would be incoherent data, so this manual endpoint doesn't accept them.
export const recordMovementSchema = z.object({
  body: z.object({
    reason: z.enum(['OPENING_BALANCE', 'ADJUSTMENT', 'DAMAGE', 'RETURN']),
    quantity: z.coerce.number().int(),
    note: z.string().max(500).optional(),
  }),
  params: z.object({ productId: z.string().uuid() }),
  query: z.object({}),
});

export const productIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({ productId: z.string().uuid() }),
  query: z.object({}),
});
