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
