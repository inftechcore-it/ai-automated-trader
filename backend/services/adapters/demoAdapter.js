const DEMO_STOCKS = {
  // US Stocks (NASDAQ/NYSE)
  'AAPL': { name: 'Apple Inc.', exchange: 'NASDAQ', price: 211.34, sector: 'Technology' },
  'MSFT': { name: 'Microsoft Corp.', exchange: 'NASDAQ', price: 428.50, sector: 'Technology' },
  'GOOGL': { name: 'Alphabet Inc.', exchange: 'NASDAQ', price: 176.85, sector: 'Technology' },
  'AMZN': { name: 'Amazon.com Inc.', exchange: 'NASDAQ', price: 185.60, sector: 'Consumer' },
  'TSLA': { name: 'Tesla Inc.', exchange: 'NASDAQ', price: 248.20, sector: 'Automotive' },
  'META': { name: 'Meta Platforms Inc.', exchange: 'NASDAQ', price: 505.75, sector: 'Technology' },
  'NVDA': { name: 'NVIDIA Corp.', exchange: 'NASDAQ', price: 131.20, sector: 'Technology' },
  'JPM': { name: 'JPMorgan Chase & Co.', exchange: 'NYSE', price: 198.45, sector: 'Finance' },
  'V': { name: 'Visa Inc.', exchange: 'NYSE', price: 279.30, sector: 'Finance' },
  'JNJ': { name: 'Johnson & Johnson', exchange: 'NYSE', price: 147.80, sector: 'Healthcare' },
  'WMT': { name: 'Walmart Inc.', exchange: 'NYSE', price: 165.20, sector: 'Retail' },
  'PG': { name: 'Procter & Gamble Co.', exchange: 'NYSE', price: 168.90, sector: 'Consumer' },
  'DIS': { name: 'Walt Disney Co.', exchange: 'NYSE', price: 102.55, sector: 'Entertainment' },
  'NFLX': { name: 'Netflix Inc.', exchange: 'NASDAQ', price: 628.40, sector: 'Entertainment' },
  'AMD': { name: 'Advanced Micro Devices', exchange: 'NASDAQ', price: 164.80, sector: 'Technology' },
  'INTC': { name: 'Intel Corp.', exchange: 'NASDAQ', price: 31.25, sector: 'Technology' },
  'CRM': { name: 'Salesforce Inc.', exchange: 'NYSE', price: 272.60, sector: 'Technology' },
  'ORCL': { name: 'Oracle Corp.', exchange: 'NYSE', price: 140.15, sector: 'Technology' },
  'CSCO': { name: 'Cisco Systems Inc.', exchange: 'NASDAQ', price: 46.80, sector: 'Technology' },
  'ADBE': { name: 'Adobe Inc.', exchange: 'NASDAQ', price: 478.30, sector: 'Technology' },

  // Indian Stocks (NSE/BSE)
  'INFY': { name: 'Infosys Ltd.', exchange: 'NSE', price: 1498.50, sector: 'Technology', currency: 'INR' },
  'RELIANCE': { name: 'Reliance Industries', exchange: 'NSE', price: 2890.00, sector: 'Energy', currency: 'INR' },
  'TCS': { name: 'Tata Consultancy Services', exchange: 'NSE', price: 3725.40, sector: 'Technology', currency: 'INR' },
  'HDFC': { name: 'HDFC Bank Ltd.', exchange: 'NSE', price: 1642.30, sector: 'Finance', currency: 'INR' },
  'ICICIBANK': { name: 'ICICI Bank Ltd.', exchange: 'NSE', price: 1124.50, sector: 'Finance', currency: 'INR' },
  'HCLTECH': { name: 'HCL Technologies', exchange: 'NSE', price: 1456.80, sector: 'Technology', currency: 'INR' },
  'WIPRO': { name: 'Wipro Ltd.', exchange: 'NSE', price: 478.25, sector: 'Technology', currency: 'INR' },
  'SBIN': { name: 'State Bank of India', exchange: 'NSE', price: 825.60, sector: 'Finance', currency: 'INR' },
  'BHARTIARTL': { name: 'Bharti Airtel Ltd.', exchange: 'NSE', price: 1542.30, sector: 'Telecom', currency: 'INR' },
  'ITC': { name: 'ITC Ltd.', exchange: 'NSE', price: 438.75, sector: 'Consumer', currency: 'INR' },
  'TATAMOTORS': { name: 'Tata Motors Ltd.', exchange: 'NSE', price: 952.40, sector: 'Automotive', currency: 'INR' },
  'MARUTI': { name: 'Maruti Suzuki India', exchange: 'NSE', price: 12450.00, sector: 'Automotive', currency: 'INR' },
  'SUNPHARMA': { name: 'Sun Pharmaceutical', exchange: 'NSE', price: 1628.50, sector: 'Healthcare', currency: 'INR' },
  'KOTAKBANK': { name: 'Kotak Mahindra Bank', exchange: 'NSE', price: 1845.20, sector: 'Finance', currency: 'INR' },
  'AXISBANK': { name: 'Axis Bank Ltd.', exchange: 'NSE', price: 1156.80, sector: 'Finance', currency: 'INR' },
  'BAJFINANCE': { name: 'Bajaj Finance Ltd.', exchange: 'NSE', price: 6842.50, sector: 'Finance', currency: 'INR' },
  'ADANIENT': { name: 'Adani Enterprises', exchange: 'NSE', price: 2456.30, sector: 'Conglomerate', currency: 'INR' },
  'TATASTEEL': { name: 'Tata Steel Ltd.', exchange: 'NSE', price: 142.85, sector: 'Metals', currency: 'INR' },
  'POWERGRID': { name: 'Power Grid Corp.', exchange: 'NSE', price: 312.45, sector: 'Utilities', currency: 'INR' },
  'NTPC': { name: 'NTPC Ltd.', exchange: 'NSE', price: 365.20, sector: 'Utilities', currency: 'INR' }
};

