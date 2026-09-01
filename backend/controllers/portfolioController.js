import { query } from '../config/db.js';
import { ok } from '../utils/apiResponse.js';
import { getQuote } from '../services/exchangeService.js';

export async function listPortfolio(req, res) {
  const modeFilter = req.params.mode ? 'AND p.mode = :mode' : '';
  const holdings = await query(
    `SELECT p.*, s.exchange_name,
      (p.quantity * p.current_price) AS market_value,
      ((p.current_price - p.average_buy_price) * p.quantity) AS pnl
     FROM portfolio p
     LEFT JOIN trading_sessions s ON p.session_id = s.id
     WHERE p.user_id = :userId ${modeFilter}
     ORDER BY p.updated_at DESC`,
    { userId: req.user.id, mode: req.params.mode }
  );

  // Enrich with current prices and exchange info
  const enrichedHoldings = await Promise.all(holdings.map(async (h) => {
    const exchange = h.exchange_name || detectExchange(h.symbol);
    let currentPrice = h.current_price;
    let previousClose = h.current_price;

    try {
      const quote = await getQuote(h.symbol, exchange);
      if (quote && quote.price) {
        currentPrice = quote.price;
        previousClose = quote.previousClose || quote.price * 0.99;
      }
    } catch (err) {
      // Use stored price if quote fails
    }

    return {
      ...h,
      exchange,
      name: h.symbol,
      current_price: currentPrice,
      previous_close: previousClose,
      sector: detectSector(h.symbol)
    };
  }));

  return ok(res, { holdings: enrichedHoldings });
}

function detectExchange(symbol) {
  if (symbol.includes('/')) return 'Binance';
  if (/^[A-Z]{1,5}$/.test(symbol)) return 'NASDAQ';
  return 'NSE';
}

function detectSector(symbol) {
  const sectors = {
    'RELIANCE': 'Energy', 'TCS': 'Technology', 'INFY': 'Technology',
    'HDFCBANK': 'Finance', 'ICICIBANK': 'Finance', 'SBIN': 'Finance',
    'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology',
    'AMZN': 'Consumer', 'TSLA': 'Automotive', 'META': 'Technology',
    'BTC/USDT': 'Crypto', 'ETH/USDT': 'Crypto'
  };
  return sectors[symbol] || 'Others';
}
