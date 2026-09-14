import { Router } from 'express';
import { body, param, query as validateQuery } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import { query } from '../config/db.js';
import * as pionexAdapter from '../services/adapters/pionexAdapter.js';
import { connectBroker, disconnectBroker } from '../services/exchangeService.js';

const router = Router();

async function getUserCredentials(userId) {
  const [row] = await query(
    'SELECT api_key, api_secret, paper_mode, is_active FROM exchange_accounts WHERE user_id = :userId AND LOWER(exchange_name) = "pionex" AND is_active = 1',
    { userId }
  );

  if (row) {
    return {
      apiKey: row.api_key,
      apiSecret: row.api_secret,
      paperMode: !!row.paper_mode,
      source: 'database'
    };
  }

  const def = pionexAdapter.getDefaultCredentials();
  if (def?.apiKey && def?.apiSecret) {
    return {
      apiKey: def.apiKey,
      apiSecret: def.apiSecret,
      paperMode: false,
      source: 'environment'
    };
  }

  return null;
}

// Check Pionex connection status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    const configured = !!creds;

    let balanceCount = 0;
    let valid = false;

    if (configured) {
      try {
        const val = await pionexAdapter.validateCredentials(creds.apiKey, creds.apiSecret);
        valid = val.valid;
        balanceCount = val.balanceCount;
      } catch (e) {
        console.warn('[PionexRoutes] Validate warning in status check:', e.message);
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

// Fetch balances / funds with USD values
router.get('/funds', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    if (!creds) {
      return fail(res, 401, 'Pionex not connected. Please add your API key & Secret in Exchanges or Trading.', 'NOT_CONNECTED');
    }

    const balances = await pionexAdapter.getBalances(creds.apiKey, creds.apiSecret);
    let totalUSD = 0;
    const assetsWithUSD = [];

    for (const bal of balances) {
      if (bal.total > 0.00001) {
        let usdValue = 0;
        if (['USDT', 'USDC', 'USD'].includes(bal.asset)) {
          usdValue = bal.total;
        } else {
          try {
            const q = await pionexAdapter.getQuote(`${bal.asset}/USDT`);
            usdValue = bal.total * (q?.price || 0);
          } catch {
            // No direct USDT pair
          }
        }

        assetsWithUSD.push({
          ...bal,
          usdValue: Number(usdValue.toFixed(2))
        });
        totalUSD += usdValue;
      }
    }

    const usdtBal = assetsWithUSD.find(a => a.asset === 'USDT')?.free || 0;

    return ok(res, {
      connected: true,
      totalUSD: Number(totalUSD.toFixed(2)),
      buyingPower: Number(usdtBal.toFixed(2)),
      balances: assetsWithUSD
    });
  } catch (error) {
    console.error('[PionexRoutes] Funds error:', error.message);
    return fail(res, 500, error.message);
  }
});

router.get('/balances', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    if (!creds) {
      return fail(res, 401, 'Pionex not connected', 'NOT_CONNECTED');
    }

    const balances = await pionexAdapter.getBalances(creds.apiKey, creds.apiSecret);
    return ok(res, { balances });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Get quote for a symbol
router.get(
  '/quote',
  validateQuery('symbol').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const quote = await pionexAdapter.getQuote(req.query.symbol);
      return ok(res, { quote });
    } catch (error) {
      return fail(res, 500, error.message);
    }
  }
);

// Get OHLCV candles
router.get(
  '/candles',
  validateQuery('symbol').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { symbol, interval = '1h', limit = 100 } = req.query;
      const candles = await pionexAdapter.getOHLCV(symbol, interval, Number(limit));
      return ok(res, { candles, symbol, interval });
    } catch (error) {
      return fail(res, 500, error.message);
    }
  }
);

// Get live L2 order book
router.get(
  '/orderbook',
  validateQuery('symbol').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { symbol, depth = 10 } = req.query;
      const orderBook = await pionexAdapter.getOrderBook(symbol, Number(depth));
      return ok(res, orderBook);
    } catch (error) {
      return fail(res, 500, error.message);
    }
  }
);

// Get live market trades
router.get(
  '/trades',
  validateQuery('symbol').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { symbol, limit = 20 } = req.query;
      const trades = await pionexAdapter.getRecentTrades(symbol, Number(limit));
      return ok(res, { trades });
    } catch (error) {
      return fail(res, 500, error.message);
    }
  }
);

// Search symbols
router.get('/symbols', async (req, res) => {
  try {
    const symbols = await pionexAdapter.searchSymbols(req.query.q || '');
    return ok(res, { symbols });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Connect Pionex API
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
      console.log(`[PionexRoutes] Validating credentials for user ${req.user.id}`);
      const validation = await pionexAdapter.validateCredentials(apiKey, apiSecret);

      if (!validation.valid) {
        return fail(res, 401, 'Invalid Pionex API key or secret', 'INVALID_CREDENTIALS');
      }

      await query(
        `INSERT INTO exchange_accounts (user_id, exchange_name, exchange_type, api_key, api_secret, broker_type, paper_mode, is_active)
         VALUES (:userId, 'Pionex', 'crypto', :apiKey, :apiSecret, 'api', :paperMode, 1)
         ON DUPLICATE KEY UPDATE api_key = :apiKey, api_secret = :apiSecret, paper_mode = :paperMode, is_active = 1`,
        {
          userId: req.user.id,
          apiKey,
          apiSecret,
          paperMode: paperMode ? 1 : 0
        }
      );

      connectBroker('Pionex', { apiKey, apiSecret, paperMode });
      pionexAdapter.setCredentials(apiKey, apiSecret);

      console.log(`[PionexRoutes] Pionex connected successfully for user ${req.user.id}`);

      return ok(res, {
        connected: true,
        exchange: 'Pionex',
        paperMode,
        balanceCount: validation.balanceCount
      });
    } catch (error) {
      console.error('[PionexRoutes] Connection failed:', error.message);
      return fail(res, 400, error.message || 'Failed to connect Pionex');
    }
  }
);

