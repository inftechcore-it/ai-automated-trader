/**
 * JarvisBot Strategy - 3-Grid Progressive Execution Engine
 *
 * 1. Fixed 3-Grid Architecture (4 Levels: Grid #0, #1, #2, #3):
 *    - Grid #0: Base Buy Level (Initial 75% Investment Entry, 25% Cash Reserve)
 *    - Grid #1: 50% Take Profit Sell + 25% Cash Reserve Buy
 *    - Grid #2: 70% Profit Harvest, 30% Runner Bag Retention, Dynamic Midpoint Inter-Grid SL Activation
 *    - Grid #3: 50% Runner Exit & Autonomous Auto-Surge Upgrade
 *
 * 2. Midpoint Inter-Grid Stop-Loss:
 *    - Formula: Inter-Grid SL = (Grid #2 Price + Grid #1 Price) / 2
 *    - Trigger: Liquidates 100% of remaining holdings to cash when price drops <= Inter-Grid SL.
 *
 * 3. Post-SL Re-entry Controller:
 *    - If price drops to Grid #1: Re-buys with 25% of fixed investment budget.
 *    - If price rebounds to Grid #2: Re-buys with 25% of fixed investment budget after a 30s stabilization cooldown.
 *
 * 4. Binance Notional Guard ($5.20 USDT):
 *    - If any fractional sell order value < $5.20, sells 100% of the remaining bag to prevent -1013 NOTIONAL errors.
 *
 * 5. Primary Hard Stop Loss:
 *    - Immediate 100% full liquidation if price <= stopLoss (below Grid #0).
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
import type {
  BotParams,
  JarvisParams,
  BotState,
  BotAction,
  PriceTick,
  ValidationResult,
} from '../types.js';

export interface JarvisLevel {
  price: number;
  index: number;
  role: string;
  type: 'buy' | 'sell';
  orderId?: string;
  filled: boolean;
  buyCount: number;
  lastActionTimestamp?: number;
}

export class JarvisBot extends BaseBotStrategy {
  readonly name = 'JARVIS Bot';
  readonly type = 'JARVIS' as const;

  private gridLevels: JarvisLevel[] = [];
  private gridSpacing = 0;
  private currentLowerPrice = 0;
  private currentUpperPrice = 0;
  private initialLowerPrice = 0;
  private initialUpperPrice = 0;
  private upperPriceIncrementsCount = 0;
  private priceTolerance = 0.0009;
  private gridProfit = 0;
  private gridProfitCount = 0;
  private lastPrice = 0;
  private asset = '';
  private quote = '';

  // 3-Grid Progressive Execution State
  private stageStatus = 'INITIAL';
  private interGridStopLossPrice = 0;
  private interGridSLActive = false;
  private lastInterGridSLTime = 0;
  private lastStageActionTime = 0;
  private pendingOrders = new Map<string, { gridLevel?: number; price: number; side: 'BUY' | 'SELL' }>();

  // Error & Status handling
  private lastError = '';
  private insufficientBalance = false;
  private lastStatusLog = 0;
  private isStopLossActive = false;
  private lastStopLossLog = 0;

  validate(params: BotParams): ValidationResult {
    const p = params as JarvisParams;
    const errors: string[] = [];

    const lowerPrice = toNum(p.lowerPrice);
    const upperPrice = toNum(p.upperPrice);
    const totalInvestment = toNum(p.totalInvestment);
    const stopLoss = toNum(p.stopLoss);
    const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;
    const priceTolerance = toNum(p.priceTolerance);

    if (!lowerPrice || lowerPrice <= 0) errors.push('Lower price must be positive');
    if (!upperPrice || upperPrice <= 0) errors.push('Upper price must be positive');
    if (lowerPrice >= upperPrice) errors.push('Lower price must be less than upper price');
    if (!totalInvestment || totalInvestment <= 0) errors.push('Total investment must be positive');
    if (stopLoss && stopLoss >= lowerPrice) errors.push('Stop loss must be below lower price');
    if (maxBuysPerLevel < 1 || maxBuysPerLevel > 10) errors.push('Max buys per level must be between 1 and 10');
    if (priceTolerance && priceTolerance < 0) errors.push('Price tolerance cannot be negative');

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    const p = this.params as JarvisParams;

    const lowerPrice = toNum(p.lowerPrice);
    const upperPrice = toNum(p.upperPrice);

    this.initialLowerPrice = lowerPrice;
    this.initialUpperPrice = upperPrice;
    this.currentLowerPrice = lowerPrice;
    this.currentUpperPrice = upperPrice;
    this.upperPriceIncrementsCount = 0;

    // Grid spacing (Fixed 3 grid spaces = 4 levels: #0, #1, #2, #3)
    if (p.incrementStepSpace && toNum(p.incrementStepSpace) > 0) {
      this.gridSpacing = toNum(p.incrementStepSpace);
    } else {
      this.gridSpacing = Number(((upperPrice - lowerPrice) / 3).toFixed(6));
    }

    // 4th-Decimal Precision Corridor (Default: ±0.0009 matching 1-9 in 4th decimal point)
    if (p.priceTolerance && toNum(p.priceTolerance) > 0) {
      this.priceTolerance = toNum(p.priceTolerance);
    } else if (p.toleranceDigits && toNum(p.toleranceDigits) > 0) {
      const digits = toNum(p.toleranceDigits);
      this.priceTolerance = Number((Math.pow(10, -digits) * 9).toFixed(digits + 2));
    } else {
      this.priceTolerance = 0.0009;
    }

    // Midpoint Inter-Grid Stop-Loss between Grid #2 and Grid #1
    this.interGridStopLossPrice = Number(((lowerPrice + 2 * this.gridSpacing + lowerPrice + this.gridSpacing) / 2).toFixed(6));
    this.interGridSLActive = false;
    this.stageStatus = 'INITIAL';

    // Build initial uniform 3-grid levels (4 rungs)
    this.rebuildGridLevels((lowerPrice + upperPrice) / 2);

    this.log(`📈 JARVIS 3-Grid Progressive Engine Initialized | Range: [$${lowerPrice.toFixed(6)} - $${upperPrice.toFixed(6)}] | Step: $${this.gridSpacing.toFixed(6)}`);
    this.log(`💰 Capital Allocation: 75% Entry at Grid #0 ($${lowerPrice.toFixed(5)}) | 25% Reserve at Grid #1 ($${(lowerPrice + this.gridSpacing).toFixed(5)})`);
    this.log(`🛡️ Inter-Grid Stop-Loss Midpoint: $${this.interGridStopLossPrice.toFixed(6)} | Precision Corridor: ±$${this.priceTolerance.toFixed(6)}`);

    if (initialState?.customState) {
      this.gridProfit = toNum(initialState.customState.gridProfit);
      this.gridProfitCount = toNum(initialState.customState.gridProfitCount);
      this.initialLowerPrice = toNum(initialState.customState.initialLowerPrice) || this.initialLowerPrice;
      this.initialUpperPrice = toNum(initialState.customState.initialUpperPrice) || this.initialUpperPrice;
      this.currentLowerPrice = toNum(initialState.customState.currentLowerPrice) || this.currentLowerPrice;
      this.currentUpperPrice = toNum(initialState.customState.currentUpperPrice) || this.currentUpperPrice;
      this.upperPriceIncrementsCount = toNum(initialState.customState.upperPriceIncrementsCount) || 0;
      this.stageStatus = initialState.customState.stageStatus || this.stageStatus;
      this.interGridStopLossPrice = toNum(initialState.customState.interGridStopLossPrice) || this.interGridStopLossPrice;
      this.interGridSLActive = initialState.customState.interGridSLActive ?? this.interGridSLActive;
      this.lastInterGridSLTime = toNum(initialState.customState.lastInterGridSLTime) || 0;
      this.lastStageActionTime = toNum(initialState.customState.lastStageActionTime) || 0;
      this.lastError = initialState.customState.lastError || '';
      this.insufficientBalance = initialState.customState.insufficientBalance || false;
      this.isStopLossActive = initialState.customState.isStopLossActive || false;

      if (Array.isArray(initialState.customState.gridLevels) && initialState.customState.gridLevels.length > 0) {
        this.gridLevels = initialState.customState.gridLevels.map((savedGrid: any) => ({
          price: toNum(savedGrid.price),
          index: savedGrid.index,
          role: savedGrid.role || this.getGridRole(savedGrid.index),
          type: savedGrid.type || 'buy',
          orderId: savedGrid.orderId,
          filled: savedGrid.filled || false,
          buyCount: savedGrid.buyCount || 0,
          lastActionTimestamp: savedGrid.lastActionTimestamp,
        }));
      }
    }
  }

  private getGridRole(index: number): string {
    switch (index) {
      case 0:
        return 'Base Buy Level (75% Entry)';
      case 1:
        return '50% Profit Sell + 25% Reserve Buy';
      case 2:
        return '70% Harvest + Inter-Grid SL Midpoint';
      case 3:
        return '50% Runner Exit (Auto-Surge Top)';
      default:
        return `Grid #${index} Level`;
    }
  }

  /**
   * Rebuilds exact 3-grid spaces (4 levels: #0, #1, #2, #3) across active window
   */
  private rebuildGridLevels(currentPrice: number): void {
    const newLevels: JarvisLevel[] = [];

    for (let i = 0; i <= 3; i++) {
      const levelPrice = Number((this.currentLowerPrice + i * this.gridSpacing).toFixed(6));
      const existing = this.gridLevels.find(g => Math.abs(g.price - levelPrice) <= this.gridSpacing * 0.35);

      newLevels.push({
        price: levelPrice,
        index: i,
        role: this.getGridRole(i),
        type: existing ? existing.type : (levelPrice <= currentPrice ? 'buy' : 'sell'),
        orderId: existing?.orderId,
        filled: existing ? existing.filled : false,
        buyCount: existing ? existing.buyCount : 0,
        lastActionTimestamp: existing?.lastActionTimestamp,
      });
    }

    this.gridLevels = newLevels;

    // Recalculate dynamic Midpoint Inter-Grid SL: (Grid #2 + Grid #1) / 2
    this.interGridStopLossPrice = Number(((this.gridLevels[2].price + this.gridLevels[1].price) / 2).toFixed(6));

    // Persist live state
    if (this.customState) {
      this.customState.currentUpperPrice = this.currentUpperPrice;
      this.customState.currentLowerPrice = this.currentLowerPrice;
      this.customState.initialLowerPrice = this.initialLowerPrice;
      this.customState.initialUpperPrice = this.initialUpperPrice;
      this.customState.upperPriceIncrementsCount = this.upperPriceIncrementsCount;
      this.customState.gridLevels = this.gridLevels;
      this.customState.priceTolerance = this.priceTolerance;
      this.customState.interGridStopLossPrice = this.interGridStopLossPrice;
      this.customState.interGridSLActive = this.interGridSLActive;
      this.customState.stageStatus = this.stageStatus;
    }
  }

  handleError(error: string): void {
    this.lastError = error;
    this.log(`ERROR: ${error}`, 'error');

    if (error.toLowerCase().includes('insufficient') ||
        error.toLowerCase().includes('balance') ||
        error.includes('NOTIONAL')) {
      this.insufficientBalance = true;
      this.log(`Insufficient balance - pausing BUY orders. Will retry when balance available.`, 'warn');
    }
  }

  async evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]> {
    if (!this.params) {
      this.log('Strategy not initialized, skipping tick', 'warn');
      return [{ action: 'hold' }];
    }
    const p = this.params as JarvisParams;
    const actions: BotAction[] = [];

    const stopLoss = toNum(p.stopLoss);
    const autoIncrementEnabled = p.autoIncrementEnabled !== false; // Default true
    const totalInvestment = toNum(p.totalInvestment);

    const now = Date.now();
    const currentPrice = tick.price;
    this.lastPrice = currentPrice;

    if (!this.asset) {
      const { base, quote } = parseSymbol(tick.symbol);
      this.asset = base;
      this.quote = quote;
    }

    // ═══════════════════════════════════════════════════════════════
    // 0. HOLDINGS & BALANCE TRACKING
    // ═══════════════════════════════════════════════════════════════
    // Auto-clear insufficient balance flag whenever live available balance >= $5.00
    if (state.availableBalance >= 5.0) {
      if (this.insufficientBalance) {
        this.insufficientBalance = false;
        this.lastError = '';
        this.log(`Balance available ($${state.availableBalance.toFixed(2)} USDT) - clearing insufficient balance flag and resuming BUY orders`);
      } else {
        this.insufficientBalance = false;
      }
    }

    const holding = state.holdings.find(h => (h.asset || '').toUpperCase() === (this.asset || '').toUpperCase());
    const totalHoldingQty = holding?.quantity || 0;
    const lockedHoldingQty = state.openOrders
      .filter(o => o.side === 'SELL')
      .reduce((sum, o) => sum + (o.quantity - (o.filledQuantity || 0)), 0);
    let availableHoldingQty = Math.max(0, totalHoldingQty - lockedHoldingQty);

    // Periodic status heartbeat
    if (now - this.lastStatusLog > 30000) {
      this.lastStatusLog = now;
      const balanceStatus = this.insufficientBalance ? ' [INSUFFICIENT BALANCE]' : '';
      const stopStatus = this.isStopLossActive ? ' [STOP LOSS ACTIVE]' : '';
      const slActiveStatus = this.interGridSLActive ? ` [INTER-GRID SL: $${this.interGridStopLossPrice.toFixed(5)}]` : '';
      this.log(`Tick: $${currentPrice.toFixed(5)} | Stage: ${this.stageStatus} | Holding: ${availableHoldingQty.toFixed(4)} ${this.asset} | Active Range: [$${this.currentLowerPrice.toFixed(4)} - $${this.currentUpperPrice.toFixed(4)}] | Shifts: ${this.upperPriceIncrementsCount}${slActiveStatus}${balanceStatus}${stopStatus}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. PRIMARY HARD STOP LOSS (LOWER SIDE BELOW GRID #0)
    // ═══════════════════════════════════════════════════════════════
    if (stopLoss && currentPrice <= stopLoss) {
      if (!this.isStopLossActive) {
        this.isStopLossActive = true;
        this.interGridSLActive = false;
        this.stageStatus = 'STOP_LOSS';
        this.log(`⚠️ HARD STOP LOSS triggered at $${currentPrice.toFixed(6)} (Stop level: $${stopLoss.toFixed(6)}). Liquidating 100% of all holdings to cash...`, 'warn');
        for (const grid of this.gridLevels) {
          grid.filled = false;
          grid.orderId = undefined;
          grid.buyCount = 0;
          grid.type = 'buy';
        }
        return this.createExitActions(state, 'HARD_STOP_LOSS');
      } else {
        if (now - this.lastStopLossLog > 30000) {
          this.lastStopLossLog = now;
          this.log(`[HARD STOP LOSS ACTIVE] Price $${currentPrice.toFixed(6)} <= Stop $${stopLoss.toFixed(6)}. Waiting for recovery...`);
        }
        return [{ action: 'hold' }];
      }
    }

    // Recover from stop loss if price rebounds above stop level
    if (this.isStopLossActive && currentPrice > stopLoss) {
      this.isStopLossActive = false;
      this.stageStatus = 'INITIAL';
      this.log(`🚀 Price recovered to $${currentPrice.toFixed(6)} (above stop loss $${stopLoss.toFixed(6)}). Resuming JARVIS 3-Grid trading!`);
      this.rebuildGridLevels(currentPrice);
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. MIDPOINT INTER-GRID STOP-LOSS TRIGGER
    // ═══════════════════════════════════════════════════════════════
    if (this.interGridSLActive && availableHoldingQty > 0) {
      const isInterGridSLTouched = currentPrice <= (this.interGridStopLossPrice + this.priceTolerance * 0.5);

      if (isInterGridSLTouched) {
        this.log(`⚠️ [JARVIS Inter-Grid SL] Midpoint Stop Loss Triggered at $${currentPrice.toFixed(5)} <= Midpoint $${this.interGridStopLossPrice.toFixed(5)}! Liquidating 100% of remaining runner holdings (${availableHoldingQty.toFixed(4)} ${this.asset}) to cash...`, 'warn');

        actions.push({
          action: 'sell',
          quantity: availableHoldingQty,
          price: currentPrice,
          orderType: 'MARKET',
          metadata: { isInterGridSL: true, triggerPrice: currentPrice, stopLossPrice: this.interGridStopLossPrice }
        });

        availableHoldingQty = 0;
        this.interGridSLActive = false;
        this.lastInterGridSLTime = now;
        this.stageStatus = 'SL_LIQUIDATED';
        if (this.gridLevels[1]) this.gridLevels[1].lastActionTimestamp = 0;
        if (this.gridLevels[2]) this.gridLevels[2].lastActionTimestamp = 0;

        return actions;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. POST-INTER-GRID SL RE-ENTRY CONTROLLER
    // ═══════════════════════════════════════════════════════════════
    if (this.stageStatus === 'SL_LIQUIDATED' || (this.lastInterGridSLTime > 0 && availableHoldingQty === 0 && !this.interGridSLActive)) {
      const grid1Price = this.gridLevels[1]?.price || (this.currentLowerPrice + this.gridSpacing);
      const grid2Price = this.gridLevels[2]?.price || (this.currentLowerPrice + 2 * this.gridSpacing);

      // Condition A: If price drops back to Grid #1 -> Re-buy with 25% of fixed investment budget
      const isGrid1Dip = currentPrice <= (grid1Price + this.priceTolerance) && currentPrice >= (this.gridLevels[0].price - this.priceTolerance);
      if (isGrid1Dip && now - (this.gridLevels[1]?.lastActionTimestamp || 0) > 1000) {
        const reEntryBudget = totalInvestment * 0.25;
        if (!this.insufficientBalance && (state.availableBalance >= reEntryBudget || state.availableBalance >= 5.0)) {
          const buyBudget = Math.min(state.availableBalance, reEntryBudget);
          const buyQty = buyBudget / currentPrice;

          if (buyBudget >= 5.0) {
            actions.push({
              action: 'buy',
              quantity: buyQty,
              price: currentPrice,
              orderType: 'MARKET',
              gridLevel: 1,
              metadata: { jarvisStage: 'POST_SL_GRID_1_REENTRY', targetPrice: grid1Price }
            });

            this.stageStatus = 'GRID_1_REENTRY';
            if (this.gridLevels[1]) this.gridLevels[1].lastActionTimestamp = now;
            this.log(`⚡ [JARVIS Re-Entry] Dip Buy Triggered at Grid #1 ($${grid1Price.toFixed(5)}) after SL! Deploying 25% budget ($${buyBudget.toFixed(2)} USDT = ${buyQty.toFixed(4)} ${this.asset})...`);
            return actions;
          }
        }
      }

      // Condition B: If price rebounds back to Grid #2 -> Re-buy with 25% budget after a 30s stabilization cooldown
      const isGrid2Rebound = currentPrice >= (grid2Price - this.priceTolerance);
      if (isGrid2Rebound) {
        const cooldownPassed = (now - this.lastInterGridSLTime) >= 30000;
        if (cooldownPassed && now - (this.gridLevels[2]?.lastActionTimestamp || 0) > 1000) {
          const reEntryBudget = totalInvestment * 0.25;
          if (!this.insufficientBalance && (state.availableBalance >= reEntryBudget || state.availableBalance >= 5.0)) {
            const buyBudget = Math.min(state.availableBalance, reEntryBudget);
            const buyQty = buyBudget / currentPrice;

            if (buyBudget >= 5.0) {
              actions.push({
                action: 'buy',
                quantity: buyQty,
                price: currentPrice,
                orderType: 'MARKET',
                gridLevel: 2,
                metadata: { jarvisStage: 'POST_SL_GRID_2_REENTRY', targetPrice: grid2Price }
              });

              this.stageStatus = 'GRID_2_REENTRY';
              this.interGridSLActive = true;
              this.interGridStopLossPrice = Number(((this.gridLevels[2].price + this.gridLevels[1].price) / 2).toFixed(6));
              if (this.gridLevels[2]) this.gridLevels[2].lastActionTimestamp = now;
              this.log(`⚡ [JARVIS Re-Entry] Rebound Buy Triggered at Grid #2 ($${grid2Price.toFixed(5)}) after 30s cooldown! Deploying 25% budget ($${buyBudget.toFixed(2)} USDT). Inter-Grid SL Reactivated at Midpoint: $${this.interGridStopLossPrice.toFixed(5)}.`);
              return actions;
            }
          }
        } else if (!cooldownPassed && now - this.lastStatusLog > 10000) {
          const remainingSec = Math.ceil((30000 - (now - this.lastInterGridSLTime)) / 1000);
          this.log(`⏳ [JARVIS Cooldown] Price at Grid #2 ($${currentPrice.toFixed(5)}). Waiting ${remainingSec}s for stabilization cooldown before re-entry...`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. AUTONOMOUS UPPER BREAKOUT UPGRADE (BULLISH SURGE AT GRID #3)
    // ═══════════════════════════════════════════════════════════════
    if (autoIncrementEnabled && currentPrice >= (this.currentUpperPrice - this.priceTolerance * 0.25)) {
      const excess = Math.max(0, currentPrice - this.currentUpperPrice);
      const stepsUp = Math.max(1, Math.floor(excess / this.gridSpacing) + 1);

      const oldUpper = this.currentUpperPrice;
      const oldLower = this.currentLowerPrice;

      this.currentUpperPrice = Number((this.currentUpperPrice + stepsUp * this.gridSpacing).toFixed(6));
      this.currentLowerPrice = Number((this.currentLowerPrice + stepsUp * this.gridSpacing).toFixed(6));
      this.upperPriceIncrementsCount += stepsUp;

      // Re-align 3-grid window with exact uniform step spacing
      this.rebuildGridLevels(currentPrice);

      this.log(`🚀 [JARVIS Auto-Upgrade] Upper boundary surged! Price $${currentPrice.toFixed(6)} >= Upper $${oldUpper.toFixed(6)}. Shifted range up by +${stepsUp} step(s) (+$${(stepsUp * this.gridSpacing).toFixed(6)}). New Range: [$${this.currentLowerPrice.toFixed(6)} - $${this.currentUpperPrice.toFixed(6)}] (Total Shifts: ${this.upperPriceIncrementsCount}). Fresh dip buy levels generated beneath peak!`);
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. AUTONOMOUS PULLBACK DOWNGRADE (BEARISH MEAN-REVERSION)
    // ═══════════════════════════════════════════════════════════════
    if (autoIncrementEnabled && this.upperPriceIncrementsCount > 0) {
      const dropBelowUpper = this.currentUpperPrice - this.gridSpacing - currentPrice;
      if (dropBelowUpper >= this.gridSpacing) {
        const stepsDown = Math.min(Math.floor(dropBelowUpper / this.gridSpacing), this.upperPriceIncrementsCount);

        if (stepsDown >= 1) {
          const oldUpper = this.currentUpperPrice;
          const oldLower = this.currentLowerPrice;

          this.currentUpperPrice = Number(Math.max(this.initialUpperPrice, this.currentUpperPrice - stepsDown * this.gridSpacing).toFixed(6));
          this.currentLowerPrice = Number(Math.max(this.initialLowerPrice, this.currentLowerPrice - stepsDown * this.gridSpacing).toFixed(6));
          this.upperPriceIncrementsCount = Math.max(0, this.upperPriceIncrementsCount - stepsDown);

          this.rebuildGridLevels(currentPrice);

          this.log(`⚡ [JARVIS Auto-Downgrade] Price pulled back to $${currentPrice.toFixed(6)} (below $${(oldUpper - 2 * this.gridSpacing).toFixed(6)}). Shifted range down by -${stepsDown} step(s). New Range: [$${this.currentLowerPrice.toFixed(6)} - $${this.currentUpperPrice.toFixed(6)}] (Remaining Shifts: ${this.upperPriceIncrementsCount}).`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. MAIN 3-GRID PROGRESSIVE EXECUTION PHASES
    // ═══════════════════════════════════════════════════════════════

    // ─── PHASE 0: Initial Entry at Grid #0 (Deploy 75% Budget) ───
    const grid0 = this.gridLevels[0];
    const isGrid0Touch = grid0 && (
      this.stageStatus === 'INITIAL' ||
      (totalHoldingQty === 0 && this.stageStatus !== 'SL_LIQUIDATED' && now - (grid0.lastActionTimestamp || 0) > 2000)
    );

    if (isGrid0Touch && currentPrice <= (grid0.price + this.gridSpacing * 0.8)) {
      const entryBudget = totalInvestment * 0.75;
      if (!this.insufficientBalance && (state.availableBalance >= entryBudget || state.availableBalance >= 5.0)) {
        const actualBudget = Math.min(state.availableBalance, entryBudget);
        const buyQty = actualBudget / currentPrice;

        if (actualBudget >= 5.0) {
          actions.push({
            action: 'buy',
            quantity: buyQty,
            price: currentPrice,
            orderType: 'MARKET',
            gridLevel: 0,
            metadata: { jarvisStage: 'PHASE_0_ENTRY', targetPrice: grid0.price }
          });

          this.stageStatus = 'GRID_0_BOUGHT';
          grid0.lastActionTimestamp = now;
          this.log(`⚡ [JARVIS Phase 0] Initial Entry Triggered at Grid #0 ($${grid0.price.toFixed(5)})! Deployed 75% Total Investment ($${actualBudget.toFixed(2)} USDT = ${buyQty.toFixed(4)} ${this.asset}). Holding 25% cash reserve ($${(totalInvestment * 0.25).toFixed(2)} USDT).`);
          return actions;
        }
      }
    }

    // ─── PHASE 1: Grid #1 Action (50% Profit Sell + 25% Reserve Buy) ───
    const grid1 = this.gridLevels[1];
    if (grid1) {
      // Case 1: Active waiting for 25% reserve buy settlement
      if (this.stageStatus === 'GRID_1_PENDING_BUY') {
        const reserveBudget = totalInvestment * 0.25;
        if (!this.insufficientBalance && (state.availableBalance >= reserveBudget || state.availableBalance >= 5.0)) {
          const actualBudget = Math.min(state.availableBalance, reserveBudget);
          const buyQty = actualBudget / currentPrice;

          if (actualBudget >= 5.0) {
            actions.push({
              action: 'buy',
              quantity: buyQty,
              price: currentPrice,
              orderType: 'MARKET',
              gridLevel: 1,
              metadata: { jarvisStage: 'PHASE_1_RESERVE_BUY', targetPrice: grid1.price }
            });

            this.stageStatus = 'GRID_1_COMPLETED';
            grid1.lastActionTimestamp = now;
            this.log(`⚡ [JARVIS Phase 1] Settlement balance received ($${actualBudget.toFixed(2)} USDT)! Deployed 25% cash reserve (${buyQty.toFixed(4)} ${this.asset}). Phase 1 complete! Moving to Phase 2 harvest.`);
            return actions;
          }
        }
      }

      // Case 2: Triggering Grid #1 for the first time
      if (currentPrice >= (grid1.price - this.priceTolerance)) {
        const isEligibleForPhase1 = this.stageStatus === 'GRID_0_BOUGHT' || (this.stageStatus === 'INITIAL' && availableHoldingQty > 0);

        if (isEligibleForPhase1 && now - (grid1.lastActionTimestamp || 0) > 2000) {
          let hasSold = false;
          // A. Sell 50% of existing coins
          if (availableHoldingQty > 0) {
            let sellQty = availableHoldingQty * 0.50;

            // Binance Notional Guard ($5.20 USDT): Convert sub-$5.20 fractional sells to 100% position exit
            if (sellQty * currentPrice < 5.20 && availableHoldingQty * currentPrice >= 5.00) {
              this.log(`🛡️ [JARVIS Notional Guard] 50% sell order ($${(sellQty * currentPrice).toFixed(2)}) is below $5.20. Converting to 100% position exit (${availableHoldingQty.toFixed(4)} ${this.asset}) to prevent NOTIONAL error.`);
              sellQty = availableHoldingQty;
            }

            if (sellQty * currentPrice >= 5.00) {
              actions.push({
                action: 'sell',
                quantity: sellQty,
                price: currentPrice,
                orderType: 'MARKET',
                gridLevel: 1,
                metadata: { jarvisStage: 'PHASE_1_PROFIT_SELL', targetPrice: grid1.price }
              });
              availableHoldingQty -= sellQty;
              grid1.type = 'sell';
              hasSold = true;
            }
          }

          // B. Deploy remaining 25% cash reserve if balance is already available
          const reserveBudget = totalInvestment * 0.25;
          let hasBought = false;
          if (!this.insufficientBalance && (state.availableBalance >= reserveBudget || state.availableBalance >= 5.0)) {
            const actualBudget = Math.min(state.availableBalance, reserveBudget);
            const buyQty = actualBudget / currentPrice;

            if (actualBudget >= 5.0) {
              actions.push({
                action: 'buy',
                quantity: buyQty,
                price: currentPrice,
                orderType: 'MARKET',
                gridLevel: 1,
                metadata: { jarvisStage: 'PHASE_1_RESERVE_BUY', targetPrice: grid1.price }
              });
              hasBought = true;
            }
          }

          grid1.lastActionTimestamp = now;

          if (hasBought) {
            this.stageStatus = 'GRID_1_COMPLETED';
            this.log(`⚡ [JARVIS Phase 1] Grid #1 ($${grid1.price.toFixed(5)}) Reached! Executed 50% profit sell and deployed 25% cash reserve ($${(totalInvestment * 0.25).toFixed(2)} USDT). Moving to Phase 2 harvest!`);
          } else if (hasSold) {
            this.stageStatus = 'GRID_1_PENDING_BUY';
            this.log(`⚡ [JARVIS Phase 1] Grid #1 ($${grid1.price.toFixed(5)}) Reached! Executed 50% profit sell. Waiting for USDT settlement to deploy 25% cash reserve ($${(totalInvestment * 0.25).toFixed(2)} USDT)...`);
          }

          if (actions.length > 0) return actions;
        }
      }
    }

    // ─── PHASE 2: Grid #2 Action (70% Harvest + 30% Runner Retention + Midpoint Inter-Grid SL) ───
    const grid2 = this.gridLevels[2];
    if (grid2 && currentPrice >= (grid2.price - this.priceTolerance)) {
      const isEligibleForPhase2 = this.stageStatus === 'GRID_1_COMPLETED' || this.stageStatus === 'GRID_1_REENTRY' || (this.stageStatus === 'GRID_1_PENDING_BUY' && availableHoldingQty > 0);

      if (isEligibleForPhase2 && availableHoldingQty > 0 && now - (grid2.lastActionTimestamp || 0) > 2000) {
        let sellQty = availableHoldingQty * 0.70;

        // Binance Notional Guard ($5.20 USDT)
        if (sellQty * currentPrice < 5.20 && availableHoldingQty * currentPrice >= 5.00) {
          this.log(`🛡️ [JARVIS Notional Guard] 70% sell order ($${(sellQty * currentPrice).toFixed(2)}) is below $5.20. Converting to 100% position exit to satisfy Binance NOTIONAL filter.`);
          sellQty = availableHoldingQty;
        }

        if (sellQty * currentPrice >= 5.00) {
          actions.push({
            action: 'sell',
            quantity: sellQty,
            price: currentPrice,
            orderType: 'MARKET',
            gridLevel: 2,
            metadata: { jarvisStage: 'PHASE_2_HARVEST', targetPrice: grid2.price }
          });
          availableHoldingQty -= sellQty;
          grid2.type = 'sell';
        }

        // Activate Midpoint Inter-Grid Stop-Loss: (Grid #2 + Grid #1) / 2
        this.interGridStopLossPrice = Number(((this.gridLevels[2].price + this.gridLevels[1].price) / 2).toFixed(6));
        this.interGridSLActive = true;
        this.stageStatus = 'GRID_2_HARVESTED';
        grid2.lastActionTimestamp = now;

        this.log(`⚡ [JARVIS Phase 2] Grid #2 ($${grid2.price.toFixed(5)}) Reached! Harvested 70% holding (Runner Bag Retained: ${availableHoldingQty.toFixed(4)} ${this.asset}). Inter-Grid SL ACTIVATED at Midpoint: $${this.interGridStopLossPrice.toFixed(5)}.`);
        if (actions.length > 0) return actions;
      }
    }

    // ─── PHASE 3: Grid #3 / Runner Action (50% Profit Exit on Surge Top) ───
    const grid3 = this.gridLevels[3];
    if (grid3 && currentPrice >= (grid3.price - this.priceTolerance)) {
      const isEligibleForPhase3 = this.stageStatus === 'GRID_2_HARVESTED' || this.stageStatus === 'GRID_2_REENTRY' || this.stageStatus === 'GRID_3_SURGE';

      if (isEligibleForPhase3 && availableHoldingQty > 0 && now - (grid3.lastActionTimestamp || 0) > 2000) {
        let sellQty = availableHoldingQty * 0.50;

        // Binance Notional Guard ($5.20 USDT)
        if (sellQty * currentPrice < 5.20 && availableHoldingQty * currentPrice >= 5.00) {
          this.log(`🛡️ [JARVIS Notional Guard] 50% runner sell ($${(sellQty * currentPrice).toFixed(2)}) is below $5.20. Converting to 100% position exit.`);
          sellQty = availableHoldingQty;
        }

        if (sellQty * currentPrice >= 5.00) {
          actions.push({
            action: 'sell',
            quantity: sellQty,
            price: currentPrice,
            orderType: 'MARKET',
            gridLevel: 3,
            metadata: { jarvisStage: 'PHASE_3_SURGE', targetPrice: grid3.price }
          });
          availableHoldingQty -= sellQty;
        }

        this.stageStatus = 'GRID_3_SURGE';
        grid3.lastActionTimestamp = now;

        this.log(`⚡ [JARVIS Phase 3] Grid #3 ($${grid3.price.toFixed(5)}) Reached! Taking 50% profit on runner bag (Remaining Runner: ${availableHoldingQty.toFixed(4)} ${this.asset}). Ready for dynamic window expansions!`);
        if (actions.length > 0) return actions;
      }
    }

    if (actions.length > 0) {
      this.log(`[JARVIS] Executing ${actions.length} action(s): ${actions.map(a => `${a.action.toUpperCase()} ${a.quantity?.toFixed(4)} @ $${a.price?.toFixed(6) || 'market'}`).join(', ')}`);
    }

    return actions.length > 0 ? actions : [{ action: 'hold' }];
  }

  private createExitActions(state: BotState, reason: string = 'STOP_LOSS'): BotAction[] {
    const actions: BotAction[] = [];
    actions.push({ action: 'cancel_all', metadata: { isExit: true, exitReason: reason } });

    for (const holding of state.holdings) {
      if (holding.quantity > 0) {
        actions.push({
          action: 'sell',
          quantity: holding.quantity,
          orderType: 'MARKET',
          metadata: { isExit: true, exitReason: reason },
        });
      }
    }

    this.log(`[JARVIS Exit] Liquidating all holdings due to ${reason}`);
    return actions;
  }

  onOrderPlaced(orderId: string, gridLevel?: number, price?: number, side?: string): void {
    if (orderId) {
      this.pendingOrders.set(orderId, {
        gridLevel,
        price: price || 0,
        side: (side || 'BUY').toUpperCase() as 'BUY' | 'SELL',
      });
    }
  }

  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number, side?: string): void {
    const trackedOrder = this.pendingOrders.get(orderId);
    const resolvedSide = (side || trackedOrder?.side || '').toUpperCase();
    let gridLevelIdx = trackedOrder?.gridLevel;

    let grid = (gridLevelIdx !== undefined) ? this.gridLevels[gridLevelIdx] : this.gridLevels.find(g => g.orderId === orderId);
    if (!grid && filledPrice > 0) {
      grid = this.gridLevels.find(g => Math.abs(g.price - filledPrice) <= (this.gridSpacing * 0.45 + this.priceTolerance));
    }

    let isBuy = resolvedSide === 'BUY';
    let isSell = resolvedSide === 'SELL';

    if (!resolvedSide && grid) {
      if (grid.index === 0) {
        isBuy = true;
      } else if (grid.index >= 2) {
        isSell = true;
      } else if (grid.index === 1) {
        isSell = this.stageStatus === 'GRID_1_PENDING_BUY' || this.stageStatus === 'GRID_0_BOUGHT';
        isBuy = !isSell;
      }
    }

    if (grid) {
      grid.filled = true;
      if (isBuy || (!isSell && grid.type === 'buy')) {
        grid.buyCount++;
        grid.type = 'buy';
        this.log(`BUY filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} x ${filledQuantity.toFixed(4)} (buy #${grid.buyCount}). Next level: Grid #${Math.min(grid.index + 1, 3)}`);
      } else {
        grid.type = 'sell';
        const profit = filledQuantity * this.gridSpacing;
        this.gridProfit += profit;
        this.gridProfitCount++;
        this.log(`SELL filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} | Profit: +$${profit.toFixed(4)} | Total cycles: ${this.gridProfitCount}`);
      }
    } else {
      const displaySide = isSell ? 'SELL' : (isBuy ? 'BUY' : 'Order');
      this.log(`${displaySide} filled: $${filledPrice.toFixed(6)} x ${filledQuantity.toFixed(4)}`);
    }

    if (orderId) this.pendingOrders.delete(orderId);

    this.customState.gridProfit = this.gridProfit;
    this.customState.gridProfitCount = this.gridProfitCount;
    this.customState.gridLevels = this.gridLevels;
    this.customState.currentUpperPrice = this.currentUpperPrice;
    this.customState.currentLowerPrice = this.currentLowerPrice;
    this.customState.initialLowerPrice = this.initialLowerPrice;
    this.customState.initialUpperPrice = this.initialUpperPrice;
    this.customState.upperPriceIncrementsCount = this.upperPriceIncrementsCount;
    this.customState.priceTolerance = this.priceTolerance;
    this.customState.interGridStopLossPrice = this.interGridStopLossPrice;
    this.customState.interGridSLActive = this.interGridSLActive;
    this.customState.stageStatus = this.stageStatus;
    this.customState.lastInterGridSLTime = this.lastInterGridSLTime;
    this.customState.lastError = this.lastError;
    this.customState.isStopLossActive = this.isStopLossActive;
  }

  onOrderCancelled(orderId: string): void {
    if (orderId) this.pendingOrders.delete(orderId);
    const grid = this.gridLevels.find(g => g.orderId === orderId);
    if (grid) {
      grid.orderId = undefined;
    }
  }

  onOrderError(error: string): void {
    this.lastError = error;
    this.log(`Order error: ${error}`, 'error');

    if (error.includes('NOTIONAL') ||
        error.toLowerCase().includes('insufficient') ||
        error.includes('MIN_NOTIONAL') ||
        error.toLowerCase().includes('balance')) {
      this.insufficientBalance = true;
      this.log(`Balance issue detected - pausing BUY orders until balance is sufficient`, 'warn');
    }
  }

  protected getMetrics(): Record<string, number> {
    const p = this.params as JarvisParams | null;
    if (!p) {
      return {
        gridCount: 3,
        gridSpacing: 0,
        lowerPrice: 0,
        upperPrice: 0,
        initialUpperPrice: 0,
        initialLowerPrice: 0,
        upperPriceIncrementsCount: 0,
        priceTolerance: 0,
        interGridStopLossPrice: 0,
        interGridSLActive: 0,
        gridProfit: 0,
        gridProfitCount: 0,
        currentPrice: 0,
        insufficientBalance: this.insufficientBalance ? 1 : 0,
      };
    }
    return {
      gridCount: 3,
      gridSpacing: this.gridSpacing,
      lowerPrice: this.currentLowerPrice || toNum(p.lowerPrice),
      upperPrice: this.currentUpperPrice || toNum(p.upperPrice),
      initialUpperPrice: this.initialUpperPrice || toNum(p.upperPrice),
      initialLowerPrice: this.initialLowerPrice || toNum(p.lowerPrice),
      upperPriceIncrementsCount: this.upperPriceIncrementsCount,
      priceTolerance: this.priceTolerance,
      interGridStopLossPrice: this.interGridStopLossPrice,
      interGridSLActive: this.interGridSLActive ? 1 : 0,
      gridProfit: this.gridProfit,
      gridProfitCount: this.gridProfitCount,
      currentPrice: this.lastPrice,
      maxBuysPerLevel: toNum(p.maxBuysPerLevel) || 1,
      insufficientBalance: this.insufficientBalance ? 1 : 0,
    };
  }

  restoreState(customState: Record<string, any>): void {
    super.restoreState(customState);
    this.gridProfit = toNum(customState.gridProfit);
    this.gridProfitCount = toNum(customState.gridProfitCount);
    this.initialLowerPrice = toNum(customState.initialLowerPrice) || this.initialLowerPrice;
    this.initialUpperPrice = toNum(customState.initialUpperPrice) || this.initialUpperPrice;
    this.currentLowerPrice = toNum(customState.currentLowerPrice) || this.currentLowerPrice;
    this.currentUpperPrice = toNum(customState.currentUpperPrice) || this.currentUpperPrice;
    this.upperPriceIncrementsCount = toNum(customState.upperPriceIncrementsCount) || this.upperPriceIncrementsCount;
    this.priceTolerance = toNum(customState.priceTolerance) || this.priceTolerance;
    this.interGridStopLossPrice = toNum(customState.interGridStopLossPrice) || this.interGridStopLossPrice;
    this.interGridSLActive = customState.interGridSLActive ?? this.interGridSLActive;
    this.stageStatus = customState.stageStatus || this.stageStatus;
    this.lastInterGridSLTime = toNum(customState.lastInterGridSLTime) || 0;
    this.lastStageActionTime = toNum(customState.lastStageActionTime) || 0;
    this.lastError = customState.lastError || '';
    this.insufficientBalance = customState.insufficientBalance || false;
    this.isStopLossActive = customState.isStopLossActive || false;

    if (Array.isArray(customState.gridLevels)) {
      this.gridLevels = customState.gridLevels.map((g: any) => ({
        ...g,
        role: g.role || this.getGridRole(g.index),
        buyCount: g.buyCount || 0,
      }));
    }
  }

  getCustomState(): Record<string, any> {
    return {
      gridProfit: this.gridProfit,
      gridProfitCount: this.gridProfitCount,
      gridLevels: this.gridLevels,
      currentLowerPrice: this.currentLowerPrice,
      currentUpperPrice: this.currentUpperPrice,
      initialLowerPrice: this.initialLowerPrice,
      initialUpperPrice: this.initialUpperPrice,
      upperPriceIncrementsCount: this.upperPriceIncrementsCount,
      priceTolerance: this.priceTolerance,
      interGridStopLossPrice: this.interGridStopLossPrice,
      interGridSLActive: this.interGridSLActive,
      stageStatus: this.stageStatus,
      lastInterGridSLTime: this.lastInterGridSLTime,
      lastStageActionTime: this.lastStageActionTime,
      lastError: this.lastError,
      insufficientBalance: this.insufficientBalance,
      isStopLossActive: this.isStopLossActive,
    };
  }
}

