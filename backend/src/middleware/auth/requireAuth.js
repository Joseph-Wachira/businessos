import { verifyAccessToken } from '../../modules/auth/tokens.js';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('MISSING_TOKEN', 'Missing bearer access token'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(ApiError.unauthorized('INVALID_TOKEN', 'Invalid or expired access token'));
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'ACTIVE') {
    return next(ApiError.unauthorized('INVALID_TOKEN', 'Invalid or expired access token'));
  }

  req.user = user;
  next();
}
