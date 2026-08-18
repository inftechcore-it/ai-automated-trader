import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const BASE_URL = env.exchanges.binanceBaseUrl;

let defaultCredentials = null;

export function initFromEnv() {
  if (env.binance?.apiKey && env.binance?.apiSecret) {
    defaultCredentials = {
      apiKey: env.binance.apiKey,
      apiSecret: env.binance.apiSecret
    };
    console.log('[Binance] Configured from environment');
    return true;
  }
  return false;
}

export function isConfigured() {
  return !!(defaultCredentials?.apiKey && defaultCredentials?.apiSecret);
}

export function getDefaultCredentials() {
  return defaultCredentials;
}

// Auto-init from env
initFromEnv();

function createSignature(queryString, apiSecret) {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

function normalizeSymbol(symbol) {
  return symbol.replace('/', '').toUpperCase();
}

export async function getQuote(symbol) {
  const url = `${BASE_URL}/api/v3/ticker/24hr`;
  const { data } = await axios.get(url, {
    params: { symbol: normalizeSymbol(symbol) },
    timeout: 5000
  });
  return {
    symbol,
    exchange: 'Binance',
    price: Number(data.lastPrice),
    change: Number(data.priceChange),
    changePercent: Number(data.priceChangePercent),
    high24h: Number(data.highPrice),
    low24h: Number(data.lowPrice),
    volume24h: Number(data.volume),
    timestamp: new Date().toISOString()
  };
}

export async function getOHLCV(symbol, interval = '1h', limit = 100) {
  const url = `${BASE_URL}/api/v3/klines`;
  const { data } = await axios.get(url, {
    params: {
      symbol: normalizeSymbol(symbol),
      interval,
      limit
    },
    timeout: 10000
  });

  return data.map(([openTime, open, high, low, close, volume]) => ({
    time: new Date(openTime).toISOString(),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number(volume)
  }));
}

export async function searchSymbols(query) {
  const url = `${BASE_URL}/api/v3/exchangeInfo`;
  const { data } = await axios.get(url, { timeout: 10000 });

  const needle = query.toLowerCase();
  return data.symbols
    .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT')
    .filter(s =>
      s.symbol.toLowerCase().includes(needle) ||
      s.baseAsset.toLowerCase().includes(needle)
    )
    .slice(0, 20)
    .map(s => ({
      symbol: `${s.baseAsset}/${s.quoteAsset}`,
      exchange: 'Binance',
      name: s.baseAsset,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset
    }));
}

export function supportsSymbol(symbol) {
  return symbol.includes('/') && symbol.toUpperCase().endsWith('USDT');
}

export async function validateCredentials(apiKey, apiSecret, useTestnet = false) {
  // Determine which URL to use
  const baseUrl = useTestnet
    ? 'https://testnet.binance.vision'
    : (BASE_URL || 'https://api.binance.com');

  const timestamp = Date.now();
  const recvWindow = 60000; // 60 second window to handle clock drift
  const queryString = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
  const signature = createSignature(queryString, apiSecret);

  console.log(`[Binance] Validating credentials against ${baseUrl}`);

  try {
    const { data } = await axios.get(`${baseUrl}/api/v3/account`, {
      params: { recvWindow, timestamp, signature },
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 15000
    });

    console.log(`[Binance] Validation successful - canTrade: ${data.canTrade}`);

    return {
      valid: true,
      permissions: data.permissions || [],
      canTrade: data.canTrade,
      canWithdraw: data.canWithdraw,
      accountType: data.accountType,
      balanceCount: data.balances?.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0).length || 0
    };
  } catch (error) {
    const status = error.response?.status;
    const binanceError = error.response?.data;

    console.error(`[Binance] Validation failed:`, {
      status,
      code: binanceError?.code,
      msg: binanceError?.msg
    });

    // Provide helpful error messages
    let errorMessage = 'Invalid API credentials';

    if (binanceError?.code === -2015) {
      errorMessage = 'Invalid API key format or key does not exist';
    } else if (binanceError?.code === -1022) {
      errorMessage = 'Invalid signature - check your API secret';
    } else if (binanceError?.code === -1021) {
      errorMessage = 'Timestamp sync issue - check your system clock';
    } else if (binanceError?.code === -2014) {
      errorMessage = 'API key format invalid';
    } else if (binanceError?.code === -1003) {
      errorMessage = 'Too many requests - rate limited. Try again later';
    } else if (status === 401) {
      errorMessage = 'API key rejected - verify key is active and has correct permissions';
    } else if (binanceError?.msg) {
      errorMessage = binanceError.msg;
    }

    throw new Error(errorMessage);
  }
}

