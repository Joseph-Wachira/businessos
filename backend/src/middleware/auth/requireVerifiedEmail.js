import { ApiError } from '../../utils/ApiError.js';

/**
 * Not yet applied to any route. Email verification is fully implemented
 * (token issue/verify/resend, single-use, invalidated on reissue) but
 * nothing currently gates on the result — this middleware exists so that
 * decision is a one-line addition to a route once made, rather than a
 * reason to skip enforcing it at all. Deliberately not wired in here: which
 * actions should require a verified email (creating a business? inviting
 * teammates? nothing yet?) is a product call, not a default worth guessing.
 */
export function requireVerifiedEmail(req, res, next) {
  if (!req.user?.isEmailVerified) {
    return next(ApiError.forbidden('EMAIL_NOT_VERIFIED', 'Please verify your email address first'));
  }
  next();
}
