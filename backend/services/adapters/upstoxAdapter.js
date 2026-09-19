import axios from 'axios';
import { gunzipSync } from 'zlib';
import { env } from '../../config/env.js';
import * as cache from '../cache.js';

const BASE_URL = 'https://api.upstox.com';
const INSTRUMENTS_URL = 'https://assets.upstox.com/market-quote/instruments/exchange';

let accessToken = null;
let tokenExpiry = null;
let instrumentsCache = { NSE: null, BSE: null, lastFetch: null };

// IST Market Hours (in minutes from midnight)
const MARKET_OPEN_MINUTES = 9 * 60 + 15;  // 9:15 AM
const MARKET_CLOSE_MINUTES = 15 * 60 + 30; // 3:30 PM

// ============ CONFIG & AUTH ============

export function getConfig() {
  return {
    clientId: env.upstox?.apiKey || process.env.UPSTOX_API_KEY,
    clientSecret: env.upstox?.apiSecret || process.env.UPSTOX_API_SECRET,
    redirectUri: env.upstox?.redirectUri || process.env.UPSTOX_REDIRECT_URI || 'http://localhost:5000/api/upstox/callback'
  };
}

export function isConfigured() {
  const config = getConfig();
  return !!(config.clientId && config.clientSecret);
}

export function getAuthUrl(state = 'upstox_auth') {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state
  });
  console.log('[Upstox] Auth URL:', `${BASE_URL}/v2/login/authorization/dialog?${params.toString()}`);
  return `${BASE_URL}/v2/login/authorization/dialog?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const config = getConfig();
  console.log('[Upstox] Exchanging code for token...');

  try {
    const { data } = await axios.post(
      `${BASE_URL}/v2/login/authorization/token`,
      new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('[Upstox] Token exchange response status:', data.status);

    if (data.access_token) {
      accessToken = data.access_token;
      // Upstox tokens expire at 3:30 AM next day, but we'll use expires_in if provided
      tokenExpiry = Date.now() + (data.expires_in || 86400) * 1000;
      console.log('[Upstox] Token stored successfully, expires:', new Date(tokenExpiry).toISOString());
      return { success: true, expiresIn: data.expires_in };
    }

    throw new Error(data.message || 'Failed to get access token');
  } catch (err) {
    console.error('[Upstox] Token exchange error:', err.response?.data || err.message);
    throw new Error(err.response?.data?.message || err.message);
  }
}

export function setAccessToken(token, expiresInSeconds = 86400) {
  accessToken = token;
  tokenExpiry = token ? Date.now() + expiresInSeconds * 1000 : null;
}

export function getAccessToken() {
  return accessToken;
}

export function isAuthenticated() {
  if (!accessToken) return false;
  if (tokenExpiry && Date.now() >= tokenExpiry) {
    console.log('[Upstox] Token expired');
    return false;
  }
  return true;
}

export function isTokenExpired() {
  return tokenExpiry && Date.now() >= tokenExpiry;
}

function getAuthHeaders(customToken = null) {
  const token = customToken || accessToken;
  if (!token) {
    const err = new Error('Upstox not authenticated. Please connect your Upstox account.');
    err.code = 'NOT_AUTHENTICATED';
    throw err;
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  };
}

// Handle API errors with proper status codes
async function apiRequest(method, url, options = {}, customToken = null) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  console.log(`[Upstox API] ${method} ${fullUrl}`);

  try {
    const response = await axios({
      method,
      url: fullUrl,
      headers: {
        ...getAuthHeaders(customToken),
        ...options.headers
      },
      timeout: 15000,
      ...options
    });

    console.log(`[Upstox API] Response status: ${response.status}`);

    if (response.data?.status !== 'success') {
      const errMsg = response.data?.errors?.[0]?.message || response.data?.message || 'API request failed';
      throw new Error(errMsg);
    }

    return response.data;
  } catch (err) {
    if (err.response?.status === 401) {
      console.error('[Upstox] 401 Unauthorized - Token may be expired');
      const error = new Error('Session expired. Please re-authenticate with Upstox.');
      error.code = 'TOKEN_EXPIRED';
      error.status = 401;
      throw error;
    }

    const errorMsg = err.response?.data?.errors?.[0]?.message ||
                     err.response?.data?.message ||
                     err.message;
    console.error(`[Upstox API] Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

