import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import * as upstoxAdapter from '../services/adapters/upstoxAdapter.js';

const router = Router();

// Middleware to handle token expiry
function handleUpstoxError(res, error) {
  console.error('[Upstox Route] Error:', error.message);

  if (error.code === 'TOKEN_EXPIRED' || error.status === 401) {
    return fail(res, 401, 'Session expired. Please re-authenticate with Upstox.', 'TOKEN_EXPIRED');
  }
  if (error.code === 'NOT_AUTHENTICATED') {
    return fail(res, 401, 'Upstox not connected. Please authenticate first.', 'NOT_AUTHENTICATED');
  }
  return fail(res, 500, error.message, 'UPSTOX_ERROR');
}

router.get('/status', requireAuth, (req, res) => {
  const isExpired = upstoxAdapter.isTokenExpired();
  return ok(res, {
    configured: upstoxAdapter.isConfigured(),
    authenticated: upstoxAdapter.isAuthenticated(),
    tokenExpired: isExpired
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
    return res.redirect(`${redirectBase}?upstox_connected=true`);
  } catch (err) {
    console.error('[Upstox] Token exchange error:', err.message);
    return res.redirect(`${redirectBase}?upstox_error=${encodeURIComponent(err.message)}`);
  }
});

router.post('/set-token', requireAuth, (req, res) => {
  const { accessToken, expiresIn } = req.body;

  if (!accessToken) {
    return fail(res, 400, 'Access token required', 'TOKEN_REQUIRED');
  }

  upstoxAdapter.setAccessToken(accessToken, expiresIn || 86400);
  return ok(res, { message: 'Token set successfully' });
});

router.post('/disconnect', requireAuth, (req, res) => {
  upstoxAdapter.setAccessToken(null, 0);
  return ok(res, { message: 'Disconnected from Upstox' });
});

// ============ PROFILE & FUNDS ============

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await upstoxAdapter.getProfile();
    return ok(res, { profile });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.get('/funds', requireAuth, async (req, res) => {
  try {
    const funds = await upstoxAdapter.getFunds();
    return ok(res, { funds });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

// ============ POSITIONS & HOLDINGS ============

router.get('/positions', requireAuth, async (req, res) => {
  try {
    const positions = await upstoxAdapter.getPositions();
    return ok(res, { positions });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.get('/holdings', requireAuth, async (req, res) => {
  try {
    const holdings = await upstoxAdapter.getHoldings();
    return ok(res, { holdings });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

// ============ ORDERS ============

router.get('/orders', requireAuth, async (req, res) => {
  try {
    const orders = await upstoxAdapter.getOrderHistory();
    return ok(res, { orders });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.get('/orders/open', requireAuth, async (req, res) => {
  try {
    const orders = await upstoxAdapter.getOpenOrders();
    return ok(res, { orders });
  } catch (error) {
    return handleUpstoxError(res, error);
  }
});

router.get('/orders/:orderId/status', requireAuth, async (req, res) => {
  try {
    const status = await upstoxAdapter.getOrderStatus(req.params.orderId);
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
      const order = await upstoxAdapter.placeOrder({
        symbol,
        exchange,
        side,
        quantity,
        orderType,
        price,
        stopPrice,
        product
      });

      return ok(res, { order, message: 'Order placed successfully' }, 201);
    } catch (error) {
      console.error('[Upstox] Order placement failed:', error.message);
      return handleUpstoxError(res, error);
    }
  }
);

router.delete('/orders/:orderId', requireAuth, async (req, res) => {
  try {
    const result = await upstoxAdapter.cancelOrder(req.params.orderId);
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
    const quote = await upstoxAdapter.getQuote(symbol, exchange);
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
