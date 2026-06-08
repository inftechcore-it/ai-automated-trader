import * as binanceAdapter from './adapters/binanceAdapter.js';
import * as krakenAdapter from './adapters/krakenAdapter.js';
import * as alphaVantageAdapter from './adapters/alphaVantageAdapter.js';
import * as upstoxAdapter from './adapters/upstoxAdapter.js';
import * as demoAdapter from './adapters/demoAdapter.js';
import * as cache from './cache.js';

export function getSupportedExchanges() {
  return [
    { name: 'Binance', type: 'crypto', description: 'Crypto spot market data and trading', live: true },
    { name: 'Kraken', type: 'crypto', description: 'Crypto market data and trading', live: true },
    { name: 'Coinbase', type: 'crypto', description: 'Crypto brokerage market data', live: false },
    { name: 'NASDAQ', type: 'stock', description: 'US technology-heavy stock exchange', live: alphaVantageAdapter.isConfigured() },
    { name: 'NYSE', type: 'stock', description: 'US stock exchange', live: alphaVantageAdapter.isConfigured() },
    { name: 'NSE', type: 'stock', description: 'National Stock Exchange of India', live: upstoxAdapter.isConfigured(), upstoxAuth: upstoxAdapter.isAuthenticated() },
    { name: 'BSE', type: 'stock', description: 'Bombay Stock Exchange', live: upstoxAdapter.isConfigured(), upstoxAuth: upstoxAdapter.isAuthenticated() }
  ];
}

export const supportedExchanges = getSupportedExchanges();

function getAdapter(exchange, symbol) {
  const exLower = exchange?.toLowerCase();

  if (exLower === 'binance' && binanceAdapter.supportsSymbol(symbol)) {
    return binanceAdapter;
  }
  if (exLower === 'kraken' && krakenAdapter.supportsSymbol(symbol)) {
    return krakenAdapter;
  }
  // Indian exchanges - prefer Upstox if authenticated
  if (['nse', 'bse'].includes(exLower)) {
    if (upstoxAdapter.isAuthenticated()) {
      return upstoxAdapter;
    }
    if (alphaVantageAdapter.isConfigured()) {
      return alphaVantageAdapter;
    }
    return demoAdapter;
  }
  // US exchanges
  if (['nasdaq', 'nyse'].includes(exLower) && alphaVantageAdapter.isConfigured()) {
    return alphaVantageAdapter;
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
    const ohlcv = await adapter.getOHLCV(symbol, interval, limit);
    cache.set(cacheKey, ohlcv, 60 * 1000); // 1 minute cache for OHLCV
    return ohlcv;
  } catch (err) {
    console.error(`[${exchange}] OHLCV error for ${symbol}:`, err.message);
    return demoAdapter.getOHLCV(symbol, interval, limit);
  }
}

export async function searchSymbols(q = '', exchange = null) {
  if (!q.trim()) return [];

  const cacheKey = `search:${exchange || 'all'}:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const results = [];
  const exLower = exchange?.toLowerCase();

  // Indian stock exchanges - use Upstox
  if (['nse', 'bse'].includes(exLower)) {
    if (upstoxAdapter.isConfigured()) {
      try {
        const upstoxResults = await upstoxAdapter.searchSymbols(q, exchange.toUpperCase());
        results.push(...upstoxResults);
      } catch (err) {
        console.error('[Upstox] Search error:', err.message);
      }
    }

    // Fallback to demo if no results
    if (results.length === 0) {
      const demoResults = await demoAdapter.searchSymbols(q, exchange);
      results.push(...demoResults);
    }

    cache.set(cacheKey, results, 5 * 60 * 1000);
    return results.slice(0, 50);
  }

  // US stock exchanges - use Alpha Vantage
  if (['nasdaq', 'nyse'].includes(exLower)) {
    if (alphaVantageAdapter.isConfigured()) {
      try {
        const avResults = await alphaVantageAdapter.searchSymbols(q);
        results.push(...avResults.map(r => ({ ...r, exchange })));
      } catch (err) {
        console.error('[AlphaVantage] Search error:', err.message);
      }
    }

    // Fallback to demo if no results
    if (results.length === 0) {
      const demoResults = await demoAdapter.searchSymbols(q, exchange);
      results.push(...demoResults);
    }

    cache.set(cacheKey, results, 5 * 60 * 1000);
    return results.slice(0, 50);
  }

  // Crypto exchanges
  try {
    if (!exchange || exLower === 'binance') {
      const binanceResults = await binanceAdapter.searchSymbols(q);
      results.push(...binanceResults);
    }
  } catch (err) {
    console.error('[Binance] Search error:', err.message);
  }

  try {
    if (!exchange || exLower === 'kraken') {
      const krakenResults = await krakenAdapter.searchSymbols(q);
      results.push(...krakenResults);
    }
  } catch (err) {
    console.error('[Kraken] Search error:', err.message);
  }

  // Fallback to demo for non-specific searches
  if (!exchange) {
    const demoResults = await demoAdapter.searchSymbols(q);
    results.push(...demoResults);
  }

  const unique = [];
  const seen = new Set();
  for (const item of results) {
    const key = `${item.exchange}:${item.symbol}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  cache.set(cacheKey, unique, 5 * 60 * 1000);
  return unique.slice(0, 50);
}

export async function placeLiveOrder() {
  const error = new Error('Live exchange order adapters are not enabled yet');
  error.status = 501;
  error.code = 'LIVE_TRADING_NOT_ENABLED';
  error.publicMessage = 'Live trading is not enabled yet';
  throw error;
}
