import { query } from '../config/db.js';
import { decrypt } from '../utils/encryption.js';
import * as binanceAdapter from './adapters/binanceAdapter.js';
import * as bybitAdapter from './adapters/bybitAdapter.js';
import * as krakenAdapter from './adapters/krakenAdapter.js';
import * as pionexAdapter from './adapters/pionexAdapter.js';
import * as coindcxAdapter from './adapters/coindcxAdapter.js';
import * as alpacaAdapter from './adapters/alpacaAdapter.js';
import * as angeloneAdapter from './adapters/angeloneAdapter.js';
import * as jupiterAdapter from './adapters/jupiterAdapter.js';
import * as upstoxAdapter from './adapters/upstoxAdapter.js';
import * as cache from './cache.js';

function getAdapter(exchangeName) {
  const name = exchangeName.toLowerCase();
  if (name === 'binance') return binanceAdapter;
  if (name === 'bybit') return bybitAdapter;
  if (name === 'kraken') return krakenAdapter;
  if (name === 'coindcx') return coindcxAdapter;
  if (name === 'pionex') return pionexAdapter;
  if (name === 'alpaca' || name === 'nasdaq' || name === 'nyse') return alpacaAdapter;
  if (name === 'angelone') return angeloneAdapter;
  if (name === 'jupiter') return jupiterAdapter;
  if (name === 'upstox') return upstoxAdapter;
  return null;
}

function safeDecrypt(val) {
  if (!val) return '';
  try {
    return decrypt(val);
  } catch {
    return val;
  }
}

export async function validateCredentials(exchangeName, apiKey, apiSecret, extraParams = {}) {
  const name = exchangeName.toLowerCase();
  try {
    if (name === 'binance') {
      return await binanceAdapter.validateCredentials(apiKey, apiSecret, extraParams.useTestnet);
    }
    if (name === 'bybit') {
      return await bybitAdapter.validateCredentials(apiKey, apiSecret, extraParams.useTestnet || extraParams.paperMode);
    }
    if (name === 'kraken') {
      return await krakenAdapter.validateCredentials(apiKey, apiSecret);
    }
    if (name === 'coindcx') {
      return await coindcxAdapter.validateCredentials(apiKey, apiSecret);
    }
    if (name === 'pionex') {
      return await pionexAdapter.validateCredentials(apiKey, apiSecret);
    }
    if (['alpaca', 'nasdaq', 'nyse'].includes(name)) {
      return await alpacaAdapter.validateCredentials(apiKey, apiSecret, extraParams.paperMode);
    }
    if (name === 'angelone') {
      const clientCode = extraParams.clientCode || apiSecret;
      const totp = extraParams.totp || extraParams.totpSecret;
      return await angeloneAdapter.validateCredentials(apiKey, clientCode, extraParams.password, totp);
    }
    if (name === 'jupiter') {
      const pk = apiSecret || apiKey;
      const kp = jupiterAdapter.getKeypair(pk);
      if (!kp) {
        return { valid: false, error: 'Invalid Solana private key' };
      }
      return {
        valid: true,
        permissions: ['swap', 'limit', 'dca'],
        hasWallet: true,
        walletAddress: kp.publicKey.toBase58()
      };
    }
    if (name === 'coinbase') {
      return { valid: true, permissions: ['spot'] };
    }

    return { valid: false, error: `${exchangeName} validation not supported yet` };
  } catch (err) {
    const message = err.response?.data?.msg || err.message || 'Invalid credentials';
    return { valid: false, error: message };
  }
}

