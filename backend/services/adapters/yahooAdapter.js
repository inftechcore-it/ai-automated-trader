import axios from 'axios';

const BASE_URL = 'https://query1.finance.yahoo.com';

function getYahooSymbol(symbol, exchange) {
  const upper = symbol.toUpperCase();
  if (['NSE', 'BSE'].includes(exchange?.toUpperCase())) {
    const suffix = exchange.toUpperCase() === 'BSE' ? '.BO' : '.NS';
    return upper.endsWith('.NS') || upper.endsWith('.BO') ? upper : `${upper}${suffix}`;
  }
  return upper;
}

export async function getQuote(symbol, exchange = 'NSE') {
  const yahooSymbol = getYahooSymbol(symbol, exchange);

  const { data } = await axios.get(`${BASE_URL}/v8/finance/chart/${yahooSymbol}`, {
    params: { interval: '1d', range: '1d' },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 8000
  });

  const result = data.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data for ${symbol}`);
  }

  const meta = result.meta;
  const quote = result.indicators?.quote?.[0] || {};

  const price = meta.regularMarketPrice || quote.close?.[quote.close.length - 1] || 0;
  const prevClose = meta.chartPreviousClose || meta.previousClose || price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: symbol.toUpperCase(),
    exchange: exchange || meta.exchangeName,
    name: meta.shortName || meta.longName || symbol,
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    open: meta.regularMarketOpen || quote.open?.[0] || price,
    high24h: meta.regularMarketDayHigh || Math.max(...(quote.high || [price])),
    low24h: meta.regularMarketDayLow || Math.min(...(quote.low || [price])),
    volume24h: meta.regularMarketVolume || 0,
    previousClose: prevClose,
    currency: meta.currency || (['NSE', 'BSE'].includes(exchange?.toUpperCase()) ? 'INR' : 'USD'),
    timestamp: new Date().toISOString(),
    source: 'yahoo'
  };
}

export async function getOHLCV(symbol, interval = '1d', limit = 100, exchange = 'NSE') {
  const yahooSymbol = getYahooSymbol(symbol, exchange);

  const intervalMap = {
    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '4h': '1h', '1d': '1d', '1w': '1wk', '1M': '1mo'
  };

  const rangeMap = {
    '1m': '1d', '5m': '5d', '15m': '5d', '30m': '1mo',
    '1h': '1mo', '4h': '3mo', '1d': '1y', '1w': '2y', '1M': '5y'
  };

  const yahooInterval = intervalMap[interval] || '1d';
  const range = rangeMap[interval] || '1y';

  const { data } = await axios.get(`${BASE_URL}/v8/finance/chart/${yahooSymbol}`, {
    params: { interval: yahooInterval, range },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000
  });

  const result = data.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data for ${symbol}`);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  const candles = timestamps.map((ts, i) => ({
    time: new Date(ts * 1000).toISOString(),
    open: Number((quote.open?.[i] || 0).toFixed(2)),
    high: Number((quote.high?.[i] || 0).toFixed(2)),
    low: Number((quote.low?.[i] || 0).toFixed(2)),
    close: Number((quote.close?.[i] || 0).toFixed(2)),
    volume: quote.volume?.[i] || 0
  })).filter(c => c.open > 0);

  return candles.slice(-limit);
}

export async function searchSymbols(query, exchange = null) {
  const { data } = await axios.get('https://query2.finance.yahoo.com/v1/finance/search', {
    params: {
      q: query,
      quotesCount: 20,
      newsCount: 0,
      enableFuzzyQuery: true,
      quotesQueryId: 'tss_match_phrase_query'
    },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 5000
  });

  const quotes = data.quotes || [];

  return quotes
    .filter(q => {
      if (!exchange) return true;
      const ex = exchange.toUpperCase();
      if (ex === 'NSE') return q.exchange === 'NSI' || q.symbol?.endsWith('.NS');
      if (ex === 'BSE') return q.exchange === 'BOM' || q.symbol?.endsWith('.BO');
      if (ex === 'NASDAQ') return q.exchange === 'NMS' || q.exchange === 'NGM';
      if (ex === 'NYSE') return q.exchange === 'NYQ' || q.exchange === 'NYS';
      return true;
    })
    .slice(0, 15)
    .map(q => {
      let cleanSymbol = q.symbol;
      let detectedExchange = exchange;

      if (q.symbol?.endsWith('.NS')) {
        cleanSymbol = q.symbol.replace('.NS', '');
        detectedExchange = 'NSE';
      } else if (q.symbol?.endsWith('.BO')) {
        cleanSymbol = q.symbol.replace('.BO', '');
        detectedExchange = 'BSE';
      }

      return {
        symbol: cleanSymbol,
        exchange: detectedExchange || q.exchange,
        name: q.shortname || q.longname || cleanSymbol,
        type: q.quoteType
      };
    });
}

export function supportsSymbol() {
  return true;
}
