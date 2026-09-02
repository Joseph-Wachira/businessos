import * as purchasesService from './purchases.service.js';

export async function list(req, res, next) {
  try {
    res.json(await purchasesService.listPurchases(req.context.db));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    res.json(await purchasesService.getPurchase(req.context.db, req.validated.params.purchaseId));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const purchase = await purchasesService.createPurchase(req.context.db, {
      ...req.validated.body,
      actorUserId: req.user.id,
    });
    res.status(201).json(purchase);
  } catch (err) {
    next(err);
  }
}

export async function receive(req, res, next) {
  try {
    const purchase = await purchasesService.receivePurchase(
      req.context.db,
      req.validated.params.purchaseId,
      req.user.id,
    );
    res.json(purchase);
  } catch (err) {
    next(err);
  }
}

export async function cancel(req, res, next) {
  try {
    const purchase = await purchasesService.cancelPurchase(req.context.db, req.validated.params.purchaseId);
    res.json(purchase);
  } catch (err) {
    next(err);
  }
}
