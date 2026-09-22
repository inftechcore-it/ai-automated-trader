import * as binanceAdapter from './adapters/binanceAdapter.js';
import * as krakenAdapter from './adapters/krakenAdapter.js';
import * as pionexAdapter from './adapters/pionexAdapter.js';
import * as coindcxAdapter from './adapters/coindcxAdapter.js';
import * as jupiterAdapter from './adapters/jupiterAdapter.js';
import * as angeloneAdapter from './adapters/angeloneAdapter.js';
import * as alphaVantageAdapter from './adapters/alphaVantageAdapter.js';
import * as upstoxAdapter from './adapters/upstoxAdapter.js';
import * as alpacaAdapter from './adapters/alpacaAdapter.js';
import * as yahooAdapter from './adapters/yahooAdapter.js';
import * as demoAdapter from './adapters/demoAdapter.js';
import * as cache from './cache.js';
import { query } from '../config/db.js';
import { env } from '../config/env.js';

let binanceSymbolsCache = null;
let binanceSymbolsCacheTime = 0;
const BINANCE_CACHE_TTL = 30 * 60 * 1000; // 30 min

export function getSupportedExchanges(userConnectedExchanges = []) {
  const connectedSet = new Set(userConnectedExchanges.map(e => (e || '').toLowerCase()));

  return [
    { name: 'Binance', type: 'crypto', description: 'Crypto spot trading', live: true, tradingEnabled: connectedSet.has('binance') },
    { name: 'CoinDCX', type: 'crypto', description: 'Indian & Global crypto spot trading exchange', live: true, tradingEnabled: connectedSet.has('coindcx') },
    { name: 'Pionex', type: 'crypto', description: 'Crypto trading with built-in bots', live: true, tradingEnabled: connectedSet.has('pionex') },
    { name: 'Jupiter', type: 'dex', description: 'Solana DEX Aggregator (Swaps, Limit, DCA)', live: true, tradingEnabled: connectedSet.has('jupiter') },
    { name: 'AngelOne', type: 'stock', description: 'Indian stocks via Angel One SmartAPI', live: true, tradingEnabled: connectedSet.has('angelone') },
    { name: 'Bybit', type: 'crypto', description: 'Crypto derivatives & spot', live: true, tradingEnabled: connectedSet.has('bybit') },
    { name: 'Kraken', type: 'crypto', description: 'Crypto trading', live: true, tradingEnabled: connectedSet.has('kraken') },
    { name: 'Coinbase', type: 'crypto', description: 'Crypto brokerage', live: false, tradingEnabled: false },
    { name: 'NASDAQ', type: 'stock', description: 'US stocks via Alpaca', live: true, tradingEnabled: connectedSet.has('alpaca') || connectedSet.has('nasdaq') },
    { name: 'NYSE', type: 'stock', description: 'US stocks via Alpaca', live: true, tradingEnabled: connectedSet.has('alpaca') || connectedSet.has('nyse') },
    { name: 'NSE', type: 'stock', description: 'Indian stocks via Angel One / Upstox', live: true, tradingEnabled: connectedSet.has('angelone') || connectedSet.has('upstox') },
    { name: 'BSE', type: 'stock', description: 'Indian stocks via Angel One / Upstox', live: true, tradingEnabled: connectedSet.has('angelone') || connectedSet.has('upstox') }
  ];
}

// Get only the exchanges that are connected and ready for trading for a specific user
export async function getConnectedExchanges(userId) {
  if (!userId) return [];

  const rows = await query(
    `SELECT exchange_name, exchange_type, paper_mode
     FROM exchange_accounts WHERE user_id = :userId AND is_active = 1`,
    { userId }
  );

  const oldRows = await query(
    `SELECT exchange_name FROM exchange_connections WHERE user_id = :userId AND is_active = 1`,
    { userId }
  ).catch(() => []);

  const seen = new Set();
  const connected = [];

  for (const r of (rows || [])) {
    const nameLower = (r.exchange_name || '').toLowerCase();
    if (nameLower && !seen.has(nameLower)) {
      seen.add(nameLower);
      connected.push({
        name: r.exchange_name,
        type: r.exchange_type || 'crypto',
        paperMode: !!r.paper_mode,
        isActive: true
      });
    }
  }

  for (const r of (oldRows || [])) {
    const nameLower = (r.exchange_name || '').toLowerCase();
    if (nameLower && !seen.has(nameLower)) {
      seen.add(nameLower);
      connected.push({
        name: r.exchange_name,
        type: 'crypto',
        paperMode: false,
        isActive: true
      });
    }
  }

  return connected;
}

