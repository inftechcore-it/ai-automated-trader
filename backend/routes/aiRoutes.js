import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { analyze, history } from '../controllers/aiController.js';

const router = Router();

router.get('/history', requireAuth, history);
router.post(
  '/analyze',
  requireAuth,
  body('symbol').trim().notEmpty(),
  body('exchange').trim().notEmpty(),
  body('interval').trim().notEmpty(),
  validate,
  analyze
);

export default router;
