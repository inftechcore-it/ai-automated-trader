import { ok } from '../utils/apiResponse.js';
import { getQuote, getHistory, searchSymbols } from '../services/marketService.js';
import { analyzeMarketBehavior, detectCandlestickPatterns, CANDLESTICK_PATTERNS_DB } from '../services/candlestickPatterns.js';

export async function quote(req, res) {
  return ok(res, { quote: await getQuote(req.query.symbol, req.query.exchange) });
}

export async function history(req, res) {
  const { symbol, exchange, interval = '1h', limit = '100' } = req.query;
  return ok(res, {
    candles: await getHistory(symbol, exchange, interval, Number(limit))
  });
}

export async function patterns(req, res) {
  const { symbol, exchange, interval = '1h', limit = '60' } = req.query;
  try {
    const candles = await getHistory(symbol, exchange, interval, Number(limit));
    const analysis = analyzeMarketBehavior(candles, { symbol, exchange });
    const allPatterns = detectCandlestickPatterns(candles);
    return ok(res, {
      symbol,
      exchange,
      interval,
      analysis,
      detectedPatterns: allPatterns,
      candlesCount: candles.length
    });
  } catch (err) {
    console.error(`[MarketController] patterns error for ${symbol}:`, err.message);
    return ok(res, {
      symbol,
      exchange,
      analysis: {
        prediction: 'NEUTRAL',
        confidence: 50,
        score: 0,
        summary: 'Awaiting candlestick data feed.',
        recentPatterns: []
      },
      detectedPatterns: []
    });
  }
}

export async function candlestickPatterns(req, res) {
  return ok(res, {
    patterns: Object.values(CANDLESTICK_PATTERNS_DB),
    count: Object.keys(CANDLESTICK_PATTERNS_DB).length
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

