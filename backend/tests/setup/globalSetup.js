import { execSync } from 'node:child_process';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://businessos:businessos@localhost:5432/businessos_test?schema=public';

export async function setup() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
