# Trading Bots - Standard Operating Procedures

## Quick Reference

| Bot | Strategy | Risk Level | Best For |
|-----|----------|------------|----------|
| Grid | Buy low, sell high in range | Medium | Sideways markets |
| Infinity Grid | Endless grid, no upper limit | Medium | Long-term accumulation |
| DCA | Regular interval buying | Low | Volatile assets |
| Smart Trade | Single trade with TP/SL | Medium | Manual-like entries |
| Trailing | Trail price before entry/exit | Medium | Catching breakouts |
| Martingale | Double down on losses | High | Recovery strategy |
| Rebalancing | Maintain portfolio allocation | Low | Diversified portfolios |
| Dynamic Grid | Auto-adjusting grid | Medium | Trending markets |

---

## 1. Grid Bot

### Purpose
Places buy and sell orders at preset price intervals within a defined range. Profits from price oscillations.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lowerPrice` | number | Yes | Bottom of grid range |
| `upperPrice` | number | Yes | Top of grid range |
| `gridCount` | number | Yes | Number of grid levels (5-50) |
| `totalInvestment` | number | Yes | Total USD to allocate |

### How It Works
1. Divides price range into equal intervals
2. Places buy orders below current price
3. Places sell orders above current price
4. When buy fills → places sell order one level above
5. When sell fills → places buy order one level below

### Best Practices
- Set range to capture 80% of recent price action
- Use 10-20 grids for optimal trade frequency
- Wider range = fewer trades but safer
- Tighter range = more trades but higher risk of breakout

### Example Configuration
```json
{
  "strategyType": "GRID",
  "symbol": "BTC/USDT",
  "params": {
    "lowerPrice": 58000,
    "upperPrice": 62000,
    "gridCount": 10,
    "totalInvestment": 1000
  }
}
```

### Risk Management
- Stop bot if price breaks below `lowerPrice` (holding coins at loss)
- Stop bot if price breaks above `upperPrice` (missed gains)
- Monitor grid utilization - if all grids on one side, range needs adjustment

---

## 2. Infinity Grid Bot

### Purpose
Grid bot without upper limit. Continues placing orders as price rises indefinitely.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lowerPrice` | number | Yes | Minimum price threshold |
| `gridSpacingPercent` | number | Yes | Percentage gap between levels (1-5%) |
| `totalInvestment` | number | Yes | Total USD to allocate |

### How It Works
1. Sets lower bound but no upper bound
2. Creates grid levels using percentage spacing
3. As price rises, grid expands upward automatically
4. Never fully exits position (always holds some coins)

### Best Practices
- Use for assets you believe will appreciate long-term
- Set `lowerPrice` at strong support level
- Use 1-2% spacing for active markets
- Use 3-5% spacing for less volatile assets

### Example Configuration
```json
{
  "strategyType": "INFINITY_GRID",
  "symbol": "ETH/USDT",
  "params": {
    "lowerPrice": 3000,
    "gridSpacingPercent": 2,
    "totalInvestment": 500
  }
}
```

### Risk Management
- Higher risk if price drops below `lowerPrice`
- Not suitable for assets expected to decline long-term
- Monitor total position size as it accumulates

---

## 3. DCA Bot (Dollar Cost Averaging)

