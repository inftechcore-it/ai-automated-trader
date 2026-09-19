import { Router } from 'express';
import { body, query as queryParam } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import * as angeloneAdapter from '../services/adapters/angeloneAdapter.js';
import { query } from '../config/db.js';
import { getUserBrokerCredentials } from '../services/exchangeService.js';

const router = Router();

// Get Angel One status & config
router.get('/status', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');

    return ok(res, {
      configured: !!creds,
      authenticated: !!creds,
      paperMode: creds?.paperMode || false,
      dbConnected: !!creds,
      clientCode: creds?.clientCode || creds?.apiSecret ? '******' : '',
      apiKey: creds?.apiKey ? '******' : ''
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Login / Authenticate session
router.post(
  '/login',
  requireAuth,
  body('apiKey').optional().isString(),
  body('clientCode').optional().isString(),
  body('password').optional().isString(),
  body('totp').optional().isString(),
  body('totpSecret').optional().isString(),
  validate,
  async (req, res) => {
    try {
      const { apiKey, clientCode, password, totp, totpSecret } = req.body;
      const effectiveClientCode = clientCode || '';
      const effectiveTotp = totp || totpSecret || '';

      let credsToUse = { apiKey, clientCode: effectiveClientCode, password, totpSecret: effectiveTotp, totp };

      if (!apiKey || !effectiveClientCode || !password || !effectiveTotp) {
        const dbCreds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
        if (dbCreds) {
          credsToUse = { ...dbCreds, ...credsToUse };
        }
      }

      const result = await angeloneAdapter.loginByPassword(credsToUse);

      if (apiKey && effectiveClientCode) {
        await query(
          `INSERT INTO exchange_accounts (user_id, exchange_name, exchange_type, api_key, api_secret, additional_params, broker_type, paper_mode, is_active)
           VALUES (:userId, 'AngelOne', 'stock', :apiKey, :apiSecret, :additionalParams, 'api', 0, 1)
           ON DUPLICATE KEY UPDATE api_key = :apiKey, api_secret = :apiSecret, additional_params = :additionalParams, is_active = 1`,
          {
            userId: req.user.id,
            apiKey,
            apiSecret: effectiveClientCode,
            additionalParams: JSON.stringify({
              clientCode: effectiveClientCode,
              password,
              totpSecret: effectiveTotp
            })
          }
        );
      }

      return ok(res, { message: 'Angel One login successful', ...result });
    } catch (err) {
      return fail(res, 400, err.message);
    }
  }
);

// Disconnect session
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await query(
      'UPDATE exchange_accounts SET is_active = 0 WHERE user_id = :userId AND LOWER(exchange_name) = "angelone"',
      { userId: req.user.id }
    );
    return ok(res, { message: 'Angel One session disconnected' });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// User profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
    if (!creds) {
      return fail(res, 401, 'Angel One not connected for your account', 'BROKER_NOT_CONNECTED');
    }
    const profile = await angeloneAdapter.getProfile(creds);
    return ok(res, { profile });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// RMS Funds & Margins
router.get('/funds', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
    if (!creds) {
      return fail(res, 401, 'Angel One not connected for your account', 'BROKER_NOT_CONNECTED');
    }
    const funds = await angeloneAdapter.getRMS(creds);
    return ok(res, { funds });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Holdings
router.get('/holdings', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
    if (!creds) {
      return fail(res, 401, 'Angel One not connected for your account', 'BROKER_NOT_CONNECTED');
    }
    const holdings = await angeloneAdapter.getHoldings(creds);
    return ok(res, { holdings });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Positions
router.get('/positions', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
    if (!creds) {
      return fail(res, 401, 'Angel One not connected for your account', 'BROKER_NOT_CONNECTED');
    }
    const positions = await angeloneAdapter.getPositions(creds);
    return ok(res, { positions });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Orders list
router.get('/orders', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
    if (!creds) {
      return fail(res, 401, 'Angel One not connected for your account', 'BROKER_NOT_CONNECTED');
    }
    const orders = await angeloneAdapter.getOrderBook(creds);
    return ok(res, { orders });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Place order
router.post(
  '/orders/place',
  requireAuth,
  body('symbol').trim().notEmpty(),
  body('exchange').optional().isString(),
  body('side').isIn(['buy', 'sell', 'BUY', 'SELL']),
  body('quantity').isFloat({ gt: 0 }),
  body('orderType').optional().isString(),
  body('productType').optional().isString(),
  body('price').optional().isFloat(),
  validate,
  async (req, res) => {
    try {
      const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
      if (!creds) {
        return fail(res, 401, 'Angel One not connected for your account', 'BROKER_NOT_CONNECTED');
      }
      const { symbol, exchange = 'NSE', side, quantity, orderType = 'MARKET', productType = 'DELIVERY', price = 0 } = req.body;
      const order = await angeloneAdapter.placeOrder({
        symbol,
        exchange,
        transactionType: side.toUpperCase(),
        orderType: orderType.toUpperCase(),
        productType: productType.toUpperCase(),
        quantity,
        price
      }, creds);
      return ok(res, { message: 'Order placed successfully on Angel One', order }, 201);
    } catch (err) {
      return fail(res, 400, err.message);
    }
  }
);

// Cancel order
router.post('/orders/:orderId/cancel', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
    if (!creds) {
      return fail(res, 401, 'Angel One not connected for your account', 'BROKER_NOT_CONNECTED');
    }
    const result = await angeloneAdapter.cancelOrder(req.params.orderId, req.body.variety || 'NORMAL', creds);
    return ok(res, { message: 'Order cancellation submitted', ...result });
  } catch (err) {
    return fail(res, 400, err.message);
  }
});

// Order status
router.get('/orders/:orderId/status', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
    if (!creds) {
      return fail(res, 401, 'Angel One not connected for your account', 'BROKER_NOT_CONNECTED');
    }
    const order = await angeloneAdapter.getOrderStatus(req.params.orderId, creds);
    return ok(res, { order });
  } catch (err) {
    return fail(res, 400, err.message);
  }
});

// Live quote (market data - public)
router.get('/quote/:symbol', requireAuth, async (req, res) => {
  try {
    const exchange = req.query.exchange || 'NSE';
    const quote = await angeloneAdapter.getQuote(req.params.symbol, exchange);
    return ok(res, { quote });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Historical candles (market data - public)
router.get('/candles', requireAuth, async (req, res) => {
  try {
    const { symbol, exchange = 'NSE', interval = '1d', limit = 100 } = req.query;
    if (!symbol) return fail(res, 400, 'Symbol is required');
    const candles = await angeloneAdapter.getOHLCV(symbol, interval, Number(limit), exchange);
    return ok(res, { candles });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Search Indian stocks
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = req.query.q || '';
    const exchange = req.query.exchange || 'NSE';
    const symbols = await angeloneAdapter.searchSymbols(q, exchange);
    return ok(res, { symbols });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

export default router;
