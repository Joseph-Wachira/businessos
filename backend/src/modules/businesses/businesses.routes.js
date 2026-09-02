import { Router } from 'express';
import { requireAuth } from '../../middleware/auth/requireAuth.js';
import { requireTenant } from '../../middleware/auth/requireTenant.js';
import { validate } from '../../middleware/validate.js';
import * as businessesController from './businesses.controller.js';
import { createBusinessSchema } from './businesses.schemas.js';

const router = Router();

router.use(requireAuth);

// Deliberately no requireTenant here: this is how a user with zero
// memberships bootstraps their first business.
router.post('/', validate(createBusinessSchema), businessesController.create);
router.get('/', businessesController.listMine);

router.get('/:businessId', requireTenant, businessesController.getOne);

export default router;
