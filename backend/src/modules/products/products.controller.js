import * as productsService from './products.service.js';

export async function list(req, res, next) {
  try {
    res.json(await productsService.listProducts(req.context.db));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    res.json(await productsService.getProduct(req.context.db, req.validated.params.productId));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const product = await productsService.createProduct(req.context.db, req.validated.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const product = await productsService.updateProduct(
      req.context.db,
      req.validated.params.productId,
      req.validated.body,
    );
    res.json(product);
  } catch (err) {
    next(err);
  }
}
