export const quotes = [
  { symbol: 'BTC/USDT', exchange: 'Binance', price: 68250.12, change: 1.22 },
  { symbol: 'ETH/USDT', exchange: 'Binance', price: 3560.44, change: -1.17 },
  { symbol: 'AAPL', exchange: 'NASDAQ', price: 211.34, change: 1.0 },
  { symbol: 'INFY', exchange: 'NSE', price: 1498.5, change: 0.89 }
];

export const candles = Array.from({ length: 42 }, (_, index) => ({
  time: index,
  price: 120 + Math.sin(index / 3) * 12 + index * 0.8,
  volume: 800 + index * 25
}));

export const holdings = [
  { symbol: 'BTC/USDT', qty: 0.12, avg: 64000, price: 68250.12, mode: 'paper' },
  { symbol: 'AAPL', qty: 8, avg: 190.4, price: 211.34, mode: 'paper' },
  { symbol: 'INFY', qty: 12, avg: 1432, price: 1498.5, mode: 'live' }
];

export const orders = [
  { time: '10:42', symbol: 'BTC/USDT', exchange: 'Binance', side: 'buy', type: 'market', qty: 0.04, price: 68120, status: 'filled', mode: 'paper' },
  { time: '11:08', symbol: 'AAPL', exchange: 'NASDAQ', side: 'buy', type: 'limit', qty: 4, price: 209, status: 'pending', mode: 'paper' },
  { time: '12:14', symbol: 'ETH/USDT', exchange: 'Binance', side: 'sell', type: 'market', qty: 0.5, price: 3560, status: 'filled', mode: 'live' }
];
