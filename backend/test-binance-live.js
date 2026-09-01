/**
 * Test Binance Live Trading Connectivity
 * Run: node test-binance-live.js
 */
import dotenv from 'dotenv';
import ccxt from 'ccxt';

dotenv.config();

async function testBinance() {
  console.log('\n========== BINANCE LIVE TRADING TEST ==========\n');

  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  const useTestnet = process.env.USE_TESTNET === 'true';

  console.log('API Key:', apiKey ? `${apiKey.substring(0,8)}...` : 'NOT SET');
  console.log('API Secret:', apiSecret ? 'SET' : 'NOT SET');
  console.log('Using Testnet:', useTestnet);
  console.log('');

  if (!apiKey || !apiSecret) {
    console.error('ERROR: BINANCE_API_KEY and BINANCE_API_SECRET must be set in .env');
    process.exit(1);
  }

  const options = {
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    options: {
      defaultType: 'spot',
      adjustForTimeDifference: true,
    },
  };

  if (useTestnet) {
    options.urls = {
      api: {
        public: 'https://testnet.binance.vision',
        private: 'https://testnet.binance.vision',
      },
    };
  }

  const exchange = new ccxt.binance(options);

  if (useTestnet) {
    exchange.setSandboxMode(true);
  }

  try {
    // Test 1: Load Markets
    console.log('1. Loading markets...');
    await exchange.loadMarkets();
    console.log(`   ✓ Loaded ${Object.keys(exchange.markets).length} markets\n`);

    // Test 2: Check Balance
    console.log('2. Checking balance...');
    const balance = await exchange.fetchBalance();
    const nonZeroBalances = Object.entries(balance.total)
      .filter(([asset, amount]) => amount > 0)
      .map(([asset, amount]) => ({
        asset,
        total: amount,
        free: balance.free[asset] || 0,
        used: balance.used[asset] || 0,
      }));

    if (nonZeroBalances.length === 0) {
      console.log('   ⚠ No balances found (account may be empty)\n');
    } else {
      console.log('   ✓ Account balances:');
      nonZeroBalances.forEach(b => {
        console.log(`     ${b.asset}: ${b.total} (free: ${b.free}, locked: ${b.used})`);
      });
      console.log('');
    }

    // Test 3: Get Ticker
    console.log('3. Fetching ADA/USDT price...');
    const ticker = await exchange.fetchTicker('ADA/USDT');
    console.log(`   ✓ ADA/USDT: $${ticker.last} (bid: ${ticker.bid}, ask: ${ticker.ask})\n`);

    // Test 4: Check Open Orders
    console.log('4. Checking open orders...');
    const openOrders = await exchange.fetchOpenOrders('ADA/USDT');
    console.log(`   ✓ Open orders for ADA/USDT: ${openOrders.length}\n`);

    // Test 5: Trade History
    console.log('5. Fetching recent trades (last 5)...');
    try {
      const trades = await exchange.fetchMyTrades('ADA/USDT', undefined, 5);
      if (trades.length === 0) {
        console.log('   No recent trades found');
      } else {
        trades.forEach(t => {
          console.log(`   ${t.side.toUpperCase()} ${t.amount} @ ${t.price} (${new Date(t.timestamp).toLocaleString()})`);
        });
      }
    } catch (e) {
      console.log('   Could not fetch trade history:', e.message);
    }
    console.log('');

    // Summary
    console.log('========== RESULT ==========');
    console.log('✓ Binance API connection: WORKING');
    console.log('✓ Balance check: WORKING');
    console.log('✓ Market data: WORKING');
    console.log('✓ Order API access: WORKING');
    console.log('');

    // Check if account can trade
    const usdt = nonZeroBalances.find(b => b.asset === 'USDT');
    if (usdt && usdt.free > 10) {
      console.log(`Ready for live trading! USDT balance: ${usdt.free}`);
    } else {
      console.log(`⚠ USDT balance ${usdt?.free || 0} - Need at least 10 USDT for trading`);
    }

    // Final check for bot trading
    console.log('\n========== BOT TRADING STATUS ==========');
    console.log(`Mode: ${useTestnet ? 'TESTNET (paper)' : 'MAINNET (live)'}`);
    console.log(`API Keys: Valid`);
    console.log(`Ready for: ${useTestnet ? 'Paper Trading Only' : 'LIVE TRADING'}`);

  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    if (error.message.includes('Invalid API')) {
      console.error('  → Check your API key and secret in .env');
    }
    if (error.message.includes('IP')) {
      console.error('  → Your IP may not be whitelisted on Binance');
    }
    process.exit(1);
  }
}

testBinance();
