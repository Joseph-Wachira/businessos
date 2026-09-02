import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({ name: z.string().min(1).max(200) }),
  params: z.object({}),
  query: z.object({}),
});

export const updateCategorySchema = z.object({
  body: z.object({ name: z.string().min(1).max(200) }),
  params: z.object({ categoryId: z.string().uuid() }),
  query: z.object({}),
});

export const categoryIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({ categoryId: z.string().uuid() }),
  query: z.object({}),
});
