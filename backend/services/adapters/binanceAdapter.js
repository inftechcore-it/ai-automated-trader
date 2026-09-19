import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const BASE_URL = env.exchanges.binanceBaseUrl;

let defaultCredentials = null;

export function initFromEnv() {
  return false;
}

export function isConfigured() {
  return false;
}

export function getDefaultCredentials() {
  return null;
}

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

let binanceSymbolsCache = null;
let binanceSymbolsCacheTime = 0;
const SYMBOLS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export const POPULAR_BINANCE_SYMBOLS = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', baseAsset: 'BTC', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'ETH/USDT', name: 'Ethereum', baseAsset: 'ETH', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'SOL/USDT', name: 'Solana', baseAsset: 'SOL', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'BNB/USDT', name: 'BNB', baseAsset: 'BNB', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'XRP/USDT', name: 'Ripple', baseAsset: 'XRP', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', baseAsset: 'DOGE', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'ADA/USDT', name: 'Cardano', baseAsset: 'ADA', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'AVAX/USDT', name: 'Avalanche', baseAsset: 'AVAX', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'LINK/USDT', name: 'Chainlink', baseAsset: 'LINK', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'NEAR/USDT', name: 'NEAR Protocol', baseAsset: 'NEAR', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'SUI/USDT', name: 'Sui', baseAsset: 'SUI', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'PEPE/USDT', name: 'Pepe', baseAsset: 'PEPE', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'SHIB/USDT', name: 'Shiba Inu', baseAsset: 'SHIB', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'DOT/USDT', name: 'Polkadot', baseAsset: 'DOT', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'RAY/USDT', name: 'Raydium', baseAsset: 'RAY', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'ORCA/USDT', name: 'Orca', baseAsset: 'ORCA', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'WIF/USDT', name: 'dogwifhat', baseAsset: 'WIF', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'LTC/USDT', name: 'Litecoin', baseAsset: 'LTC', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'UNI/USDT', name: 'Uniswap', baseAsset: 'UNI', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'RENDER/USDT', name: 'Render', baseAsset: 'RENDER', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'TAO/USDT', name: 'Bittensor', baseAsset: 'TAO', quoteAsset: 'USDT', exchange: 'Binance' },
  { symbol: 'FET/USDT', name: 'Artificial Superintelligence Alliance', baseAsset: 'FET', quoteAsset: 'USDT', exchange: 'Binance' }
];

// Cache for symbol filters to avoid repeated API calls
const symbolFiltersCache = new Map();
const FILTERS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function parseFiltersFromSymbol(symbolInfo) {
  const filters = {};
  if (!symbolInfo || !symbolInfo.filters) return filters;

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
      filters.minNotional = parseFloat(filter.minNotional);
    }
  }
  return filters;
}

