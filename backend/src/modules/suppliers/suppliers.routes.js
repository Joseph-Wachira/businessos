import { Router } from 'express';
import { requireAuth } from '../../middleware/auth/requireAuth.js';
import { requireTenant } from '../../middleware/auth/requireTenant.js';
import { requirePermission } from '../../middleware/auth/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../rbac/permissions.js';
import * as suppliersController from './suppliers.controller.js';
import { createSupplierSchema, updateSupplierSchema, supplierIdParamSchema } from './suppliers.schemas.js';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', suppliersController.list);
router.get('/:supplierId', validate(supplierIdParamSchema), suppliersController.getOne);
router.post(
  '/',
  validate(createSupplierSchema),
  requirePermission(PERMISSIONS.SUPPLIERS_MANAGE),
  suppliersController.create,
);
router.patch(
  '/:supplierId',
  validate(updateSupplierSchema),
  requirePermission(PERMISSIONS.SUPPLIERS_MANAGE),
  suppliersController.update,
);

export default router;
