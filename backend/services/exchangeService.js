import axios from 'axios';
import { env } from '../config/env.js';

export const supportedExchanges = [
  { name: 'Binance', type: 'crypto', description: 'Crypto spot market data and trading' },
  { name: 'Kraken', type: 'crypto', description: 'Crypto market data and trading' },
  { name: 'Coinbase', type: 'crypto', description: 'Crypto brokerage market data' },
  { name: 'NASDAQ', type: 'stock', description: 'US technology-heavy stock exchange' },
  { name: 'NYSE', type: 'stock', description: 'US stock exchange' },
  { name: 'NSE', type: 'stock', description: 'National Stock Exchange of India' },
  { name: 'BSE', type: 'stock', description: 'Bombay Stock Exchange' }
];

const demoQuotes = {
  'BTC/USDT': { price: 68250.12, change: 820.31, changePercent: 1.22 },
  'ETH/USDT': { price: 3560.44, change: -42.18, changePercent: -1.17 },
  AAPL: { price: 211.34, change: 2.1, changePercent: 1.0 },
  INFY: { price: 1498.5, change: 13.25, changePercent: 0.89 }
};

function normalizeSymbol(symbol) {
  return symbol.replace('/', '').toUpperCase();
}

export async function getQuote(symbol, exchange = 'Binance') {
  if (exchange.toLowerCase() === 'binance' && symbol.includes('/')) {
    const url = `${env.exchanges.binanceBaseUrl}/api/v3/ticker/24hr`;
    const { data } = await axios.get(url, { params: { symbol: normalizeSymbol(symbol) }, timeout: 5000 });
    return {
      symbol,
      exchange,
      price: Number(data.lastPrice),
      change: Number(data.priceChange),
      changePercent: Number(data.priceChangePercent),
      timestamp: new Date().toISOString()
    };
  }

  const fallback = demoQuotes[symbol.toUpperCase()] || { price: 100, change: 0, changePercent: 0 };
  return { symbol, exchange, ...fallback, timestamp: new Date().toISOString(), source: 'demo' };
}

export async function getHistory(symbol, exchange, interval = '1h') {
  const now = Date.now();
  return Array.from({ length: 60 }, (_, index) => {
    const base = demoQuotes[symbol.toUpperCase()]?.price || 100;
    const wave = Math.sin(index / 4) * base * 0.015;
    const close = Number((base + wave + index * 0.07).toFixed(2));
    return {
      time: new Date(now - (59 - index) * 60 * 60 * 1000).toISOString(),
      open: Number((close * 0.995).toFixed(2)),
      high: Number((close * 1.01).toFixed(2)),
      low: Number((close * 0.99).toFixed(2)),
      close,
      volume: Math.round(1000 + index * 18)
    };
  });
}

export function searchSymbols(q = '') {
  const universe = [
    { symbol: 'BTC/USDT', exchange: 'Binance', name: 'Bitcoin' },
    { symbol: 'ETH/USDT', exchange: 'Binance', name: 'Ethereum' },
    { symbol: 'AAPL', exchange: 'NASDAQ', name: 'Apple Inc.' },
    { symbol: 'MSFT', exchange: 'NASDAQ', name: 'Microsoft Corp.' },
    { symbol: 'INFY', exchange: 'NSE', name: 'Infosys Ltd.' },
    { symbol: 'RELIANCE', exchange: 'NSE', name: 'Reliance Industries' }
  ];
  const needle = q.trim().toLowerCase();
  return universe.filter((item) =>
    [item.symbol, item.exchange, item.name].some((value) => value.toLowerCase().includes(needle))
  );
}

export async function placeLiveOrder() {
  const error = new Error('Live exchange order adapters are not enabled yet');
  error.status = 501;
  error.code = 'LIVE_TRADING_NOT_ENABLED';
  error.publicMessage = 'Live trading is not enabled yet';
  throw error;
}
