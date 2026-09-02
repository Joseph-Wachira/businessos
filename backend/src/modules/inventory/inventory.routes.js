import { Router } from 'express';
import { requireAuth } from '../../middleware/auth/requireAuth.js';
import { requireTenant } from '../../middleware/auth/requireTenant.js';
import { requirePermission } from '../../middleware/auth/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../rbac/permissions.js';
import * as inventoryController from './inventory.controller.js';
import { recordMovementSchema, productIdParamSchema } from './inventory.schemas.js';

const router = Router();

router.use(requireAuth, requireTenant);

// Viewing movement history needs no special permission (like viewing
// members) — it's writing a movement that's restricted.
router.get('/:productId/movements', validate(productIdParamSchema), inventoryController.listMovements);
router.post(
  '/:productId/movements',
  validate(recordMovementSchema),
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  inventoryController.recordMovement,
);

export default router;
