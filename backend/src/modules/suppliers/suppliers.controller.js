import * as suppliersService from './suppliers.service.js';

export async function list(req, res, next) {
  try {
    res.json(await suppliersService.listSuppliers(req.context.db));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    res.json(await suppliersService.getSupplier(req.context.db, req.validated.params.supplierId));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const supplier = await suppliersService.createSupplier(req.context.db, req.validated.body);
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const supplier = await suppliersService.updateSupplier(
      req.context.db,
      req.validated.params.supplierId,
      req.validated.body,
    );
    res.json(supplier);
  } catch (err) {
    next(err);
  }
}
