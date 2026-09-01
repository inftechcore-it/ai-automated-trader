/**
 * Live Trading Configuration Verification
 * Checks that all required settings are in place for live trading
 * Does NOT execute any actual trades
 */

import dotenv from 'dotenv';
dotenv.config();

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║           LIVE TRADING CONFIGURATION CHECK                   ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const results = [];

// 1. Check environment variables
console.log('1. Checking Environment Variables...\n');

const requiredEnvVars = [
  { name: 'BINANCE_API_KEY', sensitive: true },
  { name: 'BINANCE_API_SECRET', sensitive: true },
  { name: 'USE_TESTNET', expected: 'false' },
  { name: 'DATABASE_URL', sensitive: true },
];

for (const env of requiredEnvVars) {
  const value = process.env[env.name];
  const exists = !!value && value.length > 0;
  const display = env.sensitive ? (exists ? '***configured***' : 'NOT SET') : value;
  const pass = env.expected ? value === env.expected : exists;

  console.log(`   ${pass ? '✓' : '✗'} ${env.name}: ${display}`);
  results.push({ name: env.name, passed: pass });
}

// 2. Check Binance adapter connection
console.log('\n2. Testing Binance API Connection...\n');

async function testBinanceConnection() {
  try {
    const { getAdapter } = await import('./arbitrage/dist/adapters/index.js');
    const adapter = await getAdapter('binance');

    // Test public API
    const ticker = await adapter.getTicker('DOGE/USDT');
    console.log(`   ✓ Public API: DOGE/USDT price = $${ticker.last?.toFixed(5)}`);
    results.push({ name: 'Binance Public API', passed: true });

    // Test authenticated API (get balance)
    try {
      const balances = await adapter.getBalance();
      const usdtBalance = balances.find(b => b.asset === 'USDT');
      console.log(`   ✓ Private API: USDT balance = $${usdtBalance?.free?.toFixed(2) || '0.00'}`);
      results.push({ name: 'Binance Private API', passed: true });
    } catch (authError) {
      console.log(`   ✗ Private API: ${authError.message}`);
      results.push({ name: 'Binance Private API', passed: false });
    }

    // Check testnet setting
    console.log(`   ${adapter.isTestnet ? '⚠' : '✓'} Testnet mode: ${adapter.isTestnet ? 'ENABLED (not live)' : 'DISABLED (live)'}`);
    results.push({ name: 'Live Mode (not testnet)', passed: !adapter.isTestnet });

  } catch (error) {
    console.log(`   ✗ Binance connection failed: ${error.message}`);
    results.push({ name: 'Binance Connection', passed: false });
  }
}

// 3. Check database connection
async function testDatabase() {
  console.log('\n3. Testing Database Connection...\n');

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Test connection
    await prisma.$connect();
    console.log('   ✓ Database connected');

    // Check bot tables exist
    const botCount = await prisma.botConfig.count();
    console.log(`   ✓ BotConfig table exists (${botCount} bots)`);

    const orderCount = await prisma.botOrder.count();
    console.log(`   ✓ BotOrder table exists (${orderCount} orders)`);

    await prisma.$disconnect();
    results.push({ name: 'Database Connection', passed: true });

  } catch (error) {
    console.log(`   ✗ Database error: ${error.message}`);
    results.push({ name: 'Database Connection', passed: false });
  }
}

// 4. Verify bot code compiles correctly
async function testBotCode() {
  console.log('\n4. Verifying Bot Strategies...\n');

  try {
    const strategies = [
      'GridBot', 'InfinityGridBot', 'DCABot', 'SmartTradeBot',
      'TrailingBot', 'MartingaleBot', 'RebalancingBot', 'DynamicGridBot'
    ];

    for (const name of strategies) {
      try {
        const module = await import(`./dist/bots/strategies/${name}.js`);
        const StrategyClass = module[name];
        const instance = new StrategyClass();
        console.log(`   ✓ ${name} loaded successfully`);
      } catch (err) {
        console.log(`   ✗ ${name} failed: ${err.message}`);
        results.push({ name: `Strategy: ${name}`, passed: false });
      }
    }
    results.push({ name: 'All Strategies Load', passed: true });

  } catch (error) {
    console.log(`   ✗ Strategy loading error: ${error.message}`);
    results.push({ name: 'Strategy Loading', passed: false });
  }
}

// 5. Summary
async function printSummary() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      CONFIGURATION SUMMARY                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const r of results) {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Results: ${passed}/${results.length} checks passed`);

  if (failed === 0) {
    console.log('\n✅ LIVE TRADING CONFIGURATION IS READY!');
    console.log('\n⚠️  IMPORTANT REMINDERS FOR LIVE TRADING:');
    console.log('   • Start with small amounts to test');
    console.log('   • Monitor bot activity closely');
    console.log('   • Set appropriate stop-loss levels');
    console.log('   • Ensure sufficient balance for all grid orders');
  } else {
    console.log('\n❌ SOME CONFIGURATION ISSUES NEED TO BE FIXED');
    console.log('   Please review the failed checks above before live trading.');
  }

  console.log('');
}

// Run all checks
async function runAllChecks() {
  await testBinanceConnection();
  await testDatabase();
  await testBotCode();
  await printSummary();
}

runAllChecks().catch(console.error);