// ============ INSTRUMENTS (ISSUE 1) ============

export async function loadInstruments(exchange) {
  const cacheKey = `upstox_instruments_${exchange}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[Upstox] Using cached ${exchange} instruments (${cached.length} items)`);
    return cached;
  }

  // Check in-memory cache
  if (instrumentsCache[exchange] && instrumentsCache.lastFetch &&
      (Date.now() - instrumentsCache.lastFetch) < 6 * 60 * 60 * 1000) {
    return instrumentsCache[exchange];
  }

  try {
    const url = `${INSTRUMENTS_URL}/${exchange}.json.gz`;
    console.log(`[Upstox] Downloading instruments from: ${url}`);

    const { data } = await axios.get(url, {
      timeout: 60000,
      responseType: 'arraybuffer'
    });

    const decompressed = gunzipSync(Buffer.from(data));
    const instruments = JSON.parse(decompressed.toString('utf-8'));

    if (!Array.isArray(instruments)) {
      throw new Error('Invalid instruments data format');
    }

    // Cache for 6 hours
    cache.set(cacheKey, instruments, 6 * 60 * 60 * 1000);
    instrumentsCache[exchange] = instruments;
    instrumentsCache.lastFetch = Date.now();

    console.log(`[Upstox] Loaded ${instruments.length} ${exchange} instruments`);
    return instruments;
  } catch (err) {
    console.error(`[Upstox] Failed to load ${exchange} instruments:`, err.message);
    return instrumentsCache[exchange] || [];
  }
}

// Find instrument by symbol
export async function findInstrument(symbol, exchange = 'NSE') {
  const instruments = await loadInstruments(exchange);
  const upperSymbol = symbol.toUpperCase();

  // Try exact match on trading_symbol
  let instrument = instruments.find(i =>
    i.trading_symbol === upperSymbol &&
    i.segment === `${exchange}_EQ` &&
    (exchange === 'NSE' ? i.instrument_type === 'EQ' : true)
  );

  // If not found, try without instrument_type filter
  if (!instrument) {
    instrument = instruments.find(i =>
      i.trading_symbol === upperSymbol &&
      i.segment?.includes('_EQ')
    );
  }

  if (!instrument) {
    console.error(`[Upstox] Instrument not found: ${symbol} on ${exchange}`);
    throw new Error(`Symbol ${symbol} not found on ${exchange}`);
  }

  console.log(`[Upstox] Found instrument: ${instrument.trading_symbol} - ${instrument.name} (${instrument.instrument_key})`);
  return instrument;
}

export async function searchSymbols(query, exchange = 'NSE') {
  if (!query || query.length < 1) return [];

  const instruments = await loadInstruments(exchange);
  const needle = query.toLowerCase().trim();

  const results = instruments
    .filter(inst => {
      // Only equity segment
      if (!inst.segment?.includes('_EQ')) return false;
      // For NSE, filter by instrument_type
      if (exchange === 'NSE' && inst.instrument_type !== 'EQ') return false;
      // Exclude derivatives
      if (['FUT', 'CE', 'PE', 'INDEX', 'IF'].includes(inst.instrument_type)) return false;

      const symbol = (inst.trading_symbol || '').toLowerCase();
      const name = (inst.name || '').toLowerCase();
      return symbol.includes(needle) || name.includes(needle);
    })
    .slice(0, 30)
    .map(inst => ({
      symbol: inst.trading_symbol,
      exchange: exchange,
      name: inst.name || inst.trading_symbol,
      instrumentKey: inst.instrument_key,
      isin: inst.isin,
      lotSize: inst.lot_size || 1,
      tickSize: inst.tick_size || 0.05,
      segment: inst.segment
    }));

  console.log(`[Upstox] Search "${query}" on ${exchange}: ${results.length} results`);
  return results;
}

// ============ QUOTES (ISSUE 2) ============

