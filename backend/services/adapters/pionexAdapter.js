import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const BASE_URL = 'https://api.pionex.com';

let defaultCredentials = null;

export function initFromEnv() {
  if (env.pionex?.apiKey && env.pionex?.apiSecret) {
    defaultCredentials = {
      apiKey: env.pionex.apiKey,
      apiSecret: env.pionex.apiSecret
    };
    console.log('[Pionex] Configured from environment');
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

function createSignature(method, path, queryString, body, apiSecret) {
  // Pionex signature: HMAC SHA256 of METHOD + PATH + QUERY + TIMESTAMP + BODY
  let signatureBase = method.toUpperCase() + path;
  if (queryString) {
    signatureBase += '?' + queryString;
  }
  if (body) {
    signatureBase += JSON.stringify(body);
  }
  return crypto.createHmac('sha256', apiSecret).update(signatureBase).digest('hex');
}

function buildQueryString(params) {
  // Sort params by key in ASCII order and build query string
  const sorted = Object.keys(params).sort();
  return sorted.map(key => `${key}=${params[key]}`).join('&');
}

function normalizeSymbol(symbol) {
  // Convert BTC/USDT to BTC_USDT (Pionex uses underscore)
  return symbol.replace('/', '_').toUpperCase();
}

function denormalizeSymbol(symbol) {
  // Convert BTC_USDT to BTC/USDT
  return symbol.replace('_', '/');
}

export async function getQuote(symbol) {
  const url = `${BASE_URL}/api/v1/market/tickers`;
  const pionexSymbol = normalizeSymbol(symbol);

  const { data } = await axios.get(url, {
    params: { symbol: pionexSymbol },
    timeout: 5000
  });

  if (!data.result || !data.data?.tickers?.length) {
    throw new Error(`Symbol ${symbol} not found on Pionex`);
  }

  const ticker = data.data.tickers[0];
  return {
    symbol,
    exchange: 'Pionex',
    price: Number(ticker.close),
    change: Number(ticker.close) - Number(ticker.open),
    changePercent: ((Number(ticker.close) - Number(ticker.open)) / Number(ticker.open) * 100).toFixed(2),
    high24h: Number(ticker.high),
    low24h: Number(ticker.low),
    volume24h: Number(ticker.volume),
    timestamp: new Date().toISOString()
  };
}

export async function getOHLCV(symbol, interval = '1h', limit = 100) {
  // Map interval to Pionex format
  const intervalMap = {
    '1m': '1M', '5m': '5M', '15m': '15M', '30m': '30M',
    '1h': '60M', '4h': '4H', '8h': '8H', '12h': '12H', '1d': '1D'
  };
  const pionexInterval = intervalMap[interval] || '60M';

  const url = `${BASE_URL}/api/v1/market/klines`;
  const { data } = await axios.get(url, {
    params: {
      symbol: normalizeSymbol(symbol),
      interval: pionexInterval,
      limit: Math.min(limit, 500)
    },
    timeout: 10000
  });

  if (!data.result || !data.data?.klines) {
    return [];
  }

  return data.data.klines.map(k => ({
    time: new Date(k.time).toISOString(),
    open: Number(k.open),
    high: Number(k.high),
    low: Number(k.low),
    close: Number(k.close),
    volume: Number(k.volume)
  }));
}

// Symbol cache
let symbolsCache = null;
let symbolsCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function searchSymbols(query) {
  // Refresh cache if needed
  if (!symbolsCache || Date.now() - symbolsCacheTime > CACHE_TTL) {
    const url = `${BASE_URL}/api/v1/common/symbols`;
    const { data } = await axios.get(url, {
      params: { type: 'SPOT' },
      timeout: 10000
    });

    if (data.result && data.data?.symbols) {
      symbolsCache = data.data.symbols;
      symbolsCacheTime = Date.now();
      console.log(`[Pionex] Cached ${symbolsCache.length} symbols`);
    }
  }

  const needle = query.toLowerCase();
  return (symbolsCache || [])
    .filter(s => s.quoteCurrency === 'USDT' && s.enable)
    .filter(s =>
      s.symbol.toLowerCase().includes(needle) ||
      s.baseCurrency.toLowerCase().includes(needle)
    )
    .slice(0, 20)
    .map(s => ({
      symbol: `${s.baseCurrency}/${s.quoteCurrency}`,
      exchange: 'Pionex',
      name: s.baseCurrency,
      baseAsset: s.baseCurrency,
      quoteAsset: s.quoteCurrency
    }));
}

export function supportsSymbol(symbol) {
  return symbol.includes('/') && symbol.toUpperCase().endsWith('USDT');
}

export async function validateCredentials(apiKey, apiSecret) {
  const timestamp = Date.now();
  const path = '/api/v1/account/balances';
  const queryParams = { timestamp };
  const queryString = buildQueryString(queryParams);
  const signature = createSignature('GET', path, queryString, null, apiSecret);

  try {
    const { data } = await axios.get(`${BASE_URL}${path}`, {
      params: queryParams,
      headers: {
        'PIONEX-KEY': apiKey,
        'PIONEX-SIGNATURE': signature
      },
      timeout: 15000
    });

    if (!data.result) {
      throw new Error(data.message || 'Invalid credentials');
    }

    console.log(`[Pionex] Validation successful - ${data.data?.balances?.length || 0} assets`);
    return {
      valid: true,
      balanceCount: data.data?.balances?.filter(b => parseFloat(b.free) > 0 || parseFloat(b.frozen) > 0).length || 0
    };
  } catch (error) {
    const pionexError = error.response?.data;
    console.error(`[Pionex] Validation failed:`, pionexError?.message || error.message);

    let errorMessage = 'Invalid API credentials';
    if (pionexError?.code === 'INVALID_APIKEY') {
      errorMessage = 'Invalid API key';
    } else if (pionexError?.code === 'INVALID_SIGNATURE') {
      errorMessage = 'Invalid signature - check your API secret';
    } else if (pionexError?.code === 'IP_NOT_WHITELISTED') {
      errorMessage = 'IP address not whitelisted for this API key';
    } else if (pionexError?.code === 'PERMISSION_DENIED') {
      errorMessage = 'API key does not have required permissions';
    } else if (pionexError?.message) {
      errorMessage = pionexError.message;
    }

    throw new Error(errorMessage);
  }
}

export async function getBalances(apiKey, apiSecret) {
  const timestamp = Date.now();
  const path = '/api/v1/account/balances';
  const queryParams = { timestamp };
  const queryString = buildQueryString(queryParams);
  const signature = createSignature('GET', path, queryString, null, apiSecret);

  try {
    const { data } = await axios.get(`${BASE_URL}${path}`, {
      params: queryParams,
      headers: {
        'PIONEX-KEY': apiKey,
        'PIONEX-SIGNATURE': signature
      },
      timeout: 15000
    });

    if (!data.result) {
      throw new Error(data.message || 'Failed to fetch balances');
    }

    return data.data.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.frozen) > 0)
      .map(b => ({
        asset: b.coin,
        free: parseFloat(b.free),
        locked: parseFloat(b.frozen),
        total: parseFloat(b.free) + parseFloat(b.frozen)
      }));
  } catch (error) {
    const pionexError = error.response?.data;
    console.error(`[Pionex] getBalances failed:`, pionexError?.message || error.message);
    throw new Error(pionexError?.message || 'Failed to fetch balances');
  }
}

