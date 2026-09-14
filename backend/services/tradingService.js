import { query } from '../config/db.js';
import { getQuote } from './exchangeService.js';
import * as pionexAdapter from './adapters/pionexAdapter.js';

export async function getOrderBook(symbol, exchange, depth = 10) {
  const exLower = exchange?.toLowerCase();

  // Try real Pionex order book
  if (exLower === 'pionex') {
    try {
      const realBook = await pionexAdapter.getOrderBook(symbol, depth);
      if (realBook?.bids?.length > 0) {
        return realBook;
      }
    } catch (e) {
      console.warn('[TradingService] Pionex live orderbook fallback:', e.message);
    }
  }

  const quote = await getQuote(symbol, exchange);
  const currentPrice = quote.price;
  const spread = currentPrice * 0.0005; // 0.05% spread

  // Generate realistic order book with price levels
  const bids = [];
  const asks = [];

  for (let i = 0; i < depth; i++) {
    const bidPrice = currentPrice - spread - (i * spread * 0.5);
    const askPrice = currentPrice + spread + (i * spread * 0.5);

    // Randomize quantities with higher volume near current price
    const bidQty = (Math.random() * 10 + 1) * (depth - i) / depth;
    const askQty = (Math.random() * 10 + 1) * (depth - i) / depth;

    bids.push({
      price: Number(bidPrice.toFixed(2)),
      quantity: Number(bidQty.toFixed(4)),
      total: Number((bidPrice * bidQty).toFixed(2))
    });

    asks.push({
      price: Number(askPrice.toFixed(2)),
      quantity: Number(askQty.toFixed(4)),
      total: Number((askPrice * askQty).toFixed(2))
    });
  }

  // Calculate cumulative totals
  let bidCumulative = 0;
  let askCumulative = 0;

  bids.forEach(bid => {
    bidCumulative += bid.quantity;
    bid.cumulative = Number(bidCumulative.toFixed(4));
  });

  asks.forEach(ask => {
    askCumulative += ask.quantity;
    ask.cumulative = Number(askCumulative.toFixed(4));
  });

  return {
    symbol,
    exchange,
    bids,
    asks,
    spread: Number((asks[0].price - bids[0].price).toFixed(2)),
    spreadPercent: Number((((asks[0].price - bids[0].price) / currentPrice) * 100).toFixed(4)),
    timestamp: new Date().toISOString()
  };
}

export async function getRecentTrades(symbol, exchange, limit = 20) {
  const exLower = exchange?.toLowerCase();

  // Try real Pionex recent trades
  if (exLower === 'pionex') {
    try {
      const realTrades = await pionexAdapter.getRecentTrades(symbol, limit);
      if (realTrades && realTrades.length > 0) {
        return realTrades;
      }
    } catch (e) {
      console.warn('[TradingService] Pionex live trades fallback:', e.message);
    }
  }

  // Get from database
  const dbTrades = await query(
    `SELECT * FROM recent_trades
     WHERE symbol = :symbol AND exchange_name = :exchange
     ORDER BY trade_time DESC
     LIMIT :limit`,
    { symbol, exchange, limit }
  );

  // If we have enough db trades, return them
  if (dbTrades.length >= limit / 2) {
    return dbTrades.map(t => ({
      id: t.id,
      price: Number(t.price),
      quantity: Number(t.quantity),
      side: t.side,
      time: t.trade_time,
      isSimulated: t.is_simulated
    }));
  }

  // Generate simulated recent trades
  const quote = await getQuote(symbol, exchange);
  const currentPrice = quote.price;
  const trades = [];

  for (let i = 0; i < limit; i++) {
    const priceVariation = (Math.random() - 0.5) * currentPrice * 0.002; // 0.2% variation
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const quantity = Math.random() * 5 + 0.01;

    trades.push({
      id: `sim_${Date.now()}_${i}`,
      price: Number((currentPrice + priceVariation).toFixed(2)),
      quantity: Number(quantity.toFixed(4)),
      side,
      time: new Date(Date.now() - i * 15000).toISOString(), // 15 seconds apart
      isSimulated: true
    });
  }

  // Mix with DB trades
  const combined = [...dbTrades.map(t => ({
    id: t.id,
    price: Number(t.price),
    quantity: Number(t.quantity),
    side: t.side,
    time: t.trade_time,
    isSimulated: t.is_simulated
  })), ...trades];

  return combined.slice(0, limit);
}

export async function getPositions(userId, sessionId = null) {
  let sql = `
    SELECT p.*, ts.exchange_name
    FROM portfolio p
    JOIN trading_sessions ts ON p.session_id = ts.id
    WHERE p.user_id = :userId AND p.mode = 'paper'
  `;
  const params = { userId };

  if (sessionId) {
    sql += ' AND p.session_id = :sessionId';
    params.sessionId = sessionId;
  }

  sql += ' ORDER BY p.updated_at DESC';

  const positions = await query(sql, params);

  // Calculate P&L for each position
  return positions.map(p => {
    const quantity = Number(p.quantity);
    const avgPrice = Number(p.average_buy_price);
    const currentPrice = Number(p.current_price);
    const costBasis = quantity * avgPrice;
    const marketValue = quantity * currentPrice;
    const unrealizedPnl = marketValue - costBasis;
    const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

    return {
      id: p.id,
      symbol: p.symbol,
      exchange: p.exchange_name,
      quantity,
      avgPrice,
      currentPrice,
      costBasis: Number(costBasis.toFixed(2)),
      marketValue: Number(marketValue.toFixed(2)),
      unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
      unrealizedPnlPercent: Number(unrealizedPnlPercent.toFixed(2)),
      mode: p.mode,
      updatedAt: p.updated_at
    };
  });
}

export async function updatePositionPrices(userId) {
  const positions = await query(
    "SELECT DISTINCT symbol, exchange_name FROM portfolio WHERE user_id = :userId AND mode = 'paper'",
    { userId }
  );

  for (const pos of positions) {
    try {
      const quote = await getQuote(pos.symbol, pos.exchange_name);
      await query(
        'UPDATE portfolio SET current_price = :price WHERE user_id = :userId AND symbol = :symbol AND mode = :mode',
        { price: quote.price, userId, symbol: pos.symbol, mode: 'paper' }
      );
    } catch (err) {
      console.error(`Failed to update price for ${pos.symbol}:`, err.message);
    }
  }
}

export async function getTradingStats(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const orders = await query(
    `SELECT * FROM orders
     WHERE user_id = :userId AND mode = 'paper' AND status = 'filled' AND filled_at >= :startDate
     ORDER BY filled_at DESC`,
    { userId, startDate: startDate.toISOString() }
  );

  let totalBuys = 0;
  let totalSells = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  orders.forEach(order => {
    const value = Number(order.quantity) * Number(order.avg_fill_price || order.price);
    if (order.side === 'buy') {
      totalBuys++;
      buyVolume += value;
    } else {
      totalSells++;
      sellVolume += value;
    }
  });

  // Calculate win rate from closed positions (simplistic)
  const realized = sellVolume - buyVolume;

  return {
    totalOrders: orders.length,
    buyOrders: totalBuys,
    sellOrders: totalSells,
    buyVolume: Number(buyVolume.toFixed(2)),
    sellVolume: Number(sellVolume.toFixed(2)),
    netVolume: Number((sellVolume - buyVolume).toFixed(2)),
    periodDays: days
  };
}
