import * as inventoryService from './inventory.service.js';

export async function listMovements(req, res, next) {
  try {
    res.json(await inventoryService.listMovements(req.context.db, req.validated.params.productId));
  } catch (err) {
    next(err);
  }
}

export async function recordMovement(req, res, next) {
  try {
    const movement = await inventoryService.recordMovement(req.context.db, {
      productId: req.validated.params.productId,
      reason: req.validated.body.reason,
      quantity: req.validated.body.quantity,
      note: req.validated.body.note,
      actorUserId: req.user.id,
    });
    res.status(201).json(movement);
  } catch (err) {
    next(err);
  }
}
