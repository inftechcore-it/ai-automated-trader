import { Router } from 'express';
import { query as validateQuery } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { history, quote, search } from '../controllers/marketController.js';

const router = Router();

router.get('/quote', requireAuth, validateQuery('symbol').trim().notEmpty(), validate, quote);
router.get('/history', requireAuth, validateQuery('symbol').trim().notEmpty(), validate, history);
router.get('/search', requireAuth, validateQuery('q').optional().trim(), validate, search);

export default router;
