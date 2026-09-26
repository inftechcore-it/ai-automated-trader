import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const BASE_URL = 'https://api.bybit.com';
const TESTNET_BASE_URL = 'https://api-testnet.bybit.com';

let defaultCredentials = null;

export function initFromEnv() {
  if (env.bybit?.apiKey && env.bybit?.apiSecret) {
    defaultCredentials = {
      apiKey: env.bybit.apiKey,
      apiSecret: env.bybit.apiSecret
    };
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

export function setCredentials(apiKey, apiSecret) {
  defaultCredentials = { apiKey, apiSecret };
}

export function clearCredentials() {
  defaultCredentials = null;
}

/**
 * Normalizes symbol to Bybit format (e.g. BTC/USDT -> BTCUSDT)
 */
export function normalizeSymbol(symbol) {
  if (!symbol) return 'BTCUSDT';
  return symbol.replace('/', '').replace('_', '').replace('-', '').toUpperCase();
}

/**
 * Denormalizes symbol to standard pair format (e.g. BTCUSDT -> BTC/USDT)
 */
export function denormalizeSymbol(symbol) {
  if (!symbol) return '';
  const upper = symbol.toUpperCase();
  if (upper.includes('/')) return upper;
  if (upper.endsWith('USDT')) return `${upper.slice(0, -4)}/USDT`;
  if (upper.endsWith('USDC')) return `${upper.slice(0, -4)}/USDC`;
  if (upper.endsWith('USD')) return `${upper.slice(0, -3)}/USD`;
  if (upper.endsWith('BTC')) return `${upper.slice(0, -3)}/BTC`;
  if (upper.endsWith('EUR')) return `${upper.slice(0, -3)}/EUR`;
  return upper;
}

/**
 * Creates Bybit V5 HMAC SHA256 signature
 */
function createSignature(timestamp, apiKey, recvWindow, queryStringOrBody, apiSecret) {
  const signStr = `${timestamp}${apiKey}${recvWindow}${queryStringOrBody}`;
  return crypto.createHmac('sha256', apiSecret).update(signStr).digest('hex');
}

/**
 * Builds standard Bybit V5 authentication headers
 */
function buildAuthHeaders(apiKey, apiSecret, queryStringOrBody = '', recvWindow = '5000') {
  const timestamp = Date.now().toString();
  const signature = createSignature(timestamp, apiKey, recvWindow, queryStringOrBody, apiSecret);

  return {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'X-BAPI-SIGN': signature,
    'X-BAPI-SIGN-TYPE': '2',
    'Content-Type': 'application/json'
  };
}

/**
 * Fetches real-time ticker / 24hr quote from Bybit Spot
 */
export async function getQuote(symbol) {
  const bybitSymbol = normalizeSymbol(symbol);
  const url = `${BASE_URL}/v5/market/tickers`;

  const { data } = await axios.get(url, {
    params: { category: 'spot', symbol: bybitSymbol },
    timeout: 6000
  });

  if (data.retCode !== 0 || !data.result?.list?.length) {
    throw new Error(data.retMsg || `Symbol ${symbol} not found on Bybit`);
  }

  const ticker = data.result.list[0];
  const lastPrice = Number(ticker.lastPrice || 0);
  const prevPrice24h = Number(ticker.prevPrice24h || lastPrice);
  const priceChange = lastPrice - prevPrice24h;
  const changePercent = Number(ticker.price24hPcnt || 0) * 100;

  return {
    symbol: denormalizeSymbol(ticker.symbol) || symbol,
    exchange: 'Bybit',
    price: lastPrice,
    change: Number(priceChange.toFixed(8)),
    changePercent: Number(changePercent.toFixed(2)),
    high24h: Number(ticker.highPrice24h || lastPrice),
    low24h: Number(ticker.lowPrice24h || lastPrice),
    volume24h: Number(ticker.volume24h || 0),
    turnover24h: Number(ticker.turnover24h || 0),
    timestamp: new Date(Number(data.time || Date.now())).toISOString()
  };
}

const INTERVAL_MAP = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '6h': '360',
  '12h': '720',
  '1d': 'D',
  '1w': 'W',
  '1M': 'M'
};

/**
 * Fetches OHLCV candlestick data from Bybit Spot
 */
export async function getOHLCV(symbol, interval = '1h', limit = 100) {
  const bybitSymbol = normalizeSymbol(symbol);
  const bybitInterval = INTERVAL_MAP[interval] || '60';
  const url = `${BASE_URL}/v5/market/kline`;

  const { data } = await axios.get(url, {
    params: {
      category: 'spot',
      symbol: bybitSymbol,
      interval: bybitInterval,
      limit: Math.min(limit, 200)
    },
    timeout: 10000
  });

  if (data.retCode !== 0 || !data.result?.list) {
    throw new Error(data.retMsg || `Failed to fetch OHLCV for ${symbol} on Bybit`);
  }

  // Bybit returns candles in descending order (latest first), reverse to ascending
  const rawCandles = [...data.result.list].reverse();

  return rawCandles.map(([startTime, open, high, low, close, volume]) => ({
    time: new Date(Number(startTime)).toISOString(),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number(volume)
  }));
}

/**
 * Fetches real-time L2 order book from Bybit Spot
 */
export async function getOrderBook(symbol, limit = 20) {
  const bybitSymbol = normalizeSymbol(symbol);
  const url = `${BASE_URL}/v5/market/orderbook`;

  const { data } = await axios.get(url, {
    params: {
      category: 'spot',
      symbol: bybitSymbol,
      limit: Math.min(limit, 50)
    },
    timeout: 6000
  });

  if (data.retCode !== 0 || !data.result) {
    throw new Error(data.retMsg || `Failed to fetch orderbook for ${symbol} on Bybit`);
  }

  const rawBids = data.result.b || [];
  const rawAsks = data.result.a || [];

  let bidCumulative = 0;
  let askCumulative = 0;

  const bids = rawBids.map(([p, q]) => {
    const price = Number(p);
    const quantity = Number(q);
    bidCumulative += quantity;
    return {
      price,
      quantity,
      total: Number((price * quantity).toFixed(2)),
      cumulative: Number(bidCumulative.toFixed(4))
    };
  });

  const asks = rawAsks.map(([p, q]) => {
    const price = Number(p);
    const quantity = Number(q);
    askCumulative += quantity;
    return {
      price,
      quantity,
      total: Number((price * quantity).toFixed(2)),
      cumulative: Number(askCumulative.toFixed(4))
    };
  });

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const spread = bestAsk > bestBid ? bestAsk - bestBid : 0;
  const spreadPercent = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

  return {
    symbol: denormalizeSymbol(bybitSymbol) || symbol,
    exchange: 'Bybit',
    bids,
    asks,
    spread: Number(spread.toFixed(4)),
    spreadPercent: Number(spreadPercent.toFixed(4)),
    timestamp: new Date(Number(data.time || Date.now())).toISOString()
  };
}

/**
 * Fetches recent public trades from Bybit Spot
 */
export async function getRecentTrades(symbol, limit = 20) {
  const bybitSymbol = normalizeSymbol(symbol);
  const url = `${BASE_URL}/v5/market/recent-trade`;

  const { data } = await axios.get(url, {
    params: {
      category: 'spot',
      symbol: bybitSymbol,
      limit: Math.min(limit, 60)
    },
    timeout: 6000
  });

  if (data.retCode !== 0 || !data.result?.list) {
    return [];
  }

  return data.result.list.map(t => ({
    id: t.execId,
    price: Number(t.price),
    quantity: Number(t.size),
    side: (t.side || 'buy').toLowerCase(),
    time: new Date(Number(t.time)).toISOString(),
    isSimulated: false
  }));
}

export const POPULAR_BYBIT_SYMBOLS = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', baseAsset: 'BTC', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'ETH/USDT', name: 'Ethereum', baseAsset: 'ETH', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'SOL/USDT', name: 'Solana', baseAsset: 'SOL', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'XRP/USDT', name: 'Ripple', baseAsset: 'XRP', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', baseAsset: 'DOGE', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'ADA/USDT', name: 'Cardano', baseAsset: 'ADA', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'AVAX/USDT', name: 'Avalanche', baseAsset: 'AVAX', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'LINK/USDT', name: 'Chainlink', baseAsset: 'LINK', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'NEAR/USDT', name: 'NEAR Protocol', baseAsset: 'NEAR', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'SUI/USDT', name: 'Sui', baseAsset: 'SUI', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'PEPE/USDT', name: 'Pepe', baseAsset: 'PEPE', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'SHIB/USDT', name: 'Shiba Inu', baseAsset: 'SHIB', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'DOT/USDT', name: 'Polkadot', baseAsset: 'DOT', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'LTC/USDT', name: 'Litecoin', baseAsset: 'LTC', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'UNI/USDT', name: 'Uniswap', baseAsset: 'UNI', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'WIF/USDT', name: 'dogwifhat', baseAsset: 'WIF', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'RENDER/USDT', name: 'Render', baseAsset: 'RENDER', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'TAO/USDT', name: 'Bittensor', baseAsset: 'TAO', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'FET/USDT', name: 'Artificial Superintelligence Alliance', baseAsset: 'FET', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'APT/USDT', name: 'Aptos', baseAsset: 'APT', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'FIL/USDT', name: 'Filecoin', baseAsset: 'FIL', quoteAsset: 'USDT', exchange: 'Bybit' },
  { symbol: 'MATIC/USDT', name: 'Polygon', baseAsset: 'MATIC', quoteAsset: 'USDT', exchange: 'Bybit' }
];

