import * as productsService from './products.service.js';
import * as inventoryService from '../inventory/inventory.service.js';

// Composed here rather than in either service: products and inventory stay
// independently owned (their own module, their own tests), and presenting
// stock alongside catalog data is a view concern, not something products.
// service.js should need to import inventory.service.js to know about.

export async function list(req, res, next) {
  try {
    const products = await productsService.listProducts(req.context.db);
    const stockByProduct = await inventoryService.currentStockByProduct(
      req.context.db,
      products.map((p) => p.id),
    );
    res.json(products.map((p) => ({ ...p, currentStock: stockByProduct[p.id] ?? 0 })));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const product = await productsService.getProduct(req.context.db, req.validated.params.productId);
    const currentStock = await inventoryService.getCurrentStock(req.context.db, product.id);
    res.json({ ...product, currentStock });
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
