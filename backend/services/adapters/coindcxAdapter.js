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
 * Known CoinDCX Target Currency (Base Asset Quantity) Precisions
 * Dynamic markets_details takes precedence; this dictionary provides instant accurate fallback.
 */
export const COINDCX_DEFAULT_PRECISIONS = {
  // 0 decimal precision (Integer whole numbers only)
  XLM: 0, DOGE: 0, SHIB: 0, PEPE: 0, BONK: 0, FLOKI: 0, ALGO: 0, HBAR: 0,
  SAND: 0, CHZ: 0, MANA: 0, CKB: 0, NOT: 0, USDC: 0, HOT: 0, VTHO: 0,
  GRT: 0, MEME: 0, GALA: 0, HIVE: 0, REQ: 0, POWR: 0, USTC: 0, IQ: 0,
  DEGEN: 0, HMSTR: 0, PHA: 0, ETN: 0, GEOD: 0, NIBI: 0, BAT: 0, KMNO: 0,
  REKT: 0, PUMP: 0, XR: 0, VINU: 0, VENOM: 0, RSS3: 0, BLAST: 0, SIS: 0,
  EDU: 0, USDS: 0, TOWNS: 0, XUSD: 0, ESP: 0, USDE: 0, LINEA: 0, PLUME: 0,
  SPK: 0, SKY: 0, ZAMA: 0, CHIP: 0, HOME: 0, AVAIL: 0, IOST: 0, MOG: 0,
  TFUEL: 0, FOGO: 0, CORE: 0, SUN: 0, XAN: 0, PEIPEI: 0, UB: 0, RIF: 0,
  PENGU: 0, DEFI: 0, TOSHI: 0, NIGHT: 0, FLT: 0, IOTA: 0, CERE: 0, MGO: 0,
  SENT: 0, ALKIMI: 0, IOTX: 0, SC: 0, ELIZAOS: 0, RAIN: 0, DBR: 0, US: 0,
  SUPER: 0, CRTS: 0, CFX: 0, BEAMX: 0, VAI: 0, VINE: 0, SUPRA: 0, ZBCN: 0,
  ZORA: 0, TURBO: 0, MANTRA: 0, VR: 0, OTK: 0, SNEK: 0, ATA: 0, LWP: 0,
  BEL: 0, GWEI: 0, LAT: 0, XEM: 0, HUMA: 0, AKE: 0, Q: 0, CAT: 0,
  TAG: 0, PZP: 0, USD1: 0, GHST: 0, ALT: 0, SOLV: 0, MAPO: 0, BOME: 0,
  EQTY: 0, AMP: 0, CSPR: 0, SLP: 0, OGN: 0, IDEX: 0, MEW: 0, SAHARA: 0,
  ZRX: 0, MBL: 0, FIO: 0, RWA: 0, TWT: 0, WAXP: 0, ARTFI: 0, ACH: 0,
  BRISE: 0, SKL: 0, PYBOBO: 0, PIPEDOG: 0, XRD: 0, WENSOL: 0, QUICK: 0,
  MAV: 0, ZPAY: 0, ORBS: 0, "1000CHEEMS": 0, VSN: 0, XPIN: 0, KONET: 0,
  RLUSD: 0, STABLE: 0, CHR: 0, SPELL: 0, QKC: 0, TEL: 0, CTSI: 0, DOGS: 0,
  "2Z": 0, TX: 0, XPRT: 0, BIGTIME: 0, SOPH: 0, HOOK: 0, TUSD: 0, ONT: 0,
  DUSK: 0, XEC: 0, ARK: 0, BRETT: 0, G: 0, BABY: 0, H: 0, BONE: 0,
  DEP: 0, DOGELONMARS: 0, FDUSD: 0, SKR: 0, U: 0, ION: 0, DEEP: 0,
  AIGENSYN: 0, ID: 0, CWEB: 0, UOS: 0, QI: 0, AWE: 0, GUN: 0, ROBO: 0,
  BNKR: 0, "1MBABYDOGE": 0, EMT: 0, LCX: 0, ADX: 0, BTTC: 0,

  // 1 decimal precision
  XRP: 1, ADA: 1, TRX: 1, POL: 1, MATIC: 1, NEAR: 1, SUI: 1, SEI: 1,
  WLD: 1, ARB: 1, FET: 1, CRV: 1, JASMY: 1, ETHFI: 1, ONDO: 1, ANKR: 1,
  DODO: 1, XAI: 1, XTZ: 1, AGLD: 1, ANIME: 1, PARTI: 1, USUAL: 1, STX: 1,
  ASTR: 1, PUSH: 1, TST: 1, TKO: 1, BLUR: 1, MOVE: 1, RUNE: 1, WAL: 1,
  WOD: 1, SQD: 1, CYS: 1, DIA: 1, RAD: 1, TUT: 1, XPL: 1, WOO: 1,
  ALI: 1, JTO: 1, MON: 1, NYM: 1, MAGIC: 1, CTK: 1, AVA: 1, SNX: 1,
  QTUM: 1, STG: 1, ARPA: 1, YGG: 1, PYTH: 1, LA: 1, AZTEC: 1, WLFI: 1,
  ERA: 1, LAB: 1, TREE: 1, OPG: 1, EURI: 1, UMA: 1, EGL1: 1, STBL: 1,
  MASK: 1, GIGA: 1, AUDIO: 1, ACE: 1, GPS: 1, C98: 1, JELLYJELLY: 1,
  C: 1, COW: 1, CETUS: 1, AVNT: 1, FRAX: 1, HOLO: 1, MTL: 1, RARE: 1,
  SYRUP: 1, FIDA: 1, SIGN: 1, AT: 1, SXT: 1, RESOLV: 1, VELVET: 1, STO: 1,
  KGEN: 1, ICNT: 1, HEMI: 1, O: 1, CELR: 1, SIREN: 1, RLC: 1, KAVA: 1,
  CXT: 1, THE: 1, S: 1, RED: 1, WCT: 1, KAIO: 1, KERNEL: 1, HAEDAL: 1,
  NXPC: 1, BR: 1, PORTAL: 1, IRYS: 1, VIRTUAL: 1, PNUT: 1, PEAQ: 1,
  BIRB: 1, BANK: 1, SAPIEN: 1, ZEST: 1, RE: 1, IN: 1, MMT: 1, TRADE: 1,
  ACT: 1, NIL: 1, NAKA: 1, NPC: 1, DGB: 1, AIN: 1, PEOPLE: 1, A: 1,
  CGPT: 1, DYM: 1, THETA: 1, HYPER: 1, JUP: 1, NOM: 1, MANTA: 1, BAS: 1,
  TROLL: 1, ACX: 1, BB: 1, DRIFT: 1, RSR: 1, OG: 1, COOKIE: 1, TNSR: 1,
  PUNDIX: 1, BLESS: 1, DGAI: 1, RAY: 1, ACU: 1, MLN: 1, MARSCOIN: 1,
  T: 1, GMT: 1, GLM: 1, USELESS: 1, CROSS: 1, MEGA: 1, VELODROME: 1,
  BREV: 1, MUBARAK: 1, SUSHI: 1, FORT: 1, HTX: 1, MINA: 1, HIPPO: 1,
  VET: 1, KAITO: 1, PONKE: 1, ARKM: 1, GOAT: 1, AIXBT: 1, BIO: 1, ACM: 1,
  GRIFFAIN: 1, ZEREBRO: 1, ATH: 1, KNC: 1, BLUE: 1, REZ: 1, BAND: 1,
  MET: 1, SOON: 1, LMWR: 1, NEWT: 1, ESPORTS: 1, ENJ: 1, RVN: 1, LSK: 1,
  "1INCH": 1, GLMR: 1, PENDLE: 1, OVR: 1, W: 1, KAIA: 1, REACT: 1,
  HEI: 1, EPIC: 1, ICX: 1, MOCA: 1, CC: 1, AIO: 1, UAI: 1, OPEN: 1,
  KITE: 1, FF: 1, HPP: 1, ONE: 1, SYN: 1, BOSON: 1, BMT: 1, SHELL: 1,
  RACA: 1, PRL: 1, ALLO: 1, CATI: 1, SAGA: 1, WMTX: 1, SCR: 1,
  SUNDOG: 1, ZIL: 1, JST: 1,

  // 2 decimal precision
  SOL: 2, LINK: 2, AVAX: 2, UNI: 2, ATOM: 2, DOT: 2, LPT: 2, BICO: 2,
  PROM: 2, WIF: 2, FIL: 2, ENS: 2, PSG: 2, LUMIA: 2, VANA: 2, POPCAT: 2,
  KSM: 2, COTI: 2, MLK: 2, IO: 2, ICP: 2, CBK: 2, USDG: 2, EWT: 2,
  MIRA: 2, CLANKER: 2, CARV: 2, SAFE: 2, LIKE: 2, API3: 2, APT: 2,
  XNO: 2, SUT: 2, ZK: 2, GENIUS: 2, MERL: 2, XVS: 2, HSK: 2, APE: 2,
  FTT: 2, LIGHT: 2, JUV: 2, LUNC: 2, ORDI: 2, ZENT: 2, DEXE: 2, BNT: 2,
  ASR: 2, PORTO: 2, SANTOS: 2, VVV: 2, FB: 2, SPX: 2, MBX: 2, INIT: 2,
  UDS: 2, EDGE: 2, NES: 2, DATA: 2, EGLD: 2, STRK: 2, LISTA: 2, OP: 2,
  STEEM: 2, GRAM: 2, FORM: 2, ZRO: 2, SOMI: 2, LAZIO: 2, EUL: 2, AXL: 2,
  "0G": 2, SWAP: 2, GRASS: 2, AR: 2, ME: 2, FIS: 2, ORCA: 2, LF: 2,
  NMR: 2, USDT: 2, ACA: 2, MDT: 2, NEXO: 2, TIA: 2, PRO: 2, FARTCOIN: 2,
  CAKE: 2, ENSO: 2, PONS: 2, CASHCAT: 2, FLOCK: 2, AUCTION: 2, FLUX: 2,
  BARD: 2, B2: 2, GNS: 2, XDC: 2, ALICE: 2, LUNA: 2, CHILLGUY: 2, BAN: 2,
  MELANIA: 2, HYPE: 2, ETC: 2, AERO: 2, LAYER: 2, RONIN: 2, SWCH: 2,
  DYDX: 2, EIGEN: 2, ZEN: 2, PIEVERSE: 2, AXS: 2, REN: 2, JOE: 2, ATM: 2,
  FLOW: 2, CITY: 2, ASTER: 2, LIT: 2, MORPHO: 2, RPL: 2, CYBER: 2,
  AEVO: 2, ENA: 2, ALPINE: 2, ARC: 2, PRCL: 2, ONG: 2, OSMO: 2,

  // 3 decimal precision
  BNB: 3, LTC: 3, AAVE: 3, BSV: 3, QNT: 3, BANANA: 3, XMR: 3, CVX: 3,
  METIS: 3, GIGGLE: 3, ILV: 3, DASH: 3, COMP: 3, TRUMP: 3, GMX: 3,
  BERA: 3, MOVR: 3, GMMT: 3, TRB: 3, XYO: 3, SSV: 3,

  // 4 decimal precision
  ETH: 4, BCH: 4, TAO: 4, USDD: 4, PYUSD: 4, PAXG: 4, TRAC: 4, GNO: 4,
  ETHW: 4, WAVES: 4,

  // 5+ decimal precision
  BTC: 5, WBTC: 5, YFI: 5, ZEC: 5, NEO: 6
};