let bybitSymbolsCache = null;
let bybitSymbolsCacheTime = 0;
const SYMBOLS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function ensureSymbolsCache() {
  if (bybitSymbolsCache && bybitSymbolsCache.length > 0 && Date.now() - bybitSymbolsCacheTime < SYMBOLS_CACHE_TTL) {
    return bybitSymbolsCache;
  }

  try {
    const url = `${BASE_URL}/v5/market/instruments-info?category=spot`;
    const { data } = await axios.get(url, { timeout: 10000 });

    if (data.retCode === 0 && data.result?.list?.length) {
      const parsed = data.result.list
        .filter(s => s.status === 'Trading' && (s.quoteCoin === 'USDT' || s.quoteCoin === 'USDC'))
        .map(s => ({
          symbol: `${s.baseCoin}/${s.quoteCoin}`,
          exchange: 'Bybit',
          name: s.baseCoin,
          baseAsset: s.baseCoin,
          quoteAsset: s.quoteCoin,
          minQty: parseFloat(s.lotSizeFilter?.minOrderQty || 0),
          maxQty: parseFloat(s.lotSizeFilter?.maxOrderQty || 0),
          stepSize: parseFloat(s.lotSizeFilter?.basePrecision || 0.0001),
          tickSize: parseFloat(s.priceFilter?.tickSize || 0.01)
        }));

      if (parsed.length > 0) {
        bybitSymbolsCache = parsed;
        bybitSymbolsCacheTime = Date.now();
        console.log(`[Bybit] Cached ${bybitSymbolsCache.length} spot symbols from instruments-info`);
        return bybitSymbolsCache;
      }
    }
  } catch (err) {
    console.warn('[Bybit] instruments-info fetch failed, falling back to popular list:', err.message);
  }

  bybitSymbolsCache = POPULAR_BYBIT_SYMBOLS;
  bybitSymbolsCacheTime = Date.now();
  return bybitSymbolsCache;
}