export async function getQuote(symbol, exchange = 'NSE') {
  const instrument = await findInstrument(symbol, exchange);
  const instrumentKey = encodeURIComponent(instrument.instrument_key);

  const data = await apiRequest('GET', `/v2/market-quote/quotes?instrument_key=${instrumentKey}`);

  const quoteData = Object.values(data.data || {})[0];
  if (!quoteData) {
    throw new Error('No quote data received');
  }

  const ohlc = quoteData.ohlc || {};
  // Use last_price as per Upstox API
  const ltp = quoteData.last_price || 0;
  const prevClose = ohlc.close || quoteData.previous_close || ltp;
  const change = ltp - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: instrument.trading_symbol,
    exchange,
    name: instrument.name || symbol,
    price: ltp,
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    open: ohlc.open || ltp,
    high24h: ohlc.high || ltp,
    low24h: ohlc.low || ltp,
    volume24h: quoteData.volume || 0,
    previousClose: prevClose,
    lastTradeTime: quoteData.last_trade_time,
    upperCircuit: quoteData.upper_circuit_limit,
    lowerCircuit: quoteData.lower_circuit_limit,
    bid: quoteData.depth?.buy?.[0]?.price,
    ask: quoteData.depth?.sell?.[0]?.price,
    currency: 'INR',
    timestamp: new Date().toISOString(),
    source: 'upstox',
    instrumentKey: instrument.instrument_key
  };
}

// ============ CHART DATA (ISSUE 2) ============

// Convert UTC timestamp to IST and check if within market hours
function isWithinMarketHours(timestamp) {
  const date = new Date(timestamp);
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);

  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  const dayOfWeek = istDate.getUTCDay();

  // Skip weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // Check if within 9:15 AM - 3:30 PM IST
  return totalMinutes >= MARKET_OPEN_MINUTES && totalMinutes <= MARKET_CLOSE_MINUTES;
}

// Convert UTC to IST timestamp string
function toIST(timestamp) {
  const date = new Date(timestamp);
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(date.getTime() + istOffset).toISOString();
}

export async function getOHLCV(symbol, interval = '1d', limit = 100, exchange = 'NSE') {
  const instrument = await findInstrument(symbol, exchange);
  const instrumentKey = encodeURIComponent(instrument.instrument_key);

  // Map frontend interval to Upstox interval
  const intervalMap = {
    '1m': '1minute',
    '5m': '5minute',
    '15m': '15minute',
    '30m': '30minute',
    '1h': '1hour',
    '4h': 'day',
    '1d': 'day',
    '1w': 'week',
    '1M': 'month'
  };

  const upstoxInterval = intervalMap[interval] || 'day';
  const isIntraday = ['1m', '5m', '15m', '30m', '1h'].includes(interval);

  let candles = [];

  if (isIntraday) {
    // Use intraday API for intraday intervals
    console.log(`[Upstox] Fetching intraday candles: ${upstoxInterval}`);
    const data = await apiRequest('GET', `/v2/historical-candle/intraday/${instrumentKey}/${upstoxInterval}`);
    candles = data.data?.candles || [];
  } else {
    // Use historical API for daily/weekly/monthly
    const toDate = new Date().toISOString().split('T')[0];
    const daysBack = interval === '1w' ? limit * 7 : interval === '1M' ? limit * 30 : limit;
    const fromDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`[Upstox] Fetching historical candles: ${upstoxInterval} from ${fromDate} to ${toDate}`);
    const data = await apiRequest('GET', `/v2/historical-candle/${instrumentKey}/${upstoxInterval}/${toDate}/${fromDate}`);
    candles = data.data?.candles || [];
  }

  // Transform and filter candles
  const transformedCandles = candles
    .map(([time, open, high, low, close, volume, oi]) => ({
      time: time,
      timeIST: toIST(time),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume || 0)
    }))
    // Filter to market hours for intraday
    .filter(c => isIntraday ? isWithinMarketHours(c.time) : true)
    // Sort by time ascending
    .sort((a, b) => new Date(a.time) - new Date(b.time))
    // Limit results
    .slice(-limit);

  console.log(`[Upstox] Returning ${transformedCandles.length} candles for ${symbol}`);
  return transformedCandles;
}

export async function getIntradayOHLCV(symbol, interval = '1minute', exchange = 'NSE') {
  return getOHLCV(symbol, interval === '1minute' ? '1m' : interval === '5minute' ? '5m' : '15m', 100, exchange);
}

// ============ FUNDS & PROFILE (ISSUE 3) ============

