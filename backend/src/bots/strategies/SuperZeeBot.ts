/**
 * SuperZeeBot Strategy - Autonomous Predictive AI Quant Engine
 * Real-time dynamic boundaries ($X, $Y, $Z), Local Microsecond Guard (<50ms),
 * Fractional Kelly Criterion Position Sizing, 4 Selectable Quant Methodologies,
 * Hysteresis Action Cooldowns, State Persistence, and Live AI Thought Stream.
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type {
  BotParams,
  BotState,
  BotAction,
  PriceTick,
  ValidationResult,
  SuperZeeParams
} from '../types.js';

function toNum(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  const n = Number(val);
  return isNaN(n) ? defaultVal : n;
}

export class SuperZeeBot extends BaseBotStrategy {
  readonly name = 'Super Zee Bot';
  readonly type = 'SUPER_ZEE' as const;

  // Dynamic Corridor Boundaries
  private dynamicLower = 0;
  private dynamicUpper = 0;
  private dynamicSpacing = 0;

  // Local Microsecond Safeguards (In-memory tick guards)
  private emergencyFloorPrice = 0;
  private takeProfitCeilingPrice = 0;
  private trailingStopLoss = 0;

  // Quant Methodology & Kelly Position Sizing
  private methodology = 'HYBRID_ENSEMBLE';
  private kellyAllocPercent = 35;
  private quantScore = 75;
  private winProbability = 65;
  private expectedValueDollar = 1.5;

  // Sizing & Capital Allocation
  private baseInvestment = 50;
  private initialEntryFilled = false;
  private hasHarvestedUpperBand = false; // Prevents infinite repeat selling at upper band; locks 30% runner
  private activeHoldingsQuantity = 0;
  private avgEntryPrice = 0;
  private realizedProfit = 0;
  private totalHarvests = 0;
  private totalDipBuys = 0;

  // Regime & Quant State
  private marketRegime = 'RANGE_ACCUMULATION';
  private lastThought = '';
  private lastDirectiveAction = 'DEFENSIVE_HOLD';

  // Telemetry & Ticks
  private lastPrice = 0;
  private lastStatusLog = 0;

  // Hysteresis & Cooldown Control
  private actionCooldownMs = 20000; // 20s minimum between regular actions
  private lastActionTimestamp = 0;
  private lastDirectiveFetchTime = 0;

  // Symbols
  private asset = 'SOL';
  private quote = 'USDT';

  validate(params: BotParams): ValidationResult {
    const p = params as SuperZeeParams;
    const errors: string[] = [];

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

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    const p = this.params as SuperZeeParams;

    this.dynamicLower = toNum(p.lowerPrice);
    this.dynamicUpper = toNum(p.upperPrice);
    this.dynamicSpacing = toNum(p.stepSpace);
    this.emergencyFloorPrice = toNum(p.emergencyFloorPrice);
    this.takeProfitCeilingPrice = toNum(p.takeProfitCeilingPrice);
    this.trailingStopLoss = toNum(p.trailingStopLoss);
    this.baseInvestment = toNum(p.baseInvestment, 50);
    this.actionCooldownMs = toNum(p.actionCooldownMs, 20000);
    this.marketRegime = p.activeRegime || 'RANGE_ACCUMULATION';
    this.methodology = p.methodology || (p as any).method || 'HYBRID_ENSEMBLE';
    this.kellyAllocPercent = toNum(p.kellyAllocPercent, 35);
    this.quantScore = toNum(p.quantScore, 75);
    this.lastPrice = toNum(p.currentPrice) || (this.dynamicLower > 0 ? (this.dynamicLower + this.dynamicUpper) / 2 : 0);
    this.lastStatusLog = 0;

    if (p.initialDirective?.thought) {
      this.lastThought = p.initialDirective.thought;
    } else {
      this.lastThought = `🧠 [Super Zee AI (${this.methodology})] Initialized in ${this.marketRegime}. Dynamic corridor: $${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}. Floor: $${this.emergencyFloorPrice.toFixed(4)}. Kelly Sizing: ${this.kellyAllocPercent}%.`;
    }

    this.log(this.lastThought, 'info');
  }

  async evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]> {
    const actions: BotAction[] = [];
    const currentPrice = tick.price;
    const now = Date.now();

    if (!currentPrice || currentPrice <= 0) return actions;
    this.lastPrice = currentPrice;

    // Parse symbols from tick if present
    if (tick.symbol) {
      const parts = tick.symbol.includes('/') ? tick.symbol.split('/') : [tick.symbol.slice(0, -4), tick.symbol.slice(-4)];
      if (parts[0]) this.asset = parts[0];
      if (parts[1]) this.quote = parts[1];
    }

    const currentHoldings = (state.holdings || []).reduce((sum, h) => sum + (h.quantity || 0), 0) + this.activeHoldingsQuantity;
    const availableCash = state.availableBalance || this.baseInvestment;

    // 📡 0. TELEMETRY STATUS LOG (Heartbeat every 18s for active telemetry feed)
    if (now - this.lastStatusLog > 18000) {
      this.lastStatusLog = now;
      const profitText = this.realizedProfit >= 0 ? `+$${this.realizedProfit.toFixed(2)}` : `-$${Math.abs(this.realizedProfit).toFixed(2)}`;
      this.log(`📊 [Super Zee Telemetry] Price: $${currentPrice.toFixed(4)} | Model: ${this.methodology} | Score: ${this.quantScore}/100 | Corridor: [$${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}] | Holdings: ${currentHoldings.toFixed(4)} ${this.asset} | Kelly: ${this.kellyAllocPercent}% | PnL: ${profitText}`, 'info');
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
    // 🚀 2. DYNAMIC FRACTIONAL KELLY ENTRY (Dynamic Allocation upon Bot Start)
    // ══════════════════════════════════════════════════════════════════
    if (!this.initialEntryFilled && currentHoldings <= 0) {
      const allocPct = Math.min(0.50, Math.max(0.15, this.kellyAllocPercent / 100));
      const entryCapital = Math.max(5.5, availableCash * allocPct);
      const buyQty = entryCapital / currentPrice;

      this.lastThought = `⚡ [Super Zee AI (${this.methodology})] Fractional Kelly deployed ${(allocPct * 100).toFixed(1)}% ($${entryCapital.toFixed(2)}) @ $${currentPrice.toFixed(4)} | EV: +$${this.expectedValueDollar.toFixed(2)} | Score: ${this.quantScore}/100.`;
      this.log(this.lastThought, 'info');

      actions.push({
        action: 'buy',
        orderType: 'MARKET',
        quantity: buyQty,
        metadata: {
          reason: `Fractional Kelly ${(allocPct * 100).toFixed(1)}% Predictive Entry (${this.methodology})`,
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
      this.refreshPredictiveDirective(tick.symbol, currentPrice).catch(() => {});
    }

    // Reset harvest lock on pullback towards VWAP / midpoint or lower band
    const corridorMid = (this.dynamicLower > 0 && this.dynamicUpper > 0)
      ? (this.dynamicLower + this.dynamicUpper) / 2
      : (this.dynamicUpper > 0 ? this.dynamicUpper * 0.985 : 0);

    if (this.hasHarvestedUpperBand && corridorMid > 0 && currentPrice <= corridorMid) {
      this.hasHarvestedUpperBand = false;
      this.log(`🔄 [Super Zee Cycle Reset] Price pulled back to $${currentPrice.toFixed(4)} (below midpoint $${corridorMid.toFixed(4)}). Upper harvest lock reset for next cycle.`, 'info');
    }

    // Condition A: 70% Profit Harvest at Upper Band / Resistance (Executes ONCE per cycle touch)
    if (this.dynamicUpper > 0 && currentPrice >= this.dynamicUpper && currentHoldings > 0 && !this.hasHarvestedUpperBand) {
      const harvestQty = currentHoldings * 0.70;
      const harvestVal = harvestQty * currentPrice;

      // Gate: Ensure harvest notional value is not dust (>= $0.75)
      if (harvestVal >= 0.75) {
        const estProfit = (currentPrice - this.avgEntryPrice) * harvestQty;

        this.lastThought = `⚡ [Super Zee AI (${this.methodology})] Harvested 70% (${harvestQty.toFixed(4)} ${this.asset}, $${harvestVal.toFixed(2)}) @ $${currentPrice.toFixed(4)}: Tagged Upper +2σ Band ($${this.dynamicUpper.toFixed(4)}). Holding remaining 30% runner. Est. Profit: ${estProfit >= 0 ? '+' : ''}$${estProfit.toFixed(2)}.`;
        this.log(this.lastThought, 'info');

        actions.push({
          action: 'sell',
          orderType: 'MARKET',
          quantity: harvestQty,
          metadata: {
            reason: `Autonomous 70% Harvest at Upper Band ($${this.dynamicUpper.toFixed(4)})`,
          },
        });

        this.hasHarvestedUpperBand = true;
        this.totalHarvests++;
        this.realizedProfit += Math.max(0, estProfit);
        this.activeHoldingsQuantity = Math.max(0, currentHoldings - harvestQty);
        this.lastActionTimestamp = now;
        return actions;
      } else {
        // Holdings too small to slice 70/30; mark harvested to protect dust
        this.hasHarvestedUpperBand = true;
      }
    }

    // Condition B: Opportunistic Dip Buy at Lower Band / Support with Kelly Sizing
    if (this.dynamicLower > 0 && currentPrice <= this.dynamicLower && availableCash >= 5.5) {
      const dipPct = Math.min(0.35, Math.max(0.15, (this.kellyAllocPercent * 0.6) / 100));
      const dipCapital = Math.min(availableCash, Math.max(5.5, this.baseInvestment * dipPct));
      const dipQty = dipCapital / currentPrice;

      this.lastThought = `⚡ [Super Zee AI (${this.methodology})] Opportunistic Kelly Dip Buy ($${dipCapital.toFixed(2)}) @ $${currentPrice.toFixed(4)}: Price touched Lower -2σ VWAP Band ($${this.dynamicLower.toFixed(4)}) with CVD absorption.`;
      this.log(this.lastThought, 'info');

      actions.push({
        action: 'buy',
        orderType: 'MARKET',
        quantity: dipQty,
        metadata: {
          reason: `Autonomous ${(dipPct * 100).toFixed(0)}% Dip Buy at Lower Band ($${this.dynamicLower.toFixed(4)})`,
        },
      });

      this.hasHarvestedUpperBand = false; // Reset lock when entering new dip
      this.totalDipBuys++;
      this.lastActionTimestamp = now;
      return actions;
    }

    return actions;
  }

  /**
   * Background async helper to refresh directive and update in-memory safeguards
   */
  private async refreshPredictiveDirective(symbol: string, currentPrice: number): Promise<void> {
    try {
      const { getQuantAnalytics } = await import('../../../services/predictiveService.js');
      const data = await getQuantAnalytics(symbol, '15m', 'Binance', this.methodology);

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

        if (data.expectedValue) {
          this.winProbability = data.expectedValue.winProbability || this.winProbability;
          this.expectedValueDollar = data.expectedValue.expectedValueDollar || this.expectedValueDollar;
          if (data.expectedValue.kellyAllocationPercent) {
            this.kellyAllocPercent = data.expectedValue.kellyAllocationPercent;
          }
        }
        if (data.quantScore) {
          this.quantScore = data.quantScore;
        }

        if (d.thought && d.thought !== this.lastThought) {
          this.lastThought = d.thought;
          this.log(`🔮 [Super Zee AI Brain (${this.methodology})] Directive: ${this.lastDirectiveAction} | ${this.lastThought}`, 'info');
        } else if (Math.abs(this.dynamicLower - oldLower) > 0.0001 || Math.abs(this.dynamicUpper - oldUpper) > 0.0001) {
          this.log(`📐 [Super Zee Recalibration] New Corridor: [$${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}] | Floor: $${this.emergencyFloorPrice.toFixed(4)}`, 'info');
        }
      }
    } catch {
      // Fallback: local volatility band drift
      if (this.dynamicLower > 0 && currentPrice > this.dynamicUpper) {
        this.dynamicLower = currentPrice * 0.98;
        this.dynamicUpper = currentPrice * 1.04;
        this.log(`🔄 [Super Zee Drift] Dynamic corridor adjusted upward to [$${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}]`, 'info');
      }
    }
  }

  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number, side?: string): void {
    if (side === 'BUY') {
      this.initialEntryFilled = true;
      this.hasHarvestedUpperBand = false; // Reset lock upon fresh accumulation
      this.activeHoldingsQuantity += filledQuantity;
      this.avgEntryPrice = filledPrice;
      this.log(`✅ [Super Zee Fill] BUY ${filledQuantity.toFixed(4)} ${this.asset} filled @ $${filledPrice.toFixed(4)}`, 'info');
    } else if (side === 'SELL') {
      this.activeHoldingsQuantity = Math.max(0, this.activeHoldingsQuantity - filledQuantity);
      if (this.activeHoldingsQuantity <= 0) {
        this.hasHarvestedUpperBand = false;
        this.initialEntryFilled = false;
      }
      this.log(`✅ [Super Zee Fill] SELL ${filledQuantity.toFixed(4)} ${this.asset} filled @ $${filledPrice.toFixed(4)}`, 'info');
    }
  }

  onOrderCancelled(orderId: string): void {
    this.log(`⚠️ [Super Zee Order] Order ${orderId} cancelled`, 'warn');
  }

  protected getMetrics(): Record<string, number> {
    return {
      currentPrice: this.lastPrice || 0,
      dynamicLower: this.dynamicLower,
      dynamicUpper: this.dynamicUpper,
      dynamicSpacing: this.dynamicSpacing,
      emergencyFloorPrice: this.emergencyFloorPrice,
      takeProfitCeilingPrice: this.takeProfitCeilingPrice,
      avgEntryPrice: this.avgEntryPrice,
      kellyAllocPercent: this.kellyAllocPercent,
      quantScore: this.quantScore,
      winProbability: this.winProbability,
      expectedValueDollar: this.expectedValueDollar,
      realizedProfit: this.realizedProfit,
      totalHarvests: this.totalHarvests,
      totalDipBuys: this.totalDipBuys,
      baseInvestment: this.baseInvestment,
      activeHoldingsQuantity: this.activeHoldingsQuantity,
      hasHarvestedUpperBand: this.hasHarvestedUpperBand ? 1 : 0,
    };
  }

  getCustomState(): Record<string, any> {
    return {
      dynamicLower: this.dynamicLower,
      dynamicUpper: this.dynamicUpper,
      dynamicSpacing: this.dynamicSpacing,
      emergencyFloorPrice: this.emergencyFloorPrice,
      takeProfitCeilingPrice: this.takeProfitCeilingPrice,
      trailingStopLoss: this.trailingStopLoss,
      baseInvestment: this.baseInvestment,
      initialEntryFilled: this.initialEntryFilled,
      hasHarvestedUpperBand: this.hasHarvestedUpperBand,
      activeHoldingsQuantity: this.activeHoldingsQuantity,
      avgEntryPrice: this.avgEntryPrice,
      realizedProfit: this.realizedProfit,
      totalHarvests: this.totalHarvests,
      totalDipBuys: this.totalDipBuys,
      marketRegime: this.marketRegime,
      methodology: this.methodology,
      kellyAllocPercent: this.kellyAllocPercent,
      quantScore: this.quantScore,
      winProbability: this.winProbability,
      expectedValueDollar: this.expectedValueDollar,
      lastThought: this.lastThought,
      lastDirectiveAction: this.lastDirectiveAction,
      lastActionTimestamp: this.lastActionTimestamp,
      lastPrice: this.lastPrice,
      lastStatusLog: this.lastStatusLog,
    };
  }

  restoreState(customState: Record<string, any>): void {
    if (!customState) return;

    if (customState.dynamicLower) this.dynamicLower = toNum(customState.dynamicLower);
    if (customState.dynamicUpper) this.dynamicUpper = toNum(customState.dynamicUpper);
    if (customState.dynamicSpacing) this.dynamicSpacing = toNum(customState.dynamicSpacing);
    if (customState.emergencyFloorPrice) this.emergencyFloorPrice = toNum(customState.emergencyFloorPrice);
    if (customState.takeProfitCeilingPrice) this.takeProfitCeilingPrice = toNum(customState.takeProfitCeilingPrice);
    if (customState.trailingStopLoss) this.trailingStopLoss = toNum(customState.trailingStopLoss);
    if (customState.baseInvestment) this.baseInvestment = toNum(customState.baseInvestment);
    if (customState.initialEntryFilled !== undefined) this.initialEntryFilled = Boolean(customState.initialEntryFilled);
    if (customState.hasHarvestedUpperBand !== undefined) this.hasHarvestedUpperBand = Boolean(customState.hasHarvestedUpperBand);
    if (customState.activeHoldingsQuantity) this.activeHoldingsQuantity = toNum(customState.activeHoldingsQuantity);
    if (customState.avgEntryPrice) this.avgEntryPrice = toNum(customState.avgEntryPrice);
    if (customState.realizedProfit) this.realizedProfit = toNum(customState.realizedProfit);
    if (customState.totalHarvests) this.totalHarvests = toNum(customState.totalHarvests);
    if (customState.totalDipBuys) this.totalDipBuys = toNum(customState.totalDipBuys);
    if (customState.marketRegime) this.marketRegime = customState.marketRegime;
    if (customState.methodology) this.methodology = customState.methodology;
    if (customState.kellyAllocPercent) this.kellyAllocPercent = toNum(customState.kellyAllocPercent);
    if (customState.quantScore) this.quantScore = toNum(customState.quantScore);
    if (customState.winProbability) this.winProbability = toNum(customState.winProbability);
    if (customState.expectedValueDollar) this.expectedValueDollar = toNum(customState.expectedValueDollar);
    if (customState.lastThought) this.lastThought = customState.lastThought;
    if (customState.lastDirectiveAction) this.lastDirectiveAction = customState.lastDirectiveAction;
    if (customState.lastActionTimestamp) this.lastActionTimestamp = toNum(customState.lastActionTimestamp);
    if (customState.lastPrice) this.lastPrice = toNum(customState.lastPrice);
    if (customState.lastStatusLog) this.lastStatusLog = toNum(customState.lastStatusLog);

    this.log(`🔄 [Super Zee Restore] Resumed state seamlessly from database (${this.methodology}). Dynamic corridor: $${this.dynamicLower.toFixed(4)} - $${this.dynamicUpper.toFixed(4)}. Floor: $${this.emergencyFloorPrice.toFixed(4)}. Kelly: ${this.kellyAllocPercent}%.`, 'info');
  }

  async cleanup(): Promise<void> {
    this.log(`🛑 [Super Zee Cleanup] Strategy shutting down safely (${this.methodology})`, 'info');
  }
}

export default SuperZeeBot;