export async function searchSymbols(query = '') {
  try {
    const symbols = await ensureSymbolsCache();

    if (!query || !query.trim()) {
      return POPULAR_BYBIT_SYMBOLS;
    }

    const rawQuery = query.trim().toLowerCase();
    const needle = rawQuery.replace('/', '').replace('-', '');

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

      const aExact = aBase === needle || aSym === rawQuery || aBase === rawQuery;
      const bExact = bBase === needle || bSym === rawQuery || bBase === rawQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      if (aBase.startsWith(needle) && !bBase.startsWith(needle)) return -1;
      if (!aBase.startsWith(needle) && bBase.startsWith(needle)) return 1;

      return 0;
    });

    return matches.slice(0, 30);
  } catch (err) {
    console.error('[Bybit] searchSymbols error:', err.message);
    return POPULAR_BYBIT_SYMBOLS;
  }
}

export function supportsSymbol(symbol) {
  if (!symbol) return false;
  const upper = symbol.toUpperCase().replace('/', '');
  return upper.endsWith('USDT') || upper.endsWith('USDC') || upper.endsWith('USD') || upper.endsWith('BTC') || upper.endsWith('EUR');
}

/**
 * Validates Bybit API Key & Secret credentials
 */
export async function validateCredentials(apiKey, apiSecret, isTestnet = false) {
  if (!apiKey || !apiSecret) {
    throw new Error('Bybit API key and API secret are required');
  }

  const baseUrl = isTestnet ? TESTNET_BASE_URL : BASE_URL;
  const path = '/v5/user/query-api';
  const queryString = '';
  const headers = buildAuthHeaders(apiKey, apiSecret, queryString);

  try {
    const { data } = await axios.get(`${baseUrl}${path}`, {
      headers,
      timeout: 10000
    });

    if (data.retCode !== 0) {
      // Bybit specific error codes
      let errMsg = data.retMsg || 'Invalid Bybit API credentials';
      if (data.retCode === 10003) errMsg = 'Invalid API key format or key does not exist on Bybit';
      if (data.retCode === 10004) errMsg = 'Invalid Bybit signature - check your API secret';
      if (data.retCode === 10002) errMsg = 'Timestamp sync issue with Bybit - check server clock';
      if (data.retCode === 10005) errMsg = 'Bybit API key has expired';
      if (data.retCode === 10006) errMsg = 'Bybit API key has IP restrictions - whitelist your server IP';
      throw new Error(errMsg);
    }

    const info = data.result || {};
    const permissions = info.permissions || {};
    const permList = [];
    if (permissions.Spot?.length) permList.push('spot');
    if (permissions.Contract?.length) permList.push('derivatives');
    if (permissions.Wallet?.length) permList.push('wallet');
    if (permissions.Options?.length) permList.push('options');

    return {
      valid: true,
      permissions: permList.length > 0 ? permList : ['spot', 'trade', 'balance'],
      userId: info.userID || info.subMemberId || null,
      note: info.note || '',
      readOnly: info.readOnly === 1,
      isTestnet
    };
  } catch (err) {
    const status = err.response?.status;
    const bybitData = err.response?.data;
    const msg = bybitData?.retMsg || err.message || 'Failed to authenticate with Bybit';

    console.error('[Bybit] validateCredentials failed:', { status, msg, retCode: bybitData?.retCode });
    throw new Error(msg);
  }
}

