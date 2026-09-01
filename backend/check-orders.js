import ccxt from 'ccxt';
import dotenv from 'dotenv';
dotenv.config();

const exchange = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_API_SECRET,
  enableRateLimit: true,
});

console.log('Checking open orders on Binance...');
const orders = await exchange.fetchOpenOrders('DOGE/USDT');
console.log('Open orders:', orders.length);
orders.forEach(o => {
  console.log('- Order', o.id, o.side, o.amount, '@', o.price, 'status:', o.status);
});

if (orders.length === 0) {
  console.log('\nNo open orders. Checking recent trades...');
  const trades = await exchange.fetchMyTrades('DOGE/USDT', undefined, 5);
  if (trades.length > 0) {
    console.log('Recent trades:');
    trades.forEach(t => {
      console.log('-', new Date(t.timestamp).toLocaleString(), t.side, t.amount, '@', t.price);
    });
  } else {
    console.log('No recent trades found.');
  }
}