function getRandomChange(basePrice) {
  const changePercent = (Math.random() - 0.5) * 4;
  const change = basePrice * (changePercent / 100);
  return { change: Number(change.toFixed(2)), changePercent: Number(changePercent.toFixed(2)) };
}

export async function getQuote(symbol, exchange = 'NASDAQ') {
  const upper = symbol.toUpperCase();
  const stock = DEMO_STOCKS[upper];

  if (!stock) {
    return {
      symbol,
      exchange,
      price: 100,
      change: 0,
      changePercent: 0,
      open: 100,
      high24h: 102,
      low24h: 98,
      volume24h: 1000000,
      timestamp: new Date().toISOString(),
      source: 'demo'
    };
  }

  const { change, changePercent } = getRandomChange(stock.price);
  const price = stock.price + change;

  return {
    symbol: upper,
    exchange: stock.exchange,
    name: stock.name,
    price: Number(price.toFixed(2)),
    change,
    changePercent,
    open: Number((stock.price * 0.998).toFixed(2)),
    high24h: Number((price * 1.015).toFixed(2)),
    low24h: Number((price * 0.985).toFixed(2)),
    volume24h: Math.floor(Math.random() * 50000000) + 5000000,
    previousClose: stock.price,
    sector: stock.sector,
    currency: stock.currency || 'USD',
    timestamp: new Date().toISOString(),
    source: 'demo'
  };
}

export async function getOHLCV(symbol, interval = '1h', limit = 100) {
  const upper = symbol.toUpperCase();
  const stock = DEMO_STOCKS[upper];
  const basePrice = stock?.price || 100;
  const now = Date.now();

  const intervalMs = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  }[interval] || 60 * 60 * 1000;

  const candles = [];
  let prevClose = basePrice * 0.95;

  for (let i = 0; i < limit; i++) {
    const trend = (i / limit) * basePrice * 0.08;
    const wave = Math.sin(i / 6) * basePrice * 0.015;
    const noise = (Math.random() - 0.5) * basePrice * 0.02;

    const open = prevClose;
    const close = Number((basePrice * 0.95 + trend + wave + noise).toFixed(2));
    const high = Number((Math.max(open, close) + Math.random() * basePrice * 0.01).toFixed(2));
    const low = Number((Math.min(open, close) - Math.random() * basePrice * 0.01).toFixed(2));

    candles.push({
      time: new Date(now - (limit - 1 - i) * intervalMs).toISOString(),
      open,
      high,
      low,
      close,
      volume: Math.floor(500000 + Math.random() * 2000000)
    });

    prevClose = close;
  }

  return candles;
}

export async function searchSymbols(query, filterExchange = null) {
  const needle = query.toLowerCase();

  return Object.entries(DEMO_STOCKS)
    .filter(([symbol, stock]) => {
      if (filterExchange && stock.exchange !== filterExchange) return false;
      return (
        symbol.toLowerCase().includes(needle) ||
        stock.name.toLowerCase().includes(needle) ||
        stock.sector?.toLowerCase().includes(needle)
      );
    })
    .slice(0, 20)
    .map(([symbol, stock]) => ({
      symbol,
      exchange: stock.exchange,
      name: stock.name,
      sector: stock.sector,
      currency: stock.currency || 'USD'
    }));
}

export function supportsSymbol() {
  return true;
}
