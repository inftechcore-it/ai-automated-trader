import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const BASE_URL = env.exchanges.krakenBaseUrl;

function createSignature(path, nonce, postData, apiSecret) {
  const message = nonce + postData;
  const hash = crypto.createHash('sha256').update(message).digest();
  const hmac = crypto.createHmac('sha512', Buffer.from(apiSecret, 'base64'));
  hmac.update(path);
  hmac.update(hash);
  return hmac.digest('base64');
}

const PAIR_MAP = {
  'BTC/USD': 'XXBTZUSD',
  'ETH/USD': 'XETHZUSD',
  'BTC/USDT': 'XBTUSDT',
  'ETH/USDT': 'ETHUSDT',
  'XRP/USD': 'XXRPZUSD',
  'SOL/USD': 'SOLUSD',
  'ADA/USD': 'ADAUSD',
  'DOT/USD': 'DOTUSD',
  'DOGE/USD': 'XDGUSD',
  'LTC/USD': 'XLTCZUSD'
};

const INTERVAL_MAP = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
  '1w': 10080
};

function toKrakenPair(symbol) {
  const upper = symbol.toUpperCase();
  if (PAIR_MAP[upper]) return PAIR_MAP[upper];
  return upper.replace('/', '');
}

function fromKrakenPair(krakenPair) {
  for (const [standard, kraken] of Object.entries(PAIR_MAP)) {
    if (kraken === krakenPair) return standard;
  }
  return krakenPair;
}

export async function getQuote(symbol) {
  const pair = toKrakenPair(symbol);
  const url = `${BASE_URL}/0/public/Ticker`;
  const { data } = await axios.get(url, {
    params: { pair },
    timeout: 5000
  });

  if (data.error && data.error.length > 0) {
    throw new Error(`Kraken API error: ${data.error.join(', ')}`);
  }

  const tickerKey = Object.keys(data.result)[0];
  const ticker = data.result[tickerKey];

  const lastPrice = Number(ticker.c[0]);
  const openPrice = Number(ticker.o);
  const change = lastPrice - openPrice;
  const changePercent = openPrice > 0 ? (change / openPrice) * 100 : 0;

  return {
    symbol,
    exchange: 'Kraken',
    price: lastPrice,
    change: Number(change.toFixed(8)),
    changePercent: Number(changePercent.toFixed(2)),
    high24h: Number(ticker.h[1]),
    low24h: Number(ticker.l[1]),
    volume24h: Number(ticker.v[1]),
    timestamp: new Date().toISOString()
  };
}

export async function getOHLCV(symbol, interval = '1h', limit = 100) {
  const pair = toKrakenPair(symbol);
  const krakenInterval = INTERVAL_MAP[interval] || 60;

  const url = `${BASE_URL}/0/public/OHLC`;
  const { data } = await axios.get(url, {
    params: { pair, interval: krakenInterval },
    timeout: 10000
  });

  if (data.error && data.error.length > 0) {
    throw new Error(`Kraken API error: ${data.error.join(', ')}`);
  }

  const ohlcKey = Object.keys(data.result).find(k => k !== 'last');
  const candles = data.result[ohlcKey] || [];

  return candles.slice(-limit).map(([time, open, high, low, close, vwap, volume]) => ({
    time: new Date(time * 1000).toISOString(),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number(volume)
  }));
}

export async function searchSymbols(query) {
  const url = `${BASE_URL}/0/public/AssetPairs`;
  const { data } = await axios.get(url, { timeout: 10000 });

  if (data.error && data.error.length > 0) {
    throw new Error(`Kraken API error: ${data.error.join(', ')}`);
  }

  const needle = query.toLowerCase();
  return Object.entries(data.result)
    .filter(([key, pair]) => {
      if (pair.status !== 'online') return false;
      const base = pair.base?.toLowerCase() || '';
      const quote = pair.quote?.toLowerCase() || '';
      return base.includes(needle) || quote.includes(needle) || key.toLowerCase().includes(needle);
    })
    .slice(0, 20)
    .map(([key, pair]) => ({
      symbol: `${pair.base}/${pair.quote}`,
      exchange: 'Kraken',
      name: pair.base,
      baseAsset: pair.base,
      quoteAsset: pair.quote
    }));
}

export function supportsSymbol(symbol) {
  const upper = symbol.toUpperCase();
  if (PAIR_MAP[upper]) return true;
  return upper.includes('/') && (upper.endsWith('USD') || upper.endsWith('USDT'));
}

export async function validateCredentials(apiKey, apiSecret) {
  const path = '/0/private/Balance';
  const nonce = Date.now() * 1000;
  const postData = `nonce=${nonce}`;
  const signature = createSignature(path, nonce, postData, apiSecret);

  const { data } = await axios.post(`${BASE_URL}${path}`, postData, {
    headers: {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: 10000
  });

  if (data.error && data.error.length > 0) {
    throw new Error(data.error.join(', '));
  }

  return {
    valid: true,
    permissions: ['balance', 'trade']
  };
}

export async function getBalances(apiKey, apiSecret) {
  const path = '/0/private/Balance';
  const nonce = Date.now() * 1000;
  const postData = `nonce=${nonce}`;
  const signature = createSignature(path, nonce, postData, apiSecret);

  const { data } = await axios.post(`${BASE_URL}${path}`, postData, {
    headers: {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: 10000
  });

  if (data.error && data.error.length > 0) {
    throw new Error(data.error.join(', '));
  }

  const balances = data.result || {};
  const ASSET_MAP = {
    'XXBT': 'BTC',
    'XETH': 'ETH',
    'ZUSD': 'USD',
    'ZEUR': 'EUR',
    'XXRP': 'XRP',
    'XXLM': 'XLM',
    'XLTC': 'LTC'
  };

  return Object.entries(balances)
    .filter(([, amount]) => parseFloat(amount) > 0)
    .map(([asset, amount]) => ({
      asset: ASSET_MAP[asset] || asset,
      free: parseFloat(amount),
      locked: 0,
      total: parseFloat(amount)
    }));
}
