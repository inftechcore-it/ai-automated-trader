import * as binanceAdapter from './adapters/binanceAdapter.js';
import * as krakenAdapter from './adapters/krakenAdapter.js';
import * as pionexAdapter from './adapters/pionexAdapter.js';
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

const connectedBrokers = new Map();

// Auto-connect exchanges from environment variables on module load
function autoConnectFromEnv() {
  // Binance
  if (env.binance?.apiKey && env.binance?.apiSecret) {
    connectedBrokers.set('binance', {
      apiKey: env.binance.apiKey,
      apiSecret: env.binance.apiSecret,
      source: 'env'
    });
    console.log('[Exchange] Auto-connected Binance from environment');
  }

  // Bybit
  if (env.bybit?.apiKey && env.bybit?.apiSecret) {
    connectedBrokers.set('bybit', {
      apiKey: env.bybit.apiKey,
      apiSecret: env.bybit.apiSecret,
      source: 'env'
    });
    console.log('[Exchange] Auto-connected Bybit from environment');
  }

  // Kraken
  if (env.kraken?.apiKey && env.kraken?.apiSecret) {
    connectedBrokers.set('kraken', {
      apiKey: env.kraken.apiKey,
      apiSecret: env.kraken.apiSecret,
      source: 'env'
    });
    console.log('[Exchange] Auto-connected Kraken from environment');
  }

  // Pionex
  if (env.pionex?.apiKey && env.pionex?.apiSecret) {
    connectedBrokers.set('pionex', {
      apiKey: env.pionex.apiKey,
      apiSecret: env.pionex.apiSecret,
      source: 'env'
    });
    console.log('[Exchange] Auto-connected Pionex from environment');
  }

  // Alpaca (US Stocks)
  if (env.alpaca?.apiKey && env.alpaca?.apiSecret) {
    alpacaAdapter.setCredentials(env.alpaca.apiKey, env.alpaca.apiSecret, env.alpaca.paperMode);
    connectedBrokers.set('alpaca', {
      apiKey: env.alpaca.apiKey,
      apiSecret: env.alpaca.apiSecret,
      paperMode: env.alpaca.paperMode,
      source: 'env'
    });
    console.log('[Exchange] Auto-connected Alpaca from environment (paper:', env.alpaca.paperMode, ')');
  }
}

// Run auto-connect on module load
autoConnectFromEnv();

export function getSupportedExchanges() {
  return [
    { name: 'Binance', type: 'crypto', description: 'Crypto spot trading', live: true, tradingEnabled: connectedBrokers.has('binance') },
    { name: 'Pionex', type: 'crypto', description: 'Crypto trading with built-in bots', live: true, tradingEnabled: connectedBrokers.has('pionex') },
    { name: 'Bybit', type: 'crypto', description: 'Crypto derivatives & spot', live: true, tradingEnabled: connectedBrokers.has('bybit') },
    { name: 'Kraken', type: 'crypto', description: 'Crypto trading', live: true, tradingEnabled: connectedBrokers.has('kraken') },
    { name: 'Coinbase', type: 'crypto', description: 'Crypto brokerage', live: false, tradingEnabled: false },
    { name: 'NASDAQ', type: 'stock', description: 'US stocks via Alpaca', live: true, tradingEnabled: alpacaAdapter.isConfigured() || connectedBrokers.has('alpaca') },
    { name: 'NYSE', type: 'stock', description: 'US stocks via Alpaca', live: true, tradingEnabled: alpacaAdapter.isConfigured() || connectedBrokers.has('alpaca') },
    { name: 'NSE', type: 'stock', description: 'Indian stocks via Upstox', live: true, tradingEnabled: upstoxAdapter.isAuthenticated() },
    { name: 'BSE', type: 'stock', description: 'Indian stocks via Upstox', live: true, tradingEnabled: upstoxAdapter.isAuthenticated() }
  ];
}

