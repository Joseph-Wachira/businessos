import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function tooManyRequestsHandler(req, res, next) {
  next(ApiError.tooManyRequests());
}

export const globalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Per-IP limiter for auth routes: blunts floods before any bcrypt/DB work runs.
export const authIpLimiter = rateLimit({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Per-account limiter, keyed on normalized email: catches credential stuffing
// against one account spread across many IPs, which the per-IP limiter alone misses.
// In-memory Map is fine for a single instance; move to a shared store (e.g. Redis)
// before running more than one API instance.
const attemptsByEmail = new Map();

function pruneExpired(now) {
  for (const [key, entry] of attemptsByEmail) {
    if (entry.resetAt <= now) attemptsByEmail.delete(key);
  }
}

export function authAccountLimiter(req, res, next) {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  if (!email) return next();

  const now = Date.now();
  if (attemptsByEmail.size > 10000) pruneExpired(now);

  const entry = attemptsByEmail.get(email);
  if (!entry || entry.resetAt <= now) {
    attemptsByEmail.set(email, { count: 1, resetAt: now + config.AUTH_RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > config.AUTH_RATE_LIMIT_MAX) {
    return next(ApiError.tooManyRequests());
  }
  next();
}
