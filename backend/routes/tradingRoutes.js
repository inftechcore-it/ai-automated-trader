import { Router } from 'express';
import { query as validateQuery } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import * as tradingService from '../services/tradingService.js';

const router = Router();

router.get(
  '/orderbook',
  requireAuth,
  validateQuery('symbol').trim().notEmpty(),
  validateQuery('exchange').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { symbol, exchange, depth } = req.query;
      const orderBook = await tradingService.getOrderBook(symbol, exchange, Number(depth) || 10);
      return ok(res, orderBook);
    } catch (error) {
      return fail(res, error.status || 500, error.publicMessage || 'Failed to get order book', error.code);
    }
  }
);

router.get(
  '/trades',
  requireAuth,
  validateQuery('symbol').trim().notEmpty(),
  validateQuery('exchange').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { symbol, exchange, limit } = req.query;
      const trades = await tradingService.getRecentTrades(symbol, exchange, Number(limit) || 20);
      return ok(res, { trades });
    } catch (error) {
      return fail(res, error.status || 500, error.publicMessage || 'Failed to get recent trades', error.code);
    }
  }
);

router.get('/positions', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.query;
    const positions = await tradingService.getPositions(req.user.id, sessionId ? Number(sessionId) : null);
    return ok(res, { positions });
  } catch (error) {
    return fail(res, error.status || 500, error.publicMessage || 'Failed to get positions', error.code);
  }
});

router.post('/positions/refresh', requireAuth, async (req, res) => {
  try {
    await tradingService.updatePositionPrices(req.user.id);
    const positions = await tradingService.getPositions(req.user.id);
    return ok(res, { positions, message: 'Prices refreshed' });
  } catch (error) {
    return fail(res, error.status || 500, error.publicMessage || 'Failed to refresh positions', error.code);
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { days } = req.query;
    const stats = await tradingService.getTradingStats(req.user.id, Number(days) || 30);
    return ok(res, stats);
  } catch (error) {
    return fail(res, error.status || 500, error.publicMessage || 'Failed to get trading stats', error.code);
  }
});

export default router;