export const supportedExchanges = getSupportedExchanges();

function getAdapter(exchange, symbol) {
  const exLower = exchange?.toLowerCase();

  if (exLower === 'jupiter' || (symbol && jupiterAdapter.supportsSymbol(symbol))) {
    return jupiterAdapter;
  }
  if (exLower === 'binance' && binanceAdapter.supportsSymbol(symbol)) {
    return binanceAdapter;
  }
  if (exLower === 'coindcx' && coindcxAdapter.supportsSymbol(symbol)) {
    return coindcxAdapter;
  }
  if (exLower === 'pionex' && pionexAdapter.supportsSymbol(symbol)) {
    return pionexAdapter;
  }
  if (exLower === 'kraken' && krakenAdapter.supportsSymbol(symbol)) {
    return krakenAdapter;
  }
  if (exLower === 'angelone') {
    return angeloneAdapter;
  }
  // Indian exchanges - use Yahoo for public quotes if not authenticated
  if (['nse', 'bse'].includes(exLower)) {
    return yahooAdapter;
  }
  // US exchanges - use Yahoo Finance (free, no rate limits)
  if (['nasdaq', 'nyse'].includes(exLower)) {
    return yahooAdapter;
  }

  return demoAdapter;
}

export async function getQuote(symbol, exchange = 'Binance') {
  const cacheKey = `quote:${exchange}:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const adapter = getAdapter(exchange, symbol);

  try {
    const quote = await adapter.getQuote(symbol, exchange);
    cache.set(cacheKey, quote, 30 * 1000); // 30 second cache for quotes
    return quote;
  } catch (err) {
    console.error(`[${exchange}] Quote error for ${symbol}:`, err.message);
    const fallback = await demoAdapter.getQuote(symbol, exchange);
    fallback.error = err.message;
    return fallback;
  }
}

export async function getHistory(symbol, exchange = 'Binance', interval = '1h', limit = 100) {
  const cacheKey = `ohlcv:${exchange}:${symbol}:${interval}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const adapter = getAdapter(exchange, symbol);

  try {
    const ohlcv = await adapter.getOHLCV(symbol, interval, limit, exchange);
    cache.set(cacheKey, ohlcv, 60 * 1000); // 1 minute cache for OHLCV
    return ohlcv;
  } catch (err) {
    console.error(`[${exchange}] OHLCV error for ${symbol}:`, err.message);
    return demoAdapter.getOHLCV(symbol, interval, limit, exchange);
  }
}

async function getCachedBinanceSymbols() {
  if (binanceSymbolsCache && binanceSymbolsCache.length > 0 && Date.now() - binanceSymbolsCacheTime < BINANCE_CACHE_TTL) {
    return binanceSymbolsCache;
  }

  try {
    const symbols = await binanceAdapter.ensureSymbolsCache();
    if (symbols && symbols.length > 0) {
      binanceSymbolsCache = symbols;
      binanceSymbolsCacheTime = Date.now();
      return symbols;
    }
  } catch (e) {
    console.warn('[Binance] Symbol fetch failed, fallback to defaults');
  }

  return binanceAdapter.POPULAR_BINANCE_SYMBOLS;
}

