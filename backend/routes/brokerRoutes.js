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
import { connectBroker, disconnectBroker, getSupportedExchanges, getUserBrokerCredentials } from '../services/exchangeService.js';

const router = Router();

router.get('/status', requireAuth, async (req, res) => {
  try {
    const exchanges = getSupportedExchanges();
    const connectedBrokers = await query(
      'SELECT exchange_name, broker_type, paper_mode, is_active, last_synced_at FROM exchange_accounts WHERE user_id = :userId AND is_active = 1',
      { userId: req.user.id }
    );
    const oldConnections = await query(
      'SELECT exchange_name, is_active FROM exchange_connections WHERE user_id = :userId AND is_active = 1',
      { userId: req.user.id }
    );

    const allConnectedNames = new Set([
      ...connectedBrokers.map(b => b.exchange_name.toLowerCase()),
      ...oldConnections.map(b => b.exchange_name.toLowerCase())
    ]);

    const status = {
      exchanges: exchanges.map(ex => ({
        ...ex,
        connected: allConnectedNames.has(ex.name.toLowerCase())
      })),
      connectedBrokers: connectedBrokers.map(b => ({
        exchange: b.exchange_name,
        type: b.broker_type,
        paperMode: b.paper_mode,
        lastSynced: b.last_synced_at
      })),
      upstoxAuthenticated: allConnectedNames.has('upstox'),
      angeloneAuthenticated: allConnectedNames.has('angelone'),
      angeloneConfigured: allConnectedNames.has('angelone'),
      jupiterConfigured: allConnectedNames.has('jupiter'),
      alpacaConfigured: allConnectedNames.has('alpaca')
    };

    return ok(res, status);
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

router.get('/angelone/status', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'AngelOne');

    if (creds) {
      return ok(res, {
        configured: true,
        authenticated: true,
        paperMode: !!creds.paperMode,
        source: 'database'
      });
    }

    return ok(res, {
      configured: false,
      authenticated: false,
      paperMode: false,
      source: 'none'
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

router.get('/alpaca/status', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'Alpaca');

    if (creds) {
      return ok(res, {
        configured: true,
        paperMode: !!creds.paperMode,
        source: 'database'
      });
    }

    return ok(res, {
      configured: false,
      paperMode: true,
      source: 'none'
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

router.get('/jupiter/status', requireAuth, async (req, res) => {
  try {
    const creds = await getUserBrokerCredentials(req.user.id, 'Jupiter');

    if (creds) {
      const pk = creds.privateKey || creds.apiSecret;
      const balances = await jupiterAdapter.getBalances(pk, creds.rpcUrl).catch(() => []);
      const solBal = balances.find(b => b.asset === 'SOL');

      return ok(res, {
        configured: true,
        authenticated: !!pk,
        walletAddress: creds.apiKey || null,
        solBalance: solBal ? solBal.free : 0,
        balances,
        rpcUrl: creds.rpcUrl || 'https://api.mainnet-beta.solana.com',
        paperMode: !!creds.paperMode,
        source: 'database'
      });
    }

    return ok(res, {
      configured: false,
      authenticated: false,
      walletAddress: null,
      solBalance: 0,
      balances: [],
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      paperMode: false,
      source: 'none'
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
        const kp = jupiterAdapter.getKeypair(effectivePk);
        validation = {
          valid: !!kp,
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
      await query(
        'UPDATE exchange_connections SET is_active = 0 WHERE user_id = :userId AND LOWER(exchange_name) = LOWER(:exchangeName)',
        { userId: req.user.id, exchangeName }
      );

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
    const credentials = await getUserBrokerCredentials(req.user.id, req.params.exchange);

    if (!credentials) {
      return fail(res, 404, `${req.params.exchange} not connected for your account`, 'BROKER_NOT_CONNECTED');
    }

    let balances = [];

    if (exchange === 'binance') {
      balances = await binanceAdapter.getBalances(credentials.apiKey, credentials.apiSecret);
    } else if (exchange === 'kraken') {
      balances = await krakenAdapter.getBalances(credentials.apiKey, credentials.apiSecret);
    } else if (exchange === 'pionex') {
      balances = await pionexAdapter.getBalances(credentials.apiKey, credentials.apiSecret);
    } else if (exchange === 'jupiter') {
      const pk = credentials.privateKey || credentials.apiSecret;
      balances = await jupiterAdapter.getBalances(pk, credentials.rpcUrl);
    } else if (exchange === 'angelone') {
      const rms = await angeloneAdapter.getRMS(credentials);
      const holdings = await angeloneAdapter.getHoldings(credentials);
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
      balances = await alpacaAdapter.getBalances(credentials);
    } else if (exchange === 'upstox') {
      const token = credentials.apiSecret || credentials.apiKey;
      const funds = await upstoxAdapter.getFunds(token);
      balances = [
        { asset: 'INR (Cash)', free: funds.available_margin || 0, locked: funds.used_margin || 0, total: (funds.available_margin || 0) + (funds.used_margin || 0) }
      ];
    } else {
      return fail(res, 400, 'Exchange not supported');
    }

    // Update last synced
    await query(
      'UPDATE exchange_accounts SET last_synced_at = NOW() WHERE user_id = :userId AND LOWER(exchange_name) = LOWER(:exchangeName)',
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
    const credentials = await getUserBrokerCredentials(req.user.id, req.params.exchange);

    if (credentials) {
      if (exchange === 'jupiter') {
        const pk = credentials.privateKey || credentials.apiSecret;
        positions = await jupiterAdapter.getBalances(pk, credentials.rpcUrl);
      } else if (exchange === 'angelone') {
        positions = await angeloneAdapter.getHoldings(credentials);
      } else if (['alpaca', 'nasdaq', 'nyse'].includes(exchange)) {
        positions = await alpacaAdapter.getPositions(credentials);
      } else if (exchange === 'upstox') {
        positions = await upstoxAdapter.getPositions(credentials.apiSecret || credentials.apiKey);
      }
    } else if (['nse', 'bse'].includes(exchange)) {
      const angelCreds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
      if (angelCreds) {
        positions = await angeloneAdapter.getHoldings(angelCreds);
      } else {
        const upstoxCreds = await getUserBrokerCredentials(req.user.id, 'Upstox');
        if (upstoxCreds) {
          positions = await upstoxAdapter.getPositions(upstoxCreds.apiSecret || upstoxCreds.apiKey);
        }
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
    const credentials = await getUserBrokerCredentials(req.user.id, req.params.exchange);

    if (credentials) {
      if (exchange === 'jupiter') {
        orders = [];
      } else if (exchange === 'binance') {
        orders = await binanceAdapter.getOpenOrders(credentials.apiKey, credentials.apiSecret);
      } else if (exchange === 'pionex') {
        orders = await pionexAdapter.getOpenOrders(credentials.apiKey, credentials.apiSecret);
      } else if (exchange === 'angelone') {
        orders = await angeloneAdapter.getOrderBook(credentials);
      } else if (['alpaca', 'nasdaq', 'nyse'].includes(exchange)) {
        orders = await alpacaAdapter.getOpenOrders(credentials);
      } else if (exchange === 'upstox') {
        orders = await upstoxAdapter.getOpenOrders(credentials.apiSecret || credentials.apiKey);
      }
    } else if (['nse', 'bse'].includes(exchange)) {
      const angelCreds = await getUserBrokerCredentials(req.user.id, 'AngelOne');
      if (angelCreds) {
        orders = await angeloneAdapter.getOrderBook(angelCreds);
      } else {
        const upstoxCreds = await getUserBrokerCredentials(req.user.id, 'Upstox');
        if (upstoxCreds) {
          orders = await upstoxAdapter.getOpenOrders(upstoxCreds.apiSecret || upstoxCreds.apiKey);
        }
      }
    }

    return ok(res, { orders, exchange: req.params.exchange });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

export default router;
