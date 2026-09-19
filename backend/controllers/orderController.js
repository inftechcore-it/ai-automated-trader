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
  const {
    limit = 100,
    offset = 0,
    status,
    symbol,
    side,
    source = 'all', // 'all', 'bot', 'manual'
    botId,
    mode,
    exchange
  } = req.query;

  const userId = String(req.user.id);
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // 1. Fetch user's bots list for dropdown filtering
    const userBots = await prisma.botConfig.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        strategyType: true,
        symbol: true,
        exchangeName: true,
        status: true,
        mode: true
      },
      orderBy: { createdAt: 'desc' }
    }).catch(() => []);

    const botsList = userBots.map(b => ({
      id: b.id,
      name: b.name,
      strategyType: b.strategyType,
      symbol: b.symbol,
      exchangeName: b.exchangeName,
      status: b.status,
      mode: b.mode
    }));

    // 2. Fetch Bot Orders if source is 'all' or 'bot'
    let formattedBotOrders = [];
    if (source === 'all' || source === 'bot') {
      const whereClause = {
        botConfig: {
          userId,
          ...(botId ? { id: botId } : {})
        }
      };

      if (status && status !== 'all') {
        const statusMap = {
          'filled': 'FILLED',
          'open': 'OPEN',
          'pending': 'PENDING',
          'cancelled': 'CANCELLED',
          'failed': 'FAILED'
        };
        whereClause.status = statusMap[status.toLowerCase()] || status.toUpperCase();
      }

      if (symbol) {
        whereClause.symbol = { contains: symbol };
      }

      if (side && side !== 'all') {
        whereClause.side = side.toUpperCase();
      }

      const rawBotOrders = await prisma.botOrder.findMany({
        where: whereClause,
        include: {
          botConfig: {
            select: {
              id: true,
              name: true,
              strategyType: true,
              exchangeName: true,
              mode: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit) * 2
      }).catch((err) => {
        console.error('[Orders] Error querying bot orders:', err.message);
        return [];
      });

      formattedBotOrders = rawBotOrders.map(bo => ({
        id: bo.id,
        symbol: bo.symbol,
        exchange: bo.botConfig?.exchangeName || 'Binance',
        exchange_name: bo.botConfig?.exchangeName || 'Binance',
        side: (bo.side || 'BUY').toLowerCase(),
        order_type: (bo.type || 'MARKET').toLowerCase(),
        quantity: Number(bo.quantity),
        price: Number(bo.price || bo.filledPrice || 0),
        stop_price: Number(bo.price || 0),
        filled_quantity: Number(bo.filledQuantity || bo.quantity || 0),
        avg_fill_price: Number(bo.filledPrice || bo.price || 0),
        status: (bo.status || 'FILLED').toLowerCase(),
        mode: (bo.botConfig?.mode || 'PAPER').toLowerCase(),
        created_at: bo.createdAt,
        updated_at: bo.updatedAt,
        filled_at: bo.filledAt || bo.createdAt,
        external_order_id: bo.exchangeOrderId || bo.id,
        fees: Number(bo.fee || 0),
        profit: Number(bo.profit || 0),
        grid_level: bo.gridLevel,
        bot_id: bo.botConfig?.id,
        bot_name: bo.botConfig?.name || 'Trading Bot',
        bot_strategy: bo.botConfig?.strategyType,
        source: 'BOT'
      }));
    }

    // 3. Fetch Manual Orders if source is 'all' or 'manual' and not filtering by a specific botId
    let formattedManualOrders = [];
    if ((source === 'all' || source === 'manual') && !botId) {
      let sql = 'SELECT * FROM orders WHERE user_id = :userId';
      const sqlParams = { userId: req.user.id };

      if (status && status !== 'all') {
        sql += ' AND status = :status';
        sqlParams.status = status.toLowerCase();
      }
      if (symbol) {
        sql += ' AND symbol LIKE :symbol';
        sqlParams.symbol = `%${symbol}%`;
      }
      if (side && side !== 'all') {
        sql += ' AND side = :side';
        sqlParams.side = side.toLowerCase();
      }

      sql += ' ORDER BY created_at DESC LIMIT :limit';
      sqlParams.limit = Number(limit) * 2;

      const rawManualOrders = await query(sql, sqlParams).catch(() => []);
      formattedManualOrders = rawManualOrders.map(o => ({
        id: o.id,
        symbol: o.symbol,
        exchange: o.exchange_name || 'Demo',
        exchange_name: o.exchange_name || 'Demo',
        side: (o.side || 'buy').toLowerCase(),
        order_type: (o.order_type || 'market').toLowerCase(),
        quantity: Number(o.quantity),
        price: Number(o.price || 0),
        stop_price: Number(o.stop_price || 0),
        filled_quantity: Number(o.filled_quantity || 0),
        avg_fill_price: Number(o.avg_fill_price || o.price || 0),
        status: (o.status || 'open').toLowerCase(),
        mode: (o.mode || 'paper').toLowerCase(),
        created_at: o.created_at,
        updated_at: o.updated_at,
        filled_at: o.filled_at,
        external_order_id: o.external_order_id || o.id,
        fees: Number(o.fees || 0),
        profit: 0,
        grid_level: null,
        bot_id: null,
        bot_name: null,
        bot_strategy: null,
        source: 'MANUAL'
      }));
    }

    // 4. Combine and filter
    let allOrders = [...formattedBotOrders, ...formattedManualOrders].sort(
      (a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime()
    );

    if (mode && mode !== 'all') {
      allOrders = allOrders.filter(o => o.mode === mode.toLowerCase());
    }

    if (exchange && exchange !== 'all') {
      allOrders = allOrders.filter(o => (o.exchange || o.exchange_name || '').toLowerCase() === exchange.toLowerCase());
    }

    const total = allOrders.length;
    const paginatedOrders = allOrders.slice(Number(offset), Number(offset) + Number(limit));

    await prisma.$disconnect();

    return ok(res, {
      orders: paginatedOrders,
      botsList,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (err) {
    await prisma.$disconnect().catch(() => {});
    console.error('[Orders] listOrders error:', err);
    return fail(res, 500, err.message);
  }
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
