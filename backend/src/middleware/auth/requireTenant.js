import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { forTenant } from '../../db/tenantScope.js';
import { ApiError } from '../../utils/ApiError.js';

const uuid = z.string().uuid();

/**
 * Resolves which business the request is acting on and verifies the
 * authenticated user has a live Membership in it — re-checked on every
 * request rather than trusted from a token claim, so a membership revoked
 * mid-session is caught immediately, not just at next login.
 *
 * The business context travels as a header (not a JWT claim) because a
 * user can belong to several businesses and switch the active one without
 * re-authenticating.
 */
export async function requireTenant(req, res, next) {
  const businessId = req.header('X-Business-Id');
  if (!businessId) {
    return next(
      ApiError.badRequest('BUSINESS_CONTEXT_REQUIRED', 'X-Business-Id header is required'),
    );
  }
  if (!uuid.safeParse(businessId).success) {
    return next(ApiError.badRequest('BUSINESS_CONTEXT_INVALID', 'X-Business-Id header must be a valid UUID'));
  }

  // A route that also carries a :businessId URL segment (e.g. GET
  // /businesses/:businessId) must agree with the header rather than let
  // either one silently win — two different tenant IDs on one request is
  // a client bug worth rejecting, not resolving by picking a favorite.
  if (req.params.businessId && req.params.businessId !== businessId) {
    return next(
      ApiError.badRequest(
        'BUSINESS_CONTEXT_MISMATCH',
        'X-Business-Id header does not match the business in the URL',
      ),
    );
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: req.user.id, businessId } },
  });

  // 404, not 403: confirming a business exists to a user with no access to it
  // is itself an information leak.
  if (!membership) {
    return next(ApiError.notFound('BUSINESS_NOT_FOUND', 'Business not found'));
  }

  req.context = {
    businessId,
    role: membership.role,
    db: forTenant(prisma, businessId),
  };
  next();
}
