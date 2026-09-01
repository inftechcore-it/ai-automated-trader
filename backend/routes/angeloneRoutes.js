import { Router } from 'express';
import { body, query as queryParam } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import * as angeloneAdapter from '../services/adapters/angeloneAdapter.js';
import { query } from '../config/db.js';

const router = Router();

// Get Angel One status & config
router.get('/status', requireAuth, async (req, res) => {
  try {
    const config = angeloneAdapter.getConfig();
    const [dbRecord] = await query(
      'SELECT api_key, api_secret, is_active, last_synced_at FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :name AND is_active = 1',
      { userId: req.user.id, name: 'AngelOne' }
    );

    return ok(res, {
      ...config,
      dbConnected: !!dbRecord,
      lastSynced: dbRecord?.last_synced_at
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
      const result = await angeloneAdapter.loginByPassword(req.body);
      return ok(res, { message: 'Angel One login successful', ...result });
    } catch (err) {
      return fail(res, 400, err.message);
    }
  }
);

// Disconnect session
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    angeloneAdapter.setCredentials('', '', '', '', null, null);
    await query(
      'UPDATE exchange_accounts SET is_active = 0 WHERE user_id = :userId AND exchange_name = :name',
      { userId: req.user.id, name: 'AngelOne' }
    );
    return ok(res, { message: 'Angel One session disconnected' });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// User profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await angeloneAdapter.getProfile();
    return ok(res, { profile });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// RMS Funds & Margins
router.get('/funds', requireAuth, async (req, res) => {
  try {
    const funds = await angeloneAdapter.getRMS();
    return ok(res, { funds });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Holdings
router.get('/holdings', requireAuth, async (req, res) => {
  try {
    const holdings = await angeloneAdapter.getHoldings();
    return ok(res, { holdings });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Positions
router.get('/positions', requireAuth, async (req, res) => {
  try {
    const positions = await angeloneAdapter.getPositions();
    return ok(res, { positions });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Orders
router.get('/orders', requireAuth, async (req, res) => {
  try {
    const orders = await angeloneAdapter.getOrderBook();
    return ok(res, { orders });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Live quote
router.get('/quote/:symbol', requireAuth, async (req, res) => {
  try {
    const exchange = req.query.exchange || 'NSE';
    const quote = await angeloneAdapter.getQuote(req.params.symbol, exchange);
    return ok(res, { quote });
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
