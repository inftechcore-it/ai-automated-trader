import { Router } from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import { query } from '../config/db.js';
import * as binanceAdapter from '../services/adapters/binanceAdapter.js';
import * as krakenAdapter from '../services/adapters/krakenAdapter.js';
import * as pionexAdapter from '../services/adapters/pionexAdapter.js';
import * as alpacaAdapter from '../services/adapters/alpacaAdapter.js';
import * as upstoxAdapter from '../services/adapters/upstoxAdapter.js';
import { connectBroker, disconnectBroker, getSupportedExchanges } from '../services/exchangeService.js';

const router = Router();

router.get('/status', requireAuth, async (req, res) => {
  try {
    const exchanges = getSupportedExchanges();
    const connectedBrokers = await query(
      'SELECT exchange_name, broker_type, paper_mode, is_active, last_synced_at FROM exchange_accounts WHERE user_id = :userId AND is_active = 1',
      { userId: req.user.id }
    );

    const status = {
      exchanges: exchanges.map(ex => ({
        ...ex,
        connected: connectedBrokers.some(b => b.exchange_name.toLowerCase() === ex.name.toLowerCase())
      })),
      connectedBrokers: connectedBrokers.map(b => ({
        exchange: b.exchange_name,
        type: b.broker_type,
        paperMode: b.paper_mode,
        lastSynced: b.last_synced_at
      })),
      upstoxAuthenticated: upstoxAdapter.isAuthenticated(),
      alpacaConfigured: alpacaAdapter.isConfigured()
    };

    return ok(res, status);
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

router.get('/alpaca/status', requireAuth, async (req, res) => {
  try {
    // Check if user has live Alpaca connected
    const [dbRecord] = await query(
      'SELECT paper_mode, is_active, last_synced_at FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :name AND is_active = 1',
      { userId: req.user.id, name: 'Alpaca' }
    );

    if (dbRecord) {
      return ok(res, {
        configured: true,
        paperMode: !!dbRecord.paper_mode,
        lastSynced: dbRecord.last_synced_at,
        source: 'database'
      });
    }

    // Fall back to environment config (paper trading from env is always available)
    const envConfigured = alpacaAdapter.isConfigured();
    return ok(res, {
      configured: envConfigured,
      paperMode: true, // Environment config is always paper mode
      source: envConfigured ? 'environment' : 'none'
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

router.post(
  '/connect',
  requireAuth,
  body('exchange').trim().notEmpty(),
  body('apiKey').trim().notEmpty(),
  body('apiSecret').trim().notEmpty(),
  body('paperMode').optional().isBoolean(),
  body('useTestnet').optional().isBoolean(),
  validate,
  async (req, res) => {
    const { exchange, apiKey, apiSecret, paperMode = false, useTestnet = false } = req.body;
    const exLower = exchange.toLowerCase();

    console.log(`[Broker] Connecting ${exchange} for user ${req.user.id} (testnet: ${useTestnet}, paper: ${paperMode})`);

    try {
      let validation;
      let exchangeName = exchange;
      let exchangeType = 'crypto';

      if (exLower === 'binance') {
        validation = await binanceAdapter.validateCredentials(apiKey, apiSecret, useTestnet);
        exchangeType = 'crypto';
      } else if (exLower === 'kraken') {
        validation = await krakenAdapter.validateCredentials(apiKey, apiSecret);
        exchangeType = 'crypto';
      } else if (exLower === 'pionex') {
        validation = await pionexAdapter.validateCredentials(apiKey, apiSecret);
        exchangeType = 'crypto';
      } else if (exLower === 'bybit') {
        // Bybit validation - just store for now, validate later
        validation = { valid: true, permissions: ['spot'] };
        exchangeType = 'crypto';
      } else if (exLower === 'coinbase') {
        // Coinbase validation - just store for now
        validation = { valid: true, permissions: ['wallet'] };
        exchangeType = 'crypto';
      } else if (['alpaca', 'nasdaq', 'nyse'].includes(exLower)) {
        validation = await alpacaAdapter.validateCredentials(apiKey, apiSecret, paperMode);
        exchangeName = 'Alpaca';
        exchangeType = 'stock';
        alpacaAdapter.setCredentials(apiKey, apiSecret, paperMode);
      } else {
        return fail(res, 400, `Exchange ${exchange} not supported for direct API connection`);
      }

      if (!validation.valid) {
        return fail(res, 401, validation.error || 'Invalid API credentials', 'INVALID_CREDENTIALS');
      }

      // Store credentials in database
      await query(
        `INSERT INTO exchange_accounts (user_id, exchange_name, exchange_type, api_key, api_secret, broker_type, paper_mode, is_active)
         VALUES (:userId, :exchangeName, :exchangeType, :apiKey, :apiSecret, 'api', :paperMode, 1)
         ON DUPLICATE KEY UPDATE api_key = :apiKey, api_secret = :apiSecret, paper_mode = :paperMode, is_active = 1`,
        {
          userId: req.user.id,
          exchangeName,
          exchangeType,
          apiKey,
          apiSecret,
          paperMode: paperMode ? 1 : 0
        }
      );

      // Cache credentials for immediate use
      connectBroker(exchangeName, { apiKey, apiSecret, paperMode });

      console.log(`[Broker] ${exchangeName} connected for user ${req.user.id} (paper: ${paperMode})`);

      return ok(res, {
        connected: true,
        exchange: exchangeName,
        paperMode,
        permissions: validation.permissions || [],
        ...validation
      });
    } catch (error) {
      console.error(`[Broker] Connection error for ${exchange}:`, error.message);
      return fail(res, error.response?.status || 500, error.message, 'CONNECTION_FAILED');
    }
  }
);

router.delete(
  '/disconnect/:exchange',
  requireAuth,
  param('exchange').trim().notEmpty(),
  validate,
  async (req, res) => {
    const exchangeName = req.params.exchange;
    try {
      await query(
        'UPDATE exchange_accounts SET is_active = 0 WHERE user_id = :userId AND LOWER(exchange_name) = LOWER(:exchangeName)',
        { userId: req.user.id, exchangeName }
      );

      disconnectBroker(exchangeName);

      // Clear adapter credentials if Alpaca
      if (exchangeName.toLowerCase() === 'alpaca') {
        alpacaAdapter.setCredentials(null, null, true);
      }

      console.log(`[Broker] ${exchangeName} disconnected for user ${req.user.id}`);

      return ok(res, { disconnected: true, exchange: exchangeName });
    } catch (error) {
      return fail(res, 500, error.message);
    }
  }
);

router.get('/balances/:exchange', requireAuth, async (req, res) => {
  const exchange = req.params.exchange.toLowerCase();

  try {
    const [credentials] = await query(
      'SELECT api_key, api_secret, paper_mode FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :exchangeName AND is_active = 1',
      { userId: req.user.id, exchangeName: req.params.exchange }
    );

    if (!credentials) {
      return fail(res, 404, `${req.params.exchange} not connected`, 'BROKER_NOT_CONNECTED');
    }

    let balances;

    if (exchange === 'binance') {
      balances = await binanceAdapter.getBalances(credentials.api_key, credentials.api_secret);
    } else if (exchange === 'kraken') {
      balances = await krakenAdapter.getBalances(credentials.api_key, credentials.api_secret);
    } else if (exchange === 'pionex') {
      balances = await pionexAdapter.getBalances(credentials.api_key, credentials.api_secret);
    } else if (['alpaca', 'nasdaq', 'nyse'].includes(exchange)) {
      alpacaAdapter.setCredentials(credentials.api_key, credentials.api_secret, credentials.paper_mode);
      balances = await alpacaAdapter.getBalances();
    } else {
      return fail(res, 400, 'Exchange not supported');
    }

    // Update last synced
    await query(
      'UPDATE exchange_accounts SET last_synced_at = NOW() WHERE user_id = :userId AND exchange_name = :exchangeName',
      { userId: req.user.id, exchangeName: req.params.exchange }
    );

    return ok(res, { balances, exchange: req.params.exchange });
  } catch (error) {
    console.error(`[Broker] Balance error for ${exchange}:`, error.message);
    return fail(res, 500, error.message);
  }
});

router.get('/positions/:exchange', requireAuth, async (req, res) => {
  const exchange = req.params.exchange.toLowerCase();

  try {
    let positions = [];

    if (['alpaca', 'nasdaq', 'nyse'].includes(exchange)) {
      const [credentials] = await query(
        'SELECT api_key, api_secret, paper_mode FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :exchangeName AND is_active = 1',
        { userId: req.user.id, exchangeName: 'Alpaca' }
      );

      if (credentials) {
        alpacaAdapter.setCredentials(credentials.api_key, credentials.api_secret, credentials.paper_mode);
        positions = await alpacaAdapter.getPositions();
      }
    } else if (['nse', 'bse'].includes(exchange) && upstoxAdapter.isAuthenticated()) {
      positions = await upstoxAdapter.getPositions();
    }

    return ok(res, { positions, exchange: req.params.exchange });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

router.get('/orders/:exchange', requireAuth, async (req, res) => {
  const exchange = req.params.exchange.toLowerCase();

  try {
    let orders = [];

    if (exchange === 'binance') {
      const [credentials] = await query(
        'SELECT api_key, api_secret FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :exchangeName AND is_active = 1',
        { userId: req.user.id, exchangeName: 'Binance' }
      );
      if (credentials) {
        orders = await binanceAdapter.getOpenOrders(credentials.api_key, credentials.api_secret);
      }
    } else if (exchange === 'pionex') {
      const [credentials] = await query(
        'SELECT api_key, api_secret FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :exchangeName AND is_active = 1',
        { userId: req.user.id, exchangeName: 'Pionex' }
      );
      if (credentials) {
        orders = await pionexAdapter.getOpenOrders(credentials.api_key, credentials.api_secret);
      }
    } else if (['alpaca', 'nasdaq', 'nyse'].includes(exchange)) {
      const [credentials] = await query(
        'SELECT api_key, api_secret, paper_mode FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :exchangeName AND is_active = 1',
        { userId: req.user.id, exchangeName: 'Alpaca' }
      );
      if (credentials) {
        alpacaAdapter.setCredentials(credentials.api_key, credentials.api_secret, credentials.paper_mode);
        orders = await alpacaAdapter.getOpenOrders();
      }
    } else if (['nse', 'bse'].includes(exchange) && upstoxAdapter.isAuthenticated()) {
      orders = await upstoxAdapter.getOpenOrders();
    }

    return ok(res, { orders, exchange: req.params.exchange });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

export default router;
