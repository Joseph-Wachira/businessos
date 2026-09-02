import { ApiError } from '../../utils/ApiError.js';

// Platform-operator guard, structurally separate from tenant RBAC — guards
// future /api/admin/* routes only, never mixed into business-scoped routers.
export function requireSuperAdmin(req, res, next) {
  if (req.user?.globalRole !== 'SUPER_ADMIN') {
    return next(ApiError.forbidden('FORBIDDEN', 'Platform admin only'));
  }
  next();
}