export async function placeOrder(apiKey, apiSecret, { symbol, side, orderType, quantity, price, amount }) {
  const timestamp = Date.now();
  const path = '/api/v1/trade/order';
  const queryParams = { timestamp };
  const queryString = buildQueryString(queryParams);

  const body = {
    symbol: normalizeSymbol(symbol),
    side: side.toUpperCase(),
    type: orderType.toUpperCase()
  };

  if (orderType.toUpperCase() === 'LIMIT') {
    body.size = quantity.toString();
    body.price = price.toString();
  } else if (orderType.toUpperCase() === 'MARKET') {
    if (side.toUpperCase() === 'BUY') {
      body.amount = amount?.toString() || (quantity * price).toString();
    } else {
      body.size = quantity.toString();
    }
  }

  const signature = createSignature('POST', path, queryString, body, apiSecret);

  try {
    const { data } = await axios.post(
      `${BASE_URL}${path}?${queryString}`,
      body,
      {
        headers: {
          'PIONEX-KEY': apiKey,
          'PIONEX-SIGNATURE': signature,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (!data.result) {
      throw new Error(data.message || 'Order placement failed');
    }

    return {
      orderId: data.data.orderId,
      clientOrderId: data.data.clientOrderId || null,
      symbol: symbol,
      side: side.toLowerCase(),
      orderType: orderType.toLowerCase(),
      quantity: parseFloat(quantity),
      price: parseFloat(price) || null,
      status: 'open',
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    const pionexError = error.response?.data;
    console.error(`[Pionex] placeOrder failed:`, pionexError?.message || error.message);
    throw new Error(`[Pionex] ${pionexError?.message || error.message}`);
  }
}

export async function cancelOrder(apiKey, apiSecret, symbol, orderId) {
  const timestamp = Date.now();
  const path = '/api/v1/trade/order';
  const queryParams = { timestamp };
  const queryString = buildQueryString(queryParams);

  const body = {
    symbol: normalizeSymbol(symbol),
    orderId: orderId
  };

  const signature = createSignature('DELETE', path, queryString, body, apiSecret);

  try {
    const { data } = await axios.delete(
      `${BASE_URL}${path}?${queryString}`,
      {
        data: body,
        headers: {
          'PIONEX-KEY': apiKey,
          'PIONEX-SIGNATURE': signature,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (!data.result) {
      throw new Error(data.message || 'Cancel order failed');
    }

    return { orderId, status: 'cancelled' };
  } catch (error) {
    const pionexError = error.response?.data;
    throw new Error(pionexError?.message || error.message);
  }
}

export async function getOrder(apiKey, apiSecret, symbol, orderId) {
  const timestamp = Date.now();
  const path = '/api/v1/trade/order';
  const queryParams = { timestamp, orderId };
  const queryString = buildQueryString(queryParams);
  const signature = createSignature('GET', path, queryString, null, apiSecret);

  try {
    const { data } = await axios.get(
      `${BASE_URL}${path}?${queryString}`,
      {
        headers: {
          'PIONEX-KEY': apiKey,
          'PIONEX-SIGNATURE': signature
        },
        timeout: 10000
      }
    );

    if (!data.result) {
      throw new Error(data.message || 'Get order failed');
    }

    const order = data.data;
    return {
      orderId: order.orderId,
      symbol: denormalizeSymbol(order.symbol),
      side: order.side.toLowerCase(),
      orderType: order.type.toLowerCase(),
      quantity: parseFloat(order.size),
      price: parseFloat(order.price) || null,
      status: mapPionexStatus(order.status),
      filledQuantity: parseFloat(order.filledSize),
      avgFillPrice: parseFloat(order.filledAmount) / parseFloat(order.filledSize) || null,
      fee: parseFloat(order.fee) || 0,
      createdAt: new Date(order.createTime).toISOString()
    };
  } catch (error) {
    const pionexError = error.response?.data;
    throw new Error(pionexError?.message || error.message);
  }
}

export async function getOpenOrders(apiKey, apiSecret, symbol = null) {
  const timestamp = Date.now();
  const path = '/api/v1/trade/openOrders';
  const queryParams = { timestamp };
  if (symbol) {
    queryParams.symbol = normalizeSymbol(symbol);
  }
  const queryString = buildQueryString(queryParams);
  const signature = createSignature('GET', path, queryString, null, apiSecret);

  try {
    const { data } = await axios.get(
      `${BASE_URL}${path}?${queryString}`,
      {
        headers: {
          'PIONEX-KEY': apiKey,
          'PIONEX-SIGNATURE': signature
        },
        timeout: 10000
      }
    );

    if (!data.result) {
      throw new Error(data.message || 'Get open orders failed');
    }

    return (data.data.orders || []).map(order => ({
      orderId: order.orderId,
      symbol: denormalizeSymbol(order.symbol),
      side: order.side.toLowerCase(),
      orderType: order.type.toLowerCase(),
      quantity: parseFloat(order.size),
      price: parseFloat(order.price) || null,
      status: mapPionexStatus(order.status),
      filledQuantity: parseFloat(order.filledSize),
      createdAt: new Date(order.createTime).toISOString()
    }));
  } catch (error) {
    const pionexError = error.response?.data;
    throw new Error(pionexError?.message || error.message);
  }
}

export async function getAllOrders(apiKey, apiSecret, symbol, limit = 50) {
  const timestamp = Date.now();
  const path = '/api/v1/trade/allOrders';
  const queryParams = { timestamp, symbol: normalizeSymbol(symbol), limit };
  const queryString = buildQueryString(queryParams);
  const signature = createSignature('GET', path, queryString, null, apiSecret);

  try {
    const { data } = await axios.get(
      `${BASE_URL}${path}?${queryString}`,
      {
        headers: {
          'PIONEX-KEY': apiKey,
          'PIONEX-SIGNATURE': signature
        },
        timeout: 10000
      }
    );

    if (!data.result) {
      throw new Error(data.message || 'Get all orders failed');
    }

    return (data.data.orders || []).map(order => ({
      orderId: order.orderId,
      symbol: denormalizeSymbol(order.symbol),
      side: order.side.toLowerCase(),
      orderType: order.type.toLowerCase(),
      quantity: parseFloat(order.size),
      price: parseFloat(order.price) || null,
      status: mapPionexStatus(order.status),
      filledQuantity: parseFloat(order.filledSize),
      avgFillPrice: parseFloat(order.filledAmount) / parseFloat(order.filledSize) || null,
      createdAt: new Date(order.createTime).toISOString()
    }));
  } catch (error) {
    const pionexError = error.response?.data;
    throw new Error(pionexError?.message || error.message);
  }
}

// Symbol filters cache
const symbolFiltersCache = new Map();
const FILTERS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getSymbolFilters(symbol) {
  const pionexSymbol = normalizeSymbol(symbol);
  const cached = symbolFiltersCache.get(pionexSymbol);

  if (cached && Date.now() - cached.timestamp < FILTERS_CACHE_TTL) {
    return cached.filters;
  }

  const url = `${BASE_URL}/api/v1/common/symbols`;
  const { data } = await axios.get(url, {
    params: { symbols: pionexSymbol },
    timeout: 10000
  });

  if (!data.result || !data.data?.symbols?.length) {
    throw new Error(`Symbol ${symbol} not found on Pionex`);
  }

  const symbolInfo = data.data.symbols[0];
  const filters = {
    minNotional: parseFloat(symbolInfo.minNotional) || 5,
    minAmount: parseFloat(symbolInfo.minAmount) || 0,
    minTradeSize: parseFloat(symbolInfo.minTradeSize) || 0,
    maxTradeSize: parseFloat(symbolInfo.maxTradeSize) || 0,
    basePrecision: symbolInfo.basePrecision || 8,
    quotePrecision: symbolInfo.quotePrecision || 8,
    amountPrecision: symbolInfo.amountPrecision || 8
  };

  symbolFiltersCache.set(pionexSymbol, { filters, timestamp: Date.now() });
  console.log(`[Pionex] Filters for ${symbol}: minNotional=$${filters.minNotional}, minTradeSize=${filters.minTradeSize}`);

  return filters;
}

function mapPionexStatus(status) {
  const map = {
    'OPEN': 'open',
    'PARTIALLY_FILLED': 'partial',
    'FILLED': 'filled',
    'CANCELED': 'cancelled',
    'REJECTED': 'rejected'
  };
  return map[status] || status?.toLowerCase() || 'unknown';
}

// Grid Bot API
export async function createGridBot(apiKey, apiSecret, params) {
  const timestamp = Date.now();
  const path = '/api/v1/bot/orders/spotGrid/create';
  const queryParams = { timestamp };
  const queryString = buildQueryString(queryParams);

  const body = {
    base: params.baseAsset,
    quote: params.quoteAsset,
    buOrderData: {
      top: params.upperPrice.toString(),
      bottom: params.lowerPrice.toString(),
      row: params.gridCount,
      gridType: params.gridType || 'arithmetic',
      quoteTotalInvestment: params.investment.toString()
    }
  };

  if (params.stopLoss) {
    body.lossStop = params.stopLoss.toString();
    body.lossStopType = 'AMOUNT';
  }

  if (params.takeProfit) {
    body.profitStop = params.takeProfit.toString();
    body.profitStopType = 'AMOUNT';
  }

  const signature = createSignature('POST', path, queryString, body, apiSecret);

  try {
    const { data } = await axios.post(
      `${BASE_URL}${path}?${queryString}`,
      body,
      {
        headers: {
          'PIONEX-KEY': apiKey,
          'PIONEX-SIGNATURE': signature,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    if (!data.result) {
      throw new Error(data.message || 'Create grid bot failed');
    }

    return {
      botId: data.data.buOrderId,
      status: 'running',
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    const pionexError = error.response?.data;
    throw new Error(`[Pionex] ${pionexError?.message || error.message}`);
  }
}

export async function getGridBot(apiKey, apiSecret, botId) {
  const timestamp = Date.now();
  const path = '/api/v1/bot/orders/spotGrid/order';
  const queryParams = { timestamp, buOrderId: botId };
  const queryString = buildQueryString(queryParams);
  const signature = createSignature('GET', path, queryString, null, apiSecret);

  try {
    const { data } = await axios.get(
      `${BASE_URL}${path}?${queryString}`,
      {
        headers: {
          'PIONEX-KEY': apiKey,
          'PIONEX-SIGNATURE': signature
        },
        timeout: 10000
      }
    );

    if (!data.result) {
      throw new Error(data.message || 'Get grid bot failed');
    }

    return data.data;
  } catch (error) {
    const pionexError = error.response?.data;
    throw new Error(pionexError?.message || error.message);
  }
}

export async function cancelGridBot(apiKey, apiSecret, botId, closeSellModel = 'TO_QUOTE') {
  const timestamp = Date.now();
  const path = '/api/v1/bot/orders/spotGrid/cancel';
  const queryParams = { timestamp };
  const queryString = buildQueryString(queryParams);

  const body = {
    buOrderId: botId,
    closeSellModel
  };

  const signature = createSignature('POST', path, queryString, body, apiSecret);

  try {
    const { data } = await axios.post(
      `${BASE_URL}${path}?${queryString}`,
      body,
      {
        headers: {
          'PIONEX-KEY': apiKey,
          'PIONEX-SIGNATURE': signature,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (!data.result) {
      throw new Error(data.message || 'Cancel grid bot failed');
    }

    return { botId, status: 'cancelled' };
  } catch (error) {
    const pionexError = error.response?.data;
    throw new Error(pionexError?.message || error.message);
  }
}
