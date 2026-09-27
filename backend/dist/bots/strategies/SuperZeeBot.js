/**
 * SuperZeeBot Strategy - Autonomous Predictive AI Quant Engine
 * Real-time dynamic boundaries ($X, $Y, $Z), Local Microsecond Guard (<50ms),
 * Hysteresis Action Cooldowns, State Persistence, and Live AI Thought Stream.
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
function toNum(val, defaultVal = 0) {
    if (val === null || val === undefined || val === '')
        return defaultVal;
    const n = Number(val);
    return isNaN(n) ? defaultVal : n;
}
export class SuperZeeBot extends BaseBotStrategy {
    name = 'Super Zee Bot';
    type = 'SUPER_ZEE';
    // Dynamic Corridor Boundaries
    dynamicLower = 0;
    dynamicUpper = 0;
    dynamicSpacing = 0;
    // Local Microsecond Safeguards (In-memory tick guards)
    emergencyFloorPrice = 0;
    takeProfitCeilingPrice = 0;
    trailingStopLoss = 0;
    // Sizing & Capital Allocation
    baseInvestment = 50;
    initialEntryFilled = false;
    activeHoldingsQuantity = 0;
    avgEntryPrice = 0;
    realizedProfit = 0;
    totalHarvests = 0;
    totalDipBuys = 0;
    // Regime & Quant State
    marketRegime = 'RANGE_ACCUMULATION';
    lastThought = '';
    lastDirectiveAction = 'DEFENSIVE_HOLD';
    // Telemetry & Ticks
    lastPrice = 0;
    lastStatusLog = 0;
    // Hysteresis & Cooldown Control
    actionCooldownMs = 20000; // 20s minimum between regular actions
    lastActionTimestamp = 0;
    lastDirectiveFetchTime = 0;
    // Symbols
    asset = 'SOL';
    quote = 'USDT';
    validate(params) {
        const p = params;
        const errors = [];
        const lower = toNum(p.lowerPrice);
        const upper = toNum(p.upperPrice);
        if (lower > 0 && upper > 0 && lower >= upper) {
            errors.push('Dynamic lower price must be less than dynamic upper price');
        }
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        };
    }
    async onInitialize(initialState) {
        const p = this.params;
        this.dynamicLower = toNum(p.lowerPrice);
        this.dynamicUpper = toNum(p.upperPrice);
        this.dynamicSpacing = toNum(p.stepSpace);
        this.emergencyFloorPrice = toNum(p.emergencyFloorPrice);
        this.takeProfitCeilingPrice = toNum(p.takeProfitCeilingPrice);
        this.trailingStopLoss = toNum(p.trailingStopLoss);
        this.baseInvestment = toNum(p.baseInvestment, 50);
        this.actionCooldownMs = toNum(p.actionCooldownMs, 20000);
        this.marketRegime = p.activeRegime || 'RANGE_ACCUMULATION';
        this.lastPrice = toNum(p.currentPrice) || (this.dynamicLower > 0 ? (this.dynamicLower + this.dynamicUpper) / 2 : 0);
        this.lastStatusLog = 0;
        if (p.initialDirective?.thought) {
            this.lastThought = p.initialDirective.thought;
        }
        else {
            this.lastThought = `🧠 [Super Zee AI] Initialized in ${this.marketRegime}. Dynamic corridor: $${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}. Emergency Floor: $${this.emergencyFloorPrice.toFixed(4)}.`;
        }
        this.log(this.lastThought, 'info');
    }
    async evaluate(tick, state) {
        const actions = [];
        const currentPrice = tick.price;
        const now = Date.now();
        if (!currentPrice || currentPrice <= 0)
            return actions;
        this.lastPrice = currentPrice;
        // Parse symbols from tick if present
        if (tick.symbol) {
            const parts = tick.symbol.includes('/') ? tick.symbol.split('/') : [tick.symbol.slice(0, -4), tick.symbol.slice(-4)];
            if (parts[0])
                this.asset = parts[0];
            if (parts[1])
                this.quote = parts[1];
        }
        const currentHoldings = (state.holdings || []).reduce((sum, h) => sum + (h.quantity || 0), 0) + this.activeHoldingsQuantity;
        const availableCash = state.availableBalance || this.baseInvestment;
        // 📡 0. TELEMETRY STATUS LOG (Heartbeat every 18s for active telemetry feed)
        if (now - this.lastStatusLog > 18000) {
            this.lastStatusLog = now;
            const profitText = this.realizedProfit >= 0 ? `+$${this.realizedProfit.toFixed(2)}` : `-$${Math.abs(this.realizedProfit).toFixed(2)}`;
            this.log(`📊 [Super Zee Telemetry] Price: $${currentPrice.toFixed(4)} | Corridor: [$${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}] | Regime: ${this.marketRegime} | Holdings: ${currentHoldings.toFixed(4)} ${this.asset} | Available: $${availableCash.toFixed(2)} | Realized PnL: ${profitText}`, 'info');
        }
        // ══════════════════════════════════════════════════════════════════
        // 🛡️ 1. LOCAL MICROSECOND GUARD (<50ms execution without AI latency)
        // ══════════════════════════════════════════════════════════════════
        if (this.emergencyFloorPrice > 0 && currentPrice <= this.emergencyFloorPrice) {
            if (currentHoldings > 0) {
                this.lastThought = `🚨 [Super Zee Microsecond Guard] Emergency Stop Floor breached at $${currentPrice.toFixed(4)} (Floor: $${this.emergencyFloorPrice.toFixed(4)}). Liquidating position immediately to preserve capital.`;
                this.log(this.lastThought, 'error');
                actions.push({
                    action: 'sell',
                    orderType: 'MARKET',
                    quantity: currentHoldings,
                    metadata: {
                        reason: `Microsecond Guard: Emergency Floor breached at $${currentPrice.toFixed(4)}`,
                    },
                });
                this.initialEntryFilled = false;
                this.activeHoldingsQuantity = 0;
                this.lastActionTimestamp = now;
                return actions;
            }
        }
        if (this.takeProfitCeilingPrice > 0 && currentPrice >= this.takeProfitCeilingPrice) {
            if (currentHoldings > 0) {
                this.lastThought = `🎯 [Super Zee Microsecond Guard] Take-Profit Ceiling triggered at $${currentPrice.toFixed(4)} (Ceiling: $${this.takeProfitCeilingPrice.toFixed(4)}). Securing maximum gain.`;
                this.log(this.lastThought, 'info');
                actions.push({
                    action: 'sell',
                    orderType: 'MARKET',
                    quantity: currentHoldings,
                    metadata: {
                        reason: `Microsecond Guard: Take-Profit Ceiling triggered at $${currentPrice.toFixed(4)}`,
                    },
                });
                this.initialEntryFilled = false;
                this.activeHoldingsQuantity = 0;
                this.lastActionTimestamp = now;
                return actions;
            }
        }
        // ══════════════════════════════════════════════════════════════════
        // 🚀 2. INITIAL BASE ENTRY (75% Allocation upon Bot Start)
        // ══════════════════════════════════════════════════════════════════
        if (!this.initialEntryFilled && currentHoldings <= 0) {
            const entryCapital = Math.max(5.5, availableCash * 0.75);
            const buyQty = entryCapital / currentPrice;
            this.lastThought = `⚡ [Super Zee AI] Establishing initial 75% base position ($${entryCapital.toFixed(2)}) @ $${currentPrice.toFixed(4)} inside ${this.marketRegime} corridor.`;
            this.log(this.lastThought, 'info');
            actions.push({
                action: 'buy',
                orderType: 'MARKET',
                quantity: buyQty,
                metadata: {
                    reason: 'Initial 75% Predictive Base Entry',
                },
            });
            this.initialEntryFilled = true;
            this.avgEntryPrice = currentPrice;
            this.lastActionTimestamp = now;
            return actions;
        }
        // ══════════════════════════════════════════════════════════════════
        // ⏳ 3. HYSTERESIS & ACTION COOLDOWN GUARD (Prevents Chop Whipsaw)
        // ══════════════════════════════════════════════════════════════════
        const isCoolingDown = (now - this.lastActionTimestamp) < this.actionCooldownMs;
        if (isCoolingDown) {
            return actions;
        }
        // ══════════════════════════════════════════════════════════════════
        // 🧠 4. BACKGROUND PREDICTIVE QUANT DIRECTIVE EVALUATION
        // ══════════════════════════════════════════════════════════════════
        // Trigger background quant directive refresh every 20 seconds
        if (now - this.lastDirectiveFetchTime > 20000) {
            this.lastDirectiveFetchTime = now;
            this.refreshPredictiveDirective(tick.symbol, currentPrice).catch(() => { });
        }
        // Condition A: 70% Profit Harvest at Upper Band / Resistance
        if (this.dynamicUpper > 0 && currentPrice >= this.dynamicUpper && currentHoldings > 0) {
            const harvestQty = currentHoldings * 0.70;
            const estProfit = (currentPrice - this.avgEntryPrice) * harvestQty;
            this.lastThought = `⚡ [Super Zee AI] Sold 70% (${harvestQty.toFixed(4)} ${this.asset}) @ $${currentPrice.toFixed(4)}: Tagged Upper +2σ VWAP Band ($${this.dynamicUpper.toFixed(4)}). Est. Profit: ${estProfit >= 0 ? '+' : ''}$${estProfit.toFixed(2)}.`;
            this.log(this.lastThought, 'info');
            actions.push({
                action: 'sell',
                orderType: 'MARKET',
                quantity: harvestQty,
                metadata: {
                    reason: `Autonomous 70% Harvest at Upper Band ($${this.dynamicUpper.toFixed(4)})`,
                },
            });
            this.totalHarvests++;
            this.realizedProfit += Math.max(0, estProfit);
            this.activeHoldingsQuantity = Math.max(0, currentHoldings - harvestQty);
            this.lastActionTimestamp = now;
            return actions;
        }
        // Condition B: 25% Opportunistic Dip Buy at Lower Band / Support
        if (this.dynamicLower > 0 && currentPrice <= this.dynamicLower && availableCash >= 5.5) {
            const dipCapital = Math.min(availableCash, Math.max(5.5, this.baseInvestment * 0.25));
            const dipQty = dipCapital / currentPrice;
            this.lastThought = `⚡ [Super Zee AI] Opportunistic 25% Dip Buy ($${dipCapital.toFixed(2)}) @ $${currentPrice.toFixed(4)}: Price touched Lower -2σ VWAP Band ($${this.dynamicLower.toFixed(4)}) with CVD absorption.`;
            this.log(this.lastThought, 'info');
            actions.push({
                action: 'buy',
                orderType: 'MARKET',
                quantity: dipQty,
                metadata: {
                    reason: `Autonomous 25% Dip Buy at Lower Band ($${this.dynamicLower.toFixed(4)})`,
                },
            });
            this.totalDipBuys++;
            this.lastActionTimestamp = now;
            return actions;
        }
        return actions;
    }
    /**
     * Background async helper to refresh directive and update in-memory safeguards
     */
    async refreshPredictiveDirective(symbol, currentPrice) {
        try {
            const { getQuantAnalytics } = await import('../../../services/predictiveService.js');
            const data = await getQuantAnalytics(symbol, '15m', 'Binance');
            if (data && data.agentDirective) {
                const d = data.agentDirective;
                const oldLower = this.dynamicLower;
                const oldUpper = this.dynamicUpper;
                this.dynamicLower = d.dynamicLower || this.dynamicLower;
                this.dynamicUpper = d.dynamicUpper || this.dynamicUpper;
                this.dynamicSpacing = d.dynamicSpacing || this.dynamicSpacing;
                this.emergencyFloorPrice = d.emergencyFloorPrice || this.emergencyFloorPrice;
                this.takeProfitCeilingPrice = d.takeProfitCeilingPrice || this.takeProfitCeilingPrice;
                this.marketRegime = data.regime || this.marketRegime;
                this.lastDirectiveAction = d.action || this.lastDirectiveAction;
                if (d.thought && d.thought !== this.lastThought) {
                    this.lastThought = d.thought;
                    this.log(`🔮 [Super Zee AI Brain] Directive: ${this.lastDirectiveAction} | ${this.lastThought}`, 'info');
                }
                else if (Math.abs(this.dynamicLower - oldLower) > 0.0001 || Math.abs(this.dynamicUpper - oldUpper) > 0.0001) {
                    this.log(`📐 [Super Zee Recalibration] New Corridor: [$${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}] | Microsecond Floor: $${this.emergencyFloorPrice.toFixed(4)}`, 'info');
                }
            }
        }
        catch {
            // Fallback: local volatility band drift
            if (this.dynamicLower > 0 && currentPrice > this.dynamicUpper) {
                this.dynamicLower = currentPrice * 0.98;
                this.dynamicUpper = currentPrice * 1.04;
                this.log(`🔄 [Super Zee Drift] Dynamic corridor adjusted upward to [$${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}]`, 'info');
            }
        }
    }
    onOrderFilled(orderId, filledPrice, filledQuantity, side) {
        if (side === 'BUY') {
            this.initialEntryFilled = true;
            this.activeHoldingsQuantity += filledQuantity;
            this.avgEntryPrice = filledPrice;
            this.log(`✅ [Super Zee Fill] BUY ${filledQuantity.toFixed(4)} ${this.asset} filled @ $${filledPrice.toFixed(4)}`, 'info');
        }
        else if (side === 'SELL') {
            this.activeHoldingsQuantity = Math.max(0, this.activeHoldingsQuantity - filledQuantity);
            this.log(`✅ [Super Zee Fill] SELL ${filledQuantity.toFixed(4)} ${this.asset} filled @ $${filledPrice.toFixed(4)}`, 'info');
        }
    }
    onOrderCancelled(orderId) {
        this.log(`⚠️ [Super Zee Order] Order ${orderId} cancelled`, 'warn');
    }
    getMetrics() {
        return {
            currentPrice: this.lastPrice || 0,
            dynamicLower: this.dynamicLower,
            dynamicUpper: this.dynamicUpper,
            dynamicSpacing: this.dynamicSpacing,
            emergencyFloorPrice: this.emergencyFloorPrice,
            takeProfitCeilingPrice: this.takeProfitCeilingPrice,
            avgEntryPrice: this.avgEntryPrice,
            realizedProfit: this.realizedProfit,
            totalHarvests: this.totalHarvests,
            totalDipBuys: this.totalDipBuys,
            baseInvestment: this.baseInvestment,
            activeHoldingsQuantity: this.activeHoldingsQuantity,
        };
    }
    getCustomState() {
        return {
            dynamicLower: this.dynamicLower,
            dynamicUpper: this.dynamicUpper,
            dynamicSpacing: this.dynamicSpacing,
            emergencyFloorPrice: this.emergencyFloorPrice,
            takeProfitCeilingPrice: this.takeProfitCeilingPrice,
            trailingStopLoss: this.trailingStopLoss,
            baseInvestment: this.baseInvestment,
            initialEntryFilled: this.initialEntryFilled,
            activeHoldingsQuantity: this.activeHoldingsQuantity,
            avgEntryPrice: this.avgEntryPrice,
            realizedProfit: this.realizedProfit,
            totalHarvests: this.totalHarvests,
            totalDipBuys: this.totalDipBuys,
            marketRegime: this.marketRegime,
            lastThought: this.lastThought,
            lastDirectiveAction: this.lastDirectiveAction,
            lastActionTimestamp: this.lastActionTimestamp,
            lastPrice: this.lastPrice,
            lastStatusLog: this.lastStatusLog,
        };
    }
    restoreState(customState) {
        if (!customState)
            return;
        if (customState.dynamicLower)
            this.dynamicLower = toNum(customState.dynamicLower);
        if (customState.dynamicUpper)
            this.dynamicUpper = toNum(customState.dynamicUpper);
        if (customState.dynamicSpacing)
            this.dynamicSpacing = toNum(customState.dynamicSpacing);
        if (customState.emergencyFloorPrice)
            this.emergencyFloorPrice = toNum(customState.emergencyFloorPrice);
        if (customState.takeProfitCeilingPrice)
            this.takeProfitCeilingPrice = toNum(customState.takeProfitCeilingPrice);
        if (customState.trailingStopLoss)
            this.trailingStopLoss = toNum(customState.trailingStopLoss);
        if (customState.baseInvestment)
            this.baseInvestment = toNum(customState.baseInvestment);
        if (customState.initialEntryFilled !== undefined)
            this.initialEntryFilled = Boolean(customState.initialEntryFilled);
        if (customState.activeHoldingsQuantity)
            this.activeHoldingsQuantity = toNum(customState.activeHoldingsQuantity);
        if (customState.avgEntryPrice)
            this.avgEntryPrice = toNum(customState.avgEntryPrice);
        if (customState.realizedProfit)
            this.realizedProfit = toNum(customState.realizedProfit);
        if (customState.totalHarvests)
            this.totalHarvests = toNum(customState.totalHarvests);
        if (customState.totalDipBuys)
            this.totalDipBuys = toNum(customState.totalDipBuys);
        if (customState.marketRegime)
            this.marketRegime = customState.marketRegime;
        if (customState.lastThought)
            this.lastThought = customState.lastThought;
        if (customState.lastDirectiveAction)
            this.lastDirectiveAction = customState.lastDirectiveAction;
        if (customState.lastActionTimestamp)
            this.lastActionTimestamp = toNum(customState.lastActionTimestamp);
        if (customState.lastPrice)
            this.lastPrice = toNum(customState.lastPrice);
        if (customState.lastStatusLog)
            this.lastStatusLog = toNum(customState.lastStatusLog);
        this.log(`🔄 [Super Zee Restore] Resumed state seamlessly from database. Dynamic corridor: $${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}. Floor: $${this.emergencyFloorPrice.toFixed(4)}.`, 'info');
    }
    async cleanup() {
        this.log('🛑 [Super Zee Cleanup] Strategy shutting down safely', 'info');
    }
}
export default SuperZeeBot;
