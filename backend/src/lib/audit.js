import { logger } from './logger.js';

/**
 * Structured security/audit event log. Not the full audit-trail system from
 * later stages (no DB table, no UI) — a stable call-site interface so the
 * ~10 call sites here don't need to change when that system is built.
 */
export function auditLog(event, { actorUserId, businessId, metadata } = {}) {
  logger.info({ audit: true, event, actorUserId, businessId, metadata }, `audit:${event}`);
}
