import { ApiError } from '../utils/ApiError.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      return next(
        ApiError.badRequest('VALIDATION_ERROR', 'Invalid request', result.error.flatten()),
      );
    }
    req.validated = result.data;
    next();
  };
}
