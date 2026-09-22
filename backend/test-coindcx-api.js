import * as coindcxAdapter from './services/adapters/coindcxAdapter.js';
import * as exchangeService from './services/exchangeService.js';
import * as accountService from './services/accountService.js';

async function runTests() {
  console.log('========================================');
  console.log('🧪 Starting CoinDCX Integration Tests');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Test 1: Symbol Normalization & Denormalization
  console.log('--- 1. Symbol Format Tests ---');
  const normMarket = coindcxAdapter.normalizeSymbol('BTC/USDT', 'market');
  assert(normMarket === 'BTCUSDT', `normalizeSymbol('BTC/USDT', 'market') === 'BTCUSDT' (got '${normMarket}')`);

  const normPairUSDT = coindcxAdapter.normalizeSymbol('BTC/USDT', 'pair');
  assert(normPairUSDT === 'B-BTC_USDT', `normalizeSymbol('BTC/USDT', 'pair') === 'B-BTC_USDT' (got '${normPairUSDT}')`);

  const normPairINR = coindcxAdapter.normalizeSymbol('BTC/INR', 'pair');
  assert(normPairINR === 'I-BTC_INR', `normalizeSymbol('BTC/INR', 'pair') === 'I-BTC_INR' (got '${normPairINR}')`);

  const denorm1 = coindcxAdapter.denormalizeSymbol('BTCUSDT');
  assert(denorm1 === 'BTC/USDT', `denormalizeSymbol('BTCUSDT') === 'BTC/USDT' (got '${denorm1}')`);

  const denorm2 = coindcxAdapter.denormalizeSymbol('B-BTC_USDT');
  assert(denorm2 === 'BTC/USDT', `denormalizeSymbol('B-BTC_USDT') === 'BTC/USDT' (got '${denorm2}')`);

  const denorm3 = coindcxAdapter.denormalizeSymbol('I-BTC_INR');
  assert(denorm3 === 'BTC/INR', `denormalizeSymbol('I-BTC_INR') === 'BTC/INR' (got '${denorm3}')`);

  // Test 2: Supported Exchanges in ExchangeService
  console.log('\n--- 2. Exchange Service Registration ---');
  const supported = exchangeService.getSupportedExchanges();
  const hasCoinDCX = supported.some(e => e.name === 'CoinDCX');
  assert(hasCoinDCX, 'exchangeService.getSupportedExchanges() includes CoinDCX');

  // Test 3: Public Symbols Search
  console.log('\n--- 3. Public Symbol Search ---');
  try {
    const searchResults = await coindcxAdapter.searchSymbols('BTC');
    assert(Array.isArray(searchResults) && searchResults.length > 0, `coindcxAdapter.searchSymbols('BTC') returned ${searchResults.length} symbols`);
    const btcUsdt = searchResults.find(s => s.symbol === 'BTC/USDT' || s.symbol === 'BTC/INR');
    assert(Boolean(btcUsdt), `Found BTC pair in CoinDCX symbol search (${btcUsdt?.symbol || 'none'})`);
  } catch (err) {
    assert(false, `Public symbol search error: ${err.message}`);
  }

  // Test 4: Live Market Quote
  console.log('\n--- 4. Live Market Quote ---');
  try {
    const quote = await coindcxAdapter.getQuote('BTC/USDT');
    assert(quote && quote.price > 0, `coindcxAdapter.getQuote('BTC/USDT') returned valid price: $${quote?.price}`);
    assert(quote.symbol === 'BTC/USDT', `Quote symbol correctly formatted: ${quote?.symbol}`);
  } catch (err) {
    assert(false, `getQuote error: ${err.message}`);
  }

  // Test 5: Live INR Market Quote
  console.log('\n--- 5. Live INR Market Quote ---');
  try {
    const inrQuote = await coindcxAdapter.getQuote('BTC/INR');
    assert(inrQuote && inrQuote.price > 0, `coindcxAdapter.getQuote('BTC/INR') returned valid INR price: ₹${inrQuote?.price}`);
  } catch (err) {
    assert(false, `getQuote INR error: ${err.message}`);
  }

  // Test 6: Live OHLCV Candles
  console.log('\n--- 6. Live OHLCV Candles ---');
  try {
    const candles = await coindcxAdapter.getOHLCV('BTC/USDT', '1h', 5);
    assert(Array.isArray(candles) && candles.length > 0, `coindcxAdapter.getOHLCV('BTC/USDT', '1h', 5) returned ${candles.length} candles`);
    if (candles.length > 0) {
      const c = candles[0];
      assert(c.open > 0 && c.high >= c.low && c.close > 0, `Candle valid: Open=${c.open}, High=${c.high}, Low=${c.low}, Close=${c.close}`);
    }
  } catch (err) {
    assert(false, `getOHLCV error: ${err.message}`);
  }

  // Test 7: Live OrderBook
  console.log('\n--- 7. Live OrderBook ---');
  try {
    const orderbook = await coindcxAdapter.getOrderBook('BTC/USDT');
    assert(orderbook && (orderbook.bids.length > 0 || orderbook.asks.length > 0), `getOrderBook returned ${orderbook?.bids?.length || 0} bids, ${orderbook?.asks?.length || 0} asks`);
  } catch (err) {
    assert(false, `getOrderBook error: ${err.message}`);
  }

  // Test 8: Live Trades
  console.log('\n--- 8. Live Recent Trades ---');
  try {
    const trades = await coindcxAdapter.getRecentTrades('BTC/USDT');
    assert(Array.isArray(trades) && trades.length > 0, `getRecentTrades returned ${trades.length} trades`);
  } catch (err) {
    assert(false, `getRecentTrades error: ${err.message}`);
  }

  // Test 9: Multi-Exchange Search in ExchangeService
  console.log('\n--- 9. Multi-Exchange Search in ExchangeService ---');
  try {
    const multiSearch = await exchangeService.searchSymbols('BTC', 'coindcx');
    assert(Array.isArray(multiSearch) && multiSearch.length > 0, `exchangeService.searchSymbols('BTC', 'coindcx') returned ${multiSearch.length} symbols`);
  } catch (err) {
    assert(false, `Multi-exchange search error: ${err.message}`);
  }

  console.log('\n========================================');
  console.log(`📊 Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
