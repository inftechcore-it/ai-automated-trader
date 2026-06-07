import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { fail } from '../utils/apiResponse.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return fail(res, 401, 'Authentication required', 'AUTH_REQUIRED');
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch {
    return fail(res, 401, 'Invalid or expired token', 'INVALID_TOKEN');
  }
}