export async function searchSymbols(query = '', exchange = null) {
  const cacheKey = `search:${exchange || 'all'}:${query}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const results = [];
  const q = (query || '').toLowerCase();

  // If specific exchange requested
  if (exchange) {
    const exLower = exchange.toLowerCase();

    if (exLower === 'binance') {
      try {
        const symbols = await binanceAdapter.searchSymbols(query);
        cache.set(cacheKey, symbols.slice(0, 30), 5 * 60 * 1000);
        return symbols.slice(0, 30);
      } catch (e) {
        console.warn('[exchangeService] Binance symbol search error:', e.message);
      }
    }

    if (exLower === 'pionex') {
      try {
        const symbols = await pionexAdapter.searchSymbols(query);
        return symbols.slice(0, 30);
      } catch (e) {
        // fallback
      }
    }

    if (exLower === 'coindcx') {
      try {
        const symbols = await coindcxAdapter.searchSymbols(query);
        return symbols.slice(0, 30);
      } catch (e) {
        // fallback
      }
    }

    if (exLower === 'kraken') {
      try {
        const symbols = await krakenAdapter.searchSymbols(query);
        return symbols.slice(0, 30);
      } catch (e) {
        // fallback
      }
    }

    if (exLower === 'jupiter') {
      try {
        const symbols = await jupiterAdapter.searchSymbols(query);
        return symbols.slice(0, 30);
      } catch (e) {
        // fallback
      }
    }

    if (exLower === 'angelone' || ['nse', 'bse'].includes(exLower)) {
      try {
        const symbols = await angeloneAdapter.searchSymbols(query, exchange.toUpperCase());
        return symbols.slice(0, 30);
      } catch (e) {
        // fallback
      }
    }

    if (['nasdaq', 'nyse', 'alpaca'].includes(exLower)) {
      try {
        const symbols = await yahooAdapter.searchSymbols(query);
        return symbols.slice(0, 30);
      } catch (e) {
        // fallback
      }
    }
  }

  // Cross-exchange search
  const [binanceSyms, coindcxSyms, pionexSyms, jupiterSyms] = await Promise.all([
    binanceAdapter.searchSymbols(query).catch(() => []),
    coindcxAdapter.searchSymbols(query).catch(() => []),
    pionexAdapter.searchSymbols(query).catch(() => []),
    jupiterAdapter.searchSymbols(query).catch(() => [])
  ]);

  results.push(...binanceSyms.slice(0, 15));
  results.push(...coindcxSyms.slice(0, 10));
  results.push(...pionexSyms.slice(0, 10));
  results.push(...jupiterSyms.slice(0, 10));

  const unique = [];
  const seen = new Set();
  for (const item of results) {
    const key = `${item.exchange}:${item.symbol}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  if (unique.length > 0) {
    cache.set(cacheKey, unique, 2 * 60 * 1000);
  }
  return unique.slice(0, 30);
}

