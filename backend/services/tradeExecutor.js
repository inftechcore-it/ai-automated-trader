import { transaction } from '../config/db.js';
import { getQuote, placeLiveOrder } from './exchangeService.js';

export async function placeOrder({ userId, sessionId, symbol, exchangeName, orderType, side, quantity, price, mode }) {
  if (mode === 'live') {
    return placeLiveOrder();
  }

  const quote = await getQuote(symbol, exchangeName);
  const executionPrice = orderType === 'market' ? quote.price : Number(price);
  const total = Number(quantity) * executionPrice;

  return transaction(async (connection) => {
    const [[wallet]] = await connection.execute(
      'SELECT * FROM paper_wallet WHERE user_id = ? AND currency = ? FOR UPDATE',
      [userId, 'USD']
    );

    if (!wallet) {
      const error = new Error('Paper wallet not found');
      error.status = 400;
      error.code = 'PAPER_WALLET_MISSING';
      error.publicMessage = 'Paper wallet not found';
      throw error;
    }

    if (side === 'buy' && Number(wallet.balance) < total) {
      const error = new Error('Insufficient paper balance');
      error.status = 400;
      error.code = 'INSUFFICIENT_PAPER_BALANCE';
      error.publicMessage = 'Insufficient paper balance';
      throw error;
    }

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
        (session_id, user_id, symbol, exchange_name, order_type, side, quantity, price, status, mode, filled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'filled', 'paper', NOW())`,
      [sessionId, userId, symbol, exchangeName, orderType, side, quantity, executionPrice]
    );

    const [[holding]] = await connection.execute(
      'SELECT * FROM portfolio WHERE user_id = ? AND session_id = ? AND symbol = ? AND mode = ? FOR UPDATE',
      [userId, sessionId, symbol, 'paper']
    );

    const currentQty = holding ? Number(holding.quantity) : 0;
    const nextQty = side === 'buy' ? currentQty + Number(quantity) : currentQty - Number(quantity);

    if (nextQty < 0) {
      const error = new Error('Insufficient paper holdings');
      error.status = 400;
      error.code = 'INSUFFICIENT_HOLDINGS';
      error.publicMessage = 'Insufficient paper holdings';
      throw error;
    }

    const avgPrice =
      side === 'buy' && nextQty > 0
        ? ((holding ? Number(holding.average_buy_price) * currentQty : 0) + total) / nextQty
        : holding?.average_buy_price || executionPrice;

    if (holding) {
      await connection.execute(
        'UPDATE portfolio SET quantity = ?, average_buy_price = ?, current_price = ? WHERE id = ?',
        [nextQty, avgPrice, executionPrice, holding.id]
      );
    } else {
      await connection.execute(
        `INSERT INTO portfolio
          (user_id, session_id, symbol, quantity, average_buy_price, current_price, mode)
         VALUES (?, ?, ?, ?, ?, ?, 'paper')`,
        [userId, sessionId, symbol, nextQty, avgPrice, executionPrice]
      );
    }

    const balanceDelta = side === 'buy' ? -total : total;
    await connection.execute(
      'UPDATE paper_wallet SET balance = balance + ? WHERE user_id = ? AND currency = ?',
      [balanceDelta, userId, 'USD']
    );

    const [[order]] = await connection.execute('SELECT * FROM orders WHERE id = ?', [orderResult.insertId]);
    return order;
  });
}
