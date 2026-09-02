import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth/requireAuth.js';
import { authIpLimiter, authAccountLimiter } from '../../middleware/rateLimit.js';
import * as authController from './auth.controller.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schemas.js';

const router = Router();

router.post(
  '/register',
  authIpLimiter,
  authAccountLimiter,
  validate(registerSchema),
  authController.register,
);
router.post(
  '/login',
  authIpLimiter,
  authAccountLimiter,
  validate(loginSchema),
  authController.login,
);
router.post('/refresh', authIpLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);
router.post(
  '/forgot-password',
  authIpLimiter,
  authAccountLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post('/reset-password', authIpLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', requireAuth, authIpLimiter, authController.resendVerification);

export default router;
