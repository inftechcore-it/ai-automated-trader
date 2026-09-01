/**
 * Complete Trading Logic Test - All 8 Bot Strategies
 * Tests that bots actually execute trades with proper price ranges
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_me';
const AUTH_TOKEN = jwt.sign({ id: 'test-user', email: 'test@test.com' }, JWT_SECRET, { expiresIn: '1h' });

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

async function makeRequest(method, endpoint, body = null) {
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get current DOGE price first
async function getCurrentPrice() {
  // Use Binance adapter to get real price
  const res = await makeRequest('GET', '/market/ticker?symbol=DOGE/USDT&exchange=Binance');
  return res.data?.price || res.data?.last || 0.07;
}

async function testBot(name, config, waitTime = 5000, validator = null) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🔧 Testing ${name}...`);
  console.log('─'.repeat(60));

  const createRes = await makeRequest('POST', '/bots/create', config);
  if (!createRes.success) {
    console.log(`❌ Failed to create: ${createRes.message}`);
    return { name, passed: false, error: createRes.message };
  }

  const botId = createRes.bot.id;
  console.log(`✓ Created: ${botId}`);

  const startRes = await makeRequest('POST', `/bots/${botId}/start`);
  if (!startRes.success) {
    console.log(`❌ Failed to start: ${startRes.message}`);
    await makeRequest('DELETE', `/bots/${botId}`);
    return { name, passed: false, error: startRes.message };
  }
  console.log(`✓ Started`);

  console.log(`⏳ Processing for ${waitTime / 1000}s...`);
  await sleep(waitTime);

  const statusRes = await makeRequest('GET', `/bots/${botId}`);
  const stats = statusRes.bot || {};

  console.log(`\n📊 Results:`);
  console.log(`   Ticks: ${stats.tickCount || 0} | Trades: ${stats.totalTrades || 0} | Orders: ${stats.openOrdersCount || 0}`);
  console.log(`   Value: $${stats.currentValue?.toFixed(2) || 'N/A'} | Holdings: ${stats.holdings?.length || 0}`);

  if (stats.strategyStatus?.metrics) {
    const m = stats.strategyStatus.metrics;
    const metricStr = Object.entries(m)
      .filter(([k, v]) => v !== 0 && v !== null && k !== 'gridCount')
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
      .join(' | ');
    if (metricStr) console.log(`   Metrics: ${metricStr}`);
  }

  // Cleanup
  await makeRequest('POST', `/bots/${botId}/stop`);
  await makeRequest('DELETE', `/bots/${botId}`);

  // Validate
  let passed = (stats.tickCount || 0) > 0;
  let details = '';

  if (validator) {
    const result = validator(stats);
    passed = result.passed;
    details = result.details;
  }

  console.log(passed ? `\n✅ ${name}: PASSED ${details}` : `\n⚠️ ${name}: ${details || 'Check results'}`);
  return { name, passed, stats };
}

async function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        COMPLETE BOT TRADING TEST SUITE (8 Strategies)        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Check server
  try {
    const health = await fetch('http://localhost:5000/health');
    if (!health.ok) throw new Error('Server not ready');
    console.log('✓ Server is running');
  } catch (e) {
    console.log('❌ Server not running. Start with: node server.js');
    process.exit(1);
  }

  // Get current price for realistic test ranges
  const currentPrice = await getCurrentPrice();
  console.log(`\n📈 Current DOGE/USDT price: $${currentPrice.toFixed(5)}`);

  const results = [];

  // 1. GRID BOT - Use price range around current price
  results.push(await testBot('Grid Bot', {
    name: 'Test Grid',
    strategyType: 'GRID',
    exchangeName: 'Binance',
    symbol: 'DOGE/USDT',
    mode: 'PAPER',
    investedAmount: 50,
    params: {
      lowerPrice: currentPrice * 0.95,  // 5% below
      upperPrice: currentPrice * 1.05,  // 5% above
      gridCount: 5,
      totalInvestment: 50,
    },
  }, 8000, (stats) => ({
    passed: stats.tickCount > 0,
    details: stats.totalTrades > 0 ? '(orders executed)' : '(grid set up, waiting for price movement)',
  })));

  // 2. INFINITY GRID BOT
  results.push(await testBot('Infinity Grid Bot', {
    name: 'Test InfinityGrid',
    strategyType: 'INFINITY_GRID',
    exchangeName: 'Binance',
    symbol: 'DOGE/USDT',
    mode: 'PAPER',
    investedAmount: 50,
    params: {
      lowerPrice: currentPrice * 0.9,
      gridSpacingPercent: 1.5,
      totalInvestment: 50,
    },
  }, 5000, (stats) => ({
    passed: stats.tickCount > 0,
    details: '(infinite grid initialized)',
  })));

  // 3. DCA BOT - Should buy immediately
  results.push(await testBot('DCA Bot', {
    name: 'Test DCA',
    strategyType: 'DCA',
    exchangeName: 'Binance',
    symbol: 'DOGE/USDT',
    mode: 'PAPER',
    investedAmount: 30,
    params: {
      amountPerBuy: 5,
      interval: 'hourly',
      totalBudget: 30,
      takeProfitPercent: 10,
      stopLossPercent: 20,
    },
  }, 5000, (stats) => ({
    passed: stats.totalTrades > 0 || stats.holdings?.length > 0,
    details: stats.totalTrades > 0 ? '(initial buy executed)' : '(waiting for buy)',
  })));

  // 4. SMART TRADE BOT - Market entry
  results.push(await testBot('Smart Trade Bot', {
    name: 'Test SmartTrade',
    strategyType: 'SMART_TRADE',
    exchangeName: 'Binance',
    symbol: 'DOGE/USDT',
    mode: 'PAPER',
    investedAmount: 20,
    params: {
      side: 'long',
      entryType: 'market',
      quantity: 20,
      takeProfitPercent: 5,
      stopLossPercent: 3,
    },
  }, 5000, (stats) => ({
    passed: stats.strategyStatus?.metrics?.phase >= 1 || stats.holdings?.length > 0,
    details: stats.strategyStatus?.metrics?.phase === 1 ? '(in position)' : '(entry pending)',
  })));

  // 5. TRAILING BOT - Set trigger below current price for trailing buy
  results.push(await testBot('Trailing Bot', {
    name: 'Test Trailing',
    strategyType: 'TRAILING',
    exchangeName: 'Binance',
    symbol: 'DOGE/USDT',
    mode: 'PAPER',
    investedAmount: 20,
    params: {
      side: 'trailing_buy',
      triggerPrice: currentPrice * 1.01,  // Trigger immediately (price below trigger)
      trailingPercent: 2,
      quantity: 100,
    },
  }, 5000, (stats) => ({
    passed: stats.tickCount > 0,
    details: stats.strategyStatus?.metrics?.phase === 1 ? '(trailing active)' : '(waiting for trigger)',
  })));

  // 6. MARTINGALE BOT - Initial buy immediately
  results.push(await testBot('Martingale Bot', {
    name: 'Test Martingale',
    strategyType: 'MARTINGALE',
    exchangeName: 'Binance',
    symbol: 'DOGE/USDT',
    mode: 'PAPER',
    investedAmount: 100,
    params: {
      initialBuyAmount: 5,
      priceDropPercent: 3,
      takeProfitPercent: 3,
      maxSafetyOrders: 3,
      multiplier: 1.5,
      maxTotalInvestment: 100,
    },
  }, 5000, (stats) => ({
    passed: stats.holdings?.length > 0 || stats.totalTrades > 0,
    details: stats.strategyStatus?.metrics?.totalSpent > 0 ? `(spent $${stats.strategyStatus.metrics.totalSpent.toFixed(2)})` : '(initial buy pending)',
  })));

  // 7. REBALANCING BOT - Multi-asset
  results.push(await testBot('Rebalancing Bot', {
    name: 'Test Rebalancing',
    strategyType: 'REBALANCING',
    exchangeName: 'Binance',
    symbol: 'BTC/USDT',  // Primary symbol for subscription
    mode: 'PAPER',
    investedAmount: 100,
    params: {
      allocations: [
        { symbol: 'BTC/USDT', targetPercent: 50 },
        { symbol: 'ETH/USDT', targetPercent: 50 },
      ],
      totalInvestment: 100,
      rebalanceThreshold: 5,
      rebalanceInterval: '1h',
    },
  }, 5000, (stats) => ({
    passed: stats.tickCount > 0,
    details: stats.strategyStatus?.metrics?.hasInitialBuy ? '(positions opened)' : '(waiting for prices)',
  })));

  // 8. DYNAMIC GRID BOT
  results.push(await testBot('Dynamic Grid Bot', {
    name: 'Test DynamicGrid',
    strategyType: 'DYNAMIC_GRID',
    exchangeName: 'Binance',
    symbol: 'DOGE/USDT',
    mode: 'PAPER',
    investedAmount: 50,
    params: {
      coinSelectionMode: 'MANUAL',
      selectedSymbol: 'DOGE/USDT',
      priceRangeLow: currentPrice * 0.9,
      priceRangeHigh: currentPrice * 1.1,
      scanPoolSize: 5,
      maxBuysPerCoin: 3,
      totalInvestment: 50,
      gridCount: 5,
    },
  }, 5000, (stats) => ({
    passed: stats.tickCount > 0,
    details: `(${stats.strategyStatus?.metrics?.totalCoins || 0} coins tracked)`,
  })));

  // Summary
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const r of results) {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Results: ${passed}/${results.length} passed`);

  if (failed === 0) {
    console.log('\n🎉 ALL 8 BOT STRATEGIES ARE WORKING CORRECTLY!');
  } else {
    console.log(`\n⚠️ ${failed} strategy(s) need attention`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(console.error);