/**
 * Fetches real-time wallet balances from Bybit V5 Unified Trading Account / Classical Spot
 */
export async function getBalances(apiKey, apiSecret, isTestnet = false) {
  if (!apiKey || !apiSecret) {
    throw new Error('Bybit credentials missing');
  }

  const baseUrl = isTestnet ? TESTNET_BASE_URL : BASE_URL;
  const balances = [];
  const seenAssets = new Set();

  // 1. Fetch UNIFIED Trading Account (UTA) balance
  try {
    const queryString = 'accountType=UNIFIED';
    const headers = buildAuthHeaders(apiKey, apiSecret, queryString);
    const { data } = await axios.get(`${baseUrl}/v5/account/wallet-balance?${queryString}`, {
      headers,
      timeout: 12000
    });

    if (data.retCode === 0 && data.result?.list?.length) {
      const account = data.result.list[0];
      const coins = account.coin || [];

      for (const c of coins) {
        const total = parseFloat(c.walletBalance || c.equity || 0);
        const free = parseFloat(c.transferablePosition || c.availableToWithdraw || c.free || total);
        const locked = parseFloat(c.locked || 0) || Math.max(0, total - free);
        const usdValue = parseFloat(c.usdValue || 0);

        if (total > 0.000001 || free > 0.000001 || locked > 0.000001) {
          seenAssets.add(c.coin.toUpperCase());
          balances.push({
            asset: c.coin.toUpperCase(),
            free: Number(free.toFixed(8)),
            locked: Number(locked.toFixed(8)),
            total: Number(total.toFixed(8)),
            usdValue: Number(usdValue.toFixed(2))
          });
        }
      }
    }
  } catch (utaErr) {
    console.warn('[Bybit] UNIFIED balance fetch failed/not UTA, attempting SPOT fallback:', utaErr.message);
  }

  // 2. Fetch SPOT account balance (for Standard / Classical accounts)
  try {
    const queryString = 'accountType=SPOT';
    const headers = buildAuthHeaders(apiKey, apiSecret, queryString);
    const { data } = await axios.get(`${baseUrl}/v5/account/wallet-balance?${queryString}`, {
      headers,
      timeout: 10000
    });

    if (data.retCode === 0 && data.result?.list?.length) {
      const account = data.result.list[0];
      const coins = account.coin || [];

      for (const c of coins) {
        const coinName = c.coin.toUpperCase();
        if (seenAssets.has(coinName)) continue;

        const total = parseFloat(c.walletBalance || c.equity || 0);
        const free = parseFloat(c.transferablePosition || c.availableToWithdraw || c.free || total);
        const locked = parseFloat(c.locked || 0) || Math.max(0, total - free);
        const usdValue = parseFloat(c.usdValue || 0);

        if (total > 0.000001 || free > 0.000001 || locked > 0.000001) {
          seenAssets.add(coinName);
          balances.push({
            asset: coinName,
            free: Number(free.toFixed(8)),
            locked: Number(locked.toFixed(8)),
            total: Number(total.toFixed(8)),
            usdValue: Number(usdValue.toFixed(2))
          });
        }
      }
    }
  } catch (spotErr) {
    // ignore if already collected from UTA
  }

  // 3. If any asset is missing USD value, calculate it via real-time Bybit ticker
  for (const b of balances) {
    if ((!b.usdValue || b.usdValue <= 0) && b.total > 0) {
      if (['USDT', 'USDC', 'USD'].includes(b.asset)) {
        b.usdValue = Number(b.total.toFixed(2));
      } else {
        try {
          const q = await getQuote(`${b.asset}/USDT`);
          if (q?.price) {
            b.usdValue = Number((b.total * q.price).toFixed(2));
          }
        } catch {
          b.usdValue = 0;
        }
      }
    }
  }

  return balances.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
}

