import { ApiError } from '../../utils/ApiError.js';
import * as authService from './auth.service.js';
import {
  setRefreshCookie,
  clearRefreshCookie,
  getRefreshCookie,
  rotateRefreshToken,
  revokeRefreshToken,
  signAccessToken,
  RefreshTokenError,
} from './tokens.js';
import { prisma } from '../../db/prisma.js';

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

export async function register(req, res, next) {
  try {
    const result = await authService.register(req.validated.body, requestMeta(req));

    if (result.alreadyRegistered) {
      // Same generic response shape as a fresh registration, so an
      // enumeration attempt learns nothing.
      return res
        .status(201)
        .json({ message: 'If that email is new, check your inbox to verify your account.' });
    }

    setRefreshCookie(res, result.refreshRawToken);
    res.status(201).json({
      user: result.user,
      memberships: result.memberships,
      accessToken: result.accessToken,
      message: 'If that email is new, check your inbox to verify your account.',
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const result = await authService.login(req.validated.body, requestMeta(req));
    setRefreshCookie(res, result.refreshRawToken);
    res.json({
      user: result.user,
      memberships: result.memberships,
      accessToken: result.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const rawToken = getRefreshCookie(req);
    if (!rawToken) return next(ApiError.unauthorized('MISSING_REFRESH_TOKEN'));

    const { rawToken: nextRawToken, userId } = await rotateRefreshToken(rawToken, requestMeta(req));
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      clearRefreshCookie(res);
      return next(ApiError.unauthorized('INVALID_REFRESH_TOKEN'));
    }

    setRefreshCookie(res, nextRawToken);
    res.json({ accessToken: signAccessToken(user) });
  } catch (err) {
    if (err instanceof RefreshTokenError) {
      clearRefreshCookie(res);
      return next(ApiError.unauthorized('INVALID_REFRESH_TOKEN', 'Session expired, please log in again'));
    }
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const rawToken = getRefreshCookie(req);
    if (rawToken) await revokeRefreshToken(rawToken);
    clearRefreshCookie(res);
    if (req.user) await authService.logout(req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const memberships = await authService.membershipsFor(req.user.id);
    res.json({ user: authService.publicUser(req.user), memberships });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    await authService.requestPasswordReset(req.validated.body.email);
    res.json({ message: 'If that email exists, a password reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.validated.body.token, req.validated.body.newPassword);
    res.json({ message: 'Password updated. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    await authService.verifyEmail(req.validated.body.token);
    res.json({ message: 'Email verified.' });
  } catch (err) {
    next(err);
  }
}

export async function resendVerification(req, res, next) {
  try {
    await authService.resendVerificationEmail(req.user.id);
    res.json({ message: 'If your email is unverified, a new link has been sent.' });
  } catch (err) {
    next(err);
  }
}