// Disconnect Pionex
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await query(
      'UPDATE exchange_accounts SET is_active = 0 WHERE user_id = :userId AND LOWER(exchange_name) = "pionex"',
      { userId: req.user.id }
    );

    disconnectBroker('Pionex');
    pionexAdapter.clearCredentials();

    console.log(`[PionexRoutes] Pionex disconnected for user ${req.user.id}`);
    return ok(res, { disconnected: true, exchange: 'Pionex' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Place Live Spot Order
router.post(
  '/orders/place',
  requireAuth,
  body('symbol').trim().notEmpty(),
  body('side').isIn(['buy', 'sell', 'BUY', 'SELL']),
  body('orderType').isIn(['market', 'limit', 'MARKET', 'LIMIT']),
  body('quantity').isNumeric(),
  body('price').optional().isNumeric(),
  body('amount').optional().isNumeric(),
  validate,
  async (req, res) => {
    const { symbol, side, orderType, quantity, price, amount } = req.body;

    try {
      const creds = await getUserCredentials(req.user.id);
      if (!creds) {
        return fail(res, 401, 'Pionex not connected. Please connect your API key & Secret.', 'NOT_CONNECTED');
      }

      console.log(`[PionexRoutes] Placing live ${side} order: ${quantity} ${symbol} @ ${price || 'MARKET'}`);

      const liveResult = await pionexAdapter.placeOrder(creds.apiKey, creds.apiSecret, {
        symbol,
        side,
        orderType,
        quantity: Number(quantity),
        price: price ? Number(price) : null,
        amount: amount ? Number(amount) : null
      });

      // Insert record into database orders table
      try {
        await query(
          `INSERT INTO orders
            (user_id, symbol, exchange_name, order_type, side, quantity, filled_quantity, price, avg_fill_price, status, mode, external_order_id)
           VALUES (:userId, :symbol, 'Pionex', :orderType, :side, :quantity, 0, :price, :price, :status, 'live', :externalOrderId)`,
          {
            userId: req.user.id,
            symbol: pionexAdapter.denormalizeSymbol(symbol) || symbol,
            orderType: orderType.toLowerCase(),
            side: side.toLowerCase(),
            quantity: Number(quantity),
            price: price ? Number(price) : null,
            status: liveResult.status || 'open',
            externalOrderId: String(liveResult.orderId)
          }
        );
      } catch (dbErr) {
        console.warn('[PionexRoutes] DB order log warning:', dbErr.message);
      }

      return ok(res, {
        success: true,
        order: liveResult
      });
    } catch (error) {
      console.error('[PionexRoutes] Place order failed:', error.message);
      return fail(res, 400, error.message || 'Order execution failed');
    }
  }
);

// Cancel Order
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
        return fail(res, 401, 'Pionex not connected', 'NOT_CONNECTED');
      }

      const result = await pionexAdapter.cancelOrder(creds.apiKey, creds.apiSecret, symbol, orderId);

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

// Get Order Status
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
        return fail(res, 401, 'Pionex not connected', 'NOT_CONNECTED');
      }

      const order = await pionexAdapter.getOrder(creds.apiKey, creds.apiSecret, symbol, orderId);

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

// Get Open Orders
router.get('/orders/open', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    if (!creds) {
      return fail(res, 401, 'Pionex not connected', 'NOT_CONNECTED');
    }

    const orders = await pionexAdapter.getOpenOrders(creds.apiKey, creds.apiSecret, req.query.symbol || null);
    return ok(res, { orders });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Grid Bot: Create native spot grid bot
router.post(
  '/grid-bot/create',
  requireAuth,
  body('baseAsset').trim().notEmpty(),
  body('quoteAsset').trim().notEmpty(),
  body('upperPrice').isNumeric(),
  body('lowerPrice').isNumeric(),
  body('gridCount').isInt({ min: 2, max: 200 }),
  body('investment').isNumeric(),
  validate,
  async (req, res) => {
    try {
      const creds = await getUserCredentials(req.user.id);
      if (!creds) {
        return fail(res, 401, 'Pionex not connected', 'NOT_CONNECTED');
      }

      const bot = await pionexAdapter.createGridBot(creds.apiKey, creds.apiSecret, req.body);
      return ok(res, { success: true, bot });
    } catch (error) {
      return fail(res, 400, error.message);
    }
  }
);

// Grid Bot: Get details
router.get('/grid-bot/:botId', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    if (!creds) {
      return fail(res, 401, 'Pionex not connected', 'NOT_CONNECTED');
    }

    const bot = await pionexAdapter.getGridBot(creds.apiKey, creds.apiSecret, req.params.botId);
    return ok(res, { bot });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

// Grid Bot: Cancel
router.post('/grid-bot/:botId/cancel', requireAuth, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.user.id);
    if (!creds) {
      return fail(res, 401, 'Pionex not connected', 'NOT_CONNECTED');
    }

    const result = await pionexAdapter.cancelGridBot(creds.apiKey, creds.apiSecret, req.params.botId);
    return ok(res, { success: true, ...result });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

export default router;
