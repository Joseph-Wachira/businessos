import { z } from 'zod';

const email = z
  .string()
  .email()
  .transform((value) => value.trim().toLowerCase());

const businessRole = z.enum(['OWNER', 'MANAGER', 'CASHIER', 'INVENTORY_MANAGER', 'ACCOUNTANT']);

export const createBusinessSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    currency: z.string().length(3).optional(),
    timezone: z.string().min(1).optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const businessIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({ businessId: z.string().uuid() }),
  query: z.object({}),
});

export const inviteMemberSchema = z.object({
  body: z.object({ email, role: businessRole }),
  params: z.object({ businessId: z.string().uuid() }),
  query: z.object({}),
});

export const revokeInvitationSchema = z.object({
  body: z.object({}),
  params: z.object({ businessId: z.string().uuid(), invitationId: z.string().uuid() }),
  query: z.object({}),
});

export const updateMemberRoleSchema = z.object({
  body: z.object({ role: businessRole }),
  params: z.object({ businessId: z.string().uuid(), membershipId: z.string().uuid() }),
  query: z.object({}),
});

export const removeMemberSchema = z.object({
  body: z.object({}),
  params: z.object({ businessId: z.string().uuid(), membershipId: z.string().uuid() }),
  query: z.object({}),
});
