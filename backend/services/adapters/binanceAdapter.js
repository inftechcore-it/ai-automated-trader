import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';

const BASE_URL = env.exchanges.binanceBaseUrl;

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

export async function validateCredentials(apiKey, apiSecret) {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = createSignature(queryString, apiSecret);

  const { data } = await axios.get(`${BASE_URL}/api/v3/account`, {
    params: { timestamp, signature },
    headers: { 'X-MBX-APIKEY': apiKey },
    timeout: 10000
  });

  return {
    valid: true,
    permissions: data.permissions || [],
    canTrade: data.canTrade,
    canWithdraw: data.canWithdraw
  };
}

export async function getBalances(apiKey, apiSecret) {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = createSignature(queryString, apiSecret);

  const { data } = await axios.get(`${BASE_URL}/api/v3/account`, {
    params: { timestamp, signature },
    headers: { 'X-MBX-APIKEY': apiKey },
    timeout: 10000
  });

  return data.balances
    .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
    .map(b => ({
      asset: b.asset,
      free: parseFloat(b.free),
      locked: parseFloat(b.locked),
      total: parseFloat(b.free) + parseFloat(b.locked)
    }));
}