export async function ensureSymbolsCache() {
  if (binanceSymbolsCache && binanceSymbolsCache.length > 0 && Date.now() - binanceSymbolsCacheTime < SYMBOLS_CACHE_TTL) {
    return binanceSymbolsCache;
  }

  // Attempt 1: Fetch all spot trading symbols with full metadata from exchangeInfo
  try {
    const url = `${BASE_URL || 'https://api.binance.com'}/api/v3/exchangeInfo?permissions=SPOT`;
    const { data } = await axios.get(url, { timeout: 10000 });
    if (data && data.symbols && Array.isArray(data.symbols)) {
      const parsed = data.symbols
        .filter(s => s.status === 'TRADING' && (s.quoteAsset === 'USDT' || s.quoteAsset === 'USDC'))
        .map(s => {
          // Pre-populate filters cache if available
          if (s.filters && Array.isArray(s.filters)) {
            try {
              const filters = parseFiltersFromSymbol(s);
              symbolFiltersCache.set(s.symbol, { filters, timestamp: Date.now() });
            } catch {}
          }

          return {
            symbol: `${s.baseAsset}/${s.quoteAsset}`,
            exchange: 'Binance',
            name: s.baseAsset,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset
          };
        });

      if (parsed.length > 0) {
        binanceSymbolsCache = parsed;
        binanceSymbolsCacheTime = Date.now();
        console.log(`[Binance] Cached ${binanceSymbolsCache.length} spot symbols from exchangeInfo`);
        return binanceSymbolsCache;
      }
    }
  } catch (err) {
    console.warn('[Binance] exchangeInfo fetch failed, attempting fast ticker/price fallback:', err.message);
  }

  // Attempt 2: Lightweight fast fallback via ticker/price
  try {
    const url = `${BASE_URL || 'https://api.binance.com'}/api/v3/ticker/price`;
    const { data } = await axios.get(url, { timeout: 8000 });
    if (Array.isArray(data)) {
      const parsed = [];
      for (const item of data) {
        if (item.symbol.endsWith('USDT')) {
          const base = item.symbol.slice(0, -4);
          parsed.push({
            symbol: `${base}/USDT`,
            exchange: 'Binance',
            name: base,
            baseAsset: base,
            quoteAsset: 'USDT'
          });
        } else if (item.symbol.endsWith('USDC')) {
          const base = item.symbol.slice(0, -4);
          parsed.push({
            symbol: `${base}/USDC`,
            exchange: 'Binance',
            name: base,
            baseAsset: base,
            quoteAsset: 'USDC'
          });
        }
      }
      if (parsed.length > 0) {
        binanceSymbolsCache = parsed;
        binanceSymbolsCacheTime = Date.now();
        console.log(`[Binance] Cached ${binanceSymbolsCache.length} spot symbols from ticker/price`);
        return binanceSymbolsCache;
      }
    }
  } catch (err2) {
    console.warn('[Binance] ticker/price fallback failed:', err2.message);
  }

  // Attempt 3: Default popular symbols list
  binanceSymbolsCache = POPULAR_BINANCE_SYMBOLS;
  binanceSymbolsCacheTime = Date.now();
  return binanceSymbolsCache;
}

export async function searchSymbols(query = '') {
  try {
    const symbols = await ensureSymbolsCache();

    if (!query || !query.trim()) {
      return POPULAR_BINANCE_SYMBOLS;
    }

    const rawQuery = query.trim().toLowerCase();
    const needle = rawQuery.replace('/', '');

    const matches = symbols.filter(s => {
      const symClean = s.symbol.toLowerCase().replace('/', '');
      const baseLower = s.baseAsset.toLowerCase();
      const nameLower = (s.name || '').toLowerCase();
      return (
        symClean.includes(needle) ||
        baseLower.includes(needle) ||
        nameLower.includes(needle) ||
        s.symbol.toLowerCase().includes(rawQuery)
      );
    });

    matches.sort((a, b) => {
      const aBase = a.baseAsset.toLowerCase();
      const bBase = b.baseAsset.toLowerCase();
      const aSym = a.symbol.toLowerCase();
      const bSym = b.symbol.toLowerCase();

      // 1. Exact matches (e.g. query "RAY" -> RAY/USDT)
      const aExact = aBase === needle || aSym === rawQuery || aBase === rawQuery;
      const bExact = bBase === needle || bSym === rawQuery || bBase === rawQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // 2. Starts with query
      const aStarts = aBase.startsWith(needle);
      const bStarts = bBase.startsWith(needle);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // 3. Prioritize USDT pairs over USDC
      if (a.quoteAsset === 'USDT' && b.quoteAsset !== 'USDT') return -1;
      if (a.quoteAsset !== 'USDT' && b.quoteAsset === 'USDT') return 1;

      return aBase.localeCompare(bBase);
    });

    if (matches.length > 0) {
      return matches.slice(0, 30);
    }

    return POPULAR_BINANCE_SYMBOLS.filter(s =>
      s.symbol.toLowerCase().includes(rawQuery) ||
      s.baseAsset.toLowerCase().includes(needle)
    );
  } catch (err) {
    console.warn('[Binance] searchSymbols error:', err.message);
    return POPULAR_BINANCE_SYMBOLS;
  }
}