export async function getBalances(apiKey, apiSecret, useTestnet = false) {
  const baseUrl = useTestnet
    ? 'https://testnet.binance.vision'
    : (BASE_URL || 'https://api.binance.com');

  const timestamp = Date.now();
  const recvWindow = 60000;
  const queryString = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
  const signature = createSignature(queryString, apiSecret);

  try {
    const { data } = await axios.get(`${baseUrl}/api/v3/account`, {
      params: { recvWindow, timestamp, signature },
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 15000
    });

    return data.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked)
      }));
  } catch (error) {
    const binanceError = error.response?.data;
    console.error(`[Binance] getBalances failed:`, binanceError?.msg || error.message);
    throw new Error(binanceError?.msg || 'Failed to fetch balances');
  }
}

export async function placeOrder(apiKey, apiSecret, { symbol, side, orderType, quantity, price, stopPrice }) {
  const binanceSymbol = normalizeSymbol(symbol);
  const timestamp = Date.now();

  const params = {
    symbol: binanceSymbol,
    side: side.toUpperCase(),
    type: orderType.toUpperCase(),
    quantity: quantity.toString(),
    timestamp
  };

  if (orderType === 'LIMIT') {
    params.timeInForce = 'GTC';
    params.price = price.toString();
  }

  if (orderType === 'STOP_LOSS_LIMIT' || orderType === 'TAKE_PROFIT_LIMIT') {
    params.timeInForce = 'GTC';
    params.price = price.toString();
    params.stopPrice = stopPrice.toString();
  }

  if (orderType === 'STOP_LOSS' || orderType === 'TAKE_PROFIT') {
    params.stopPrice = stopPrice.toString();
  }

  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const signature = createSignature(queryString, apiSecret);

  const { data } = await axios.post(
    `${BASE_URL}/api/v3/order`,
    `${queryString}&signature=${signature}`,
    {
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    }
  );

  return {
    orderId: data.orderId.toString(),
    clientOrderId: data.clientOrderId,
    symbol: symbol,
    side: data.side.toLowerCase(),
    orderType: data.type.toLowerCase(),
    quantity: parseFloat(data.origQty),
    price: parseFloat(data.price) || null,
    status: mapBinanceStatus(data.status),
    filledQuantity: parseFloat(data.executedQty),
    avgFillPrice: parseFloat(data.cummulativeQuoteQty) / parseFloat(data.executedQty) || null,
    createdAt: new Date(data.transactTime).toISOString()
  };
}

export async function cancelOrder(apiKey, apiSecret, symbol, orderId) {
  const binanceSymbol = normalizeSymbol(symbol);
  const timestamp = Date.now();
  const queryString = `symbol=${binanceSymbol}&orderId=${orderId}&timestamp=${timestamp}`;
  const signature = createSignature(queryString, apiSecret);

  const { data } = await axios.delete(
    `${BASE_URL}/api/v3/order?${queryString}&signature=${signature}`,
    {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 10000
    }
  );

  return { orderId: data.orderId.toString(), status: 'cancelled' };
}

