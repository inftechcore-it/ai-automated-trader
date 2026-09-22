import { Router } from 'express';
import { body, param, query as validateQuery } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import { query } from '../config/db.js';
import * as coindcxAdapter from '../services/adapters/coindcxAdapter.js';
import { getUserBrokerCredentials } from '../services/exchangeService.js';

const router = Router();

async function getUserCredentials(userId) {
  const creds = await getUserBrokerCredentials(userId, 'CoinDCX');
  if (!creds) return null;
  return {
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
    paperMode: !!creds.paperMode,
    source: 'database'
  };
}

/**
 * Check CoinDCX connection status
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    const configured = !!creds;

    let balanceCount = 0;
    let valid = false;

    if (configured) {
      try {
        const val = await coindcxAdapter.validateCredentials(creds.apiKey, creds.apiSecret);
        valid = val.valid;
        balanceCount = val.balanceCount;
      } catch (e) {
        console.warn('[CoinDCXRoutes] Validate warning in status check:', e.message);
      }
    }

    return ok(res, {
      configured,
      authenticated: valid || configured,
      isConnected: configured,
      source: creds?.source || 'none',
      paperMode: creds?.paperMode || false,
      balanceCount
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

/**
 * Fetch balances & funds with USD and INR valuations
 */
router.get('/funds', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    if (!creds) {
      return fail(res, 401, 'CoinDCX not connected. Please add your API key & Secret in Exchanges or Trading.', 'NOT_CONNECTED');
    }

    const balances = await coindcxAdapter.getBalances(creds.apiKey, creds.apiSecret);
    let totalUSD = 0;
    let totalINR = 0;
    let availableUSDT = 0;
    let availableINR = 0;
    const assetsWithValues = [];

    for (const bal of balances) {
      if (bal.total > 0.00001) {
        let usdValue = 0;
        let inrValue = 0;

        if (['USDT', 'USDC', 'USD', 'BUSD'].includes(bal.asset)) {
          usdValue = bal.total;
          inrValue = bal.total * 85.0;
          availableUSDT += bal.free;
        } else if (bal.asset === 'INR') {
          inrValue = bal.total;
          usdValue = bal.total / 85.0;
          availableINR += bal.free;
        } else {
          try {
            const q = await coindcxAdapter.getQuote(`${bal.asset}/USDT`);
            usdValue = bal.total * (q?.price || 0);
            inrValue = usdValue * 85.0;
          } catch {
            try {
              const inrQuote = await coindcxAdapter.getQuote(`${bal.asset}/INR`);
              inrValue = bal.total * (inrQuote?.price || 0);
              usdValue = inrValue / 85.0;
            } catch {
              usdValue = 0;
              inrValue = 0;
            }
          }
        }

        assetsWithValues.push({
          ...bal,
          usdValue: Number(usdValue.toFixed(2)),
          inrValue: Number(inrValue.toFixed(2))
        });
        totalUSD += usdValue;
        totalINR += inrValue;
      }
    }

    return ok(res, {
      connected: true,
      totalUSD: Number(totalUSD.toFixed(2)),
      totalINR: Number(totalINR.toFixed(2)),
      buyingPowerUSD: Number(availableUSDT.toFixed(2)),
      buyingPowerINR: Number(availableINR.toFixed(2)),
      balances: assetsWithValues
    });
  } catch (error) {
    console.error('[CoinDCXRoutes] Funds error:', error.message);
    return fail(res, 500, error.message);
  }
});

router.get('/balances', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    if (!creds) {
      return fail(res, 401, 'CoinDCX not connected', 'NOT_CONNECTED');
    }

    const balances = await coindcxAdapter.getBalances(creds.apiKey, creds.apiSecret);
    return ok(res, { balances });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

/**
 * Get ticker quote for a symbol
 */
router.get(
  '/quote',
  validateQuery('symbol').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const quote = await coindcxAdapter.getQuote(req.query.symbol);
      return ok(res, { quote });
    } catch (error) {
      return fail(res, 500, error.message);
    }
  }
);

/**
 * Get OHLCV candles
 */
