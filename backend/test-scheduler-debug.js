/**
 * Test BotScheduler price feed
 */
import dotenv from 'dotenv';
dotenv.config();

async function testScheduler() {
  console.log('\n========== SCHEDULER DEBUG ==========\n');

  try {
    // 1. Test adapter import
    console.log('1. Testing adapter import...');
    const { getAdapter } = await import('./arbitrage/dist/adapters/index.js');
    console.log('   ✓ Adapter factory imported\n');

    // 2. Test binance adapter
    console.log('2. Getting Binance adapter...');
    const adapter = await getAdapter('binance');
    console.log('   ✓ Binance adapter initialized\n');

    // 3. Test getTicker
    console.log('3. Testing getTicker for DOGE/USDT...');
    const ticker = await adapter.getTicker('DOGE/USDT');
    console.log('   ✓ Got ticker:', {
      symbol: 'DOGE/USDT',
      last: ticker.last,
      bid: ticker.bid,
      ask: ticker.ask,
    });
    console.log('');

    // 4. Test BotScheduler
    console.log('4. Testing BotScheduler...');
    const { getBotScheduler } = await import('./dist/bots/BotScheduler.js');
    const scheduler = getBotScheduler();
    await scheduler.start();
    console.log('   ✓ BotScheduler started\n');

    // 5. Subscribe to a price feed
    console.log('5. Subscribing to DOGE/USDT price feed...');
    let tickCount = 0;

    await scheduler.subscribe(
      'test-bot-123',
      'binance',
      'DOGE/USDT',
      (tick) => {
        tickCount++;
        console.log(`   [TICK ${tickCount}] Price: $${tick.price?.toFixed(6)}`);
      }
    );
    console.log('   ✓ Subscribed\n');

    console.log('6. Waiting 10 seconds for price ticks...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log(`\n========== RESULT ==========`);
    console.log(`Ticks received: ${tickCount}`);
    console.log(`Scheduler stats:`, scheduler.getStats());

    if (tickCount > 0) {
      console.log('\n✓ SCHEDULER IS WORKING - prices are flowing');
    } else {
      console.log('\n✗ NO TICKS RECEIVED - check adapter/WebSocket');
    }

    await scheduler.stop();

  } catch (error) {
    console.error('ERROR:', error);
  }

  process.exit(0);
}

testScheduler();
