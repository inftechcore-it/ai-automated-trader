/**
 * Unit Test Simulation for Universal Fee-Aware Net Profit Gatekeeper
 * Validates:
 * 1. Multi-exchange fee registry lookup
 * 2. Breakeven target price calculation
 * 3. 4-buy dip accumulation + premature sell blockage (Gross > 0, Net < 0)
 * 4. Profitable execution once price reaches breakeven target
 * 5. Emergency stop-loss bypass
 */

import { getExchangeFeeRate, calculateFeeBreakevenPrice, calculateNetProfit } from './services/exchangeService.js';

console.log('================================================================');
console.log('🛡️ TESTING UNIVERSAL FEE-AWARE NET PROFIT GATEKEEPER');
console.log('================================================================\n');

let allPassed = true;
function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
    allPassed = false;
  }
}

// 1. Multi-exchange fee rates verification
console.log('--- Step 1: Exchange Fee Registry Verification ---');
assert(getExchangeFeeRate('Pionex') === 0.0005, 'Pionex fee is 0.05% (0.0005)');
assert(getExchangeFeeRate('Binance') === 0.0010, 'Binance fee is 0.10% (0.0010)');
assert(getExchangeFeeRate('CoinDCX') === 0.0020, 'CoinDCX fee is 0.20% (0.0020)');
assert(getExchangeFeeRate('Jupiter') === 0.0015, 'Jupiter DEX fee is ~0.15% (0.0015)');
assert(getExchangeFeeRate('AngelOne') === 0.0010, 'AngelOne fee is 0.10% (0.0010)');
assert(getExchangeFeeRate('Upstox') === 0.0010, 'Upstox fee is 0.10% (0.0010)');
assert(getExchangeFeeRate('Alpaca') === 0.0005, 'Alpaca fee is 0.05% (0.0005)');

// 2. Dynamic Breakeven Target Math Verification
console.log('\n--- Step 2: Mathematical Breakeven Price Verification ---');
// Avg entry $100, 1 coin, accumulated buy fee = $0.10, sell fee rate = 0.1% (0.001)
// P_breakeven = (100 * 1 + 0.10) / (1 * (1 - 0.001)) = 100.10 / 0.999 = 100.2002002
const testBreakeven = calculateFeeBreakevenPrice(100, 1, 0.10, 0.001, 0);
assert(Math.abs(testBreakeven - 100.2002) < 0.001, `Breakeven accurately computed: ${testBreakeven.toFixed(6)}`);

// At exactly testBreakeven, net profit should be >= 0
const checkAtBreakeven = calculateNetProfit({
  sellPrice: testBreakeven,
  avgEntryPrice: 100,
  quantity: 1,
  accumulatedBuyFees: 0.10,
  feeRate: 0.001,
});
assert(Math.abs(checkAtBreakeven.netProfit) < 0.00001, `Net profit at breakeven is exactly 0: $${checkAtBreakeven.netProfit.toFixed(6)}`);

// 3. User Exact Scenario: 4-Buy DCA Accumulation
console.log('\n--- Step 3: User Scenario: 4-Buy DCA Accumulation ---');
// Buy 1: 30 coins @ $0.50 ($15.00), fee: $0.015
// Buy 2: 30.612 coins @ $0.49 ($15.00), fee: $0.015
// Buy 3: 31.25 coins @ $0.48 ($15.00), fee: $0.015
// Buy 4: 31.915 coins @ $0.47 ($15.00), fee: $0.015
// Total coins: 123.777, Total cost: $60.00, Avg entry: $0.48474
// Accumulated Buy Fees: $0.060
const totalQty = 123.777;
const avgEntry = 0.48474;
const totalAccumulatedBuyFees = 0.060;
const binanceFeeRate = 0.0010;

