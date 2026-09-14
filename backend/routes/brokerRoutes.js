import { Router } from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import { query } from '../config/db.js';
import * as binanceAdapter from '../services/adapters/binanceAdapter.js';
import * as krakenAdapter from '../services/adapters/krakenAdapter.js';
import * as pionexAdapter from '../services/adapters/pionexAdapter.js';
import * as jupiterAdapter from '../services/adapters/jupiterAdapter.js';
import * as angeloneAdapter from '../services/adapters/angeloneAdapter.js';
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
      angeloneAuthenticated: angeloneAdapter.isAuthenticated(),
      angeloneConfigured: angeloneAdapter.isConfigured(),
      jupiterConfigured: jupiterAdapter.isConfigured(),
      alpacaConfigured: alpacaAdapter.isConfigured()
    };

    return ok(res, status);
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

router.get('/angelone/status', requireAuth, async (req, res) => {
  try {
    const [dbRecord] = await query(
      'SELECT paper_mode, is_active, last_synced_at FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :name AND is_active = 1',
      { userId: req.user.id, name: 'AngelOne' }
    );

    if (dbRecord) {
      return ok(res, {
        configured: true,
        authenticated: angeloneAdapter.isAuthenticated(),
        paperMode: !!dbRecord.paper_mode,
        lastSynced: dbRecord.last_synced_at,
        source: 'database'
      });
    }

    const envConfigured = angeloneAdapter.isConfigured();
    return ok(res, {
      configured: envConfigured,
      authenticated: angeloneAdapter.isAuthenticated(),
      paperMode: false,
      source: envConfigured ? 'environment' : 'none'
    });
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

router.get('/jupiter/status', requireAuth, async (req, res) => {
  try {
    const [dbRecord] = await query(
      'SELECT api_key, api_secret, paper_mode, is_active, last_synced_at FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :name AND is_active = 1',
      { userId: req.user.id, name: 'Jupiter' }
    );

    const config = jupiterAdapter.getConfig();
    const balances = await jupiterAdapter.getBalances().catch(() => []);
    const solBal = balances.find(b => b.asset === 'SOL');

    if (dbRecord) {
      return ok(res, {
        configured: true,
        authenticated: config.hasWallet,
        walletAddress: config.walletAddress,
        solBalance: solBal ? solBal.free : 0,
        balances,
        rpcUrl: config.rpcUrl,
        paperMode: !!dbRecord.paper_mode,
        lastSynced: dbRecord.last_synced_at,
        source: 'database'
      });
    }

    return ok(res, {
      configured: config.configured,
      authenticated: config.hasWallet,
      walletAddress: config.walletAddress,
      solBalance: solBal ? solBal.free : 0,
      balances,
      rpcUrl: config.rpcUrl,
      paperMode: false,
      source: config.configured ? 'environment' : 'none'
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
  body('apiSecret').optional().isString(),
  body('clientCode').optional().isString(),
  body('password').optional().isString(),
  body('totp').optional().isString(),
  body('totpSecret').optional().isString(),
  body('privateKey').optional().isString(),
  body('rpcUrl').optional().isString(),
  body('paperMode').optional().isBoolean(),
  body('useTestnet').optional().isBoolean(),
  validate,
  async (req, res) => {
    const {
      exchange,
      apiKey,
      apiSecret = '',
      clientCode = '',
      password = '',
      totp = '',
      totpSecret = '',
      privateKey = '',
      rpcUrl = '',
      paperMode = false,
      useTestnet = false
    } = req.body;
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
      } else if (exLower === 'jupiter') {
        const effectiveRpc = rpcUrl || 'https://api.mainnet-beta.solana.com';
        const effectivePk = privateKey || apiSecret || '';
        jupiterAdapter.setCredentials(apiKey, effectiveRpc, effectivePk);
        const kp = jupiterAdapter.getKeypair();
        validation = {
          valid: true,
          permissions: ['swap', 'limit', 'dca'],
          hasWallet: !!kp,
          walletAddress: kp ? kp.publicKey.toBase58() : null
        };
        exchangeName = 'Jupiter';
        exchangeType = 'dex';
      } else if (exLower === 'angelone') {
        const effectiveClientCode = clientCode || apiSecret;
        const effectiveTotp = totp || totpSecret;
        validation = await angeloneAdapter.validateCredentials(apiKey, effectiveClientCode, password, effectiveTotp);
        exchangeName = 'AngelOne';
        exchangeType = 'stock';
      } else if (exLower === 'bybit') {
        validation = { valid: true, permissions: ['spot'] };
        exchangeType = 'crypto';
      } else if (exLower === 'coinbase') {
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
      const storedSecret = exLower === 'jupiter' ? (privateKey || apiSecret) : (apiSecret || clientCode);
      let additionalParams = null;
      if (exLower === 'angelone') {
        additionalParams = JSON.stringify({
          clientCode: clientCode || apiSecret,
          password,
          totpSecret: totpSecret || totp
        });
      } else if (exLower === 'jupiter') {
        additionalParams = JSON.stringify({
          rpcUrl: rpcUrl || 'https://api.mainnet-beta.solana.com',
          privateKey: privateKey || apiSecret
        });
      }

      await query(
        `INSERT INTO exchange_accounts (user_id, exchange_name, exchange_type, api_key, api_secret, additional_params, broker_type, paper_mode, is_active)
         VALUES (:userId, :exchangeName, :exchangeType, :apiKey, :apiSecret, :additionalParams, 'api', :paperMode, 1)
         ON DUPLICATE KEY UPDATE api_key = :apiKey, api_secret = :apiSecret, additional_params = :additionalParams, paper_mode = :paperMode, is_active = 1`,
        {
          userId: req.user.id,
          exchangeName,
          exchangeType,
          apiKey,
          apiSecret: storedSecret,
          additionalParams,
          paperMode: paperMode ? 1 : 0
        }
      );

      // Cache credentials for immediate use
      connectBroker(exchangeName, {
        apiKey,
        apiSecret: apiSecret || clientCode,
        clientCode: clientCode || apiSecret,
        password,
        totpSecret: totpSecret || totp,
        paperMode
      });

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

      // Clear adapter credentials
      if (exchangeName.toLowerCase() === 'angelone') {
        angeloneAdapter.clearCredentials();
      }
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
    } else if (exchange === 'jupiter') {
      balances = await jupiterAdapter.getBalances();
    } else if (exchange === 'angelone') {
      const rms = await angeloneAdapter.getRMS();
      const holdings = await angeloneAdapter.getHoldings();
      balances = [
        { asset: 'INR (Cash)', free: rms.availableCash, locked: rms.utilizedMargin, total: rms.net },
        ...holdings.map(h => ({
          asset: h.tradingsymbol,
          free: h.quantity,
          locked: 0,
          total: h.quantity,
          ltp: h.ltp,
          value: h.totalValue
        }))
      ];
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

    if (exchange === 'jupiter') {
      positions = await jupiterAdapter.getBalances();
    } else if (exchange === 'angelone') {
      positions = await angeloneAdapter.getHoldings();
    } else if (['alpaca', 'nasdaq', 'nyse'].includes(exchange)) {
      const [credentials] = await query(
        'SELECT api_key, api_secret, paper_mode FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :exchangeName AND is_active = 1',
        { userId: req.user.id, exchangeName: 'Alpaca' }
      );

      if (credentials) {
        alpacaAdapter.setCredentials(credentials.api_key, credentials.api_secret, credentials.paper_mode);
        positions = await alpacaAdapter.getPositions();
      }
    } else if (['nse', 'bse'].includes(exchange)) {
      if (angeloneAdapter.isAuthenticated()) {
        positions = await angeloneAdapter.getHoldings();
      } else if (upstoxAdapter.isAuthenticated()) {
        positions = await upstoxAdapter.getPositions();
      }
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

    if (exchange === 'jupiter') {
      orders = [];
    } else if (exchange === 'binance') {
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
    } else if (exchange === 'angelone') {
      orders = await angeloneAdapter.getOrderBook();
    } else if (['alpaca', 'nasdaq', 'nyse'].includes(exchange)) {
      const [credentials] = await query(
        'SELECT api_key, api_secret, paper_mode FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :exchangeName AND is_active = 1',
        { userId: req.user.id, exchangeName: 'Alpaca' }
      );
      if (credentials) {
        alpacaAdapter.setCredentials(credentials.api_key, credentials.api_secret, credentials.paper_mode);
        orders = await alpacaAdapter.getOpenOrders();
      }
    } else if (['nse', 'bse'].includes(exchange)) {
      if (angeloneAdapter.isAuthenticated()) {
        orders = await angeloneAdapter.getOrderBook();
      } else if (upstoxAdapter.isAuthenticated()) {
        orders = await upstoxAdapter.getOpenOrders();
      }
    }

    return ok(res, { orders, exchange: req.params.exchange });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

export default router;
