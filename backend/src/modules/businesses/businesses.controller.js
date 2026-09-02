import * as businessesService from './businesses.service.js';

export async function create(req, res, next) {
  try {
    const business = await businessesService.createBusiness(req.user.id, req.validated.body);
    res.status(201).json(business);
  } catch (err) {
    next(err);
  }
}

export async function listMine(req, res, next) {
  try {
    res.json(await businessesService.listMyBusinesses(req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    res.json(await businessesService.getBusiness(req.context.businessId));
  } catch (err) {
    next(err);
  }
}

export async function listMembers(req, res, next) {
  try {
    res.json(await businessesService.listMembers(req.context.db));
  } catch (err) {
    next(err);
  }
}

export async function listInvitations(req, res, next) {
  try {
    res.json(await businessesService.listPendingInvitations(req.context.db));
  } catch (err) {
    next(err);
  }
}

export async function inviteMember(req, res, next) {
  try {
    const invitation = await businessesService.inviteMember({
      db: req.context.db,
      businessId: req.context.businessId,
      actingUserId: req.user.id,
      actingRole: req.context.role,
      email: req.validated.body.email,
      role: req.validated.body.role,
    });
    res.status(201).json(invitation);
  } catch (err) {
    next(err);
  }
}

export async function revokeInvitation(req, res, next) {
  try {
    await businessesService.revokeInvitation({
      db: req.context.db,
      businessId: req.context.businessId,
      actingUserId: req.user.id,
      invitationId: req.validated.params.invitationId,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const updated = await businessesService.updateMemberRole({
      db: req.context.db,
      businessId: req.context.businessId,
      actingUserId: req.user.id,
      actingRole: req.context.role,
      membershipId: req.validated.params.membershipId,
      role: req.validated.body.role,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req, res, next) {
  try {
    await businessesService.removeMember({
      db: req.context.db,
      businessId: req.context.businessId,
      actingUserId: req.user.id,
      membershipId: req.validated.params.membershipId,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