router.get(
  '/candles',
  validateQuery('symbol').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { symbol, interval = '1h', limit = 100 } = req.query;
      const candles = await coindcxAdapter.getOHLCV(symbol, interval, Number(limit));
      return ok(res, { candles, symbol, interval });
    } catch (error) {
      return fail(res, 500, error.message);
    }
  }
);

/**
 * Get live L2 order book
 */
router.get(
  '/orderbook',
  validateQuery('symbol').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { symbol, depth = 10 } = req.query;
      const orderBook = await coindcxAdapter.getOrderBook(symbol, Number(depth));
      return ok(res, orderBook);
    } catch (error) {
      return fail(res, 500, error.message);
    }
  }
);

/**
 * Get live market trades
 */
router.get(
  '/trades',
  validateQuery('symbol').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { symbol, limit = 20 } = req.query;
      const trades = await coindcxAdapter.getRecentTrades(symbol, Number(limit));
      return ok(res, { trades });
    } catch (error) {
      return fail(res, 500, error.message);
    }
  }
);

/**
 * Search symbols
 */
router.get('/symbols', async (req, res) => {
  try {
    const symbols = await coindcxAdapter.searchSymbols(req.query.q || '');
    return ok(res, { symbols });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

/**
 * Connect CoinDCX API
 */
router.post(
  '/connect',
  requireAuth,
  body('apiKey').trim().notEmpty().withMessage('API Key is required'),
  body('apiSecret').trim().notEmpty().withMessage('API Secret is required'),
  body('paperMode').optional().isBoolean(),
  validate,
  async (req, res) => {
    const { apiKey, apiSecret, paperMode = false } = req.body;

    try {
      console.log(`[CoinDCXRoutes] Validating credentials for user ${req.user.id}`);
      const validation = await coindcxAdapter.validateCredentials(apiKey, apiSecret);

      if (!validation.valid) {
        return fail(res, 401, 'Invalid CoinDCX API key or secret', 'INVALID_CREDENTIALS');
      }

      await query(
        `INSERT INTO exchange_accounts (user_id, exchange_name, exchange_type, api_key, api_secret, broker_type, paper_mode, is_active)
         VALUES (:userId, 'CoinDCX', 'crypto', :apiKey, :apiSecret, 'api', :paperMode, 1)
         ON DUPLICATE KEY UPDATE api_key = :apiKey, api_secret = :apiSecret, paper_mode = :paperMode, is_active = 1`,
        {
          userId: req.user.id,
          apiKey,
          apiSecret,
          paperMode: paperMode ? 1 : 0
        }
      );

      coindcxAdapter.setCredentials(apiKey, apiSecret);

      console.log(`[CoinDCXRoutes] CoinDCX connected successfully for user ${req.user.id}`);

      return ok(res, {
        connected: true,
        exchange: 'CoinDCX',
        paperMode,
        balanceCount: validation.balanceCount
      });
    } catch (error) {
      console.error('[CoinDCXRoutes] Connection failed:', error.message);
      return fail(res, 400, error.message || 'Failed to connect CoinDCX');
    }
  }
);

/**
 * Disconnect CoinDCX
 */
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await query(
      'UPDATE exchange_accounts SET is_active = 0 WHERE user_id = :userId AND LOWER(exchange_name) = "coindcx"',
      { userId: req.user.id }
    );

    coindcxAdapter.clearCredentials();

    console.log(`[CoinDCXRoutes] CoinDCX disconnected for user ${req.user.id}`);
    return ok(res, { disconnected: true, exchange: 'CoinDCX' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

/**
 * Place Live Spot Order
 */
router.post(
  '/orders/place',
  requireAuth,
  body('symbol').trim().notEmpty(),
  body('side').isIn(['buy', 'sell', 'BUY', 'SELL']),
  body('orderType').isIn(['market', 'limit', 'MARKET', 'LIMIT', 'stop_limit', 'STOP_LIMIT']),
  body('quantity').isNumeric(),
  body('price').optional().isNumeric(),
  body('stopPrice').optional().isNumeric(),
  validate,
  async (req, res) => {
    const { symbol, side, orderType, quantity, price, stopPrice } = req.body;

    try {
      const creds = await getUserCredentials(req.user.id);
      if (!creds) {
        return fail(res, 401, 'CoinDCX not connected. Please connect your API key & Secret.', 'NOT_CONNECTED');
      }

      console.log(`[CoinDCXRoutes] Placing live ${side} order: ${quantity} ${symbol} @ ${price || 'MARKET'}`);

      const liveResult = await coindcxAdapter.placeOrder(creds.apiKey, creds.apiSecret, {
        symbol,
        side,
        orderType,
        quantity: Number(quantity),
        price: price ? Number(price) : null,
        stopPrice: stopPrice ? Number(stopPrice) : null
      });

      // Insert record into database orders table
      try {
        await query(
          `INSERT INTO orders
            (user_id, symbol, exchange_name, order_type, side, quantity, filled_quantity, price, avg_fill_price, status, mode, external_order_id)
           VALUES (:userId, :symbol, 'CoinDCX', :orderType, :side, :quantity, 0, :price, :price, :status, 'live', :externalOrderId)`,
          {
            userId: req.user.id,
            symbol: coindcxAdapter.denormalizeSymbol(symbol) || symbol,
            orderType: orderType.toLowerCase(),
            side: side.toLowerCase(),
            quantity: Number(quantity),
            price: price ? Number(price) : null,
            status: liveResult.status || 'open',
            externalOrderId: String(liveResult.orderId)
          }
        );
      } catch (dbErr) {
        console.warn('[CoinDCXRoutes] DB order log warning:', dbErr.message);
      }

      return ok(res, {
        success: true,
        order: liveResult
      });
    } catch (error) {
      console.error('[CoinDCXRoutes] Place order failed:', error.message);
      return fail(res, 400, error.message || 'Order execution failed');
    }
  }
);

/**
 * Cancel Order
 */
router.post(
  '/orders/:orderId/cancel',
  requireAuth,
  param('orderId').trim().notEmpty(),
  validate,
  async (req, res) => {
    const { orderId } = req.params;
    const { symbol = 'BTC/USDT' } = req.body;

    try {
      const creds = await getUserCredentials(req.user.id);
      if (!creds) {
        return fail(res, 401, 'CoinDCX not connected', 'NOT_CONNECTED');
      }

      const result = await coindcxAdapter.cancelOrder(creds.apiKey, creds.apiSecret, symbol, orderId);

      // Update DB
      await query(
        'UPDATE orders SET status = "cancelled" WHERE external_order_id = :orderId AND user_id = :userId',
        { orderId: String(orderId), userId: req.user.id }
      ).catch(() => {});

      return ok(res, { success: true, ...result });
    } catch (error) {
      return fail(res, 400, error.message);
    }
  }
);

/**
 * Get Order Status
 */
router.get(
  '/orders/:orderId/status',
  requireAuth,
  param('orderId').trim().notEmpty(),
  validate,
  async (req, res) => {
    const { orderId } = req.params;
    const { symbol = 'BTC/USDT' } = req.query;

    try {
      const creds = await getUserCredentials(req.user.id);
      if (!creds) {
        return fail(res, 401, 'CoinDCX not connected', 'NOT_CONNECTED');
      }

      const order = await coindcxAdapter.getOrder(creds.apiKey, creds.apiSecret, symbol, orderId);

      // Sync status to DB
      if (order.status) {
        await query(
          `UPDATE orders
           SET status = :status, filled_quantity = :filled, avg_fill_price = :avgPrice
           WHERE external_order_id = :orderId AND user_id = :userId`,
          {
            status: order.status,
            filled: order.filledQuantity || 0,
            avgPrice: order.avgFillPrice || order.price || null,
            orderId: String(orderId),
            userId: req.user.id
          }
        ).catch(() => {});
      }

      return ok(res, { order });
    } catch (error) {
      return fail(res, 400, error.message);
    }
  }
);

/**
 * Get Open Orders
 */
router.get('/orders/open', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    if (!creds) {
      return fail(res, 401, 'CoinDCX not connected', 'NOT_CONNECTED');
    }

    const orders = await coindcxAdapter.getOpenOrders(creds.apiKey, creds.apiSecret, req.query.symbol || null);
    return ok(res, { orders });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

export default router;
