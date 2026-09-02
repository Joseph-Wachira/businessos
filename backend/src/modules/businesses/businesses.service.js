import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { auditLog } from '../../lib/audit.js';

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(name) {
  const base = slugify(name) || 'business';
  let slug = base;
  let suffix = 1;
  while (await prisma.business.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

export async function createBusiness(userId, { name, currency, timezone }) {
  const slug = await uniqueSlug(name);

  const business = await prisma.business.create({
    data: {
      name,
      slug,
      currency: currency ?? 'USD',
      timezone: timezone ?? 'UTC',
      memberships: { create: { userId, role: 'OWNER' } },
    },
  });

  auditLog('business_created', { actorUserId: userId, businessId: business.id });
  return business;
}

export async function listMyBusinesses(userId) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { business: true },
  });
  return memberships.map((m) => ({ ...m.business, role: m.role }));
}

export async function getBusiness(businessId) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw ApiError.notFound('BUSINESS_NOT_FOUND', 'Business not found');
  return business;
}
