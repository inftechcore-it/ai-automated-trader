import { query } from '../config/db.js';
import { ok, fail } from '../utils/apiResponse.js';
import { getHistory, getQuote } from '../services/exchangeService.js';
import { analyzeMarketBehavior, detectCandlestickPatterns } from '../services/candlestickPatterns.js';

export async function listWatchlist(req, res) {
  const items = await query('SELECT * FROM watchlist WHERE user_id = :userId ORDER BY added_at DESC', {
    userId: req.user.id
  });
  return ok(res, { items });
}

export async function analyzeWatchlist(req, res) {
  const { interval = '1h' } = req.query;
  const items = await query('SELECT * FROM watchlist WHERE user_id = :userId ORDER BY added_at DESC', {
    userId: req.user.id
  });

  if (!items || items.length === 0) {
    return ok(res, {
      items: [],
      summary: {
        total: 0,
        bullish: 0,
        bearish: 0,
        neutral: 0,
        sentimentScore: 0,
        topBullish: [],
        topBearish: [],
        activePatternsCount: 0
      }
    });
  }

  const analyzedItems = await Promise.all(
    items.map(async (item) => {
      try {
        const [quote, candles] = await Promise.all([
          getQuote(item.symbol, item.exchange_name).catch(() => null),
          getHistory(item.symbol, item.exchange_name, interval, 50).catch(() => [])
        ]);

        const analysis = analyzeMarketBehavior(candles, {
          symbol: item.symbol,
          exchange: item.exchange_name
        });
        const allPatterns = detectCandlestickPatterns(candles);

        return {
          id: item.id,
          symbol: item.symbol,
          exchange_name: item.exchange_name,
          added_at: item.added_at,
          quote: quote || { price: analysis.currentPrice, change: 0, changePercent: 0 },
          analysis,
          latestPattern: analysis.latestPattern,
          detectedPatterns: allPatterns.slice(-5),
          prediction: analysis.prediction,
          confidence: analysis.confidence,
          score: analysis.score,
          targetPrice: analysis.targetPrice,
          stopLoss: analysis.stopLoss,
          riskReward: analysis.riskReward,
          summary: analysis.summary
        };
      } catch (err) {
        console.error(`[Watchlist Analysis] error on ${item.symbol}:`, err.message);
        return {
          id: item.id,
          symbol: item.symbol,
          exchange_name: item.exchange_name,
          added_at: item.added_at,
          quote: null,
          analysis: {
            prediction: 'NEUTRAL',
            confidence: 50,
            score: 0,
            summary: 'Data feed connecting...'
          },
          latestPattern: null,
          detectedPatterns: []
        };
      }
    })
  );

  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  let totalScore = 0;
  let activePatternsCount = 0;

  analyzedItems.forEach((it) => {
    if (it.score > 15) bullishCount++;
    else if (it.score < -15) bearishCount++;
    else neutralCount++;

    totalScore += it.score || 0;
    if (it.detectedPatterns) activePatternsCount += it.detectedPatterns.length;
  });

  const avgScore = analyzedItems.length > 0 ? Math.round(totalScore / analyzedItems.length) : 0;
  const topBullish = [...analyzedItems]
    .filter((a) => a.score > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 3);
  const topBearish = [...analyzedItems]
    .filter((a) => a.score < 0)
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .slice(0, 3);

  return ok(res, {
    items: analyzedItems,
    summary: {
      total: analyzedItems.length,
      bullish: bullishCount,
      bearish: bearishCount,
      neutral: neutralCount,
      sentimentScore: avgScore,
      topBullish,
      topBearish,
      activePatternsCount
    }
  });
}

export async function addWatchlistItem(req, res) {
  const { symbol, exchangeName } = req.body;
  const result = await query(
    'INSERT INTO watchlist (user_id, symbol, exchange_name) VALUES (:userId, :symbol, :exchangeName)',
    { userId: req.user.id, symbol, exchangeName }
  );
  return ok(res, { id: result.insertId }, 201);
}

export async function deleteWatchlistItem(req, res) {
  const result = await query('DELETE FROM watchlist WHERE id = :id AND user_id = :userId', {
    id: req.params.id,
    userId: req.user.id
  });
  if (!result.affectedRows) return fail(res, 404, 'Watchlist item not found', 'WATCHLIST_ITEM_NOT_FOUND');
  return ok(res);
}