export async function placeLiveOrder(orderParams) {
  const { userId, symbol, exchange, side, orderType, quantity, price, stopPrice, broker } = orderParams;
  const exLower = exchange?.toLowerCase();

  if (!userId) {
    throw createError('User ID required for live order placement', 400, 'USER_REQUIRED');
  }

  // Crypto exchanges
  if (exLower === 'binance') {
    const creds = await getUserBrokerCredentials(userId, 'Binance');
    if (!creds) throw createError('Binance not connected for your account. Please add your API keys in Settings/Exchanges.', 401, 'BROKER_NOT_CONNECTED');

    return binanceAdapter.placeOrder(creds.apiKey, creds.apiSecret, {
      symbol, side, orderType: mapOrderType(orderType, 'binance'), quantity, price, stopPrice
    });
  }

  if (exLower === 'kraken') {
    const creds = await getUserBrokerCredentials(userId, 'Kraken');
    if (!creds) throw createError('Kraken not connected for your account. Please add your API keys in Settings/Exchanges.', 401, 'BROKER_NOT_CONNECTED');

    return krakenAdapter.placeOrder(creds.apiKey, creds.apiSecret, {
      symbol, side, orderType, quantity, price, stopPrice
    });
  }

  if (exLower === 'pionex') {
    const creds = await getUserBrokerCredentials(userId, 'Pionex');
    if (!creds) throw createError('Pionex not connected for your account. Please add your API keys in Settings/Exchanges.', 401, 'BROKER_NOT_CONNECTED');

    return pionexAdapter.placeOrder(creds.apiKey, creds.apiSecret, {
      symbol, side, orderType: mapOrderType(orderType, 'pionex'), quantity, price
    });
  }

  if (exLower === 'coindcx') {
    const creds = await getUserBrokerCredentials(userId, 'CoinDCX');
    if (!creds) throw createError('CoinDCX not connected for your account. Please add your API keys in Settings/Exchanges.', 401, 'BROKER_NOT_CONNECTED');

    return coindcxAdapter.placeOrder(creds.apiKey, creds.apiSecret, {
      symbol, side, orderType: mapOrderType(orderType, 'coindcx'), quantity, price, stopPrice
    });
  }

  // Jupiter (Solana DEX)
  if (exLower === 'jupiter') {
    const creds = await getUserBrokerCredentials(userId, 'Jupiter');
    if (!creds || !creds.privateKey) {
      throw createError('Jupiter not connected. Please configure your Solana Private Key in Settings/Exchanges.', 401, 'BROKER_NOT_CONNECTED');
    }
    return jupiterAdapter.placeOrder({
      symbol,
      side,
      orderType,
      quantity,
      price,
      dryRun: false
    }, creds.privateKey, creds.rpcUrl);
  }

  // Angel One SmartAPI
  if (exLower === 'angelone') {
    const creds = await getUserBrokerCredentials(userId, 'AngelOne');
    if (!creds) {
      throw createError('Angel One not connected for your account. Please add your API credentials in Settings/Exchanges.', 401, 'BROKER_NOT_CONNECTED');
    }

    return angeloneAdapter.placeOrder({
      symbol,
      transactionType: side.toUpperCase(),
      orderType: orderType.toUpperCase(),
      productType: 'DELIVERY',
      price: price || 0,
      quantity,
      exchange: 'NSE'
    }, creds);
  }

  // Indian stock exchanges (NSE/BSE)
  if (['nse', 'bse'].includes(exLower)) {
    const brokerChoice = (broker || '').toLowerCase();

    if (brokerChoice === 'angelone' || !brokerChoice) {
      const creds = await getUserBrokerCredentials(userId, 'AngelOne');
      if (creds) {
        return angeloneAdapter.placeOrder({
          symbol,
          transactionType: side.toUpperCase(),
          orderType: orderType.toUpperCase(),
          productType: 'DELIVERY',
          price: price || 0,
          quantity,
          exchange: exchange.toUpperCase()
        }, creds);
      }
    }

    if (brokerChoice === 'upstox' || !brokerChoice) {
      const creds = await getUserBrokerCredentials(userId, 'Upstox');
      if (creds && creds.apiSecret) {
        return upstoxAdapter.placeOrder({
          symbol, side, orderType, quantity, price, stopPrice, exchange: exchange.toUpperCase()
        }, creds.apiSecret);
      }
    }

    throw createError('No Indian broker connected for your account (Angel One or Upstox required).', 401, 'BROKER_NOT_CONNECTED');
  }

  // US stock exchanges
  if (['nasdaq', 'nyse'].includes(exLower)) {
    const creds = await getUserBrokerCredentials(userId, 'Alpaca');
    if (!creds) {
      throw createError('Alpaca not connected for your account. Please add your API credentials in Settings/Exchanges.', 401, 'BROKER_NOT_CONNECTED');
    }

    return alpacaAdapter.placeOrder({
      symbol, side, orderType, quantity, price, stopPrice
    }, creds);
  }

  throw createError(`Live trading not supported for ${exchange}`, 400, 'EXCHANGE_NOT_SUPPORTED');
}

