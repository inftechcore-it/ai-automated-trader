import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const BASE_URL = 'https://api.coindcx.com';
const PUBLIC_BASE_URL = 'https://public.coindcx.com';

let defaultCredentials = null;

export function initFromEnv() {
  if (env.coindcx?.apiKey && env.coindcx?.apiSecret) {
    defaultCredentials = {
      apiKey: env.coindcx.apiKey,
      apiSecret: env.coindcx.apiSecret
    };
    return true;
  }
  return false;
}

export function setCredentials(apiKey, apiSecret) {
  defaultCredentials = { apiKey, apiSecret };
}

export function clearCredentials() {
  defaultCredentials = null;
}

export function isConfigured() {
  return !!(defaultCredentials?.apiKey && defaultCredentials?.apiSecret);
}

export function getDefaultCredentials() {
  return defaultCredentials;
}

/**
 * Generate HMAC-SHA256 signature for CoinDCX API
 * @param {Object} body - Request payload containing timestamp
 * @param {string} apiSecret - CoinDCX API Secret
 * @returns {string} Hex encoded signature
 */
function createSignature(body, apiSecret) {
  const payloadString = JSON.stringify(body);
  return crypto.createHmac('sha256', apiSecret).update(payloadString).digest('hex');
}

/**
 * Normalizes trading symbol to CoinDCX format
 * Examples:
 * - BTC/USDT -> BTCUSDT (or pair: B-BTC_USDT)
 * - BTC/INR  -> BTCINR  (or pair: I-BTC_INR)
 * - ETH/BTC  -> ETHBTC
 */
export function normalizeSymbol(symbol, format = 'market') {
  if (!symbol) return format === 'pair' ? 'B-BTC_USDT' : 'BTCUSDT';
  
  const clean = symbol.replace(/[-_]/g, '/').toUpperCase();
  const parts = clean.split('/');
  
  if (parts.length === 2) {
    const [base, quote] = parts;
    if (format === 'pair') {
      if (quote === 'USDT') return `B-${base}_USDT`;
      if (quote === 'INR') return `I-${base}_INR`;
      if (quote === 'USDC') return `B-${base}_USDC`;
      if (quote === 'BTC') return `B-${base}_BTC`;
      return `B-${base}_${quote}`;
    }
    return `${base}${quote}`;
  }

  // Already concatenated like BTCUSDT or B-BTC_USDT
  if (symbol.includes('B-') || symbol.includes('I-')) {
    if (format === 'pair') return symbol;
    return symbol.replace(/^[BI]-/, '').replace('_', '');
  }

  return symbol.replace('/', '').toUpperCase();
}

/**
 * Denormalizes CoinDCX symbol to standard pair format
 * Examples:
 * - BTCUSDT or B-BTC_USDT -> BTC/USDT
 * - BTCINR or I-BTC_INR -> BTC/INR
 */
export function denormalizeSymbol(symbol) {
  if (!symbol) return '';

  if (symbol.includes('B-') || symbol.includes('I-')) {
    const clean = symbol.replace(/^[BI]-/, '');
    return clean.replace('_', '/');
  }

  if (symbol.includes('/')) return symbol;
  if (symbol.includes('_')) return symbol.replace('_', '/');

  const quotes = ['USDT', 'USDC', 'INR', 'BTC', 'ETH', 'BUSD'];
  for (const q of quotes) {
    if (symbol.endsWith(q) && symbol.length > q.length) {
      const base = symbol.slice(0, symbol.length - q.length);
      return `${base}/${q}`;
    }
  }

  return symbol;
}

/**
 * Fetch 24h ticker quote for symbol
 */
