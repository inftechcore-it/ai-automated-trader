import { query } from '../config/db.js';
import { ok, fail } from '../utils/apiResponse.js';
import { placeOrder as executeOrder, cancelOrder as cancelOrderService, getOpenOrders as getOpenOrdersService } from '../services/tradeExecutor.js';

export async function placeOrder(req, res) {
  const { sessionId, symbol, exchangeName, orderType, side, quantity, price, stopPrice, takeProfitPrice, mode, notes, broker } = req.body;

  try {
    const order = await executeOrder({
      userId: req.user.id,
      sessionId,
      symbol,
      exchangeName,
      orderType,
      side,
      quantity,
      price,
      stopPrice,
      takeProfitPrice,
      mode,
      notes,
      broker
    });
    return ok(res, { order }, 201);
  } catch (error) {
    return fail(res, error.status || 500, error.publicMessage || 'Failed to place order', error.code);
  }
}

export async function cancelOrder(req, res) {
  try {
    const order = await cancelOrderService(Number(req.params.id), req.user.id);
    return ok(res, { order, message: 'Order cancelled successfully' });
  } catch (error) {
    return fail(res, error.status || 500, error.publicMessage || 'Failed to cancel order', error.code);
  }
}

export async function listOrders(req, res) {
  const { limit = 50, offset = 0, status, symbol } = req.query;

  let sql = 'SELECT * FROM orders WHERE user_id = :userId';
  const params = { userId: req.user.id };

  if (status) {
    sql += ' AND status = :status';
    params.status = status;
  }

  if (symbol) {
    sql += ' AND symbol = :symbol';
    params.symbol = symbol;
  }

  sql += ' ORDER BY created_at DESC LIMIT :limit OFFSET :offset';
  params.limit = Number(limit);
  params.offset = Number(offset);

  const orders = await query(sql, params);

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM orders WHERE user_id = :userId';
  const countParams = { userId: req.user.id };
  if (status) {
    countSql += ' AND status = :status';
    countParams.status = status;
  }
  if (symbol) {
    countSql += ' AND symbol = :symbol';
    countParams.symbol = symbol;
  }

  const [countResult] = await query(countSql, countParams);

  return ok(res, {
    orders,
    pagination: {
      total: countResult.total,
      limit: Number(limit),
      offset: Number(offset)
    }
  });
}

export async function getOrder(req, res) {
  const [order] = await query('SELECT * FROM orders WHERE id = :id AND user_id = :userId', {
    id: req.params.id,
    userId: req.user.id
  });
  if (!order) return fail(res, 404, 'Order not found', 'ORDER_NOT_FOUND');
  return ok(res, { order });
}

export async function getOpenOrders(req, res) {
  const { sessionId } = req.query;
  try {
    const orders = await getOpenOrdersService(req.user.id, sessionId ? Number(sessionId) : null);
    return ok(res, { orders });
  } catch (error) {
    return fail(res, error.status || 500, error.publicMessage || 'Failed to get open orders', error.code);
  }
}
