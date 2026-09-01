import { query, transaction } from '../config/db.js';
import { getQuote, placeLiveOrder, cancelLiveOrder } from './exchangeService.js';

export async function placeOrder({ userId, sessionId, symbol, exchangeName, orderType, side, quantity, price, stopPrice, takeProfitPrice, mode, notes }) {
  console.log('[TradeExecutor] placeOrder called:', { userId, sessionId, symbol, exchangeName, orderType, side, quantity, price, mode });

  if (mode === 'live') {
    const liveResult = await placeLiveOrder({ userId, symbol, exchange: exchangeName, side, orderType, quantity, price, stopPrice });

    // Store the live order in our database for tracking
    const [result] = await query(
      `INSERT INTO orders
        (session_id, user_id, symbol, exchange_name, order_type, side, quantity, filled_quantity, price, stop_price, avg_fill_price, status, mode, notes, external_order_id)
       VALUES (:sessionId, :userId, :symbol, :exchangeName, :orderType, :side, :quantity, :filledQuantity, :price, :stopPrice, :avgFillPrice, :status, 'live', :notes, :externalOrderId)`,
      {
        sessionId, userId, symbol, exchangeName, orderType, side, quantity,
        filledQuantity: liveResult.filledQuantity || 0,
        price: liveResult.price || price || null,
        stopPrice: stopPrice || null,
        avgFillPrice: liveResult.avgFillPrice || null,
        status: liveResult.status || 'open',
        notes: notes || null,
        externalOrderId: liveResult.orderId
      }
    );

    return {
      ...liveResult,
      id: result.insertId,
      mode: 'live',
      exchange: exchangeName
    };
  }

  const quote = await getQuote(symbol, exchangeName);
  const currentPrice = quote.price;

  // For market orders, execute immediately
  if (orderType === 'market') {
    return executeMarketOrder({ userId, sessionId, symbol, exchangeName, side, quantity, currentPrice, mode, notes });
  }

  // For limit orders, check if can fill immediately or create pending order
  if (orderType === 'limit') {
    const canFill = (side === 'buy' && currentPrice <= price) || (side === 'sell' && currentPrice >= price);
    if (canFill) {
      return executeMarketOrder({ userId, sessionId, symbol, exchangeName, side, quantity, currentPrice, mode, notes });
    }
    return createPendingOrder({ userId, sessionId, symbol, exchangeName, orderType, side, quantity, price, triggerPrice: price, triggerCondition: side === 'buy' ? 'below' : 'above', mode, notes });
  }

  // For stop-loss orders
  if (orderType === 'stop_loss') {
    const triggerCondition = side === 'sell' ? 'below' : 'above';
    return createPendingOrder({ userId, sessionId, symbol, exchangeName, orderType, side, quantity, price: stopPrice, triggerPrice: stopPrice, triggerCondition, mode, notes });
  }

  // For take-profit orders
  if (orderType === 'take_profit') {
    const triggerCondition = side === 'sell' ? 'above' : 'below';
    return createPendingOrder({ userId, sessionId, symbol, exchangeName, orderType, side, quantity, price: takeProfitPrice || price, triggerPrice: takeProfitPrice || price, triggerCondition, mode, notes });
  }

  // For stop-limit orders
  if (orderType === 'stop_limit') {
    const triggerCondition = side === 'sell' ? 'below' : 'above';
    return createPendingOrder({ userId, sessionId, symbol, exchangeName, orderType, side, quantity, price, triggerPrice: stopPrice, triggerCondition, mode, notes });
  }

  throw createError('Invalid order type', 400, 'INVALID_ORDER_TYPE');
}