export async function getQuote(symbol) {
  const marketSymbol = normalizeSymbol(symbol, 'market');
  const pairSymbol = normalizeSymbol(symbol, 'pair');

  try {
    const { data } = await axios.get(`${BASE_URL}/exchange/ticker`, {
      timeout: 8000
    });

    if (Array.isArray(data)) {
      const ticker = data.find(t => 
        t.market === marketSymbol || 
        t.market === pairSymbol ||
        t.market === symbol.replace('/', '')
      );

      if (ticker) {
        const lastPrice = parseFloat(ticker.last_price || 0);
        const changePercent = parseFloat(ticker.change_24_hour || 0);
        const high24h = parseFloat(ticker.high || lastPrice);
        const low24h = parseFloat(ticker.low || lastPrice);
        const open = high24h > 0 ? lastPrice / (1 + changePercent / 100) : lastPrice;
        const change = lastPrice - open;

        return {
          symbol: denormalizeSymbol(ticker.market) || symbol,
          exchange: 'CoinDCX',
          price: lastPrice,
          open: Number(open.toFixed(6)),
          change: Number(change.toFixed(6)),
          changePercent: Number(changePercent.toFixed(2)),
          high24h: high24h,
          low24h: low24h,
          volume24h: parseFloat(ticker.volume || 0),
          bid: parseFloat(ticker.bid || lastPrice),
          ask: parseFloat(ticker.ask || lastPrice),
          timestamp: new Date(ticker.timestamp ? ticker.timestamp * 1000 : Date.now()).toISOString()
        };
      }
    }

    throw new Error(`Symbol ${symbol} not found on CoinDCX`);
  } catch (err) {
    // Fallback: try public candle endpoint to construct current price
    try {
      const candles = await getOHLCV(symbol, '1h', 2);
      if (candles && candles.length > 0) {
        const last = candles[candles.length - 1];
        const prev = candles[0] || last;
        const change = last.close - prev.open;
        const changePercent = prev.open > 0 ? (change / prev.open) * 100 : 0;
        return {
          symbol: denormalizeSymbol(symbol),
          exchange: 'CoinDCX',
          price: last.close,
          open: last.open,
          change: Number(change.toFixed(4)),
          changePercent: Number(changePercent.toFixed(2)),
          high24h: last.high,
          low24h: last.low,
          volume24h: last.volume,
          timestamp: last.time
        };
      }
    } catch {}

    throw new Error(`[CoinDCX] getQuote failed: ${err.message}`);
  }
}

/**
 * Fetch OHLCV candles
 */