/**
 * Format quantity to CoinDCX target currency allowed precision (e.g. 0 decimals for XLM/DOGE, 1 for XRP)
 */
export function formatOrderQuantity(symbol, quantity, precisionOverride = null) {
  if (quantity === undefined || quantity === null || isNaN(quantity)) return 0;
  const clean = (symbol || '').toUpperCase().replace(/[-_]/g, '/');
  const parts = clean.split('/');
  const baseAsset = (parts[0] || '').replace(/^[BI]-/, '') || clean;

  let precision = precisionOverride;
  if (precision === null || precision === undefined) {
    const marketSym = normalizeSymbol(symbol, 'market');
    const pairSym = normalizeSymbol(symbol, 'pair');
    const cached = symbolFiltersCache.get(marketSym) || symbolFiltersCache.get(pairSym) || symbolFiltersCache.get(clean);
    if (typeof cached?.filters?.targetPrecision === 'number') {
      precision = cached.filters.targetPrecision;
    } else if (COINDCX_DEFAULT_PRECISIONS[baseAsset] !== undefined) {
      precision = COINDCX_DEFAULT_PRECISIONS[baseAsset];
    } else {
      precision = 1;
    }
  }

  // Ensure precision is a non-negative integer
  precision = Math.max(0, Math.floor(Number(precision) || 0));

  if (precision === 0) {
    return Math.floor(Number(quantity));
  }

  const factor = Math.pow(10, precision);
  const floored = Math.floor(Number(quantity) * factor) / factor;
  return Number(floored.toFixed(precision));
}