### Purpose
Buys fixed USD amounts at regular intervals regardless of price. Reduces timing risk.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amountPerBuy` | number | Yes | USD per purchase |
| `interval` | string | Yes | `hourly`, `daily`, `weekly` |
| `totalBudget` | number | Yes | Maximum total investment |
| `takeProfitPercent` | number | No | Auto-sell at profit % |
| `stopLossPercent` | number | No | Auto-sell at loss % |

### How It Works
1. Immediately executes first buy
2. Schedules subsequent buys at interval
3. Tracks average entry price
4. Optionally exits at TP/SL thresholds

### Best Practices
- Use for volatile assets where timing is difficult
- Set intervals based on volatility (hourly for crypto, daily for stocks)
- Always set a `totalBudget` to limit exposure
- Consider TP between 10-20% for reasonable exits

### Example Configuration
```json
{
  "strategyType": "DCA",
  "symbol": "DOGE/USDT",
  "params": {
    "amountPerBuy": 25,
    "interval": "daily",
    "totalBudget": 500,
    "takeProfitPercent": 15,
    "stopLossPercent": 30
  }
}
```

### Risk Management
- Longer DCA periods = lower average cost in declining markets
- Set stop loss wider than normal (DCA expects volatility)
- Don't DCA into fundamentally declining assets

---

## 4. Smart Trade Bot

### Purpose
Single trade entry with automated take-profit, stop-loss, and trailing exits.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `side` | string | Yes | `long` or `short` |
| `entryType` | string | Yes | `market` or `limit` |
| `quantity` | number | Yes | USD amount to invest |
| `entryPrice` | number | Limit only | Limit order entry price |
| `takeProfitPercent` | number | One exit required | Exit at profit % |
| `takeProfit` | number | One exit required | Exit at specific price |
| `stopLossPercent` | number | One exit required | Exit at loss % |
| `stopLoss` | number | One exit required | Exit at specific price |
| `trailingTakeProfit` | number | One exit required | Trail by % from peak |

### How It Works
1. **Entry Phase**: Places market or limit order
2. **Position Phase**: Monitors price against exit conditions
3. **Exit Phase**: Automatically sells when condition met

Exit priority: Trailing > Take Profit > Stop Loss

### Best Practices
- Use market entry for immediate execution
- Use limit entry for better price but may not fill
- Trailing TP captures more gains in strong trends
- Always set at least one exit condition

### Example Configuration
```json
{
  "strategyType": "SMART_TRADE",
  "symbol": "SOL/USDT",
  "params": {
    "side": "long",
    "entryType": "market",
    "quantity": 100,
    "takeProfitPercent": 10,
    "stopLossPercent": 5,
    "trailingTakeProfit": 3
  }
}
```

### Risk Management
- Risk:Reward ratio should be at least 1:2 (SL:TP)
- Trailing TP of 2-5% works well for volatile assets
- Don't use for short positions without existing holdings

---

## 5. Trailing Bot

### Purpose
Waits for price trigger, then trails price by percentage before executing.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `side` | string | Yes | `trailing_buy` or `trailing_sell` |
| `triggerPrice` | number | Yes | Price to activate trailing |
| `trailingPercent` | number | Yes | Distance to trail (1-10%) |
| `quantity` | number | Yes | Coins to trade |

### How It Works

**Trailing Buy:**
1. Waits for price to drop below `triggerPrice`
2. Starts tracking lowest price seen
3. Buys when price rises `trailingPercent` from low

**Trailing Sell:**
1. Waits for price to rise above `triggerPrice`
2. Starts tracking highest price seen
3. Sells when price drops `trailingPercent` from high

### Best Practices
- Trailing buy: Set trigger below current price to catch dips
- Trailing sell: Set trigger above current price to catch peaks
- Use 2-3% trailing for volatile assets
- Use 5-10% trailing for less volatile assets

### Example Configuration
```json
{
  "strategyType": "TRAILING",
  "symbol": "BNB/USDT",
  "params": {
    "side": "trailing_buy",
    "triggerPrice": 580,
    "trailingPercent": 2,
    "quantity": 1.5
  }
}
```

### Risk Management
- Tight trailing % may execute too early
- Wide trailing % may miss the move
- Works best in trending markets, not choppy ones

---

## 6. Martingale Bot

### Purpose
Doubles down on losing positions to lower average cost. High risk, high reward recovery strategy.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `initialBuyAmount` | number | Yes | First buy in USD |
| `priceDropPercent` | number | Yes | Drop % to trigger safety order |
| `takeProfitPercent` | number | Yes | Exit at profit % from avg |
| `maxSafetyOrders` | number | Yes | Maximum additional buys |
| `multiplier` | number | Yes | Size multiplier per order |
| `maxTotalInvestment` | number | Yes | Hard cap on total spend |

### How It Works
1. Executes initial buy
2. If price drops by `priceDropPercent`, buys again (multiplied size)
3. Continues buying on drops up to `maxSafetyOrders`
4. Sells entire position when average cost + `takeProfitPercent` reached

### Investment Calculation
Total potential investment = initialBuy × (1 + m + m² + ... + m^n)
where m = multiplier, n = maxSafetyOrders

Example: $10 initial, 1.5x multiplier, 3 safety orders = $10 + $15 + $22.50 + $33.75 = $81.25

### Best Practices
- Use small initial amount (5-10% of total budget)
- Keep multiplier between 1.2-2.0
- Set `maxTotalInvestment` to hard limit exposure
- Only use on assets you believe will recover

### Example Configuration
```json
{
  "strategyType": "MARTINGALE",
  "symbol": "AVAX/USDT",
  "params": {
    "initialBuyAmount": 20,
    "priceDropPercent": 5,
    "takeProfitPercent": 3,
    "maxSafetyOrders": 4,
    "multiplier": 1.5,
    "maxTotalInvestment": 300
  }
}
```

### Risk Management
- HIGHEST RISK strategy - can lose entire investment
- Never use on fundamentally weak assets
- Always set `maxTotalInvestment` conservatively
- Don't increase multiplier above 2.0

---

## 7. Rebalancing Bot

### Purpose
Maintains target portfolio allocation across multiple assets. Auto-rebalances when drift exceeds threshold.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `allocations` | array | Yes | Target % for each asset |
| `totalInvestment` | number | Yes | Portfolio value in USD |
| `rebalanceThreshold` | number | Yes | Drift % to trigger rebalance |
| `rebalanceInterval` | string | Yes | Check frequency (`1h`, `4h`, `1d`) |

### How It Works
1. Calculates target value for each asset
2. Compares to current holdings
3. If any asset drifts more than threshold, rebalances
4. Sells overweight assets, buys underweight assets

### Best Practices
- Use 3-5 assets for diversification
- Set threshold between 5-10% to balance fees vs drift
- Longer intervals reduce trading fees
- Total allocations must equal 100%

### Example Configuration
```json
{
  "strategyType": "REBALANCING",
  "symbol": "BTC/USDT",
  "params": {
    "allocations": [
      { "symbol": "BTC/USDT", "targetPercent": 50 },
      { "symbol": "ETH/USDT", "targetPercent": 30 },
      { "symbol": "SOL/USDT", "targetPercent": 20 }
    ],
    "totalInvestment": 1000,
    "rebalanceThreshold": 5,
    "rebalanceInterval": "4h"
  }
}
```

### Risk Management
- Frequent rebalancing increases trading fees
- May sell winners too early in strong trends
- Consider tax implications of selling
- All assets should be fundamentally sound

---

## 8. Dynamic Grid Bot

### Purpose
Grid bot that automatically adjusts range and can scan for optimal trading pairs.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `coinSelectionMode` | string | Yes | `MANUAL` or `AUTO_SCAN` |
| `selectedSymbol` | string | Manual | Symbol to trade |
| `priceRangeLow` | number | Yes | Lower grid bound |
| `priceRangeHigh` | number | Yes | Upper grid bound |
| `gridCount` | number | Yes | Number of grid levels |
| `totalInvestment` | number | Yes | Total USD allocation |
| `scanPoolSize` | number | Auto | Number of pairs to analyze |
| `maxBuysPerCoin` | number | Yes | Max positions per asset |

### How It Works
1. **Manual Mode**: Trades specified symbol within range
2. **Auto Mode**: Scans top coins by volatility/volume
3. Places grid orders within dynamic range
4. Adjusts range as market conditions change

### Best Practices
- Manual mode for known trading ranges
- Auto mode for discovering opportunities
- Set `maxBuysPerCoin` to limit concentration
- Monitor grid efficiency metrics

### Example Configuration
```json
{
  "strategyType": "DYNAMIC_GRID",
  "symbol": "MATIC/USDT",
  "params": {
    "coinSelectionMode": "MANUAL",
    "selectedSymbol": "MATIC/USDT",
    "priceRangeLow": 0.50,
    "priceRangeHigh": 0.70,
    "gridCount": 8,
    "totalInvestment": 200,
    "maxBuysPerCoin": 3
  }
}
```

### Risk Management
- Auto mode may select volatile/risky pairs
- Review selected pairs before committing funds
- Dynamic adjustments may not keep pace with flash crashes

---

## General Operating Procedures

### Pre-Launch Checklist
1. [ ] Verify exchange API keys are configured
2. [ ] Check available balance covers investment
3. [ ] Confirm symbol is tradeable on exchange
4. [ ] Review all parameters match strategy
5. [ ] Start in PAPER mode first

### Monitoring
- Check bot status every 4-8 hours initially
- Review trade history for expected behavior
- Monitor PnL and adjust parameters if needed
- Watch for exchange maintenance windows

### Emergency Procedures
1. **Price Crash**: Stop grid/infinity bots to prevent buying into decline
2. **Exchange Issues**: Pause all bots until resolved
3. **Unexpected Behavior**: Stop bot, export logs, investigate

### Paper vs Live Trading
| Aspect | Paper | Live |
|--------|-------|------|
| Mode | `PAPER` | `LIVE` |
| Execution | Simulated | Real orders |
| Balance | Virtual | Real funds |
| Risk | None | Actual loss possible |

### API Configuration
```env
# Paper trading (default)
USE_TESTNET=true

# Live trading
USE_TESTNET=false
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Bot not trading | Price outside range | Adjust range parameters |
| Orders rejected | Insufficient balance | Check exchange balance |
| MIN_NOTIONAL error | Order too small | Increase investment amount |
| Status shows 0 ticks | Connection issue | Restart bot, check API |
| Live orders not filling | Market moved | Use market orders or adjust price |

---

## Quick Start Commands

```bash
# Start server
cd backend && node server.js

# Run paper trading test
node test-all-trading.js

# Verify live configuration
node test-live-config.js

# Create bot via API
curl -X POST http://localhost:5000/api/bots/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"strategyType":"GRID","symbol":"DOGE/USDT","mode":"PAPER",...}'
```
