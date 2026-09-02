import { Router } from 'express';
import { requireAuth } from '../../middleware/auth/requireAuth.js';
import { requireTenant } from '../../middleware/auth/requireTenant.js';
import { requirePermission } from '../../middleware/auth/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../rbac/permissions.js';
import * as purchasesController from './purchases.controller.js';
import { createPurchaseSchema, purchaseIdParamSchema } from './purchases.schemas.js';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', purchasesController.list);
router.get('/:purchaseId', validate(purchaseIdParamSchema), purchasesController.getOne);
router.post(
  '/',
  validate(createPurchaseSchema),
  requirePermission(PERMISSIONS.PURCHASES_MANAGE),
  purchasesController.create,
);
router.post(
  '/:purchaseId/receive',
  validate(purchaseIdParamSchema),
  requirePermission(PERMISSIONS.PURCHASES_MANAGE),
  purchasesController.receive,
);
router.post(
  '/:purchaseId/cancel',
  validate(purchaseIdParamSchema),
  requirePermission(PERMISSIONS.PURCHASES_MANAGE),
  purchasesController.cancel,
);

export default router;
