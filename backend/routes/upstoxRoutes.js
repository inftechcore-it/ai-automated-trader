import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import * as upstoxAdapter from '../services/adapters/upstoxAdapter.js';
import { query } from '../config/db.js';
import { getUserBrokerCredentials } from '../services/exchangeService.js';

const router = Router();

async function getUserToken(userId) {
  const creds = await getUserBrokerCredentials(userId, 'Upstox');
  return creds ? (creds.apiSecret || creds.apiKey) : null;
}

// Middleware to handle token expiry
function handleUpstoxError(res, error) {
  console.error('[Upstox Route] Error:', error.message);

  if (error.code === 'TOKEN_EXPIRED' || error.status === 401) {
    return fail(res, 401, 'Session expired. Please re-authenticate with Upstox.', 'TOKEN_EXPIRED');
  }
  if (error.code === 'NOT_AUTHENTICATED') {
    return fail(res, 401, 'Upstox not connected for your account. Please authenticate first.', 'NOT_AUTHENTICATED');
  }
  return fail(res, 500, error.message, 'UPSTOX_ERROR');
}

router.get('/status', requireAuth, async (req, res) => {
  const token = await getUserToken(req.user.id);
  return ok(res, {
    configured: upstoxAdapter.isConfigured(),
    authenticated: !!token,
    isConnected: !!token,
    tokenExpired: false
  });
});

router.get('/auth-url', requireAuth, (req, res) => {
  if (!upstoxAdapter.isConfigured()) {
    return fail(res, 400, 'Upstox API not configured. Set UPSTOX_API_KEY and UPSTOX_API_SECRET.', 'UPSTOX_NOT_CONFIGURED');
  }

  const config = upstoxAdapter.getConfig();
  const state = `user_${req.user.id}_${Date.now()}`;
  const authUrl = upstoxAdapter.getAuthUrl(state);

  return ok(res, {
    authUrl,
    state,
    debug: {
      clientId: config.clientId?.substring(0, 8) + '...',
      redirectUri: config.redirectUri
    }
  });
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  const frontendUrl = process.env.CLIENT_ORIGINS?.split(',')[0]?.trim() || 'http://localhost:5173';
  const redirectBase = `${frontendUrl}/trading`;

  if (error) {
    console.error('[Upstox] OAuth error:', error);
    return res.redirect(`${redirectBase}?upstox_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${redirectBase}?upstox_error=no_code`);
  }

  try {
    const result = await upstoxAdapter.exchangeCodeForToken(code);
    console.log('[Upstox] Authentication successful');

    // Extract userId from state if available
    let targetUserId = null;
    if (state && typeof state === 'string' && state.startsWith('user_')) {
      const parts = state.split('_');
      if (parts.length >= 2) targetUserId = parts[1];
    }

    if (targetUserId && upstoxAdapter.getAccessToken()) {
      const token = upstoxAdapter.getAccessToken();
      await query(
        `INSERT INTO exchange_accounts (user_id, exchange_name, exchange_type, api_key, api_secret, broker_type, paper_mode, is_active)
         VALUES (:userId, 'Upstox', 'stock', :token, :token, 'oauth', 0, 1)
         ON DUPLICATE KEY UPDATE api_key = :token, api_secret = :token, is_active = 1`,
        { userId: targetUserId, token }
      );
    }

    return res.redirect(`${redirectBase}?upstox_connected=true`);
  } catch (err) {
    console.error('[Upstox] Token exchange error:', err.message);
    return res.redirect(`${redirectBase}?upstox_error=${encodeURIComponent(err.message)}`);
  }
});

router.post('/set-token', requireAuth, async (req, res) => {
  const { accessToken, expiresIn } = req.body;

  if (!accessToken) {
    return fail(res, 400, 'Access token required', 'TOKEN_REQUIRED');
  }

  await query(
    `INSERT INTO exchange_accounts (user_id, exchange_name, exchange_type, api_key, api_secret, broker_type, paper_mode, is_active)
     VALUES (:userId, 'Upstox', 'stock', :token, :token, 'oauth', 0, 1)
     ON DUPLICATE KEY UPDATE api_key = :token, api_secret = :token, is_active = 1`,
    { userId: req.user.id, token: accessToken }
  );

  return ok(res, { message: 'Token set successfully' });
});

router.post('/disconnect', requireAuth, async (req, res) => {
  await query(
    'UPDATE exchange_accounts SET is_active = 0 WHERE user_id = :userId AND LOWER(exchange_name) = "upstox"',
    { userId: req.user.id }
  );
  return ok(res, { message: 'Disconnected from Upstox' });
});

