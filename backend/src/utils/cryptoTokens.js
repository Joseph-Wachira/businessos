import crypto from 'node:crypto';

export function generateRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
