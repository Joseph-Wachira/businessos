import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { auditLog } from '../../lib/audit.js';
import { sendMail } from '../../lib/mailer.js';
import { config } from '../../config/env.js';

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

// Everything below acts within a single, already-resolved business context
// (requireTenant has verified the caller is a member), so it takes the
// tenant-scoped `db` client (req.context.db) rather than the raw prisma
// singleton — a query here that forgot to filter by business would be a
// cross-tenant leak, and the scoped client makes that structurally
// impossible instead of a habit to remember.

export async function listMembers(db) {
  const memberships = await db.membership.findMany({
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    email: m.user.email,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    role: m.role,
    createdAt: m.createdAt,
  }));
}

export async function listPendingInvitations(db) {
  return db.invitation.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function inviteMember({ db, businessId, actingUserId, actingRole, email, role }) {
  // A MANAGER holds BUSINESS_INVITE_MEMBER but not BUSINESS_UPDATE_MEMBER_ROLE
  // (see rolePermissions.js) — without this check they could still mint a
  // co-owner by inviting one directly, bypassing that restriction entirely.
  if (role === 'OWNER' && actingRole !== 'OWNER') {
    throw ApiError.forbidden('CANNOT_ASSIGN_OWNER', 'Only an existing owner can assign the owner role');
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await db.membership.findFirst({ where: { userId: existingUser.id } });
    if (existingMembership) {
      throw ApiError.conflict('ALREADY_MEMBER', 'This person is already a member of this business');
    }
  }

  const pendingDuplicate = await db.invitation.findFirst({ where: { email, status: 'PENDING' } });
  if (pendingDuplicate) {
    throw ApiError.conflict('INVITATION_PENDING', 'An invitation is already pending for this email');
  }

  const invitation = await db.invitation.create({
    data: {
      email,
      role,
      invitedByUserId: actingUserId,
      status: existingUser ? 'ACCEPTED' : 'PENDING',
      resolvedAt: existingUser ? new Date() : null,
    },
  });

  if (existingUser) {
    await db.membership.create({ data: { userId: existingUser.id, role } });
    await sendMail({
      to: existingUser.email,
      subject: "You've been added to a business on BusinessOS",
      html: `<p>You've been added as <strong>${role}</strong>. Log in to see it.</p>`,
    });
  } else {
    await sendMail({
      to: email,
      subject: "You're invited to join a business on BusinessOS",
      html: `<p>You've been invited to join as <strong>${role}</strong>. Register at <a href="${config.FRONTEND_URL}/register">${config.FRONTEND_URL}/register</a> using this email address to get access.</p>`,
    });
  }

  auditLog('member_invited', {
    actorUserId: actingUserId,
    businessId,
    metadata: { email, role, immediate: Boolean(existingUser) },
  });
  return invitation;
}

export async function revokeInvitation({ db, businessId, actingUserId, invitationId }) {
  const invitation = await db.invitation.findFirst({ where: { id: invitationId, status: 'PENDING' } });
  if (!invitation) throw ApiError.notFound('INVITATION_NOT_FOUND', 'Invitation not found');

  await db.invitation.update({ where: { id: invitationId }, data: { status: 'REVOKED', resolvedAt: new Date() } });
  auditLog('invitation_revoked', { actorUserId: actingUserId, businessId, metadata: { invitationId, email: invitation.email } });
}

async function assertNotLastOwner(db, membership, action) {
  if (membership.role !== 'OWNER') return;
  const ownerCount = await db.membership.count({ where: { role: 'OWNER' } });
  if (ownerCount <= 1) {
    throw ApiError.conflict('LAST_OWNER', `A business must have at least one owner (cannot ${action} the last one)`);
  }
}

export async function updateMemberRole({ db, businessId, actingUserId, actingRole, membershipId, role }) {
  if (role === 'OWNER' && actingRole !== 'OWNER') {
    throw ApiError.forbidden('CANNOT_ASSIGN_OWNER', 'Only an existing owner can assign the owner role');
  }

  const membership = await db.membership.findFirst({ where: { id: membershipId } });
  if (!membership) throw ApiError.notFound('MEMBER_NOT_FOUND', 'Member not found');

  if (membership.role !== role) await assertNotLastOwner(db, membership, 'demote');

  const updated = await db.membership.update({ where: { id: membershipId }, data: { role } });
  auditLog('member_role_updated', {
    actorUserId: actingUserId,
    businessId,
    metadata: { membershipId, from: membership.role, to: role },
  });
  return updated;
}

export async function removeMember({ db, businessId, actingUserId, membershipId }) {
  const membership = await db.membership.findFirst({ where: { id: membershipId } });
  if (!membership) throw ApiError.notFound('MEMBER_NOT_FOUND', 'Member not found');

  await assertNotLastOwner(db, membership, 'remove');

  await db.membership.delete({ where: { id: membershipId } });
  auditLog('member_removed', {
    actorUserId: actingUserId,
    businessId,
    metadata: { membershipId, removedUserId: membership.userId, role: membership.role },
  });
}
