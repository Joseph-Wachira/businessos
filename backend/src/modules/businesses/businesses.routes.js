import { Router } from 'express';
import { requireAuth } from '../../middleware/auth/requireAuth.js';
import { requireTenant } from '../../middleware/auth/requireTenant.js';
import { requirePermission } from '../../middleware/auth/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../rbac/permissions.js';
import * as businessesController from './businesses.controller.js';
import {
  createBusinessSchema,
  businessIdParamSchema,
  inviteMemberSchema,
  revokeInvitationSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
} from './businesses.schemas.js';

const router = Router();

router.use(requireAuth);

// Deliberately no requireTenant here: this is how a user with zero
// memberships bootstraps their first business.
router.post('/', validate(createBusinessSchema), businessesController.create);
router.get('/', businessesController.listMine);

// validate() runs before requireTenant everywhere below: a malformed
// businessId/membershipId/invitationId should come back as a clean 400,
// not reach a Prisma query on a UUID column and surface as a 500.
router.get('/:businessId', validate(businessIdParamSchema), requireTenant, businessesController.getOne);

// Listing members needs no extra permission beyond being a member at all
// (any role can see their coworkers); invite/role-change/remove are gated
// per-permission below.
router.get(
  '/:businessId/members',
  validate(businessIdParamSchema),
  requireTenant,
  businessesController.listMembers,
);
router.patch(
  '/:businessId/members/:membershipId',
  validate(updateMemberRoleSchema),
  requireTenant,
  requirePermission(PERMISSIONS.BUSINESS_UPDATE_MEMBER_ROLE),
  businessesController.updateMemberRole,
);
router.delete(
  '/:businessId/members/:membershipId',
  validate(removeMemberSchema),
  requireTenant,
  requirePermission(PERMISSIONS.BUSINESS_REMOVE_MEMBER),
  businessesController.removeMember,
);

router.get(
  '/:businessId/invitations',
  validate(businessIdParamSchema),
  requireTenant,
  requirePermission(PERMISSIONS.BUSINESS_INVITE_MEMBER),
  businessesController.listInvitations,
);
router.post(
  '/:businessId/invitations',
  validate(inviteMemberSchema),
  requireTenant,
  requirePermission(PERMISSIONS.BUSINESS_INVITE_MEMBER),
  businessesController.inviteMember,
);
router.delete(
  '/:businessId/invitations/:invitationId',
  validate(revokeInvitationSchema),
  requireTenant,
  requirePermission(PERMISSIONS.BUSINESS_INVITE_MEMBER),
  businessesController.revokeInvitation,
);

export default router;