// ============ PROFILE & FUNDS ============

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const token = await getUserToken(req.user.id);
    if (!token) return fail(res, 401, 'Upstox not connected for your account', 'NOT_AUTHENTICATED');
    const profile = await upstoxAdapter.getProfile(token);
    return ok(res, { profile });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.get('/funds', requireAuth, async (req, res) => {
  try {
    const token = await getUserToken(req.user.id);
    if (!token) return fail(res, 401, 'Upstox not connected for your account', 'NOT_AUTHENTICATED');
    const funds = await upstoxAdapter.getFunds(token);
    return ok(res, { funds });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

// ============ POSITIONS & HOLDINGS ============

router.get('/positions', requireAuth, async (req, res) => {
  try {
    const token = await getUserToken(req.user.id);
    if (!token) return fail(res, 401, 'Upstox not connected for your account', 'NOT_AUTHENTICATED');
    const positions = await upstoxAdapter.getPositions(token);
    return ok(res, { positions });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.get('/holdings', requireAuth, async (req, res) => {
  try {
    const token = await getUserToken(req.user.id);
    if (!token) return fail(res, 401, 'Upstox not connected for your account', 'NOT_AUTHENTICATED');
    const holdings = await upstoxAdapter.getHoldings(token);
    return ok(res, { holdings });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

// ============ ORDERS ============

router.get('/orders', requireAuth, async (req, res) => {
  try {
    const token = await getUserToken(req.user.id);
    if (!token) return fail(res, 401, 'Upstox not connected for your account', 'NOT_AUTHENTICATED');
    const orders = await upstoxAdapter.getOrderHistory(token);
    return ok(res, { orders });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.get('/orders/open', requireAuth, async (req, res) => {
  try {
    const token = await getUserToken(req.user.id);
    if (!token) return fail(res, 401, 'Upstox not connected for your account', 'NOT_AUTHENTICATED');
    const orders = await upstoxAdapter.getOpenOrders(token);
    return ok(res, { orders });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.get('/orders/:orderId/status', requireAuth, async (req, res) => {
  try {
    const token = await getUserToken(req.user.id);
    if (!token) return fail(res, 401, 'Upstox not connected for your account', 'NOT_AUTHENTICATED');
    const status = await upstoxAdapter.getOrderStatus(req.params.orderId, token);
    return ok(res, { order: status });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.post(
  '/orders/place',
  requireAuth,
  body('symbol').trim().notEmpty().withMessage('Symbol is required'),
  body('exchange').trim().notEmpty().withMessage('Exchange is required'),
  body('side').isIn(['buy', 'sell', 'BUY', 'SELL']).withMessage('Side must be buy or sell'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('orderType').optional().isIn(['market', 'limit', 'stop_loss', 'stop_limit']),
  body('price').optional().isFloat({ min: 0 }),
  body('stopPrice').optional().isFloat({ min: 0 }),
  body('product').optional().isIn(['D', 'I']).withMessage('Product must be D (Delivery) or I (Intraday)'),
  validate,
  async (req, res) => {
    const { symbol, exchange, side, quantity, orderType = 'market', price, stopPrice, product = 'D' } = req.body;

    console.log('[Upstox] Order request:', { symbol, exchange, side, quantity, orderType, price, product });

    try {
      const token = await getUserToken(req.user.id);
      if (!token) return fail(res, 401, 'Upstox not connected for your account', 'NOT_AUTHENTICATED');

      const order = await upstoxAdapter.placeOrder({
        symbol,
        exchange,
        side,
        quantity,
        orderType,
        price,
        stopPrice,
        product
      }, token);

      return ok(res, { order, message: 'Order placed successfully' }, 201);
    } catch (error) {
      console.error('[Upstox] Order placement failed:', error.message);
      return handleUpstoxError(res, error);
    }
  }
);

router.delete('/orders/:orderId', requireAuth, async (req, res) => {
  try {
    const token = await getUserToken(req.user.id);
    if (!token) return fail(res, 401, 'Upstox not connected for your account', 'NOT_AUTHENTICATED');
    const result = await upstoxAdapter.cancelOrder(req.params.orderId, token);
    return ok(res, { ...result, message: 'Order cancelled successfully' });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

// ============ MARKET DATA ============

router.get('/quote', requireAuth, async (req, res) => {
  const { symbol, exchange = 'NSE' } = req.query;

  if (!symbol) {
    return fail(res, 400, 'Symbol is required', 'SYMBOL_REQUIRED');
  }

  try {
    const token = await getUserToken(req.user.id);
    const quote = await upstoxAdapter.getQuote(symbol, exchange, token);
    return ok(res, { quote });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.get('/search', requireAuth, async (req, res) => {
  const { q, exchange = 'NSE' } = req.query;

  if (!q) {
    return ok(res, { symbols: [] });
  }

  try {
    const symbols = await upstoxAdapter.searchSymbols(q, exchange);
    return ok(res, { symbols });
  } catch (error) {
    console.error('[Upstox] Search error:', error.message);
    return ok(res, { symbols: [] });
  }
});

router.get('/instruments', requireAuth, async (req, res) => {
  const { exchange = 'NSE' } = req.query;

  try {
    const instruments = await upstoxAdapter.loadInstruments(exchange);
    return ok(res, {
      exchange,
      count: instruments.length,
      sample: instruments.slice(0, 10).map(i => ({
        symbol: i.trading_symbol,
        name: i.name,
        instrumentKey: i.instrument_key
      }))
    });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

export default router;
