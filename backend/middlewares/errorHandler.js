import { fail } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export function notFound(req, res) {
  return fail(res, 404, 'Route not found', 'NOT_FOUND');
}

export function errorHandler(error, req, res, next) {
  logger.error(error);
  if (res.headersSent) return next(error);
  return fail(
    res,
    error.status || 500,
    error.publicMessage || 'Unexpected server error',
    error.code || 'SERVER_ERROR'
  );
}