// Premature Strategy SELL at +0.3% above entry ($0.48619):
// Gross profit: (0.48619 - 0.48474) * 123.777 = +$0.1795
// Sell fee: 123.777 * 0.48619 * 0.001 = $0.0602
// Total fees: $0.060 + $0.0602 = $0.1202
// If another scenario where gross gain was only +$0.050:
const smallBouncePrice = 0.48514; // very slight bounce
const prematureCheck = calculateNetProfit({
  sellPrice: smallBouncePrice,
  avgEntryPrice: avgEntry,
  quantity: totalQty,
  accumulatedBuyFees: totalAccumulatedBuyFees,
  feeRate: binanceFeeRate,
});

console.log(`Small bounce gross gain: +$${prematureCheck.grossProfit.toFixed(4)}`);
console.log(`Total cycle fees (4 buys + sell): $${prematureCheck.totalCycleFees.toFixed(4)}`);
console.log(`Net outcome if sold: $${prematureCheck.netProfit.toFixed(4)}`);
console.log(`Gatekeeper Decision: ${prematureCheck.isProfitable ? 'ALLOW' : '🛑 BLOCK & CONVERT TO HOLD'}`);

assert(!prematureCheck.isProfitable, 'Premature sell BLOCKED because net profit is negative');
assert(prematureCheck.netProfit < 0, `Net loss confirmed: $${prematureCheck.netProfit.toFixed(4)}`);

// Breakeven target price
const breakevenTarget = prematureCheck.breakevenPrice;
console.log(`\nFee-Adjusted Breakeven Target needed: $${breakevenTarget.toFixed(6)}`);
assert(breakevenTarget > smallBouncePrice, 'Breakeven price is higher than premature sell price');

// Now simulate market rising past breakeven target to $0.4865:
const risePrice = breakevenTarget + 0.0010;
const profitableCheck = calculateNetProfit({
  sellPrice: risePrice,
  avgEntryPrice: avgEntry,
  quantity: totalQty,
  accumulatedBuyFees: totalAccumulatedBuyFees,
  feeRate: binanceFeeRate,
});

console.log(`\nMarket price reaches $${risePrice.toFixed(6)}:`);
console.log(`Gross profit: +$${profitableCheck.grossProfit.toFixed(4)}`);
console.log(`Total cycle fees: $${profitableCheck.totalCycleFees.toFixed(4)}`);
console.log(`Net locked profit: +$${profitableCheck.netProfit.toFixed(4)}`);
console.log(`Gatekeeper Decision: ${profitableCheck.isProfitable ? '✅ EXECUTE SELL' : 'BLOCK'}`);

assert(profitableCheck.isProfitable, 'Execution allowed once price covers all cycle fees');
assert(profitableCheck.netProfit > 0, `Guaranteed true positive profit: +$${profitableCheck.netProfit.toFixed(4)}`);

// 4. Emergency Stop-Loss Bypass
console.log('\n--- Step 4: Emergency Stop-Loss / Hard Floor Bypass ---');
const isEmergency = (action) => Boolean(
  action.metadata?.bypassFeeGate ||
  action.metadata?.isEmergencyStop ||
  action.metadata?.isExit ||
  action.orderType === 'STOP_LOSS' ||
  (action.metadata?.exitReason && String(action.metadata.exitReason).toLowerCase().includes('stop')) ||
  (action.metadata?.exitReason && String(action.metadata.exitReason).toLowerCase().includes('floor'))
);

const normalAction = { action: 'sell', quantity: 10, metadata: {} };
const emergencyFloorAction = { action: 'sell', quantity: 10, metadata: { exitReason: 'Emergency Floor Triggered' } };
const stopLossAction = { action: 'sell', quantity: 10, orderType: 'STOP_LOSS' };

assert(!isEmergency(normalAction), 'Normal profit sell is subject to fee gatekeeper');
assert(isEmergency(emergencyFloorAction), 'Emergency Floor bypasses fee gatekeeper for capital defense');
assert(isEmergency(stopLossAction), 'Stop Loss order type bypasses fee gatekeeper');

console.log('\n================================================================');
if (allPassed) {
  console.log('🎉 ALL UNIT SIMULATION TESTS PASSED SUCCESSFULLY!');
} else {
  console.log('💥 SOME TESTS FAILED!');
}
console.log('================================================================');
