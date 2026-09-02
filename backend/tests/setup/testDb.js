import { beforeEach } from 'vitest';
import { prisma } from '../../src/db/prisma.js';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://businessos:businessos@localhost:5432/businessos_test?schema=public';
process.env.NODE_ENV = 'test';

beforeEach(async () => {
  const tables = [
    'refresh_tokens',
    'password_reset_tokens',
    'email_verification_tokens',
    'memberships',
    'businesses',
    'users',
  ];
  await prisma.$transaction(
    tables.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)),
  );
});
