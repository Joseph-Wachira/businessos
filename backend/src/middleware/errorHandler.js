import { ApiError } from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(ApiError.notFound('ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const isApiError = err instanceof ApiError;
  const status = isApiError ? err.status : 500;

  if (status >= 500) {
    req.log?.error(err) ?? console.error(err);
  }

  res.status(status).json({
    error: {
      code: isApiError ? err.code : 'INTERNAL_ERROR',
      message: status >= 500 ? 'Internal server error' : err.message,
      details: isApiError ? err.details : undefined,
    },
  });
}
