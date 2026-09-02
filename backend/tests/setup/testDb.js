import 'dotenv/config';
import { beforeEach } from 'vitest';
import { prisma } from '../../src/db/prisma.js';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://businessos:businessos@localhost:5433/businessos_test?schema=public';
process.env.NODE_ENV = 'test';
// A single test file can easily send more requests than a real client would
// in the rate limiter's window (each test in a flow like register -> login ->
// refresh -> logout adds up fast), and every test in the file shares one
// Express app instance and therefore one limiter counter. Rate limiting
// itself is this middleware's job to get right, not something every
// unrelated auth/tenancy test should have to budget requests around.
process.env.AUTH_RATE_LIMIT_MAX = '1000';

beforeEach(async () => {
  const tables = [
    'refresh_tokens',
    'password_reset_tokens',
    'email_verification_tokens',
    'invitations',
    'memberships',
    'businesses',
    'users',
  ];
  await prisma.$transaction(
    tables.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)),
  );
});
