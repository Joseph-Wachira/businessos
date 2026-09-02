import { ROLE_PERMISSIONS } from '../../rbac/rolePermissions.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Route handlers declare a permission, never a role — today it resolves
 * from a hardcoded role->permission map, but when granular/custom
 * permissions land (per the product roadmap) only ROLE_PERMISSIONS'
 * resolution source changes (e.g. to a DB-backed table); no route wiring
 * calling requirePermission(...) needs to change.
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    const granted = ROLE_PERMISSIONS[req.context?.role] ?? [];
    if (!granted.includes(permission)) {
      return next(ApiError.forbidden('FORBIDDEN', 'Insufficient permissions'));
    }
    next();
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.context || !roles.includes(req.context.role)) {
      return next(ApiError.forbidden('FORBIDDEN', 'Insufficient role'));
    }
    next();
  };
}
