import { ok } from '../utils/apiResponse.js';
import { getQuote, getHistory, searchSymbols } from '../services/marketService.js';

export async function quote(req, res) {
  return ok(res, { quote: await getQuote(req.query.symbol, req.query.exchange) });
}

export async function history(req, res) {
  const { symbol, exchange, interval = '1h', limit = '100' } = req.query;
  return ok(res, {
    candles: await getHistory(symbol, exchange, interval, Number(limit))
  });
}

export async function search(req, res) {
  const q = req.query.q || '';
  const exchange = req.query.exchange || null;
  console.log(`[MarketController] search q="${q}" exchange="${exchange}"`);
  const symbols = await searchSymbols(q, exchange);
  console.log(`[MarketController] returning ${symbols.length} symbols`);
  return ok(res, { symbols });
}
