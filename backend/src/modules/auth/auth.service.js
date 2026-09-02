import { prisma } from '../../db/prisma.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { generateRawToken, hashToken } from '../../utils/cryptoTokens.js';
import { sendMail } from '../../lib/mailer.js';
import { auditLog } from '../../lib/audit.js';
import { config } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  signAccessToken,
  issueRefreshToken,
  revokeAllRefreshTokensForUser,
} from './tokens.js';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const LOCKOUT_THRESHOLD = 5;

// A password hash for a nonexistent user, verified against on every login
// attempt against an unknown email so response timing doesn't distinguish
// "no such user" from "wrong password". Computed once lazily (not hardcoded)
// so it's guaranteed to be a valid hash for whatever bcrypt version/cost is in use.
let dummyHashPromise;
function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword('timing-safety-dummy-password');
  return dummyHashPromise;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isEmailVerified: user.isEmailVerified,
    globalRole: user.globalRole,
  };
}

// A brand-new user can have pending invitations from several different
// businesses at once, so this is inherently cross-tenant and can't go
// through a single forTenant()-scoped client — raw prisma is the correct
// tool here, same as membershipsFor()/listMyBusinesses() below.
async function acceptPendingInvitations(user) {
  const pending = await prisma.invitation.findMany({ where: { email: user.email, status: 'PENDING' } });
  if (pending.length === 0) return [];

  await prisma.$transaction([
    ...pending.map((invitation) =>
      prisma.membership.create({ data: { userId: user.id, businessId: invitation.businessId, role: invitation.role } }),
    ),
    ...pending.map((invitation) =>
      prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', resolvedAt: new Date() } }),
    ),
  ]);

  auditLog('invitations_accepted_on_register', {
    actorUserId: user.id,
    metadata: { count: pending.length, businessIds: pending.map((i) => i.businessId) },
  });
  return membershipsFor(user.id);
}

async function membershipsFor(userId) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { business: { select: { id: true, name: true, slug: true } } },
  });
  return memberships.map((m) => ({
    businessId: m.businessId,
    businessName: m.business.name,
    businessSlug: m.business.slug,
    role: m.role,
  }));
}

export async function register({ email, password, firstName, lastName }, { ip, userAgent }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Pay the same bcrypt cost as the new-user path below so response
    // timing doesn't also reveal which branch ran — the response body is
    // already identical (see auth.controller.js); latency was the one
    // remaining side-channel.
    await comparePassword(password, await getDummyHash());
    auditLog('register_attempted_existing_email', { metadata: { email } });
    return { alreadyRegistered: true };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName },
  });

  const { rawToken: emailVerificationRawToken } = await issueEmailVerificationToken(user);
  const memberships = await acceptPendingInvitations(user);

  const accessToken = signAccessToken(user);
  const refreshRawToken = await issueRefreshToken({ userId: user.id, createdByIp: ip, userAgent });

  auditLog('user_registered', { actorUserId: user.id });

  return {
    alreadyRegistered: false,
    user: publicUser(user),
    memberships,
    accessToken,
    refreshRawToken,
    emailVerificationRawToken,
  };
}

export async function login({ email, password }, { ip, userAgent }) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await comparePassword(password, await getDummyHash());
    auditLog('login_failed', { metadata: { email, reason: 'no_such_user' } });
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    auditLog('login_blocked_locked', { actorUserId: user.id });
    throw ApiError.unauthorized('ACCOUNT_LOCKED', 'Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    auditLog('login_failed', { actorUserId: user.id, metadata: { reason: 'disabled' } });
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= LOCKOUT_THRESHOLD;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failedLoginCount,
        // Flat 2-minute lockout once failed attempts reach the threshold;
        // the counter then resets to 0, so a later run of failures starts
        // the same 2-minute clock again rather than escalating. DoS-
        // resistant (no permanent lockout against the real owner) at the
        // cost of a weaker deterrent — an attacker can wait out any single
        // lockout at a constant rate. Real escalation would need a
        // persisted lockout-cycle counter, which doesn't exist yet.
        lockedUntil: shouldLock ? new Date(Date.now() + 2 * 60 * 1000) : null,
      },
    });
    auditLog('login_failed', { actorUserId: user.id, metadata: { reason: 'bad_password' } });
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  const accessToken = signAccessToken(user);
  const refreshRawToken = await issueRefreshToken({ userId: user.id, createdByIp: ip, userAgent });
  const memberships = await membershipsFor(user.id);

  auditLog('login_succeeded', { actorUserId: user.id });

  return { user: publicUser(user), memberships, accessToken, refreshRawToken };
}

export async function logout(userId) {
  auditLog('logout', { actorUserId: userId });
}

async function issueEmailVerificationToken(user) {
  // Invalidate any outstanding unused tokens first so a stale link (leaked
  // via a shared inbox, browser history, or a forwarded email) stops
  // working the moment a newer one is requested, not just once it's used.
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = generateRawToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });
  const link = `${config.FRONTEND_URL}/verify-email?token=${rawToken}`;
  await sendMail({
    to: user.email,
    subject: 'Verify your BusinessOS email',
    html: `<p>Confirm your email address:</p><p><a href="${link}">${link}</a></p>`,
  });
  return { rawToken };
}

export async function resendVerificationEmail(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isEmailVerified) return null;
  return issueEmailVerificationToken(user);
}

export async function verifyEmail(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest('INVALID_TOKEN', 'Invalid or expired verification token');
  }

  const { count } = await prisma.emailVerificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count !== 1) {
    throw ApiError.badRequest('INVALID_TOKEN', 'Invalid or expired verification token');
  }

  await prisma.user.update({ where: { id: record.userId }, data: { isEmailVerified: true } });
  auditLog('email_verified', { actorUserId: record.userId });
}

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null; // generic response regardless, no enumeration

  // Same reasoning as issueEmailVerificationToken: a newer reset link
  // should retire any older ones, not just race ahead of them.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  const link = `${config.FRONTEND_URL}/reset-password?token=${rawToken}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your BusinessOS password',
    html: `<p>Reset your password:</p><p><a href="${link}">${link}</a></p>`,
  });
  auditLog('password_reset_requested', { actorUserId: user.id });
  return { rawToken };
}

export async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest('INVALID_TOKEN', 'Invalid or expired reset token');
  }

  // Atomic conditional update, not read-then-write: closes the race where
  // two concurrent requests both observe usedAt === null.
  const { count } = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count !== 1) {
    throw ApiError.badRequest('INVALID_TOKEN', 'Invalid or expired reset token');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash, passwordChangedAt: new Date() },
  });

  // A reset is often a compromise-response: kill every existing session.
  await revokeAllRefreshTokensForUser(record.userId);
  auditLog('password_reset_completed', { actorUserId: record.userId });
}

export { membershipsFor, publicUser };