export async function cancelLiveOrder({ userId, symbol, exchange, orderId }) {
  const exLower = exchange?.toLowerCase();

  if (exLower === 'jupiter') {
    return jupiterAdapter.cancelOrder(orderId, symbol);
  }

  if (exLower === 'binance') {
    const creds = await getUserBrokerCredentials(userId, 'Binance');
    if (!creds) throw createError('Binance not connected for your account', 401, 'BROKER_NOT_CONNECTED');
    return binanceAdapter.cancelOrder(creds.apiKey, creds.apiSecret, symbol, orderId);
  }

  if (exLower === 'kraken') {
    const creds = await getUserBrokerCredentials(userId, 'Kraken');
    if (!creds) throw createError('Kraken not connected for your account', 401, 'BROKER_NOT_CONNECTED');
    return krakenAdapter.cancelOrder(creds.apiKey, creds.apiSecret, symbol, orderId);
  }

  if (exLower === 'pionex') {
    const creds = await getUserBrokerCredentials(userId, 'Pionex');
    if (!creds) throw createError('Pionex not connected for your account', 401, 'BROKER_NOT_CONNECTED');
    return pionexAdapter.cancelOrder(creds.apiKey, creds.apiSecret, symbol, orderId);
  }

  if (exLower === 'coindcx') {
    const creds = await getUserBrokerCredentials(userId, 'CoinDCX');
    if (!creds) throw createError('CoinDCX not connected for your account', 401, 'BROKER_NOT_CONNECTED');
    return coindcxAdapter.cancelOrder(creds.apiKey, creds.apiSecret, symbol, orderId);
  }

  if (exLower === 'angelone') {
    const creds = await getUserBrokerCredentials(userId, 'AngelOne');
    if (!creds) throw createError('Angel One not connected for your account', 401, 'BROKER_NOT_CONNECTED');
    return angeloneAdapter.cancelOrder(orderId, 'NORMAL', creds);
  }

  if (['nse', 'bse'].includes(exLower)) {
    const creds = await getUserBrokerCredentials(userId, 'AngelOne');
    if (creds) return angeloneAdapter.cancelOrder(orderId, 'NORMAL', creds);
    const upstoxCreds = await getUserBrokerCredentials(userId, 'Upstox');
    if (upstoxCreds) return upstoxAdapter.cancelOrder(orderId, upstoxCreds.apiSecret);
    throw createError('Broker not connected for your account', 401, 'BROKER_NOT_CONNECTED');
  }

  if (['nasdaq', 'nyse'].includes(exLower)) {
    const creds = await getUserBrokerCredentials(userId, 'Alpaca');
    if (!creds) throw createError('Alpaca not connected for your account', 401, 'BROKER_NOT_CONNECTED');
    return alpacaAdapter.cancelOrder(orderId, creds);
  }

  throw createError(`Exchange ${exchange} not supported`, 400, 'EXCHANGE_NOT_SUPPORTED');
}

export async function getLivePositions(userId, exchange) {
  const exLower = exchange?.toLowerCase();

  if (exLower === 'jupiter') {
    const creds = await getUserBrokerCredentials(userId, 'Jupiter');
    if (!creds || !creds.privateKey) return [];
    return jupiterAdapter.getBalances(creds.privateKey, creds.rpcUrl);
  }

  if (exLower === 'binance') {
    const creds = await getUserBrokerCredentials(userId, 'Binance');
    if (!creds) return [];
    const balances = await binanceAdapter.getBalances(creds.apiKey, creds.apiSecret);
    return balances.filter(b => b.total > 0 && b.asset !== 'USDT');
  }

  if (exLower === 'pionex') {
    const creds = await getUserBrokerCredentials(userId, 'Pionex');
    if (!creds) return [];
    const balances = await pionexAdapter.getBalances(creds.apiKey, creds.apiSecret);
    return balances.filter(b => b.total > 0 && b.asset !== 'USDT');
  }

  if (exLower === 'coindcx') {
    const creds = await getUserBrokerCredentials(userId, 'CoinDCX');
    if (!creds) return [];
    const balances = await coindcxAdapter.getBalances(creds.apiKey, creds.apiSecret);
    return balances.filter(b => b.total > 0 && !['USDT', 'INR'].includes(b.asset));
  }

  if (exLower === 'angelone') {
    const creds = await getUserBrokerCredentials(userId, 'AngelOne');
    if (!creds) return [];
    return angeloneAdapter.getHoldings(creds);
  }

  if (['nse', 'bse'].includes(exLower)) {
    const creds = await getUserBrokerCredentials(userId, 'AngelOne');
    if (creds) return angeloneAdapter.getHoldings(creds);
    const upstoxCreds = await getUserBrokerCredentials(userId, 'Upstox');
    if (upstoxCreds) return upstoxAdapter.getPositions(upstoxCreds.apiSecret);
  }

  if (['nasdaq', 'nyse'].includes(exLower)) {
    const creds = await getUserBrokerCredentials(userId, 'Alpaca');
    if (!creds) return [];
    return alpacaAdapter.getPositions(creds);
  }

  return [];
}