export async function getOrder(apiKey, apiSecret, symbol, orderId) {
  const binanceSymbol = normalizeSymbol(symbol);
  const timestamp = Date.now();
  const queryString = `symbol=${binanceSymbol}&orderId=${orderId}&timestamp=${timestamp}`;
  const signature = createSignature(queryString, apiSecret);

  const { data } = await axios.get(
    `${BASE_URL}/api/v3/order?${queryString}&signature=${signature}`,
    {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 10000
    }
  );

  return {
    orderId: data.orderId.toString(),
    symbol: symbol,
    side: data.side.toLowerCase(),
    orderType: data.type.toLowerCase(),
    quantity: parseFloat(data.origQty),
    price: parseFloat(data.price) || null,
    status: mapBinanceStatus(data.status),
    filledQuantity: parseFloat(data.executedQty),
    avgFillPrice: parseFloat(data.cummulativeQuoteQty) / parseFloat(data.executedQty) || null
  };
}

export async function getOpenOrders(apiKey, apiSecret, symbol = null) {
  const timestamp = Date.now();
  let queryString = `timestamp=${timestamp}`;
  if (symbol) {
    queryString = `symbol=${normalizeSymbol(symbol)}&${queryString}`;
  }
  const signature = createSignature(queryString, apiSecret);

  const { data } = await axios.get(
    `${BASE_URL}/api/v3/openOrders?${queryString}&signature=${signature}`,
    {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 10000
    }
  );

  return data.map(order => ({
    orderId: order.orderId.toString(),
    symbol: order.symbol,
    side: order.side.toLowerCase(),
    orderType: order.type.toLowerCase(),
    quantity: parseFloat(order.origQty),
    price: parseFloat(order.price) || null,
    status: mapBinanceStatus(order.status),
    filledQuantity: parseFloat(order.executedQty),
    createdAt: new Date(order.time).toISOString()
  }));
}

function mapBinanceStatus(status) {
  const map = {
    'NEW': 'open',
    'PARTIALLY_FILLED': 'partial',
    'FILLED': 'filled',
    'CANCELED': 'cancelled',
    'REJECTED': 'rejected',
    'EXPIRED': 'expired'
  };
  return map[status] || status.toLowerCase();
}

// Cache for symbol filters to avoid repeated API calls
const symbolFiltersCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getSymbolFilters(symbol) {
  const binanceSymbol = normalizeSymbol(symbol);
  const cached = symbolFiltersCache.get(binanceSymbol);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.filters;
  }

  const url = `${BASE_URL}/api/v3/exchangeInfo`;
  const { data } = await axios.get(url, {
    params: { symbol: binanceSymbol },
    timeout: 10000
  });

  const symbolInfo = data.symbols.find(s => s.symbol === binanceSymbol);
  if (!symbolInfo) {
    throw new Error(`Symbol ${symbol} not found on Binance`);
  }

  const filters = {};
  for (const filter of symbolInfo.filters) {
    if (filter.filterType === 'NOTIONAL') {
      filters.minNotional = parseFloat(filter.minNotional);
      filters.maxNotional = parseFloat(filter.maxNotional);
      filters.applyMinToMarket = filter.applyMinToMarket;
      filters.applyMaxToMarket = filter.applyMaxToMarket;
    }
    if (filter.filterType === 'LOT_SIZE') {
      filters.minQty = parseFloat(filter.minQty);
      filters.maxQty = parseFloat(filter.maxQty);
      filters.stepSize = parseFloat(filter.stepSize);
    }
    if (filter.filterType === 'PRICE_FILTER') {
      filters.minPrice = parseFloat(filter.minPrice);
      filters.maxPrice = parseFloat(filter.maxPrice);
      filters.tickSize = parseFloat(filter.tickSize);
    }
    if (filter.filterType === 'MIN_NOTIONAL') {
      // Legacy filter - some pairs still use this
      filters.minNotional = parseFloat(filter.minNotional);
    }
  }

  symbolFiltersCache.set(binanceSymbol, { filters, timestamp: Date.now() });
  console.log(`[Binance] Filters for ${symbol}: minNotional=$${filters.minNotional}, minQty=${filters.minQty}, stepSize=${filters.stepSize}`);

  return filters;
}