/**
 * Places a live spot order on Bybit
 */
export async function placeOrder(apiKey, apiSecret, { symbol, side, orderType, quantity, price, stopPrice, isTestnet = false }) {
  const baseUrl = isTestnet ? TESTNET_BASE_URL : BASE_URL;
  const bybitSymbol = normalizeSymbol(symbol);
  const bybitSide = side.toLowerCase() === 'buy' ? 'Buy' : 'Sell';
  const bybitOrderType = orderType.toLowerCase() === 'market' ? 'Market' : 'Limit';

  const body = {
    category: 'spot',
    symbol: bybitSymbol,
    side: bybitSide,
    orderType: bybitOrderType,
    qty: quantity.toString(),
    timeInForce: 'GTC'
  };

  if (bybitOrderType === 'Limit' && price) {
    body.price = price.toString();
  }

  if (stopPrice) {
    body.triggerPrice = stopPrice.toString();
    body.triggerDirection = bybitSide === 'Buy' ? 1 : 2;
  }

  const jsonBody = JSON.stringify(body);
  const headers = buildAuthHeaders(apiKey, apiSecret, jsonBody);

  try {
    const { data } = await axios.post(`${baseUrl}/v5/order/create`, body, {
      headers,
      timeout: 10000
    });

    if (data.retCode !== 0) {
      throw new Error(data.retMsg || 'Bybit order placement failed');
    }

    const res = data.result || {};
    return {
      orderId: res.orderId,
      clientOrderId: res.orderLinkId || null,
      symbol: denormalizeSymbol(bybitSymbol) || symbol,
      side: side.toLowerCase(),
      orderType: orderType.toLowerCase(),
      quantity: parseFloat(quantity),
      price: price ? parseFloat(price) : null,
      status: 'open',
      filledQuantity: 0,
      avgFillPrice: null,
      createdAt: new Date(Number(data.time || Date.now())).toISOString()
    };
  } catch (err) {
    const msg = err.response?.data?.retMsg || err.message;
    console.error(`[Bybit] placeOrder error:`, msg);
    throw new Error(`Bybit: ${msg}`);
  }
}