/**
 * Format price to CoinDCX base currency allowed precision
 */
export function formatOrderPrice(symbol, price, precisionOverride = null) {
  if (price === undefined || price === null || isNaN(price)) return undefined;
  let precision = precisionOverride;
  if (precision === null || precision === undefined) {
    const marketSym = normalizeSymbol(symbol, 'market');
    const pairSym = normalizeSymbol(symbol, 'pair');
    const clean = (symbol || '').toUpperCase().replace(/[-_]/g, '/');
    const cached = symbolFiltersCache.get(marketSym) || symbolFiltersCache.get(pairSym) || symbolFiltersCache.get(clean);
    precision = typeof cached?.filters?.basePrecision === 'number' ? cached.filters.basePrecision : 4;
  }
  precision = Math.max(0, Math.floor(Number(precision) || 0));
  const factor = Math.pow(10, precision);
  const rounded = Math.round(Number(price) * factor) / factor;
  return Number(rounded.toFixed(precision));
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

  // Fetch precision rules from CoinDCX market details
  const filters = await getSymbolFilters(symbol);
  const formattedQuantity = formatOrderQuantity(symbol, quantity, filters.targetPrecision);
  const formattedPrice = price ? formatOrderPrice(symbol, price, filters.basePrecision) : undefined;
  const formattedStopPrice = stopPrice ? formatOrderPrice(symbol, stopPrice, filters.basePrecision) : undefined;

  if (formattedQuantity <= 0) {
    throw new Error(`[CoinDCX] Formatted quantity is 0 for ${symbol} with precision ${filters.targetPrecision}. Minimum order quantity is ${filters.minAmount}`);
  }

  const body = {
    side: upperSide,
    order_type: cdcxOrderType,
    market: marketSymbol,
    total_quantity: formattedQuantity,
    timestamp: timestamp
  };

  if (cdcxOrderType === 'limit_order' || formattedPrice) {
    body.price_per_unit = formattedPrice;
  }

  if (formattedStopPrice) {
    body.stop_price = formattedStopPrice;
  }

  console.log(`[CoinDCX] Dispatching order: ${upperSide.toUpperCase()} ${formattedQuantity} ${marketSymbol} (precision: ${filters.targetPrecision}) @ ${formattedPrice || 'MARKET'}`);

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
        quantity: parseFloat(order.total_quantity || formattedQuantity),
        price: parseFloat(order.price_per_unit || formattedPrice) || null,
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
        quantity: parseFloat(data.total_quantity || formattedQuantity),
        price: parseFloat(data.price_per_unit || formattedPrice) || null,
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
  if (!symbol) {
    return {
      minNotional: 1,
      minAmount: 1,
      minTradeSize: 1,
      maxTradeSize: 100000,
      basePrecision: 4,
      targetPrecision: 0
    };
  }

  const clean = symbol.replace(/[-_]/g, '/').toUpperCase();
  const parts = clean.split('/');
  const baseAsset = (parts[0] || '').replace(/^[BI]-/, '') || clean;
  const quoteAsset = parts[1] || 'USDT';
  const marketSymbol = normalizeSymbol(symbol, 'market');
  const pairSymbol = normalizeSymbol(symbol, 'pair');

  const cached = symbolFiltersCache.get(marketSymbol) || 
                 symbolFiltersCache.get(pairSymbol) || 
                 symbolFiltersCache.get(clean) ||
                 symbolFiltersCache.get(`${baseAsset}/${quoteAsset}`);

  if (cached && Date.now() - cached.timestamp < FILTERS_CACHE_TTL) {
    return cached.filters;
  }

  try {
    const { data } = await axios.get(`${BASE_URL}/exchange/v1/markets_details`, {
      timeout: 10000
    });

    if (Array.isArray(data) && data.length > 0) {
      const now = Date.now();
      for (const m of data) {
        const mBase = (m.target_currency_short_name || '').toUpperCase();
        const mQuote = (m.base_currency_short_name || '').toUpperCase();
        const mPair = m.pair || '';
        const mSym = m.symbol || '';
        const mName = m.coindcx_name || '';

        const targetPrec = typeof m.target_currency_precision === 'number' 
          ? m.target_currency_precision 
          : (COINDCX_DEFAULT_PRECISIONS[mBase] !== undefined ? COINDCX_DEFAULT_PRECISIONS[mBase] : 1);
        
        const basePrec = typeof m.base_currency_precision === 'number'
          ? m.base_currency_precision
          : 4;

        const f = {
          minNotional: parseFloat(m.min_notional || 0),
          minAmount: parseFloat(m.min_quantity || 0),
          minTradeSize: parseFloat(m.min_quantity || 0),
          maxTradeSize: parseFloat(m.max_quantity || 0),
          step: parseFloat(m.step || (targetPrec === 0 ? 1 : Math.pow(10, -targetPrec))),
          minPrice: parseFloat(m.min_price || 0),
          maxPrice: parseFloat(m.max_price || 0),
          basePrecision: basePrec,
          targetPrecision: targetPrec
        };

        if (mSym) symbolFiltersCache.set(mSym.toUpperCase(), { filters: f, timestamp: now });
        if (mName) symbolFiltersCache.set(mName.toUpperCase(), { filters: f, timestamp: now });
        if (mPair) symbolFiltersCache.set(mPair.toUpperCase(), { filters: f, timestamp: now });
        if (mBase && mQuote) symbolFiltersCache.set(`${mBase}/${mQuote}`, { filters: f, timestamp: now });
      }

      const match = symbolFiltersCache.get(marketSymbol) || 
                    symbolFiltersCache.get(pairSymbol) || 
                    symbolFiltersCache.get(clean) ||
                    symbolFiltersCache.get(`${baseAsset}/${quoteAsset}`);

      if (match) {
        return match.filters;
      }
    }
  } catch (err) {
    console.warn(`[CoinDCX] getSymbolFilters API error: ${err.message}`);
  }

  // Fallback to COINDCX_DEFAULT_PRECISIONS dictionary
  const fallbackTargetPrecision = COINDCX_DEFAULT_PRECISIONS[baseAsset] !== undefined
    ? COINDCX_DEFAULT_PRECISIONS[baseAsset]
    : 1;

  const fallbackFilters = {
    minNotional: 1,
    minAmount: fallbackTargetPrecision === 0 ? 1 : 0.0001,
    minTradeSize: fallbackTargetPrecision === 0 ? 1 : 0.0001,
    maxTradeSize: 10000000,
    step: fallbackTargetPrecision === 0 ? 1 : 0.0001,
    basePrecision: 4,
    targetPrecision: fallbackTargetPrecision
  };

  symbolFiltersCache.set(marketSymbol, { filters: fallbackFilters, timestamp: Date.now() });
  return fallbackFilters;
}

export async function getPrecision(symbol) {
  const filters = await getSymbolFilters(symbol);
  return filters.targetPrecision;
}
