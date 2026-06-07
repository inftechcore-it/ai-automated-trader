import { Router } from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { addWatchlistItem, deleteWatchlistItem, listWatchlist } from '../controllers/watchlistController.js';

const router = Router();

router.get('/', requireAuth, listWatchlist);
router.post(
  '/',
  requireAuth,
  body('symbol').trim().notEmpty(),
  body('exchangeName').trim().notEmpty(),
  validate,
  addWatchlistItem
);
router.delete('/:id', requireAuth, param('id').isInt(), validate, deleteWatchlistItem);

export default router;