export async function getOHLCV(symbol, interval = '1h', limit = 100) {
  const pairSymbol = normalizeSymbol(symbol, 'pair');
  
  // CoinDCX supported intervals: 1m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 1d, 1w
  const intervalMap = {
    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h',
    '1d': '1d', '1w': '1w'
  };
  const cdcxInterval = intervalMap[interval] || '1h';

  try {
    const { data } = await axios.get(`${PUBLIC_BASE_URL}/market_data/candles`, {
      params: {
        pair: pairSymbol,
        interval: cdcxInterval,
        limit: Math.min(limit, 500)
      },
      timeout: 10000
    });

    if (Array.isArray(data)) {
      return data.map(k => ({
        time: new Date(k.time || k.timestamp || Date.now()).toISOString(),
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
        volume: parseFloat(k.volume || 0)
      })).reverse(); // CoinDCX returns latest first
    }

    return [];
  } catch (error) {
    console.warn(`[CoinDCX] getOHLCV error for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Fetch Order Book (Level 2)
 */
export async function getOrderBook(symbol, depth = 10) {
  const pairSymbol = normalizeSymbol(symbol, 'pair');

  try {
    const { data } = await axios.get(`${PUBLIC_BASE_URL}/market_data/orderbook`, {
      params: { pair: pairSymbol },
      timeout: 8000
    });

    // data format: { bids: { "67000": "0.5" }, asks: { "67100": "0.4" } } or arrays
    let rawBids = [];
    let rawAsks = [];

    if (data.bids && typeof data.bids === 'object' && !Array.isArray(data.bids)) {
      rawBids = Object.entries(data.bids)
        .map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) }))
        .sort((a, b) => b.price - a.price)
        .slice(0, depth);
    } else if (Array.isArray(data.bids)) {
      rawBids = data.bids.slice(0, depth).map(b => ({
        price: parseFloat(Array.isArray(b) ? b[0] : b.price || b.p),
        quantity: parseFloat(Array.isArray(b) ? b[1] : b.quantity || b.q)
      }));
    }

    if (data.asks && typeof data.asks === 'object' && !Array.isArray(data.asks)) {
      rawAsks = Object.entries(data.asks)
        .map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) }))
        .sort((a, b) => a.price - b.price)
        .slice(0, depth);
    } else if (Array.isArray(data.asks)) {
      rawAsks = data.asks.slice(0, depth).map(a => ({
        price: parseFloat(Array.isArray(a) ? a[0] : a.price || a.p),
        quantity: parseFloat(Array.isArray(a) ? a[1] : a.quantity || a.q)
      }));
    }

    let bidCumulative = 0;
    let askCumulative = 0;
    const bids = rawBids.map(b => {
      bidCumulative += b.quantity;
      return {
        price: b.price,
        quantity: b.quantity,
        total: parseFloat((b.price * b.quantity).toFixed(2)),
        cumulative: parseFloat(bidCumulative.toFixed(4))
      };
    });

    const asks = rawAsks.map(a => {
      askCumulative += a.quantity;
      return {
        price: a.price,
        quantity: a.quantity,
        total: parseFloat((a.price * a.quantity).toFixed(2)),
        cumulative: parseFloat(askCumulative.toFixed(4))
      };
    });

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;

    return {
      symbol: denormalizeSymbol(symbol),
      exchange: 'CoinDCX',
      bids,
      asks,
      spread: bestAsk && bestBid ? Number((bestAsk - bestBid).toFixed(4)) : 0,
      spreadPercent: bestAsk && bestBid ? Number((((bestAsk - bestBid) / bestAsk) * 100).toFixed(4)) : 0,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    throw new Error(`[CoinDCX] getOrderBook failed for ${symbol}: ${err.message}`);
  }
}

/**
 * Fetch Recent Trades
 */
export async function getRecentTrades(symbol, limit = 20) {
  const pairSymbol = normalizeSymbol(symbol, 'pair');

  try {
    const { data } = await axios.get(`${PUBLIC_BASE_URL}/market_data/trade_history`, {
      params: { pair: pairSymbol, limit: Math.min(limit, 50) },
      timeout: 8000
    });

    if (Array.isArray(data)) {
      return data.slice(0, limit).map((t, idx) => ({
        id: t.trade_id || t.id || `trade_${t.T || Date.now()}_${idx}`,
        price: parseFloat(t.p || t.price),
        quantity: parseFloat(t.q || t.quantity),
        side: (t.m === true || t.side === 'sell' || t.maker === false) ? 'sell' : 'buy',
        time: new Date(t.T || t.timestamp || Date.now()).toISOString()
      }));
    }

    return [];
  } catch (error) {
    console.warn(`[CoinDCX] getRecentTrades error for ${symbol}:`, error.message);
    return [];
  }
}

// Cached popular symbols
export const POPULAR_COINDCX_SYMBOLS = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', baseAsset: 'BTC', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'ETH/USDT', name: 'Ethereum', baseAsset: 'ETH', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'SOL/USDT', name: 'Solana', baseAsset: 'SOL', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'XRP/USDT', name: 'XRP', baseAsset: 'XRP', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'BNB/USDT', name: 'BNB', baseAsset: 'BNB', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', baseAsset: 'DOGE', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'ADA/USDT', name: 'Cardano', baseAsset: 'ADA', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'AVAX/USDT', name: 'Avalanche', baseAsset: 'AVAX', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'SHIB/USDT', name: 'Shiba Inu', baseAsset: 'SHIB', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'NEAR/USDT', name: 'NEAR Protocol', baseAsset: 'NEAR', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'SUI/USDT', name: 'Sui', baseAsset: 'SUI', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'PEPE/USDT', name: 'Pepe', baseAsset: 'PEPE', quoteAsset: 'USDT', exchange: 'CoinDCX' },
  { symbol: 'BTC/INR', name: 'Bitcoin (INR)', baseAsset: 'BTC', quoteAsset: 'INR', exchange: 'CoinDCX' },
  { symbol: 'ETH/INR', name: 'Ethereum (INR)', baseAsset: 'ETH', quoteAsset: 'INR', exchange: 'CoinDCX' },
  { symbol: 'USDT/INR', name: 'Tether (INR)', baseAsset: 'USDT', quoteAsset: 'INR', exchange: 'CoinDCX' },
  { symbol: 'SOL/INR', name: 'Solana (INR)', baseAsset: 'SOL', quoteAsset: 'INR', exchange: 'CoinDCX' },
  { symbol: 'XRP/INR', name: 'XRP (INR)', baseAsset: 'XRP', quoteAsset: 'INR', exchange: 'CoinDCX' }
];

let symbolsCache = null;
let symbolsCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 mins

/**
 * Search symbols on CoinDCX
 */
export async function searchSymbols(query = '') {
  try {
    if (!symbolsCache || Date.now() - symbolsCacheTime > CACHE_TTL) {
      const { data } = await axios.get(`${BASE_URL}/exchange/v1/markets_details`, {
        timeout: 10000
      });

      if (Array.isArray(data) && data.length > 0) {
        symbolsCache = data.filter(s => s.status === 'active' || !s.status).map(s => {
          const rawPair = s.coindcx_name || s.symbol || `${s.target_currency_short_name || ''}${s.base_currency_short_name || ''}`;
          const unifiedSymbol = denormalizeSymbol(rawPair);
          const parts = unifiedSymbol.split('/');
          const baseAsset = parts[0] || s.target_currency_short_name || s.base_currency_short_name;
          const quoteAsset = parts[1] || s.base_currency_short_name || s.target_currency_short_name;
          return {
            symbol: unifiedSymbol,
            rawSymbol: s.coindcx_name || s.symbol,
            name: s.target_currency_name || s.base_currency_name || unifiedSymbol,
            baseAsset,
            quoteAsset,
            exchange: 'CoinDCX',
            minQuantity: parseFloat(s.min_quantity || 0),
            maxQuantity: parseFloat(s.max_quantity || 0),
            step: parseFloat(s.step || 0.0001),
            minPrice: parseFloat(s.min_price || 0),
            minNotional: parseFloat(s.min_notional || 0)
          };
        });
        symbolsCacheTime = Date.now();
        console.log(`[CoinDCX] Cached ${symbolsCache.length} markets`);
      }
    }

    if (!query || !query.trim()) {
      return POPULAR_COINDCX_SYMBOLS;
    }

    const needle = query.trim().toLowerCase();
    const matches = (symbolsCache || [])
      .filter(s =>
        (s.symbol && s.symbol.toLowerCase().includes(needle)) ||
        (s.name && s.name.toLowerCase().includes(needle)) ||
        (s.baseAsset && s.baseAsset.toLowerCase().includes(needle))
      )
      .slice(0, 30);

    if (matches.length > 0) return matches;

    return POPULAR_COINDCX_SYMBOLS.filter(s =>
      s.symbol.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle)
    );
  } catch (err) {
    console.warn('[CoinDCX] searchSymbols fallback:', err.message);
    if (!query || !query.trim()) return POPULAR_COINDCX_SYMBOLS;
    const needle = query.trim().toLowerCase();
    return POPULAR_COINDCX_SYMBOLS.filter(s =>
      s.symbol.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle)
    );
  }
}

export function supportsSymbol(symbol) {
  if (!symbol) return false;
  const upper = symbol.toUpperCase();
  return upper.includes('/') && (upper.endsWith('USDT') || upper.endsWith('INR') || upper.endsWith('USDC') || upper.endsWith('BTC'));
}

/**
 * Validate API credentials against CoinDCX
 */
export async function validateCredentials(apiKey, apiSecret) {
  if (!apiKey || !apiSecret) {
    return { valid: false, error: 'API Key and API Secret are required' };
  }

  const timestamp = Date.now();
  const body = { timestamp };
  const signature = createSignature(body, apiSecret);

  try {
    const { data } = await axios.post(`${BASE_URL}/exchange/v1/users/balances`, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': apiKey,
        'X-AUTH-SIGNATURE': signature
      },
      timeout: 15000
    });

    if (Array.isArray(data)) {
      const activeBalances = data.filter(b => parseFloat(b.balance || 0) > 0 || parseFloat(b.locked_balance || 0) > 0);
      console.log(`[CoinDCX] Validation successful - ${activeBalances.length} active assets`);
      return {
        valid: true,
        permissions: ['spot', 'read', 'trade'],
        balanceCount: activeBalances.length
      };
    }

    if (data.message || data.error) {
      throw new Error(data.message || data.error || 'Authentication failed');
    }

    return { valid: true, permissions: ['spot', 'read', 'trade'], balanceCount: 0 };
  } catch (error) {
    const cdcxError = error.response?.data;
    console.error('[CoinDCX] Validation failed:', cdcxError || error.message);
    
    let errMsg = 'Invalid CoinDCX API credentials';
    if (cdcxError?.message) {
      errMsg = cdcxError.message;
    } else if (error.response?.status === 401) {
      errMsg = 'Unauthorized: Check your CoinDCX API Key & Secret';
    } else if (error.response?.status === 403) {
      errMsg = 'Forbidden: IP address not allowed or permissions missing';
    } else if (error.message) {
      errMsg = error.message;
    }

    throw new Error(errMsg);
  }
}

/**
 * Get balances for connected account
 */
export async function getBalances(apiKey, apiSecret) {
  const key = apiKey || defaultCredentials?.apiKey;
  const secret = apiSecret || defaultCredentials?.apiSecret;

  if (!key || !secret) {
    throw new Error('CoinDCX API credentials not configured');
  }

  const timestamp = Date.now();
  const body = { timestamp };
  const signature = createSignature(body, secret);

  try {
    const { data } = await axios.post(`${BASE_URL}/exchange/v1/users/balances`, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': key,
        'X-AUTH-SIGNATURE': signature
      },
      timeout: 15000
    });

    if (!Array.isArray(data)) {
      throw new Error(data.message || 'Failed to fetch CoinDCX balances');
    }

    return data
      .filter(b => parseFloat(b.balance || 0) > 0 || parseFloat(b.locked_balance || 0) > 0)
      .map(b => {
        const free = parseFloat(b.balance || 0);
        const locked = parseFloat(b.locked_balance || 0);
        return {
          asset: b.currency?.toUpperCase(),
          free: free,
          locked: locked,
          total: free + locked
        };
      });
  } catch (error) {
    const cdcxError = error.response?.data;
    console.error('[CoinDCX] getBalances failed:', cdcxError || error.message);
    throw new Error(cdcxError?.message || error.message || 'Failed to fetch CoinDCX balances');
  }
}

/**
 * Place a Spot Order on CoinDCX
 */
export async function placeOrder(apiKey, apiSecret, { symbol, side, orderType, quantity, price, stopPrice, amount }) {
  const key = apiKey || defaultCredentials?.apiKey;
  const secret = apiSecret || defaultCredentials?.apiSecret;

  if (!key || !secret) {
    throw new Error('CoinDCX API credentials not configured');
  }

  const timestamp = Date.now();
  const marketSymbol = normalizeSymbol(symbol, 'market');
  const upperSide = side.toLowerCase(); // CoinDCX expects "buy" or "sell"
  const upperType = orderType.toLowerCase();

  // CoinDCX order types: 'market_order', 'limit_order', 'stop_limit'
  let cdcxOrderType = 'market_order';
  if (upperType === 'limit') cdcxOrderType = 'limit_order';
  else if (upperType === 'stop_limit' || upperType === 'stop_loss') cdcxOrderType = 'stop_limit';

  const body = {
    side: upperSide,
    order_type: cdcxOrderType,
    market: marketSymbol,
    total_quantity: Number(quantity),
    timestamp: timestamp
  };

  if (cdcxOrderType === 'limit_order' || price) {
    body.price_per_unit = Number(price);
  }

  if (stopPrice) {
    body.stop_price = Number(stopPrice);
  }

  const signature = createSignature(body, secret);

  try {
    const { data } = await axios.post(`${BASE_URL}/exchange/v1/orders/create`, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': key,
        'X-AUTH-SIGNATURE': signature
      },
      timeout: 12000
    });

    if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
      const order = data.orders[0];
      return {
        orderId: order.id,
        clientOrderId: order.client_order_id || null,
        symbol: denormalizeSymbol(symbol) || symbol,
        side: upperSide,
        orderType: upperType,
        quantity: parseFloat(order.total_quantity || quantity),
        price: parseFloat(order.price_per_unit || price) || null,
        status: mapCoinDCXStatus(order.status),
        createdAt: new Date().toISOString()
      };
    }

    if (data.id) {
      return {
        orderId: data.id,
        clientOrderId: data.client_order_id || null,
        symbol: denormalizeSymbol(symbol) || symbol,
        side: upperSide,
        orderType: upperType,
        quantity: parseFloat(data.total_quantity || quantity),
        price: parseFloat(data.price_per_unit || price) || null,
        status: mapCoinDCXStatus(data.status),
        createdAt: new Date().toISOString()
      };
    }

    throw new Error(data.message || 'Order creation failed on CoinDCX');
  } catch (error) {
    const cdcxError = error.response?.data;
    console.error('[CoinDCX] placeOrder failed:', cdcxError || error.message);
    throw new Error(`[CoinDCX] ${cdcxError?.message || error.message}`);
  }
}

/**
 * Cancel an active order
 */
export async function cancelOrder(apiKey, apiSecret, symbol, orderId) {
  const key = apiKey || defaultCredentials?.apiKey;
  const secret = apiSecret || defaultCredentials?.apiSecret;

  if (!key || !secret) {
    throw new Error('CoinDCX API credentials not configured');
  }

  const timestamp = Date.now();
  const body = {
    id: String(orderId),
    timestamp
  };
  const signature = createSignature(body, secret);

  try {
    // Try cancel_by_ids or direct cancel
    const { data } = await axios.post(`${BASE_URL}/exchange/v1/orders/cancel`, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': key,
        'X-AUTH-SIGNATURE': signature
      },
      timeout: 10000
    });

    return { orderId, status: 'cancelled', result: data };
  } catch (error) {
    // Try cancel_by_ids alternative
    try {
      const batchBody = { ids: [String(orderId)], timestamp };
      const batchSig = createSignature(batchBody, secret);
      const { data } = await axios.post(`${BASE_URL}/exchange/v1/orders/cancel_by_ids`, batchBody, {
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-APIKEY': key,
          'X-AUTH-SIGNATURE': batchSig
        },
        timeout: 10000
      });
      return { orderId, status: 'cancelled', result: data };
    } catch (batchErr) {
      const cdcxError = error.response?.data;
      throw new Error(cdcxError?.message || error.message);
    }
  }
}

/**
 * Fetch Order Status & Fill Details
 */
export async function getOrder(apiKey, apiSecret, symbol, orderId) {
  const key = apiKey || defaultCredentials?.apiKey;
  const secret = apiSecret || defaultCredentials?.apiSecret;

  if (!key || !secret) {
    throw new Error('CoinDCX API credentials not configured');
  }

  const timestamp = Date.now();
  const body = { id: String(orderId), timestamp };
  const signature = createSignature(body, secret);

  try {
    const { data } = await axios.post(`${BASE_URL}/exchange/v1/orders/status`, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': key,
        'X-AUTH-SIGNATURE': signature
      },
      timeout: 10000
    });

    return {
      orderId: data.id || orderId,
      symbol: denormalizeSymbol(data.market || symbol),
      side: (data.side || 'buy').toLowerCase(),
      orderType: (data.order_type || 'market_order').replace('_order', ''),
      quantity: parseFloat(data.total_quantity || 0),
      price: parseFloat(data.price_per_unit || 0) || null,
      status: mapCoinDCXStatus(data.status),
      filledQuantity: parseFloat(data.filled_quantity || 0),
      avgFillPrice: parseFloat(data.avg_price || data.price_per_unit || 0) || null,
      fee: parseFloat(data.fee_amount || data.fee || 0),
      createdAt: new Date(data.created_at || Date.now()).toISOString()
    };
  } catch (error) {
    const cdcxError = error.response?.data;
    throw new Error(cdcxError?.message || error.message);
  }
}

export async function getOrderStatus(apiKey, apiSecret, symbol, orderId) {
  return getOrder(apiKey, apiSecret, symbol, orderId);
}

/**
 * Fetch Open / Active Orders
 */
export async function getOpenOrders(apiKey, apiSecret, symbol = null) {
  const key = apiKey || defaultCredentials?.apiKey;
  const secret = apiSecret || defaultCredentials?.apiSecret;

  if (!key || !secret) {
    throw new Error('CoinDCX API credentials not configured');
  }

  const timestamp = Date.now();
  const body = { timestamp };
  if (symbol) {
    body.market = normalizeSymbol(symbol, 'market');
  }
  const signature = createSignature(body, secret);

  try {
    const { data } = await axios.post(`${BASE_URL}/exchange/v1/orders/active_orders`, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': key,
        'X-AUTH-SIGNATURE': signature
      },
      timeout: 10000
    });

    const ordersList = Array.isArray(data) ? data : (data.orders || []);

    return ordersList.map(order => ({
      orderId: order.id,
      symbol: denormalizeSymbol(order.market),
      side: (order.side || '').toLowerCase(),
      orderType: (order.order_type || '').replace('_order', ''),
      quantity: parseFloat(order.total_quantity || 0),
      price: parseFloat(order.price_per_unit || 0) || null,
      status: mapCoinDCXStatus(order.status),
      filledQuantity: parseFloat(order.filled_quantity || 0),
      createdAt: new Date(order.created_at || Date.now()).toISOString()
    }));
  } catch (error) {
    const cdcxError = error.response?.data;
    throw new Error(cdcxError?.message || error.message);
  }
}

/**
 * Map CoinDCX internal status to standard unified status
 */
function mapCoinDCXStatus(status) {
  if (!status) return 'open';
  const upper = status.toUpperCase();
  const map = {
    'INIT': 'open',
    'OPEN': 'open',
    'PARTIALLY_FILLED': 'partial',
    'FILLED': 'filled',
    'CANCELLED': 'cancelled',
    'CANCELED': 'cancelled',
    'REJECTED': 'rejected',
    'EXPIRED': 'cancelled',
    'UNTRIGGERED': 'open'
  };
  return map[upper] || status.toLowerCase();
}

/**
 * Symbol precision and trading filters cache
 */
const symbolFiltersCache = new Map();
const FILTERS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getSymbolFilters(symbol) {
  const marketSymbol = normalizeSymbol(symbol, 'market');
  const cached = symbolFiltersCache.get(marketSymbol);

  if (cached && Date.now() - cached.timestamp < FILTERS_CACHE_TTL) {
    return cached.filters;
  }

  const { data } = await axios.get(`${BASE_URL}/exchange/v1/markets_details`, {
    timeout: 10000
  });

  if (Array.isArray(data)) {
    const info = data.find(m => m.symbol === marketSymbol || m.coindcx_name === marketSymbol);
    if (info) {
      const filters = {
        minNotional: parseFloat(info.min_notional || 0),
        minAmount: parseFloat(info.min_quantity || 0),
        minTradeSize: parseFloat(info.min_quantity || 0),
        maxTradeSize: parseFloat(info.max_quantity || 0),
        step: parseFloat(info.step || 0.0001),
        minPrice: parseFloat(info.min_price || 0),
        maxPrice: parseFloat(info.max_price || 0),
        basePrecision: info.base_currency_precision || 8,
        targetPrecision: info.target_currency_precision || 8
      };
      symbolFiltersCache.set(marketSymbol, { filters, timestamp: Date.now() });
      return filters;
    }
  }

  return {
    minNotional: 1,
    minAmount: 0.0001,
    minTradeSize: 0.0001,
    maxTradeSize: 100000,
    basePrecision: 8,
    targetPrecision: 8
  };
}