export async function getBalances(connectionId, userId) {
  const cacheKey = `balances:${connectionId}:${userId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 1. Check exchange_accounts table first
  let record = null;
  const [accountRow] = await query(
    `SELECT id, exchange_name, exchange_type, api_key, api_secret, additional_params, paper_mode
     FROM exchange_accounts WHERE id = :id AND user_id = :userId AND is_active = 1`,
    { id: connectionId, userId }
  );

  if (accountRow) {
    let additional = {};
    try {
      if (accountRow.additional_params) {
        additional = typeof accountRow.additional_params === 'string' ? JSON.parse(accountRow.additional_params) : accountRow.additional_params;
      }
    } catch {}

    record = {
      exchangeName: accountRow.exchange_name,
      apiKey: accountRow.api_key,
      apiSecret: accountRow.api_secret,
      paperMode: !!accountRow.paper_mode,
      clientCode: additional.clientCode || accountRow.api_secret,
      password: additional.password || '',
      totpSecret: additional.totpSecret || '',
      privateKey: additional.privateKey || accountRow.api_secret,
      rpcUrl: additional.rpcUrl || '',
      additional
    };
  } else {
    // 2. Fall back to exchange_connections table
    const [connRow] = await query(
      `SELECT id, exchange_name, exchange_type, api_key_encrypted, api_secret_encrypted
       FROM exchange_connections WHERE id = :id AND user_id = :userId AND is_active = 1`,
      { id: connectionId, userId }
    );

    if (connRow) {
      record = {
        exchangeName: connRow.exchange_name,
        apiKey: safeDecrypt(connRow.api_key_encrypted),
        apiSecret: safeDecrypt(connRow.api_secret_encrypted),
        paperMode: false
      };
    }
  }

  if (!record) {
    throw new Error('Exchange connection not found');
  }

  const exLower = record.exchangeName.toLowerCase();

  try {
    let balances = [];

    if (exLower === 'binance') {
      balances = await binanceAdapter.getBalances(record.apiKey, record.apiSecret);
    } else if (exLower === 'bybit') {
      balances = await bybitAdapter.getBalances(record.apiKey, record.apiSecret, record.paperMode);
    } else if (exLower === 'kraken') {
      balances = await krakenAdapter.getBalances(record.apiKey, record.apiSecret);
    } else if (exLower === 'coindcx') {
      balances = await coindcxAdapter.getBalances(record.apiKey, record.apiSecret);
    } else if (exLower === 'pionex') {
      balances = await pionexAdapter.getBalances(record.apiKey, record.apiSecret);
    } else if (['alpaca', 'nasdaq', 'nyse'].includes(exLower)) {
      balances = await alpacaAdapter.getBalances({
        apiKey: record.apiKey,
        apiSecret: record.apiSecret,
        paper: record.paperMode
      });
    } else if (exLower === 'angelone') {
      const rms = await angeloneAdapter.getRMS(record);
      const holdings = await angeloneAdapter.getHoldings(record);
      balances = [
        { asset: 'INR (Cash)', free: rms.availableCash, locked: rms.utilizedMargin, total: rms.net },
        ...holdings.map(h => ({
          asset: h.tradingsymbol,
          free: h.quantity,
          locked: 0,
          total: h.quantity,
          usdValue: (h.totalValue || (h.quantity * h.ltp)) / 85.0
        }))
      ];
    } else if (exLower === 'jupiter') {
      balances = await jupiterAdapter.getBalances(record.privateKey, record.rpcUrl);
    } else if (exLower === 'upstox') {
      const funds = await upstoxAdapter.getFundsAndMargin(record.apiSecret || record.apiKey);
      const equity = funds.equity || {};
      balances = [
        {
          asset: 'INR',
          free: equity.available_margin || 0,
          locked: equity.used_margin || 0,
          total: (equity.available_margin || 0) + (equity.used_margin || 0)
        }
      ];
    }

    const result = { balances, lastSync: new Date().toISOString() };
    cache.set(cacheKey, result, 30 * 1000); // 30 sec cache
    return result;
  } catch (err) {
    const message = err.response?.data?.msg || err.message || 'Failed to fetch balances';
    return { balances: [], error: message };
  }
}

export async function verifyConnection(connectionId, userId) {
  let record = null;
  const [accountRow] = await query(
    `SELECT id, exchange_name, api_key, api_secret, additional_params, paper_mode
     FROM exchange_accounts WHERE id = :id AND user_id = :userId`,
    { id: connectionId, userId }
  );

  if (accountRow) {
    record = {
      type: 'account',
      exchangeName: accountRow.exchange_name,
      apiKey: accountRow.api_key,
      apiSecret: accountRow.api_secret,
      paperMode: !!accountRow.paper_mode
    };
  } else {
    const [connRow] = await query(
      `SELECT id, exchange_name, api_key_encrypted, api_secret_encrypted
       FROM exchange_connections WHERE id = :id AND user_id = :userId`,
      { id: connectionId, userId }
    );
    if (connRow) {
      record = {
        type: 'connection',
        exchangeName: connRow.exchange_name,
        apiKey: safeDecrypt(connRow.api_key_encrypted),
        apiSecret: safeDecrypt(connRow.api_secret_encrypted)
      };
    }
  }

  if (!record) {
    throw new Error('Exchange connection not found');
  }

  try {
    const result = await validateCredentials(record.exchangeName, record.apiKey, record.apiSecret, {
      paperMode: record.paperMode
    });

    if (record.type === 'account') {
      await query(
        'UPDATE exchange_accounts SET last_synced_at = NOW(), is_active = 1 WHERE id = :id',
        { id: connectionId }
      );
    } else {
      await query(
        'UPDATE exchange_connections SET last_verified = NOW(), is_active = TRUE WHERE id = :id',
        { id: connectionId }
      );
    }

    return { ...result, lastVerified: new Date().toISOString() };
  } catch (err) {
    const message = err.response?.data?.msg || err.message || 'Verification failed';
    return { valid: false, error: message };
  }
}

export async function getAllBalances(userId) {
  // Get active accounts from exchange_accounts
  const accounts = await query(
    `SELECT id, exchange_name AS exchangeName, is_active AS isActive
     FROM exchange_accounts WHERE user_id = :userId AND is_active = 1`,
    { userId }
  );

  // Get active connections from exchange_connections
  const connections = await query(
    `SELECT id, exchange_name AS exchangeName, is_active AS isActive
     FROM exchange_connections WHERE user_id = :userId AND is_active = TRUE`,
    { userId }
  );

  const combined = [...accounts, ...connections];

  const results = await Promise.all(
    combined.map(async (conn) => {
      const { balances, error, lastSync } = await getBalances(conn.id, userId);
      return {
        exchangeId: conn.id,
        exchangeName: conn.exchangeName,
        balances: balances || [],
        error,
        lastSync
      };
    })
  );

  return results;
}
