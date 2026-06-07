import { validationResult } from 'express-validator';
import { fail } from '../utils/apiResponse.js';

export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  return fail(res, 422, 'Invalid request input', 'VALIDATION_ERROR', result.array());
}
