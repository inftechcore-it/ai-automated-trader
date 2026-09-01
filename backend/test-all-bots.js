/**
 * Comprehensive Bot Strategy Test Suite
 * Tests all bot strategies in PAPER trading mode
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

// Generate a valid JWT token for testing
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_me';
const AUTH_TOKEN = jwt.sign(
  { id: 'test-user-123', email: 'test@example.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Generated test auth token');

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

// Use Binance for paper trading tests (mode: PAPER enables dryRun simulation)
const EXCHANGE = 'Binance';
const SYMBOL = 'DOGE/USDT';

// Test configurations for each bot type
const BOT_CONFIGS = [
  {
    name: 'Test Grid Bot',
    strategyType: 'GRID',
    exchangeName: EXCHANGE,
    symbol: SYMBOL,
    mode: 'PAPER',
    investedAmount: 100,
    params: {
      lowerPrice: 0.10,
      upperPrice: 0.15,
      gridCount: 10,
      totalInvestment: 100,
    },
  },
  {
    name: 'Test Infinity Grid Bot',
    strategyType: 'INFINITY_GRID',
    exchangeName: EXCHANGE,
    symbol: SYMBOL,
    mode: 'PAPER',
    investedAmount: 100,
    params: {
      lowerPrice: 0.10,
      gridSpacingPercent: 1.5,
      totalInvestment: 100,
    },
  },
  {
    name: 'Test DCA Bot',
    strategyType: 'DCA',
    exchangeName: EXCHANGE,
    symbol: SYMBOL,
    mode: 'PAPER',
    investedAmount: 100,
    params: {
      amountPerBuy: 10,
      interval: 'hourly',
      totalBudget: 100,
      takeProfitPercent: 10,
      stopLossPercent: 15,
    },
  },
  {
    name: 'Test Smart Trade Bot',
    strategyType: 'SMART_TRADE',
    exchangeName: EXCHANGE,
    symbol: SYMBOL,
    mode: 'PAPER',
    investedAmount: 50,
    params: {
      side: 'long',
      entryType: 'market',
      quantity: 50,
      takeProfitPercent: 5,
      stopLossPercent: 3,
    },
  },
  {
    name: 'Test Trailing Bot',
    strategyType: 'TRAILING',
    exchangeName: EXCHANGE,
    symbol: SYMBOL,
    mode: 'PAPER',
    investedAmount: 50,
    params: {
      side: 'trailing_sell',
      triggerPrice: 0.12,
      trailingPercent: 3,
      quantity: 100,
    },
  },
  {
    name: 'Test Martingale Bot',
    strategyType: 'MARTINGALE',
    exchangeName: EXCHANGE,
    symbol: SYMBOL,
    mode: 'PAPER',
    investedAmount: 250,
    params: {
      initialBuyAmount: 10,
      priceDropPercent: 5,
      takeProfitPercent: 5,
      maxSafetyOrders: 5,
      multiplier: 1.5,
      maxTotalInvestment: 250,
    },
  },
  {
    name: 'Test Rebalancing Bot',
    strategyType: 'REBALANCING',
    exchangeName: EXCHANGE,
    symbol: SYMBOL,
    mode: 'PAPER',
    investedAmount: 200,
    params: {
      allocations: [
        { symbol: 'BTC/USDT', targetPercent: 50 },
        { symbol: 'ETH/USDT', targetPercent: 50 },
      ],
      totalInvestment: 200,
      rebalanceThreshold: 5,
      rebalanceInterval: '24h',
    },
  },
  {
    name: 'Test Dynamic Grid Bot',
    strategyType: 'DYNAMIC_GRID',
    exchangeName: EXCHANGE,
    symbol: SYMBOL,
    mode: 'PAPER',
    investedAmount: 100,
    params: {
      coinSelectionMode: 'MANUAL',
      selectedSymbol: SYMBOL,
      priceRangeLow: 0.10,
      priceRangeHigh: 0.20,
      scanPoolSize: 5,
      maxBuysPerCoin: 3,
      totalInvestment: 100,
      gridCount: 10,
    },
  },
];

// Test results storage
const results = {
  passed: [],
  failed: [],
  errors: [],
};

async function makeRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

async function testBotStrategy(config) {
  const strategyName = config.strategyType;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${config.name} (${strategyName})`);
  console.log('='.repeat(60));

  let botId = null;

  try {
    // Step 1: Create bot
    console.log('\n1. Creating bot...');
    const createResult = await makeRequest('POST', '/bots/create', config);

    if (!createResult.ok) {
      throw new Error(`Failed to create bot: ${JSON.stringify(createResult.data)}`);
    }

    botId = createResult.data.bot?.id;
    console.log(`   ✓ Bot created with ID: ${botId}`);

    // Step 2: Verify bot exists
    console.log('\n2. Verifying bot exists...');
    const getResult = await makeRequest('GET', `/bots/${botId}`);

    if (!getResult.ok) {
      throw new Error(`Failed to get bot: ${JSON.stringify(getResult.data)}`);
    }

    console.log(`   ✓ Bot verified: status=${getResult.data.bot?.status}`);

    // Step 3: Start bot
    console.log('\n3. Starting bot...');
    const startResult = await makeRequest('POST', `/bots/${botId}/start`);

    if (!startResult.ok) {
      throw new Error(`Failed to start bot: ${JSON.stringify(startResult.data)}`);
    }

    console.log(`   ✓ Bot started: status=${startResult.data.bot?.status}`);

    // Step 4: Wait and check status
    console.log('\n4. Waiting for bot to process...');
    await sleep(3000);

    const statusResult = await makeRequest('GET', `/bots/${botId}`);
    if (!statusResult.ok) {
      throw new Error(`Failed to get bot status: ${JSON.stringify(statusResult.data)}`);
    }

    const stats = statusResult.data.bot;
    console.log(`   ✓ Bot status: ${stats?.status}`);
    console.log(`   ✓ Current value: $${stats?.currentValue?.toFixed?.(2) || stats?.currentValue}`);
    console.log(`   ✓ Open orders: ${stats?.openOrdersCount || 0}`);
    console.log(`   ✓ Tick count: ${stats?.tickCount || 0}`);

    // Step 5: Pause bot
    console.log('\n5. Pausing bot...');
    const pauseResult = await makeRequest('POST', `/bots/${botId}/pause`);

    if (!pauseResult.ok && !pauseResult.data?.message?.includes('only pause')) {
      console.log(`   ⚠ Pause result: ${JSON.stringify(pauseResult.data)}`);
    } else {
      console.log(`   ✓ Bot paused`);
    }

    // Step 6: Resume bot
    console.log('\n6. Resuming bot...');
    const resumeResult = await makeRequest('POST', `/bots/${botId}/resume`);

    if (!resumeResult.ok && !resumeResult.data?.message?.includes('only resume')) {
      console.log(`   ⚠ Resume result: ${JSON.stringify(resumeResult.data)}`);
    } else {
      console.log(`   ✓ Bot resumed`);
    }

    // Step 7: Get orders
    console.log('\n7. Getting bot orders...');
    const ordersResult = await makeRequest('GET', `/bots/${botId}/orders`);

    if (ordersResult.ok) {
      console.log(`   ✓ Orders retrieved: ${ordersResult.data.orders?.length || 0} orders`);
    }

    // Step 8: Stop bot
    console.log('\n8. Stopping bot...');
    const stopResult = await makeRequest('POST', `/bots/${botId}/stop`, { reason: 'Test completed' });

    if (!stopResult.ok) {
      console.log(`   ⚠ Stop result: ${JSON.stringify(stopResult.data)}`);
    } else {
      console.log(`   ✓ Bot stopped`);
    }

    // Step 9: Delete bot
    console.log('\n9. Cleaning up (deleting bot)...');
    const deleteResult = await makeRequest('DELETE', `/bots/${botId}`);

    if (deleteResult.ok) {
      console.log(`   ✓ Bot deleted`);
    }

    // Test passed
    console.log(`\n✅ ${strategyName} - ALL TESTS PASSED`);
    results.passed.push(strategyName);

  } catch (error) {
    console.error(`\n❌ ${strategyName} - TEST FAILED: ${error.message}`);
    results.failed.push({ strategy: strategyName, error: error.message });

    // Cleanup on failure
    if (botId) {
      try {
        await makeRequest('POST', `/bots/${botId}/stop`, { reason: 'Test failed' });
        await makeRequest('DELETE', `/bots/${botId}`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEngineStatus() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Bot Engine Status');
  console.log('='.repeat(60));

  const result = await makeRequest('GET', '/bots/engine/stats');

  if (result.ok && result.data.initialized) {
    console.log('✓ Bot Engine is initialized');
    console.log(`  Stats: ${JSON.stringify(result.data.stats, null, 2)}`);
    return true;
  } else {
    console.log('✗ Bot Engine not initialized');
    console.log(`  Response: ${JSON.stringify(result.data)}`);
    return false;
  }
}

async function testStrategiesEndpoint() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Strategies Endpoint');
  console.log('='.repeat(60));

  const result = await makeRequest('GET', '/bots/strategies');

  if (result.ok) {
    console.log('✓ Strategies endpoint working');
    console.log(`  Available strategies: ${result.data.strategies?.map(s => s.type).join(', ')}`);
    return true;
  } else {
    console.log('✗ Strategies endpoint failed');
    return false;
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          BOT STRATEGY COMPREHENSIVE TEST SUITE               ║');
  console.log('║                    Paper Trading Mode                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Check if server is running
  console.log('\nChecking server connection...');
  try {
    const health = await fetch(`${BASE_URL.replace('/api', '')}/health`);
    if (!health.ok) {
      console.error('❌ Server not responding. Make sure the backend is running on port 5000.');
      process.exit(1);
    }
    console.log('✓ Server is running');
  } catch (error) {
    console.error('❌ Cannot connect to server:', error.message);
    console.log('\nPlease start the server first:');
    console.log('  cd backend && node server.js');
    process.exit(1);
  }

  // Test engine status
  const engineOk = await testEngineStatus();
  if (!engineOk) {
    console.log('\n⚠ Engine not initialized, waiting...');
    await sleep(5000);
  }

  // Test strategies endpoint
  await testStrategiesEndpoint();

  // Test each bot strategy
  for (const config of BOT_CONFIGS) {
    await testBotStrategy(config);
    await sleep(1000); // Brief pause between tests
  }

  // Print summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  console.log(`\n✅ PASSED (${results.passed.length}/${BOT_CONFIGS.length}):`);
  results.passed.forEach(s => console.log(`   - ${s}`));

  if (results.failed.length > 0) {
    console.log(`\n❌ FAILED (${results.failed.length}/${BOT_CONFIGS.length}):`);
    results.failed.forEach(f => console.log(`   - ${f.strategy}: ${f.error}`));
  }

  console.log('\n' + '='.repeat(60));

  if (results.failed.length === 0) {
    console.log('🎉 ALL TESTS PASSED! All bot strategies are working correctly.');
  } else {
    console.log(`⚠ ${results.failed.length} test(s) failed. Please review the errors above.`);
  }

  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
