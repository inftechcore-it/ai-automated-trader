import ccxt from 'ccxt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const exchange = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_API_SECRET,
  enableRateLimit: true,
  timeout: 30000,
  options: {
    defaultType: 'spot',
    fetchMarkets: ['spot'],  // Only load spot markets
  },
});

console.log('=== Test Live Order Capability ===');
console.log('');

// Load markets first
await exchange.loadMarkets();

// Get PEPE price
const ticker = await exchange.fetchTicker('PEPE/USDT');
console.log('PEPE/USDT current price:', ticker.last);

// Check minimum order requirements
const market = exchange.markets['PEPE/USDT'];
console.log('Min order amount:', market.limits.amount?.min || 'N/A');
console.log('Min order cost:', market.limits.cost?.min || 'N/A', 'USDT');
console.log('');

// Calculate a small test order
const testQuantity = 1000000; // 1M PEPE
const orderCost = testQuantity * ticker.last;
console.log('Test order: BUY', testQuantity, 'PEPE');
console.log('Order cost:', orderCost.toFixed(2), 'USDT');
console.log('');

// Check balance
const balance = await exchange.fetchBalance();
const usdtFree = balance.USDT?.free || 0;
console.log('Available USDT:', usdtFree);

if (orderCost > usdtFree) {
  console.log('⚠ Not enough USDT for test order');
  process.exit(0);
}

console.log('');
console.log('Placing LIMIT BUY order at', (ticker.last * 0.95).toFixed(8), '(5% below market)...');

try {
  const order = await exchange.createOrder(
    'PEPE/USDT',
    'limit',
    'buy',
    testQuantity,
    ticker.last * 0.95  // 5% below market - won't fill immediately
  );

  console.log('');
  console.log('✓ ORDER PLACED SUCCESSFULLY!');
  console.log('Order ID:', order.id);
  console.log('Status:', order.status);
  console.log('');

  // Cancel it immediately since this is just a test
  console.log('Cancelling test order...');
  await exchange.cancelOrder(order.id, 'PEPE/USDT');
  console.log('✓ Order cancelled');
  console.log('');
  console.log('=== LIVE TRADING IS WORKING ===');

} catch (error) {
  console.log('');
  console.log('✗ Order failed:', error.message);
}
