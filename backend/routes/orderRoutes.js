import { Router } from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { getOrder, listOrders, placeOrder } from '../controllers/orderController.js';

const router = Router();

router.get('/', requireAuth, listOrders);
router.get('/:id', requireAuth, param('id').isInt(), validate, getOrder);
router.post(
  '/place',
  requireAuth,
  body('sessionId').isInt(),
  body('symbol').trim().notEmpty(),
  body('exchangeName').trim().notEmpty(),
  body('orderType').isIn(['market', 'limit']),
  body('side').isIn(['buy', 'sell']),
  body('quantity').isFloat({ gt: 0 }),
  body('price').optional({ nullable: true }).isFloat({ gt: 0 }),
  body('mode').isIn(['paper', 'live']),
  validate,
  placeOrder
);

export default router;
