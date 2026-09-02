import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

export function hashPassword(plain) {
  return bcrypt.hash(plain, config.BCRYPT_SALT_ROUNDS);
}

export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
