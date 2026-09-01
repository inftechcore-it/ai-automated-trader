import { Router } from 'express';
import { body, param, query as validateQuery } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { getOrder, listOrders, placeOrder, cancelOrder, getOpenOrders } from '../controllers/orderController.js';

const router = Router();

router.get('/', requireAuth, listOrders);

router.get('/open', requireAuth, getOpenOrders);

router.get(
  '/:id',
  requireAuth,
  param('id').isInt(),
  validate,
  getOrder
);

router.post(
  '/place',
  requireAuth,
  body('sessionId').isInt(),
  body('symbol').trim().notEmpty(),
  body('exchangeName').trim().notEmpty(),
  body('orderType').isIn(['market', 'limit', 'stop_loss', 'take_profit', 'stop_limit']),
  body('side').isIn(['buy', 'sell']),
  body('quantity').isFloat({ gt: 0 }),
  body('price').optional({ nullable: true }).isFloat({ gt: 0 }),
  body('stopPrice').optional({ nullable: true }).isFloat({ gt: 0 }),
  body('takeProfitPrice').optional({ nullable: true }).isFloat({ gt: 0 }),
  body('mode').isIn(['paper', 'live']),
  body('notes').optional().trim(),
  validate,
  placeOrder
);

router.post(
  '/:id/cancel',
  requireAuth,
  param('id').isInt(),
  validate,
  cancelOrder
);

export default router;
