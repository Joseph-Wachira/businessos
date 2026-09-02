import { z } from 'zod';

export const createBusinessSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    currency: z.string().length(3).optional(),
    timezone: z.string().min(1).optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});
