/**
 * Quick test script to verify all endpoints work
 * Run: node test-endpoints.js
 */

const BASE_URL = 'http://localhost:5000';

async function test() {
  console.log('='.repeat(60));
  console.log('ENDPOINT TEST SCRIPT');
  console.log('='.repeat(60));

  // Test 1: Health check
  console.log('\n[TEST 1] Health Check...');
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    console.log('✓ Health:', data.success ? 'OK' : 'FAIL');
  } catch (e) {
    console.log('✗ Health check failed:', e.message);
    console.log('  → Is the backend running on port 5000?');
    process.exit(1);
  }

  // Test 2: Symbol search (no auth needed for this test)
  console.log('\n[TEST 2] Symbol Search (Binance BTC)...');
  try {
    // Import the search function directly
    const { searchSymbols } = await import('./services/exchangeService.js');
    const results = await searchSymbols('BTC', 'Binance');
    console.log(`✓ Found ${results.length} symbols`);
    if (results.length > 0) {
      console.log('  First result:', results[0].symbol);
    } else {
      console.log('  ✗ No results - check Binance API connection');
    }
  } catch (e) {
    console.log('✗ Search failed:', e.message);
  }

  // Test 3: Exchange connections
  console.log('\n[TEST 3] Connected Exchanges...');
  try {
    const { getConnectedExchanges } = await import('./services/exchangeService.js');
    const exchanges = getConnectedExchanges();
    console.log(`✓ ${exchanges.length} exchanges connected:`, exchanges.map(e => e.name).join(', '));
  } catch (e) {
    console.log('✗ Exchange check failed:', e.message);
  }

  // Test 4: Bot engine
  console.log('\n[TEST 4] Bot Engine...');
  try {
    const { initializeBotEngine } = await import('./dist/bots/index.js');
    const engine = await initializeBotEngine();
    console.log('✓ Bot engine initialized');
  } catch (e) {
    console.log('✗ Bot engine failed:', e.message);
    console.log('  → Run: npx tsc --project src/bots/tsconfig.json');
  }

  // Test 5: Database connection
  console.log('\n[TEST 5] Database...');
  try {
    const { query } = await import('./config/db.js');
    const [result] = await query('SELECT 1 as test');
    console.log('✓ Database connected');
  } catch (e) {
    console.log('✗ Database failed:', e.message);
  }

  // Test 6: Prisma
  console.log('\n[TEST 6] Prisma Client...');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    const count = await prisma.botConfig.count();
    console.log(`✓ Prisma connected, ${count} bots in database`);
    await prisma.$disconnect();
  } catch (e) {
    console.log('✗ Prisma failed:', e.message);
    console.log('  → Run: npx prisma generate && npx prisma db push');
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

test().catch(console.error);
