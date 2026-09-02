import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'owner@demo.businessos.local' },
    update: {},
    create: {
      email: 'owner@demo.businessos.local',
      passwordHash,
      firstName: 'Demo',
      lastName: 'Owner',
      isEmailVerified: true,
    },
  });

  const business = await prisma.business.upsert({
    where: { slug: 'demo-shop' },
    update: {},
    create: { name: 'Demo Shop', slug: 'demo-shop' },
  });

  await prisma.membership.upsert({
    where: { userId_businessId: { userId: user.id, businessId: business.id } },
    update: {},
    create: { userId: user.id, businessId: business.id, role: 'OWNER' },
  });

  console.log(`Seeded demo user "${user.email}" / "Password123" as OWNER of "${business.name}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
