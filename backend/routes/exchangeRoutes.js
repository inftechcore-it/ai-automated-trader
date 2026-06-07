import { Router } from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { connectExchange, connected, disconnect, supported, updateExchange } from '../controllers/exchangeController.js';

const router = Router();

router.get('/supported', requireAuth, supported);
router.get('/connected', requireAuth, connected);
router.post(
  '/connect',
  requireAuth,
  body('exchangeName').trim().notEmpty(),
  body('exchangeType').isIn(['stock', 'crypto']),
  body('apiKey').trim().notEmpty(),
  body('apiSecret').trim().notEmpty(),
  validate,
  connectExchange
);
router.patch('/:id', requireAuth, param('id').isInt(), body('isActive').isBoolean(), validate, updateExchange);
router.delete('/:id', requireAuth, param('id').isInt(), validate, disconnect);

export default router;