// Get only the exchanges that are connected and ready for trading
export function getConnectedExchanges() {
  const connected = [];

  if (connectedBrokers.has('binance')) {
    connected.push({ name: 'Binance', type: 'crypto', isActive: true });
  }
  if (connectedBrokers.has('bybit')) {
    connected.push({ name: 'Bybit', type: 'crypto', isActive: true });
  }
  if (connectedBrokers.has('kraken')) {
    connected.push({ name: 'Kraken', type: 'crypto', isActive: true });
  }
  if (connectedBrokers.has('pionex')) {
    connected.push({ name: 'Pionex', type: 'crypto', isActive: true });
  }
  if (connectedBrokers.has('alpaca') || alpacaAdapter.isConfigured()) {
    connected.push({ name: 'Alpaca', type: 'stock', isActive: true, markets: ['NASDAQ', 'NYSE'] });
  }
  if (upstoxAdapter.isAuthenticated()) {
    connected.push({ name: 'Upstox', type: 'stock', isActive: true, markets: ['NSE', 'BSE'] });
  }

  return connected;
}

export function connectBroker(exchangeName, credentials) {
  const name = exchangeName.toLowerCase();
  connectedBrokers.set(name, credentials);
  console.log(`[Broker] Connected: ${exchangeName}`);
}

export function disconnectBroker(exchangeName) {
  connectedBrokers.delete(exchangeName.toLowerCase());
}

export function getBrokerCredentials(exchangeName) {
  return connectedBrokers.get(exchangeName.toLowerCase());
}

export const supportedExchanges = getSupportedExchanges();

