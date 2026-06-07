import { ok } from '../utils/apiResponse.js';
import { getQuote, getHistory, searchSymbols } from '../services/marketService.js';

export async function quote(req, res) {
  return ok(res, { quote: await getQuote(req.query.symbol, req.query.exchange) });
}

export async function history(req, res) {
  return ok(res, {
    candles: await getHistory(req.query.symbol, req.query.exchange, req.query.interval)
  });
}

export async function search(req, res) {
  return ok(res, { symbols: searchSymbols(req.query.q || '') });
}