export async function getLiveOpenOrders(userId, exchange) {
  const exLower = exchange?.toLowerCase();

  if (exLower === 'binance') {
    const creds = await getUserBrokerCredentials(userId, 'Binance');
    if (!creds) return [];
    return binanceAdapter.getOpenOrders(creds.apiKey, creds.apiSecret);
  }

  if (exLower === 'kraken') {
    const creds = await getUserBrokerCredentials(userId, 'Kraken');
    if (!creds) return [];
    return krakenAdapter.getOpenOrders(creds.apiKey, creds.apiSecret);
  }

  if (exLower === 'pionex') {
    const creds = await getUserBrokerCredentials(userId, 'Pionex');
    if (!creds) return [];
    return pionexAdapter.getOpenOrders(creds.apiKey, creds.apiSecret);
  }

  if (exLower === 'coindcx') {
    const creds = await getUserBrokerCredentials(userId, 'CoinDCX');
    if (!creds) return [];
    return coindcxAdapter.getOpenOrders(creds.apiKey, creds.apiSecret);
  }

  if (exLower === 'angelone') {
    const creds = await getUserBrokerCredentials(userId, 'AngelOne');
    if (!creds) return [];
    return angeloneAdapter.getOrderBook(creds);
  }

  if (['nse', 'bse'].includes(exLower)) {
    const creds = await getUserBrokerCredentials(userId, 'AngelOne');
    if (creds) return angeloneAdapter.getOrderBook(creds);
    const upstoxCreds = await getUserBrokerCredentials(userId, 'Upstox');
    if (upstoxCreds) return upstoxAdapter.getOpenOrders(upstoxCreds.apiSecret);
  }

  if (['nasdaq', 'nyse'].includes(exLower)) {
    const creds = await getUserBrokerCredentials(userId, 'Alpaca');
    if (!creds) return [];
    return alpacaAdapter.getOpenOrders(creds);
  }

  return [];
}

export async function getUserBrokerCredentials(userId, exchangeName) {
  if (!userId || !exchangeName) return null;

  // 1. Check exchange_accounts table (active for this user)
  const [row] = await query(
    'SELECT api_key, api_secret, additional_params, paper_mode FROM exchange_accounts WHERE user_id = :userId AND LOWER(exchange_name) = LOWER(:exchangeName) AND is_active = 1',
    { userId, exchangeName }
  );

  if (row) {
    let additional = {};
    try {
      if (row.additional_params) {
        additional = typeof row.additional_params === 'string' ? JSON.parse(row.additional_params) : row.additional_params;
      }
    } catch {}

    return {
      apiKey: row.api_key,
      apiSecret: row.api_secret,
      paperMode: !!row.paper_mode,
      clientCode: additional.clientCode || row.api_secret,
      password: additional.password || '',
      totpSecret: additional.totpSecret || '',
      privateKey: additional.privateKey || row.api_secret,
      rpcUrl: additional.rpcUrl || '',
      ...additional
    };
  }

  // 2. Check exchange_connections table (encrypted)
  const [conn] = await query(
    'SELECT api_key_encrypted, api_secret_encrypted FROM exchange_connections WHERE user_id = :userId AND LOWER(exchange_name) = LOWER(:exchangeName) AND is_active = 1',
    { userId, exchangeName }
  );

  if (conn) {
    try {
      const { decrypt } = await import('../utils/encryption.js');
      return {
        apiKey: decrypt(conn.api_key_encrypted),
        apiSecret: decrypt(conn.api_secret_encrypted),
        paperMode: false
      };
    } catch (err) {
      console.error('[Exchange] Decryption error:', err.message);
    }
  }

  // STRICT: Do NOT return global credentials or environment variables for user actions!
  return null;
}

function mapOrderType(orderType, exchange) {
  if (exchange === 'binance') {
    const map = {
      'market': 'MARKET',
      'limit': 'LIMIT',
      'stop_loss': 'STOP_LOSS',
      'take_profit': 'TAKE_PROFIT',
      'stop_limit': 'STOP_LOSS_LIMIT'
    };
    return map[orderType] || 'MARKET';
  }
  if (exchange === 'pionex' || exchange === 'coindcx') {
    const map = {
      'market': 'MARKET',
      'limit': 'LIMIT',
      'stop_loss': 'STOP_LOSS',
      'stop_limit': 'STOP_LIMIT'
    };
    return map[orderType] || 'MARKET';
  }
  return orderType;
}

function createError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

// Fallback compatibility exports
export async function connectBroker() {}
export async function disconnectBroker() {}

