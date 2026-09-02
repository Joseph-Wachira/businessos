import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

// Postgres's unique constraint on User.email is case-sensitive, and nothing
// downstream re-checks case — normalizing at this one boundary is what makes
// "Jane@x.com" and "jane@x.com" the same account everywhere (register,
// login, password reset all validate through one of the schemas below).
const email = z
  .string()
  .email()
  .transform((value) => value.trim().toLowerCase());

export const registerSchema = z.object({
  body: z.object({
    email,
    password,
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email }),
  params: z.object({}),
  query: z.object({}),
});

export const resetPasswordSchema = z.object({
  body: z.object({ token: z.string().min(1), newPassword: password }),
  params: z.object({}),
  query: z.object({}),
});

export const verifyEmailSchema = z.object({
  body: z.object({ token: z.string().min(1) }),
  params: z.object({}),
  query: z.object({}),
});
