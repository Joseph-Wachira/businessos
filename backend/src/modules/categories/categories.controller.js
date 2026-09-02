import * as categoriesService from './categories.service.js';

export async function list(req, res, next) {
  try {
    res.json(await categoriesService.listCategories(req.context.db));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const category = await categoriesService.createCategory(req.context.db, req.validated.body);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const category = await categoriesService.updateCategory(
      req.context.db,
      req.validated.params.categoryId,
      req.validated.body,
    );
    res.json(category);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await categoriesService.deleteCategory(req.context.db, req.validated.params.categoryId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