export async function getFunds(customToken = null) {
  // Use segment=SEC for equity as per Upstox API
  const data = await apiRequest('GET', '/v2/user/get-funds-and-margin?segment=SEC', {}, customToken);

  const equity = data.data?.equity || data.data || {};

  return {
    equity: {
      availableMargin: Number(equity.available_margin || equity.used_margin || 0),
      usedMargin: Number(equity.used_margin || 0),
      payin: Number(equity.payin_amount || 0),
      span: Number(equity.span_margin || 0),
      adhocMargin: Number(equity.adhoc_margin || 0),
      notionalCash: Number(equity.notional_cash || 0),
      exposure: Number(equity.exposure_margin || 0)
    },
    totalAvailable: Number(equity.available_margin || 0),
    totalUsed: Number(equity.used_margin || 0),
    currency: 'INR'
  };
}

export async function getProfile(customToken = null) {
  const data = await apiRequest('GET', '/v2/user/profile', {}, customToken);

  return {
    userId: data.data?.user_id,
    userName: data.data?.user_name,
    email: data.data?.email,
    broker: data.data?.broker,
    exchanges: data.data?.exchanges || [],
    products: data.data?.products || [],
    orderTypes: data.data?.order_types || [],
    isActive: data.data?.is_active
  };
}

// ============ ORDERS (ISSUE 4) ============

