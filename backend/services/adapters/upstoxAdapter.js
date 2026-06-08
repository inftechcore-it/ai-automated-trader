import axios from 'axios';
import { gunzipSync } from 'zlib';
import { env } from '../../config/env.js';
import * as cache from '../cache.js';

const BASE_URL = 'https://api.upstox.com';
const INSTRUMENTS_URL = 'https://assets.upstox.com/market-quote/instruments/exchange';

let accessToken = null;
let tokenExpiry = null;
let instrumentsCache = { NSE: null, BSE: null, lastFetch: null };

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
  // Upstox OAuth URL format
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state
  });
  // Log for debugging
  console.log('[Upstox] Auth URL params:', {
    client_id: config.clientId,
    redirect_uri: config.redirectUri
  });
  return `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const config = getConfig();
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

  if (data.access_token) {
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in || 86400) * 1000;
    return { success: true, expiresIn: data.expires_in };
  }

  throw new Error(data.message || 'Failed to get access token');
}

export function setAccessToken(token, expiresInSeconds = 86400) {
  accessToken = token;
  tokenExpiry = Date.now() + expiresInSeconds * 1000;
}

export function getAccessToken() {
  return accessToken;
}

export function isAuthenticated() {
  return accessToken && (!tokenExpiry || Date.now() < tokenExpiry);
}

function getAuthHeaders() {
  if (!isAuthenticated()) {
    throw new Error('Upstox not authenticated. Please connect your Upstox account.');
  }
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json'
  };
}

function formatInstrumentKey(symbol, exchange) {
  const segment = exchange === 'BSE' ? 'BSE_EQ' : 'NSE_EQ';
  return `${segment}|${symbol}`;
}

async function loadInstruments(exchange) {
  const cacheKey = `upstox_instruments_${exchange}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `${INSTRUMENTS_URL}/${exchange}.json.gz`;
    const { data } = await axios.get(url, {
      timeout: 30000,
      responseType: 'arraybuffer'
    });

    const decompressed = gunzipSync(Buffer.from(data));
    const instruments = JSON.parse(decompressed.toString('utf-8'));

    if (!Array.isArray(instruments)) {
      throw new Error('Invalid instruments data');
    }

    cache.set(cacheKey, instruments, 6 * 60 * 60 * 1000); // 6 hour cache
    instrumentsCache[exchange] = instruments;
    instrumentsCache.lastFetch = Date.now();
    console.log(`[Upstox] Loaded ${instruments.length} ${exchange} instruments`);
    return instruments;
  } catch (err) {
    console.error(`[Upstox] Failed to load ${exchange} instruments:`, err.message);
    return instrumentsCache[exchange] || [];
  }
}

export async function searchSymbols(query, exchange = 'NSE') {
  const instruments = await loadInstruments(exchange);
  const needle = query.toLowerCase();

  // Filter for equity instruments
  // NSE uses 'EQ', BSE uses various codes like 'A', 'B', 'T', 'X', 'Z' for different groups
  const equityTypes = ['EQ', 'A', 'B', 'T', 'X', 'Z', 'XT', 'TS', 'E'];

  return instruments
    .filter(inst => {
      // Only equity segment
      if (!inst.segment?.includes('_EQ')) return false;
      // Check instrument type (NSE uses EQ, BSE uses group codes)
      if (exchange === 'NSE' && inst.instrument_type !== 'EQ') return false;
      // Exclude futures, options, index
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
      lotSize: inst.lot_size,
      tickSize: inst.tick_size
    }));
}

export async function getQuote(symbol, exchange = 'NSE') {
  if (!isAuthenticated()) {
    throw new Error('Upstox not authenticated');
  }

  const instruments = await loadInstruments(exchange);
  const instrument = instruments.find(i =>
    i.trading_symbol === symbol.toUpperCase() && i.instrument_type === 'EQ'
  );

  if (!instrument) {
    throw new Error(`Symbol ${symbol} not found on ${exchange}`);
  }

  const instrumentKey = encodeURIComponent(instrument.instrument_key);

  const { data } = await axios.get(
    `${BASE_URL}/v2/market-quote/quotes?instrument_key=${instrumentKey}`,
    {
      headers: getAuthHeaders(),
      timeout: 10000
    }
  );

  if (data.status !== 'success' || !data.data) {
    throw new Error(data.message || 'Failed to get quote');
  }

  const quoteData = Object.values(data.data)[0];
  if (!quoteData) {
    throw new Error('No quote data received');
  }

  const ohlc = quoteData.ohlc || {};
  const ltp = quoteData.last_price || ohlc.close || 0;
  const prevClose = ohlc.close || ltp;
  const change = ltp - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: symbol.toUpperCase(),
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
    currency: 'INR',
    timestamp: new Date().toISOString(),
    source: 'upstox'
  };
}

export async function getOHLCV(symbol, interval = '1d', limit = 100, exchange = 'NSE') {
  if (!isAuthenticated()) {
    throw new Error('Upstox not authenticated');
  }

  const instruments = await loadInstruments(exchange);
  const instrument = instruments.find(i =>
    i.trading_symbol === symbol.toUpperCase() && i.instrument_type === 'EQ'
  );

  if (!instrument) {
    throw new Error(`Symbol ${symbol} not found on ${exchange}`);
  }

  const instrumentKey = encodeURIComponent(instrument.instrument_key);

  const intervalMap = {
    '1m': '1minute',
    '5m': '1minute',
    '15m': '30minute',
    '30m': '30minute',
    '1h': '30minute',
    '4h': 'day',
    '1d': 'day',
    '1w': 'week',
    '1M': 'month'
  };

  const upstoxInterval = intervalMap[interval] || 'day';

  const toDate = new Date().toISOString().split('T')[0];
  const fromDate = new Date(Date.now() - limit * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data } = await axios.get(
    `${BASE_URL}/v2/historical-candle/${instrumentKey}/${upstoxInterval}/${toDate}/${fromDate}`,
    {
      headers: getAuthHeaders(),
      timeout: 15000
    }
  );

  if (data.status !== 'success' || !data.data?.candles) {
    throw new Error(data.message || 'Failed to get historical data');
  }

  return data.data.candles
    .slice(-limit)
    .map(([time, open, high, low, close, volume]) => ({
      time: new Date(time).toISOString(),
      open,
      high,
      low,
      close,
      volume
    }))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

export async function getIntradayOHLCV(symbol, interval = '1minute', exchange = 'NSE') {
  if (!isAuthenticated()) {
    throw new Error('Upstox not authenticated');
  }

  const instruments = await loadInstruments(exchange);
  const instrument = instruments.find(i =>
    i.trading_symbol === symbol.toUpperCase() && i.instrument_type === 'EQ'
  );

  if (!instrument) {
    throw new Error(`Symbol ${symbol} not found on ${exchange}`);
  }

  const instrumentKey = encodeURIComponent(instrument.instrument_key);

  const { data } = await axios.get(
    `${BASE_URL}/v2/historical-candle/intraday/${instrumentKey}/${interval}`,
    {
      headers: getAuthHeaders(),
      timeout: 10000
    }
  );

  if (data.status !== 'success' || !data.data?.candles) {
    throw new Error(data.message || 'Failed to get intraday data');
  }

  return data.data.candles.map(([time, open, high, low, close, volume]) => ({
    time: new Date(time).toISOString(),
    open,
    high,
    low,
    close,
    volume
  }));
}

export function supportsSymbol(symbol) {
  return !symbol.includes('/');
}