function getAdapter(exchange, symbol) {
  const exLower = exchange?.toLowerCase();

  if (exLower === 'binance' && binanceAdapter.supportsSymbol(symbol)) {
    return binanceAdapter;
  }
  if (exLower === 'pionex' && pionexAdapter.supportsSymbol(symbol)) {
    return pionexAdapter;
  }
  if (exLower === 'kraken' && krakenAdapter.supportsSymbol(symbol)) {
    return krakenAdapter;
  }
  // Indian exchanges - prefer Upstox if authenticated, fallback to Yahoo
  if (['nse', 'bse'].includes(exLower)) {
    if (upstoxAdapter.isAuthenticated()) {
      return upstoxAdapter;
    }
    return yahooAdapter; // Free live data
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
  // Return cache if valid
  if (binanceSymbolsCache && binanceSymbolsCache.length > 0 && Date.now() - binanceSymbolsCacheTime < BINANCE_CACHE_TTL) {
    console.log(`[Binance] Using cached ${binanceSymbolsCache.length} symbols`);
    return binanceSymbolsCache;
  }

  console.log('[Binance] Fetching fresh symbols from API...');

  try {
    // Use native fetch instead of dynamic axios import
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://api.binance.com/api/v3/exchangeInfo', {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Binance] API returned ${data.symbols?.length || 0} total symbols`);

    binanceSymbolsCache = data.symbols
      .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT')
      .map(s => ({
        symbol: `${s.baseAsset}/${s.quoteAsset}`,
        exchange: 'Binance',
        name: s.baseAsset,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset
      }));
    binanceSymbolsCacheTime = Date.now();
    console.log(`[Binance] Cached ${binanceSymbolsCache.length} USDT trading pairs`);
    return binanceSymbolsCache;
  } catch (err) {
    console.error('[Binance] Failed to fetch symbols:', err.message);
    // Return empty array but DON'T cache it - so next request will retry
    return binanceSymbolsCache || [];
  }
}

export async function searchSymbols(q = '', exchange = null) {
  if (!q.trim()) return [];

  const cacheKey = `search:${exchange || 'all'}:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.length > 0) return cached; // Only use cache if it has results

  const results = [];
  const exLower = exchange?.toLowerCase();
  const needle = q.toLowerCase();

  console.log(`[Search] query="${q}" exchange="${exchange}"`);

  // Stock exchanges - use Yahoo Finance (fast, no auth needed)
  if (['nse', 'bse', 'nasdaq', 'nyse', 'alpaca'].includes(exLower)) {
    try {
      const yahooResults = await yahooAdapter.searchSymbols(q, exchange.toUpperCase());
      results.push(...yahooResults);
    } catch (err) {
      console.error('[Yahoo] Search error:', err.message);
      // Fallback to demo
      const demoResults = await demoAdapter.searchSymbols(q, exchange);
      results.push(...demoResults);
    }

    if (results.length > 0) {
      cache.set(cacheKey, results, 2 * 60 * 1000); // 2 min cache
    }
    return results.slice(0, 30);
  }

  // Crypto exchanges - use Binance symbols as source (most comprehensive)
  const cryptoExchanges = ['binance', 'pionex', 'bybit', 'kraken', 'okx', 'kucoin', 'gate'];

  if (!exchange || cryptoExchanges.includes(exLower)) {
    try {
      console.log('[Search] Fetching Binance symbols...');
      const allSymbols = await getCachedBinanceSymbols();
      console.log(`[Search] Got ${allSymbols.length} Binance symbols`);

      if (allSymbols.length === 0) {
        console.log('[Search] WARNING: No symbols cached, returning fallback');
        // Comprehensive fallback for major coins
        const fallbackSymbols = [
          // Top coins
          { symbol: 'BTC/USDT', name: 'Bitcoin', baseAsset: 'BTC', quoteAsset: 'USDT' },
          { symbol: 'ETH/USDT', name: 'Ethereum', baseAsset: 'ETH', quoteAsset: 'USDT' },
          { symbol: 'BNB/USDT', name: 'BNB', baseAsset: 'BNB', quoteAsset: 'USDT' },
          { symbol: 'SOL/USDT', name: 'Solana', baseAsset: 'SOL', quoteAsset: 'USDT' },
          { symbol: 'XRP/USDT', name: 'XRP', baseAsset: 'XRP', quoteAsset: 'USDT' },
          { symbol: 'DOGE/USDT', name: 'Dogecoin', baseAsset: 'DOGE', quoteAsset: 'USDT' },
          { symbol: 'ADA/USDT', name: 'Cardano', baseAsset: 'ADA', quoteAsset: 'USDT' },
          { symbol: 'AVAX/USDT', name: 'Avalanche', baseAsset: 'AVAX', quoteAsset: 'USDT' },
          { symbol: 'SHIB/USDT', name: 'Shiba Inu', baseAsset: 'SHIB', quoteAsset: 'USDT' },
          { symbol: 'DOT/USDT', name: 'Polkadot', baseAsset: 'DOT', quoteAsset: 'USDT' },
          { symbol: 'MATIC/USDT', name: 'Polygon', baseAsset: 'MATIC', quoteAsset: 'USDT' },
          { symbol: 'LTC/USDT', name: 'Litecoin', baseAsset: 'LTC', quoteAsset: 'USDT' },
          { symbol: 'LINK/USDT', name: 'Chainlink', baseAsset: 'LINK', quoteAsset: 'USDT' },
          { symbol: 'UNI/USDT', name: 'Uniswap', baseAsset: 'UNI', quoteAsset: 'USDT' },
          { symbol: 'ATOM/USDT', name: 'Cosmos', baseAsset: 'ATOM', quoteAsset: 'USDT' },
          { symbol: 'XLM/USDT', name: 'Stellar', baseAsset: 'XLM', quoteAsset: 'USDT' },
          { symbol: 'ETC/USDT', name: 'Ethereum Classic', baseAsset: 'ETC', quoteAsset: 'USDT' },
          { symbol: 'FIL/USDT', name: 'Filecoin', baseAsset: 'FIL', quoteAsset: 'USDT' },
          { symbol: 'TRX/USDT', name: 'TRON', baseAsset: 'TRX', quoteAsset: 'USDT' },
          { symbol: 'NEAR/USDT', name: 'NEAR Protocol', baseAsset: 'NEAR', quoteAsset: 'USDT' },
          { symbol: 'APT/USDT', name: 'Aptos', baseAsset: 'APT', quoteAsset: 'USDT' },
          { symbol: 'ARB/USDT', name: 'Arbitrum', baseAsset: 'ARB', quoteAsset: 'USDT' },
          { symbol: 'OP/USDT', name: 'Optimism', baseAsset: 'OP', quoteAsset: 'USDT' },
          { symbol: 'INJ/USDT', name: 'Injective', baseAsset: 'INJ', quoteAsset: 'USDT' },
          { symbol: 'SUI/USDT', name: 'Sui', baseAsset: 'SUI', quoteAsset: 'USDT' },
          { symbol: 'PEPE/USDT', name: 'Pepe', baseAsset: 'PEPE', quoteAsset: 'USDT' },
          // USDT pairs with other quote assets
          { symbol: 'USDT/USD', name: 'Tether', baseAsset: 'USDT', quoteAsset: 'USD' },
          { symbol: 'USDC/USDT', name: 'USD Coin', baseAsset: 'USDC', quoteAsset: 'USDT' },
          { symbol: 'BUSD/USDT', name: 'Binance USD', baseAsset: 'BUSD', quoteAsset: 'USDT' },
        ].filter(s =>
          s.symbol.toLowerCase().includes(needle) ||
          s.baseAsset.toLowerCase().includes(needle) ||
          s.name.toLowerCase().includes(needle)
        );
        results.push(...fallbackSymbols.map(s => ({ ...s, exchange: exchange || 'Binance' })));
      } else {
        const filtered = allSymbols
          .filter(s => s.symbol.toLowerCase().includes(needle) || s.baseAsset.toLowerCase().includes(needle))
          .slice(0, 20)
          .map(s => ({
            ...s,
            exchange: exchange || 'Binance' // Use the requested exchange name
          }));
        console.log(`[Search] Filtered to ${filtered.length} matches`);
        results.push(...filtered);
      }
    } catch (err) {
      console.error('[Crypto] Search error:', err.message, err.stack);
    }
  }

  // Kraken-specific search
  if (!exchange || exLower === 'kraken') {
    try {
      const krakenResults = await krakenAdapter.searchSymbols(q);
      for (const kr of krakenResults) {
        if (!results.find(r => r.symbol === kr.symbol)) {
          results.push(kr);
        }
      }
    } catch (err) {
      console.error('[Kraken] Search error:', err.message);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of results) {
    const key = item.symbol;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  console.log(`[Search] Returning ${unique.length} results`);

  // Only cache if we have results
  if (unique.length > 0) {
    cache.set(cacheKey, unique, 2 * 60 * 1000);
  }
  return unique.slice(0, 30);
}

export async function placeLiveOrder({ userId, symbol, exchange, side, orderType, quantity, price, stopPrice }) {
  const exLower = exchange?.toLowerCase();

  // Crypto exchanges
  if (exLower === 'binance') {
    const creds = await getUserBrokerCredentials(userId, 'Binance');
    if (!creds) throw createError('Binance not connected. Add API credentials first.', 401, 'BROKER_NOT_CONNECTED');

    return binanceAdapter.placeOrder(creds.apiKey, creds.apiSecret, {
      symbol, side, orderType: mapOrderType(orderType, 'binance'), quantity, price, stopPrice
    });
  }

  if (exLower === 'kraken') {
    const creds = await getUserBrokerCredentials(userId, 'Kraken');
    if (!creds) throw createError('Kraken not connected. Add API credentials first.', 401, 'BROKER_NOT_CONNECTED');

    return krakenAdapter.placeOrder(creds.apiKey, creds.apiSecret, {
      symbol, side, orderType, quantity, price, stopPrice
    });
  }

  if (exLower === 'pionex') {
    const creds = await getUserBrokerCredentials(userId, 'Pionex');
    if (!creds) throw createError('Pionex not connected. Add API credentials first.', 401, 'BROKER_NOT_CONNECTED');

    return pionexAdapter.placeOrder(creds.apiKey, creds.apiSecret, {
      symbol, side, orderType: mapOrderType(orderType, 'pionex'), quantity, price
    });
  }

  // Indian stock exchanges
  if (['nse', 'bse'].includes(exLower)) {
    if (!upstoxAdapter.isAuthenticated()) {
      throw createError('Upstox not connected. Please authenticate first.', 401, 'BROKER_NOT_CONNECTED');
    }

    return upstoxAdapter.placeOrder({
      symbol, side, orderType, quantity, price, stopPrice, exchange: exchange.toUpperCase()
    });
  }

  // US stock exchanges
  if (['nasdaq', 'nyse'].includes(exLower)) {
    if (!alpacaAdapter.isConfigured()) {
      throw createError('Alpaca not configured. Add API credentials first.', 401, 'BROKER_NOT_CONNECTED');
    }

    return alpacaAdapter.placeOrder({
      symbol, side, orderType, quantity, price, stopPrice
    });
  }

  throw createError(`Live trading not supported for ${exchange}`, 400, 'EXCHANGE_NOT_SUPPORTED');
}

export async function cancelLiveOrder({ userId, symbol, exchange, orderId }) {
  const exLower = exchange?.toLowerCase();

  if (exLower === 'binance') {
    const creds = await getUserBrokerCredentials(userId, 'Binance');
    if (!creds) throw createError('Binance not connected', 401, 'BROKER_NOT_CONNECTED');
    return binanceAdapter.cancelOrder(creds.apiKey, creds.apiSecret, symbol, orderId);
  }

  if (exLower === 'kraken') {
    const creds = await getUserBrokerCredentials(userId, 'Kraken');
    if (!creds) throw createError('Kraken not connected', 401, 'BROKER_NOT_CONNECTED');
    return krakenAdapter.cancelOrder(creds.apiKey, creds.apiSecret, symbol, orderId);
  }

  if (exLower === 'pionex') {
    const creds = await getUserBrokerCredentials(userId, 'Pionex');
    if (!creds) throw createError('Pionex not connected', 401, 'BROKER_NOT_CONNECTED');
    return pionexAdapter.cancelOrder(creds.apiKey, creds.apiSecret, symbol, orderId);
  }

  if (['nse', 'bse'].includes(exLower)) {
    if (!upstoxAdapter.isAuthenticated()) throw createError('Upstox not connected', 401, 'BROKER_NOT_CONNECTED');
    return upstoxAdapter.cancelOrder(orderId);
  }

  if (['nasdaq', 'nyse'].includes(exLower)) {
    if (!alpacaAdapter.isConfigured()) throw createError('Alpaca not configured', 401, 'BROKER_NOT_CONNECTED');
    return alpacaAdapter.cancelOrder(orderId);
  }

  throw createError(`Exchange ${exchange} not supported`, 400, 'EXCHANGE_NOT_SUPPORTED');
}

export async function getLivePositions(userId, exchange) {
  const exLower = exchange?.toLowerCase();

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

  if (['nse', 'bse'].includes(exLower) && upstoxAdapter.isAuthenticated()) {
    return upstoxAdapter.getPositions();
  }

  if (['nasdaq', 'nyse'].includes(exLower) && alpacaAdapter.isConfigured()) {
    return alpacaAdapter.getPositions();
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

  if (['nse', 'bse'].includes(exLower) && upstoxAdapter.isAuthenticated()) {
    return upstoxAdapter.getOpenOrders();
  }

  if (['nasdaq', 'nyse'].includes(exLower) && alpacaAdapter.isConfigured()) {
    return alpacaAdapter.getOpenOrders();
  }

  return [];
}

async function getUserBrokerCredentials(userId, exchangeName) {
  const [row] = await query(
    'SELECT api_key, api_secret FROM exchange_accounts WHERE user_id = :userId AND exchange_name = :exchangeName AND is_active = 1',
    { userId, exchangeName }
  );

  if (!row) return null;
  return { apiKey: row.api_key, apiSecret: row.api_secret };
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
  if (exchange === 'pionex') {
    const map = {
      'market': 'MARKET',
      'limit': 'LIMIT'
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