/**
 * Cancels an open order on Bybit
 */
export async function cancelOrder(apiKey, apiSecret, symbol, orderId, isTestnet = false) {
  const baseUrl = isTestnet ? TESTNET_BASE_URL : BASE_URL;
  const bybitSymbol = normalizeSymbol(symbol);

  const body = {
    category: 'spot',
    symbol: bybitSymbol,
    orderId
  };

  const jsonBody = JSON.stringify(body);
  const headers = buildAuthHeaders(apiKey, apiSecret, jsonBody);

  const { data } = await axios.post(`${baseUrl}/v5/order/cancel`, body, {
    headers,
    timeout: 10000
  });

  if (data.retCode !== 0) {
    throw new Error(data.retMsg || 'Failed to cancel Bybit order');
  }

  return { orderId, status: 'cancelled' };
}

/**
 * Fetches open orders from Bybit Spot
 */
export async function getOpenOrders(apiKey, apiSecret, symbol = null, isTestnet = false) {
  const baseUrl = isTestnet ? TESTNET_BASE_URL : BASE_URL;
  let queryString = 'category=spot';
  if (symbol) {
    queryString += `&symbol=${normalizeSymbol(symbol)}`;
  }

  const headers = buildAuthHeaders(apiKey, apiSecret, queryString);

  const { data } = await axios.get(`${baseUrl}/v5/order/realtime?${queryString}`, {
    headers,
    timeout: 10000
  });

  if (data.retCode !== 0 || !data.result?.list) {
    return [];
  }

  return data.result.list.map(o => ({
    orderId: o.orderId,
    clientOrderId: o.orderLinkId,
    symbol: denormalizeSymbol(o.symbol),
    side: (o.side || 'buy').toLowerCase(),
    orderType: (o.orderType || 'market').toLowerCase(),
    quantity: parseFloat(o.qty || 0),
    price: parseFloat(o.price || 0) || null,
    status: mapBybitStatus(o.orderStatus),
    filledQuantity: parseFloat(o.cumExecQty || 0),
    avgFillPrice: parseFloat(o.avgPrice || 0) || null,
    createdAt: new Date(Number(o.createdTime || Date.now())).toISOString()
  }));
}

function mapBybitStatus(status) {
  const map = {
    'New': 'open',
    'PartiallyFilled': 'partial',
    'Filled': 'filled',
    'Cancelled': 'cancelled',
    'Rejected': 'rejected',
    'Deactivated': 'cancelled'
  };
  return map[status] || (status || '').toLowerCase();
}
