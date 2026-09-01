import ccxt from 'ccxt';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_API_SECRET;

console.log('=== Binance API Diagnostic ===');
console.log('API Key:', apiKey?.substring(0, 10) + '...');
console.log('USE_TESTNET env:', process.env.USE_TESTNET);
console.log('');

// Test 1: Production API (what your real keys are for)
console.log('--- Test 1: Production API ---');
try {
  const prodExchange = new ccxt.binance({
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
  });

  await prodExchange.loadMarkets();
  const balance = await prodExchange.fetchBalance();
  console.log('✓ Production API works!');
  console.log('USDT Balance:', balance.USDT?.free || 0);
} catch (error) {
  console.log('✗ Production API failed:', error.message);
}

console.log('');

// Test 2: Testnet API (what the adapter currently uses)
console.log('--- Test 2: Testnet API ---');
try {
  const testExchange = new ccxt.binance({
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    urls: {
      api: {
        public: 'https://testnet.binance.vision',
        private: 'https://testnet.binance.vision',
      },
    },
  });
  testExchange.setSandboxMode(true);

  await testExchange.loadMarkets();
  const balance = await testExchange.fetchBalance();
  console.log('✓ Testnet API works!');
  console.log('USDT Balance:', balance.USDT?.free || 0);
} catch (error) {
  console.log('✗ Testnet API failed:', error.message);
  console.log('');
  console.log('>>> This is expected! Your REAL API keys cannot work on testnet.');
}

console.log('');
console.log('=== SOLUTION ===');
console.log('Add to your .env file:');
console.log('USE_TESTNET=false');
console.log('');
console.log('This tells the adapter to use production Binance API instead of testnet.');
