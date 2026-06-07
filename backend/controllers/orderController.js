import { query } from '../config/db.js';
import { ok, fail } from '../utils/apiResponse.js';
import { placeOrder as executeOrder } from '../services/tradeExecutor.js';

export async function placeOrder(req, res) {
  const { sessionId, symbol, exchangeName, orderType, side, quantity, price, mode } = req.body;
  const order = await executeOrder({
    userId: req.user.id,
    sessionId,
    symbol,
    exchangeName,
    orderType,
    side,
    quantity,
    price,
    mode
  });
  return ok(res, { order }, 201);
}

export async function listOrders(req, res) {
  const orders = await query(
    'SELECT * FROM orders WHERE user_id = :userId ORDER BY created_at DESC',
    { userId: req.user.id }
  );
  return ok(res, { orders });
}

export async function getOrder(req, res) {
  const [order] = await query('SELECT * FROM orders WHERE id = :id AND user_id = :userId', {
    id: req.params.id,
    userId: req.user.id
  });
  if (!order) return fail(res, 404, 'Order not found', 'ORDER_NOT_FOUND');
  return ok(res, { order });
}
