import { ApiError } from '../utils/ApiError.js';

export function validate(schema) {
  return (req, res, next) => {
    // express.json() leaves req.body as undefined for a request with no
    // body (GET/DELETE, or any request without a matching Content-Type) —
    // it does not set `{}`. A schema for a bodyless route naturally
    // declares `body: z.object({})`, which zod rejects for `undefined`, so
    // this normalizes the absent case to `{}` rather than requiring every
    // such schema to remember `.optional()`.
    const result = schema.safeParse({ body: req.body ?? {}, params: req.params, query: req.query });
    if (!result.success) {
      return next(
        ApiError.badRequest('VALIDATION_ERROR', 'Invalid request', result.error.flatten()),
      );
    }
    req.validated = result.data;
    next();
  };
}