export async function placeOrder({ symbol, side, orderType, quantity, price, stopPrice, exchange = 'NSE', product = 'D' }, customToken = null) {
  const instrument = await findInstrument(symbol, exchange);

  // Map order types to Upstox format
  const upstoxOrderType = {
    'market': 'MARKET',
    'limit': 'LIMIT',
    'stop_loss': 'SL',
    'stop_limit': 'SL-M',
    'sl': 'SL',
    'sl-m': 'SL-M'
  }[orderType?.toLowerCase()] || 'MARKET';

  const orderPayload = {
    quantity: parseInt(quantity),
    product: product, // D = Delivery (CNC), I = Intraday (MIS)
    validity: 'DAY',
    price: upstoxOrderType === 'MARKET' ? 0 : Number(price) || 0,
    tag: 'AI_BDM_TRADE',
    instrument_token: instrument.instrument_key,
    order_type: upstoxOrderType,
    transaction_type: side.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
    disclosed_quantity: 0,
    trigger_price: Number(stopPrice) || 0,
    is_amo: false
  };

  console.log('[Upstox] Placing order:', JSON.stringify(orderPayload, null, 2));

  try {
    const { data } = await axios.post(
      `${BASE_URL}/v2/order/place`,
      orderPayload,
      {
        headers: {
          ...getAuthHeaders(customToken),
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('[Upstox] Order response:', JSON.stringify(data, null, 2));

    if (data.status !== 'success') {
      const errorMsg = data.errors?.map(e => e.message).join(', ') || data.message || 'Order placement failed';
      console.error('[Upstox] Order failed:', errorMsg);
      throw new Error(errorMsg);
    }

    const orderId = data.data?.order_id;
    console.log('[Upstox] Order placed successfully:', orderId);

    return {
      orderId,
      symbol: instrument.trading_symbol,
      exchange,
      side: side.toLowerCase(),
      orderType,
      quantity: parseInt(quantity),
      price: price || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      instrumentKey: instrument.instrument_key
    };
  } catch (err) {
    const errorDetail = err.response?.data?.errors?.[0]?.message ||
                        err.response?.data?.message ||
                        err.message;
    console.error('[Upstox] Order placement error:', errorDetail);
    throw new Error(`Order failed: ${errorDetail}`);
  }
}

export async function getOrderStatus(orderId, customToken = null) {
  const data = await apiRequest('GET', `/v2/order/history?order_id=${orderId}`, {}, customToken);

  const orders = data.data || [];
  if (orders.length === 0) {
    throw new Error('Order not found');
  }

  // Get the latest status
  const latestOrder = orders[orders.length - 1];

  return {
    orderId: latestOrder.order_id,
    symbol: latestOrder.trading_symbol,
    exchange: latestOrder.exchange,
    side: latestOrder.transaction_type?.toLowerCase(),
    orderType: latestOrder.order_type?.toLowerCase(),
    quantity: latestOrder.quantity,
    filledQuantity: latestOrder.filled_quantity || 0,
    price: latestOrder.price,
    avgFillPrice: latestOrder.average_price,
    status: mapUpstoxStatus(latestOrder.status),
    statusMessage: latestOrder.status_message,
    createdAt: latestOrder.order_timestamp,
    updatedAt: latestOrder.exchange_timestamp
  };
}

export async function cancelOrder(orderId, customToken = null) {
  const data = await apiRequest('DELETE', `/v2/order/cancel?order_id=${orderId}`, {}, customToken);

  console.log('[Upstox] Order cancelled:', orderId);
  return { orderId, status: 'cancelled' };
}

export async function getOpenOrders(customToken = null) {
  const data = await apiRequest('GET', '/v2/order/retrieve-all', {}, customToken);

  return (data.data || [])
    .filter(o => ['open', 'pending', 'trigger pending', 'not modified', 'modify pending', 'transit'].includes(o.status?.toLowerCase()))
    .map(o => ({
      orderId: o.order_id,
      symbol: o.trading_symbol,
      exchange: o.exchange,
      side: o.transaction_type?.toLowerCase(),
      orderType: o.order_type?.toLowerCase(),
      quantity: o.quantity,
      filledQuantity: o.filled_quantity || 0,
      price: o.price || null,
      status: mapUpstoxStatus(o.status),
      createdAt: o.order_timestamp
    }));
}

export async function getOrderHistory(customToken = null) {
  const data = await apiRequest('GET', '/v2/order/retrieve-all', {}, customToken);

  return (data.data || []).map(o => ({
    orderId: o.order_id,
    symbol: o.trading_symbol,
    exchange: o.exchange,
    side: o.transaction_type?.toLowerCase(),
    orderType: o.order_type?.toLowerCase(),
    quantity: o.quantity,
    filledQuantity: o.filled_quantity || 0,
    price: o.price || null,
    avgFillPrice: o.average_price || null,
    status: mapUpstoxStatus(o.status),
    statusMessage: o.status_message,
    createdAt: o.order_timestamp
  }));
}

// ============ POSITIONS & HOLDINGS ============

export async function getPositions(customToken = null) {
  const data = await apiRequest('GET', '/v2/portfolio/short-term-positions', {}, customToken);

  return (data.data || []).map(p => ({
    symbol: p.trading_symbol,
    exchange: p.exchange,
    quantity: p.quantity,
    avgPrice: p.average_price,
    currentPrice: p.last_price,
    pnl: p.pnl,
    pnlPercent: p.average_price > 0 ? (p.pnl / (p.average_price * Math.abs(p.quantity))) * 100 : 0,
    product: p.product,
    instrumentKey: p.instrument_token
  }));
}

export async function getHoldings(customToken = null) {
  const data = await apiRequest('GET', '/v2/portfolio/long-term-holdings', {}, customToken);

  return (data.data || []).map(h => ({
    symbol: h.trading_symbol,
    exchange: h.exchange,
    quantity: h.quantity,
    avgPrice: h.average_price,
    currentPrice: h.last_price,
    pnl: h.pnl,
    pnlPercent: h.average_price > 0 ? (h.pnl / (h.average_price * h.quantity)) * 100 : 0,
    isin: h.isin
  }));
}

// ============ HELPERS ============

function mapUpstoxStatus(status) {
  const statusLower = (status || '').toLowerCase();
  const map = {
    'complete': 'filled',
    'completed': 'filled',
    'rejected': 'rejected',
    'cancelled': 'cancelled',
    'open': 'open',
    'pending': 'pending',
    'trigger pending': 'pending',
    'not modified': 'open',
    'modify pending': 'pending',
    'transit': 'pending',
    'traded': 'filled'
  };
  return map[statusLower] || statusLower;
}

export function supportsSymbol(symbol) {
  return !symbol.includes('/');
}

// Preload instruments on startup
export async function preloadInstruments() {
  console.log('[Upstox] Preloading instruments...');
  try {
    await Promise.all([
      loadInstruments('NSE'),
      loadInstruments('BSE')
    ]);
    console.log('[Upstox] Instruments preloaded successfully');
  } catch (err) {
    console.error('[Upstox] Failed to preload instruments:', err.message);
  }
}
