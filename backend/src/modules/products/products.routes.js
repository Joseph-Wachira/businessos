import { Router } from 'express';
import { requireAuth } from '../../middleware/auth/requireAuth.js';
import { requireTenant } from '../../middleware/auth/requireTenant.js';
import { requirePermission } from '../../middleware/auth/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../rbac/permissions.js';
import * as productsController from './products.controller.js';
import { createProductSchema, updateProductSchema, productIdParamSchema } from './products.schemas.js';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', productsController.list);
router.get('/:productId', validate(productIdParamSchema), productsController.getOne);
router.post(
  '/',
  validate(createProductSchema),
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  productsController.create,
);
router.patch(
  '/:productId',
  validate(updateProductSchema),
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  productsController.update,
);

export default router;