export function supportsSymbol(symbol) {
  if (!symbol) return false;
  const upper = symbol.toUpperCase();
  return upper.includes('/') && (upper.endsWith('USDT') || upper.endsWith('USDC') || upper.endsWith('FDUSD'));
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

function formatQuantity(qty, stepSize = 0.0001) {
  if (!qty || isNaN(qty)) return '0';
  if (!stepSize || stepSize <= 0) {
    return Number(qty).toFixed(4);
  }

  const stepStr = stepSize.toString();
  let precision = 0;
  if (stepStr.includes('.')) {
    precision = stepStr.split('.')[1].length;
  } else if (stepSize < 1) {
    precision = Math.max(0, Math.round(-Math.log10(stepSize)));
  }

  const factor = Math.pow(10, precision);
  const floored = Math.floor(Number(qty) * factor) / factor;
  return floored.toFixed(precision);
}

function formatPrice(price, tickSize = 0.0001) {
  if (!price || isNaN(price)) return undefined;
  if (!tickSize || tickSize <= 0) {
    return Number(price).toFixed(4);
  }

  const tickStr = tickSize.toString();
  let precision = 0;
  if (tickStr.includes('.')) {
    precision = tickStr.split('.')[1].length;
  } else if (tickSize < 1) {
    precision = Math.max(0, Math.round(-Math.log10(tickSize)));
  }

  return Number(price).toFixed(precision);
}

export async function placeOrder(apiKey, apiSecret, { symbol, side, orderType, quantity, price, stopPrice }) {
  const binanceSymbol = normalizeSymbol(symbol);
  const timestamp = Date.now();

  let formattedQty = quantity;
  let formattedPrice = price;
  let formattedStopPrice = stopPrice;

  try {
    const filters = await getSymbolFilters(symbol).catch(() => null);
    if (filters) {
      if (filters.stepSize) {
        formattedQty = formatQuantity(quantity, filters.stepSize);
      }
      if (filters.tickSize && price) {
        formattedPrice = formatPrice(price, filters.tickSize);
      }
      if (filters.tickSize && stopPrice) {
        formattedStopPrice = formatPrice(stopPrice, filters.tickSize);
      }
    } else {
      formattedQty = formatQuantity(quantity, 0.01);
    }
  } catch (err) {
    console.warn(`[Binance] Failed to fetch filters for ${symbol}, fallback:`, err.message);
    formattedQty = formatQuantity(quantity, 0.01);
  }

  console.log(`[Binance] Formatted Order: ${side} ${formattedQty} (raw: ${quantity}) ${binanceSymbol} @ ${formattedPrice || 'MARKET'}`);

  const params = {
    symbol: binanceSymbol,
    side: side.toUpperCase(),
    type: orderType.toUpperCase(),
    quantity: formattedQty.toString(),
    timestamp
  };

  if (orderType === 'LIMIT' && formattedPrice) {
    params.timeInForce = 'GTC';
    params.price = formattedPrice.toString();
  }

  if ((orderType === 'STOP_LOSS_LIMIT' || orderType === 'TAKE_PROFIT_LIMIT') && formattedPrice && formattedStopPrice) {
    params.timeInForce = 'GTC';
    params.price = formattedPrice.toString();
    params.stopPrice = formattedStopPrice.toString();
  }

  if ((orderType === 'STOP_LOSS' || orderType === 'TAKE_PROFIT') && formattedStopPrice) {
    params.stopPrice = formattedStopPrice.toString();
  }

  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const signature = createSignature(queryString, apiSecret);

  try {
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
  } catch (error) {
    const binanceError = error.response?.data?.msg || error.response?.data?.message || error.message;
    console.error(`[Binance] placeOrder failed:`, binanceError);
    throw new Error(`Binance: ${binanceError}`);
  }
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

export async function getSymbolFilters(symbol) {
  const binanceSymbol = normalizeSymbol(symbol);
  const cached = symbolFiltersCache.get(binanceSymbol);

  if (cached && Date.now() - cached.timestamp < FILTERS_CACHE_TTL) {
    return cached.filters;
  }

  const url = `${BASE_URL}/api/v3/exchangeInfo`;
  const { data } = await axios.get(url, {
    params: { symbol: binanceSymbol },
    timeout: 10000
  });

  const symbolInfo = data.symbols?.find(s => s.symbol === binanceSymbol) || data.symbols?.[0];
  if (!symbolInfo) {
    throw new Error(`Symbol ${symbol} not found on Binance`);
  }

  const filters = parseFiltersFromSymbol(symbolInfo);
  symbolFiltersCache.set(binanceSymbol, { filters, timestamp: Date.now() });
  console.log(`[Binance] Filters for ${symbol}: minNotional=$${filters.minNotional}, minQty=${filters.minQty}, stepSize=${filters.stepSize}`);

  return filters;
}
