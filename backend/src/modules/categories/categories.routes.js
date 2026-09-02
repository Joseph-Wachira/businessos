import { Router } from 'express';
import { requireAuth } from '../../middleware/auth/requireAuth.js';
import { requireTenant } from '../../middleware/auth/requireTenant.js';
import { requirePermission } from '../../middleware/auth/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../rbac/permissions.js';
import * as categoriesController from './categories.controller.js';
import { createCategorySchema, updateCategorySchema, categoryIdParamSchema } from './categories.schemas.js';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', categoriesController.list);
router.post(
  '/',
  validate(createCategorySchema),
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
  categoriesController.create,
);
router.patch(
  '/:categoryId',
  validate(updateCategorySchema),
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
  categoriesController.update,
);
router.delete(
  '/:categoryId',
  validate(categoryIdParamSchema),
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
  categoriesController.remove,
);

export default router;
