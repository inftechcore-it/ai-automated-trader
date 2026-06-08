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
  return ok(res, { symbols: await searchSymbols(req.query.q || '', req.query.exchange) });
}
