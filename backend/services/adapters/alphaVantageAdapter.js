import axios from 'axios';
import { env } from '../../config/env.js';

const BASE_URL = 'https://www.alphavantage.co/query';

function getApiKey() {
  const key = env.exchanges.alphaVantageApiKey;
  if (!key) {
    throw new Error('ALPHA_VANTAGE_API_KEY not configured');
  }
  return key;
}

export async function getQuote(symbol) {
  const { data } = await axios.get(BASE_URL, {
    params: {
      function: 'GLOBAL_QUOTE',
      symbol: symbol.toUpperCase(),
      apikey: getApiKey()
    },
    timeout: 10000
  });

  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }

  if (data['Note'] || data['Information']) {
    throw new Error('Alpha Vantage rate limit exceeded - try again later');
  }

  const quote = data['Global Quote'];
  if (!quote || !quote['05. price']) {
    throw new Error(`No data found for symbol: ${symbol}`);
  }

  const price = Number(quote['05. price']);
  const prevClose = Number(quote['08. previous close']);
  const change = Number(quote['09. change']);
  const changePercent = parseFloat(quote['10. change percent']);

  return {
    symbol: quote['01. symbol'],
    exchange: 'US Stock',
    price,
    change,
    changePercent,
    open: Number(quote['02. open']),
    high24h: Number(quote['03. high']),
    low24h: Number(quote['04. low']),
    volume24h: Number(quote['06. volume']),
    previousClose: prevClose,
    timestamp: new Date().toISOString()
  };
}

export async function getOHLCV(symbol, interval = '1h', limit = 100) {
  const avInterval = {
    '1m': '1min',
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1h': '60min'
  }[interval];

  let func = 'TIME_SERIES_INTRADAY';
  let seriesKey = `Time Series (${avInterval})`;

  if (!avInterval || interval === '1d') {
    func = 'TIME_SERIES_DAILY';
    seriesKey = 'Time Series (Daily)';
  }

  const params = {
    function: func,
    symbol: symbol.toUpperCase(),
    apikey: getApiKey(),
    outputsize: limit > 100 ? 'full' : 'compact'
  };

  if (avInterval) {
    params.interval = avInterval;
  }

  const { data } = await axios.get(BASE_URL, { params, timeout: 15000 });

  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }

  if (data['Note']) {
    throw new Error('Alpha Vantage rate limit exceeded');
  }

  const series = data[seriesKey];
  if (!series) {
    throw new Error(`No OHLCV data for ${symbol}`);
  }

  const candles = Object.entries(series)
    .map(([time, values]) => ({
      time: new Date(time).toISOString(),
      open: Number(values['1. open']),
      high: Number(values['2. high']),
      low: Number(values['3. low']),
      close: Number(values['4. close']),
      volume: Number(values['5. volume'])
    }))
    .sort((a, b) => new Date(a.time) - new Date(b.time))
    .slice(-limit);

  return candles;
}

export async function searchSymbols(query) {
  const { data } = await axios.get(BASE_URL, {
    params: {
      function: 'SYMBOL_SEARCH',
      keywords: query,
      apikey: getApiKey()
    },
    timeout: 10000
  });

  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }

  if (data['Note'] || data['Information']) {
    throw new Error('Alpha Vantage rate limit exceeded');
  }

  const matches = data.bestMatches || [];

  return matches
    .filter(m => ['NYSE', 'NASDAQ', 'NSE', 'BSE'].some(ex =>
      m['4. region']?.includes(ex) || m['3. type'] === 'Equity'
    ))
    .slice(0, 20)
    .map(m => ({
      symbol: m['1. symbol'],
      exchange: m['4. region'] || 'US Stock',
      name: m['2. name'],
      type: m['3. type'],
      currency: m['8. currency']
    }));
}

export function supportsSymbol(symbol) {
  return !symbol.includes('/');
}

export function isConfigured() {
  return !!env.exchanges.alphaVantageApiKey;
}
