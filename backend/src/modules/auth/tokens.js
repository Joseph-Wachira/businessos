import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { generateRawToken, hashToken } from '../../utils/cryptoTokens.js';
import { auditLog } from '../../lib/audit.js';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/auth';

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, globalRole: user.globalRole }, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_ACCESS_SECRET);
}

function refreshExpiry() {
  return new Date(Date.now() + config.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
}

export async function issueRefreshToken({ userId, familyId, createdByIp, userAgent }) {
  const rawToken = generateRawToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      familyId: familyId ?? crypto.randomUUID(),
      expiresAt: refreshExpiry(),
      createdByIp,
      userAgent,
    },
  });
  return rawToken;
}

export class RefreshTokenError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

/**
 * Rotation-with-reuse-detection: presenting an already-rotated (revoked)
 * token is treated as a theft signal and kills the whole family, forcing
 * re-login on every device sharing that session lineage.
 */
export async function rotateRefreshToken(rawToken, { createdByIp, userAgent } = {}) {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) throw new RefreshTokenError('invalid_refresh_token');

  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    auditLog('refresh_token_reuse_detected', {
      actorUserId: existing.userId,
      metadata: { familyId: existing.familyId },
    });
    throw new RefreshTokenError('reuse_detected');
  }

  if (existing.expiresAt < new Date()) {
    throw new RefreshTokenError('expired_refresh_token');
  }

  const nextRawToken = await issueRefreshToken({
    userId: existing.userId,
    familyId: existing.familyId,
    createdByIp,
    userAgent,
  });

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedByTokenHash: hashToken(nextRawToken) },
  });

  return { rawToken: nextRawToken, userId: existing.userId };
}

export async function revokeRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokensForUser(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function setRefreshCookie(res, rawToken) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: config.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

export function getRefreshCookie(req) {
  return req.cookies?.[REFRESH_COOKIE_NAME];
}