async function executeMarketOrder({ userId, sessionId, symbol, exchangeName, side, quantity, currentPrice, mode, notes }) {
  console.log('[TradeExecutor] executeMarketOrder:', { symbol, side, quantity, currentPrice, mode });
  const executionPrice = currentPrice;
  const total = Number(quantity) * executionPrice;
  console.log('[TradeExecutor] Order total:', total);

  return transaction(async (connection) => {
    // Get paper wallet
    const [[wallet]] = await connection.execute(
      'SELECT * FROM paper_wallet WHERE user_id = ? AND currency = ? FOR UPDATE',
      [userId, 'USD']
    );

    if (!wallet) {
      // Create paper wallet if doesn't exist
      await connection.execute(
        'INSERT INTO paper_wallet (user_id, balance, currency) VALUES (?, 100000, ?)',
        [userId, 'USD']
      );
      const [[newWallet]] = await connection.execute(
        'SELECT * FROM paper_wallet WHERE user_id = ? AND currency = ?',
        [userId, 'USD']
      );
      if (!newWallet) throw createError('Failed to create paper wallet', 500, 'WALLET_ERROR');
    }

    const walletBalance = wallet ? Number(wallet.balance) : 100000;

    // Check balance for buy orders
    if (side === 'buy' && walletBalance < total) {
      throw createError('Insufficient paper balance', 400, 'INSUFFICIENT_PAPER_BALANCE');
    }

    // Check holdings for sell orders
    const [[holding]] = await connection.execute(
      'SELECT * FROM portfolio WHERE user_id = ? AND session_id = ? AND symbol = ? AND mode = ? FOR UPDATE',
      [userId, sessionId, symbol, 'paper']
    );

    const currentQty = holding ? Number(holding.quantity) : 0;
    if (side === 'sell' && currentQty < quantity) {
      throw createError('Insufficient holdings to sell', 400, 'INSUFFICIENT_HOLDINGS');
    }

    // Insert the order
    const [orderResult] = await connection.execute(
      `INSERT INTO orders
        (session_id, user_id, symbol, exchange_name, order_type, side, quantity, filled_quantity, price, avg_fill_price, status, mode, notes, filled_at)
       VALUES (?, ?, ?, ?, 'market', ?, ?, ?, ?, ?, 'filled', 'paper', ?, NOW())`,
      [sessionId, userId, symbol, exchangeName, side, quantity, quantity, executionPrice, executionPrice, notes || null]
    );

    // Update portfolio
    const nextQty = side === 'buy' ? currentQty + Number(quantity) : currentQty - Number(quantity);
    const avgPrice = side === 'buy' && nextQty > 0
      ? ((holding ? Number(holding.average_buy_price) * currentQty : 0) + total) / nextQty
      : holding?.average_buy_price || executionPrice;

    if (holding) {
      if (nextQty > 0) {
        await connection.execute(
          'UPDATE portfolio SET quantity = ?, average_buy_price = ?, current_price = ? WHERE id = ?',
          [nextQty, avgPrice, executionPrice, holding.id]
        );
      } else {
        await connection.execute('DELETE FROM portfolio WHERE id = ?', [holding.id]);
      }
    } else if (nextQty > 0) {
      await connection.execute(
        `INSERT INTO portfolio (user_id, session_id, symbol, quantity, average_buy_price, current_price, mode)
         VALUES (?, ?, ?, ?, ?, ?, 'paper')`,
        [userId, sessionId, symbol, nextQty, avgPrice, executionPrice]
      );
    }

    // Update wallet balance
    const balanceDelta = side === 'buy' ? -total : total;
    await connection.execute(
      'UPDATE paper_wallet SET balance = balance + ? WHERE user_id = ? AND currency = ?',
      [balanceDelta, userId, 'USD']
    );

    // Record the trade
    await connection.execute(
      `INSERT INTO recent_trades (symbol, exchange_name, price, quantity, side, is_simulated)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [symbol, exchangeName, executionPrice, quantity, side]
    );

    const [[order]] = await connection.execute('SELECT * FROM orders WHERE id = ?', [orderResult.insertId]);
    return order;
  });
}

async function createPendingOrder({ userId, sessionId, symbol, exchangeName, orderType, side, quantity, price, triggerPrice, triggerCondition, mode, notes }) {
  return transaction(async (connection) => {
    // Insert order with 'open' status
    const [orderResult] = await connection.execute(
      `INSERT INTO orders
        (session_id, user_id, symbol, exchange_name, order_type, side, quantity, filled_quantity, price, stop_price, status, mode, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'open', 'paper', ?)`,
      [sessionId, userId, symbol, exchangeName, orderType, side, quantity, price, orderType === 'stop_loss' || orderType === 'stop_limit' ? triggerPrice : null, notes || null]
    );

    // Create pending order entry for monitoring
    await connection.execute(
      `INSERT INTO pending_orders (order_id, user_id, symbol, exchange_name, trigger_price, trigger_condition)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderResult.insertId, userId, symbol, exchangeName, triggerPrice, triggerCondition]
    );

    const [[order]] = await connection.execute('SELECT * FROM orders WHERE id = ?', [orderResult.insertId]);
    return order;
  });
}

export async function cancelOrder(orderId, userId) {
  return transaction(async (connection) => {
    const [[order]] = await connection.execute(
      'SELECT * FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
      [orderId, userId]
    );

    if (!order) {
      throw createError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status === 'filled' || order.status === 'cancelled') {
      throw createError(`Cannot cancel ${order.status} order`, 400, 'INVALID_ORDER_STATUS');
    }

    // Update order status
    await connection.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['cancelled', orderId]
    );

    // Remove from pending orders if exists
    await connection.execute(
      'DELETE FROM pending_orders WHERE order_id = ?',
      [orderId]
    );

    const [[updatedOrder]] = await connection.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
    return updatedOrder;
  });
}

export async function getOpenOrders(userId, sessionId = null) {
  let sql = `SELECT * FROM orders WHERE user_id = ? AND status IN ('open', 'pending', 'partially_filled') ORDER BY created_at DESC`;
  const params = [userId];

  if (sessionId) {
    sql = `SELECT * FROM orders WHERE user_id = ? AND session_id = ? AND status IN ('open', 'pending', 'partially_filled') ORDER BY created_at DESC`;
    params.push(sessionId);
  }

  return query(sql, params);
}

export async function getOrderHistory(userId, limit = 50, offset = 0) {
  return query(
    `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
}

export async function checkAndTriggerOrders(symbol, exchangeName, currentPrice) {
  const pendingOrders = await query(
    `SELECT po.*, o.side, o.quantity, o.order_type, o.session_id, o.mode
     FROM pending_orders po
     JOIN orders o ON po.order_id = o.id
     WHERE po.symbol = ? AND po.exchange_name = ? AND po.is_triggered = FALSE`,
    [symbol, exchangeName]
  );

  for (const pending of pendingOrders) {
    const shouldTrigger =
      (pending.trigger_condition === 'below' && currentPrice <= pending.trigger_price) ||
      (pending.trigger_condition === 'above' && currentPrice >= pending.trigger_price);

    if (shouldTrigger) {
      try {
        await triggerPendingOrder(pending, currentPrice);
      } catch (err) {
        console.error(`Failed to trigger order ${pending.order_id}:`, err.message);
      }
    }
  }
}

async function triggerPendingOrder(pending, currentPrice) {
  return transaction(async (connection) => {
    // Mark as triggered
    await connection.execute(
      'UPDATE pending_orders SET is_triggered = TRUE, triggered_at = NOW() WHERE id = ?',
      [pending.id]
    );

    // Execute the order
    const [[wallet]] = await connection.execute(
      'SELECT * FROM paper_wallet WHERE user_id = ? AND currency = ? FOR UPDATE',
      [pending.user_id, 'USD']
    );

    const total = Number(pending.quantity) * currentPrice;

    if (pending.side === 'buy' && Number(wallet.balance) < total) {
      await connection.execute(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['rejected', pending.order_id]
      );
      return;
    }

    // Update order to filled
    await connection.execute(
      'UPDATE orders SET status = ?, filled_quantity = ?, avg_fill_price = ?, filled_at = NOW() WHERE id = ?',
      ['filled', pending.quantity, currentPrice, pending.order_id]
    );

    // Update portfolio
    const [[holding]] = await connection.execute(
      'SELECT * FROM portfolio WHERE user_id = ? AND session_id = ? AND symbol = ? AND mode = ? FOR UPDATE',
      [pending.user_id, pending.session_id, pending.symbol, 'paper']
    );

    const currentQty = holding ? Number(holding.quantity) : 0;
    const nextQty = pending.side === 'buy' ? currentQty + Number(pending.quantity) : currentQty - Number(pending.quantity);

    if (nextQty < 0) {
      await connection.execute(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['rejected', pending.order_id]
      );
      return;
    }

    const avgPrice = pending.side === 'buy' && nextQty > 0
      ? ((holding ? Number(holding.average_buy_price) * currentQty : 0) + total) / nextQty
      : holding?.average_buy_price || currentPrice;

    if (holding) {
      if (nextQty > 0) {
        await connection.execute(
          'UPDATE portfolio SET quantity = ?, average_buy_price = ?, current_price = ? WHERE id = ?',
          [nextQty, avgPrice, currentPrice, holding.id]
        );
      } else {
        await connection.execute('DELETE FROM portfolio WHERE id = ?', [holding.id]);
      }
    } else if (nextQty > 0) {
      await connection.execute(
        `INSERT INTO portfolio (user_id, session_id, symbol, quantity, average_buy_price, current_price, mode)
         VALUES (?, ?, ?, ?, ?, ?, 'paper')`,
        [pending.user_id, pending.session_id, pending.symbol, nextQty, avgPrice, currentPrice]
      );
    }

    // Update wallet
    const balanceDelta = pending.side === 'buy' ? -total : total;
    await connection.execute(
      'UPDATE paper_wallet SET balance = balance + ? WHERE user_id = ? AND currency = ?',
      [balanceDelta, pending.user_id, 'USD']
    );

    // Record trade
    await connection.execute(
      `INSERT INTO recent_trades (symbol, exchange_name, price, quantity, side, is_simulated)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [pending.symbol, pending.exchange_name, currentPrice, pending.quantity, pending.side]
    );
  });
}

function createError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}
