/**
 * JarvisBot Strategy - Autonomous Upper-Bound Expanding Grid Trading Bot
 *
 * Solves the traditional grid limitation where a bot halts/stalls when market price
 * breaks out above the upper bound ("out of grid").
 *
 * When market price surges and reaches or exceeds the upper price:
 * The bot acts AUTONOMOUSLY to increase its upper price:
 *   newUpperPrice = currentPrice + gridSpacing (Step Space)
 * and dynamically recalibrates its grid levels to continue active, profitable trading.
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

interface JarvisLevel {
  price: number;
  index: number;
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
  private initialUpperPrice = 0;
  private upperPriceIncrementsCount = 0;
  private priceTolerance = 0;
  private gridProfit = 0;
  private gridProfitCount = 0;
  private lastPrice = 0;
  private asset = '';
  private quote = '';

  // Error & Status handling
  private lastError = '';
  private insufficientBalance = false;
  private lastBalanceCheck = 0;
  private lastStatusLog = 0;
  private isStopLossActive = false;
  private lastStopLossLog = 0;
  private lastIncrementLog = 0;

  validate(params: BotParams): ValidationResult {
    const p = params as JarvisParams;
    const errors: string[] = [];

    const lowerPrice = toNum(p.lowerPrice);
    const upperPrice = toNum(p.upperPrice);
    const gridCount = toNum(p.gridCount);
    const totalInvestment = toNum(p.totalInvestment);
    const stopLoss = toNum(p.stopLoss);
    const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;

    if (!lowerPrice || lowerPrice <= 0) errors.push('Lower price must be positive');
    if (!upperPrice || upperPrice <= 0) errors.push('Upper price must be positive');
    if (lowerPrice >= upperPrice) errors.push('Lower price must be less than upper price');
    if (!gridCount || gridCount < 2 || gridCount > 200) errors.push('Grid count must be between 2 and 200');
    if (!totalInvestment || totalInvestment <= 0) errors.push('Total investment must be positive');
    if (stopLoss && stopLoss >= lowerPrice) errors.push('Stop loss must be below lower price');
    if (maxBuysPerLevel < 1 || maxBuysPerLevel > 10) errors.push('Max buys per level must be between 1 and 10');

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    const p = this.params as JarvisParams;

    const lowerPrice = toNum(p.lowerPrice);
    const upperPrice = toNum(p.upperPrice);
    const gridCount = toNum(p.gridCount);
    const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;

    this.currentLowerPrice = lowerPrice;
    this.currentUpperPrice = upperPrice;
    this.initialUpperPrice = upperPrice;
    this.upperPriceIncrementsCount = 0;

    // Grid spacing (Step Space)
    if (p.incrementStepSpace && p.incrementStepSpace > 0) {
      this.gridSpacing = toNum(p.incrementStepSpace);
    } else {
      this.gridSpacing = (upperPrice - lowerPrice) / gridCount;
    }

    // Tolerance corridor buffer (auto-tuned to 15% of grid spacing or sub-cent precision)
    if (p.priceTolerance && p.priceTolerance > 0) {
      this.priceTolerance = toNum(p.priceTolerance);
    } else {
      this.priceTolerance = Math.min(this.gridSpacing * 0.15, lowerPrice < 1.0 ? 0.0009 : lowerPrice < 100 ? 0.05 : 0.5);
    }

    // Build initial grid levels
    this.gridLevels = [];
    for (let i = 0; i <= gridCount; i++) {
      const price = lowerPrice + i * this.gridSpacing;
      this.gridLevels.push({
        price,
        index: i,
        type: 'buy',
        filled: false,
        buyCount: 0,
      });
    }

    this.log(`📈 JARVIS Bot initialized with ${gridCount} grids | Step Space: $${this.gridSpacing.toFixed(6)} | Range: $${lowerPrice.toFixed(6)} - $${upperPrice.toFixed(6)}`);
    this.log(`⚡ Autonomous Upper Increment: ENABLED (Expands upper boundary automatically on market surges)`);

    if (initialState?.customState) {
      this.gridProfit = toNum(initialState.customState.gridProfit);
      this.gridProfitCount = toNum(initialState.customState.gridProfitCount);
      this.currentUpperPrice = toNum(initialState.customState.currentUpperPrice) || this.currentUpperPrice;
      this.upperPriceIncrementsCount = toNum(initialState.customState.upperPriceIncrementsCount) || 0;
      this.lastError = initialState.customState.lastError || '';
      this.insufficientBalance = initialState.customState.insufficientBalance || false;
      this.isStopLossActive = initialState.customState.isStopLossActive || false;

      if (Array.isArray(initialState.customState.gridLevels) && initialState.customState.gridLevels.length > 0) {
        this.gridLevels = initialState.customState.gridLevels.map((savedGrid: any) => ({
          price: toNum(savedGrid.price),
          index: savedGrid.index,
          type: savedGrid.type || 'buy',
          orderId: savedGrid.orderId,
          filled: savedGrid.filled || false,
          buyCount: savedGrid.buyCount || 0,
          lastActionTimestamp: savedGrid.lastActionTimestamp,
        }));
      }
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
    const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;
    const autoIncrementEnabled = p.autoIncrementEnabled !== false; // Default true
    const baseGridCount = toNum(p.gridCount);
    const investmentPerGrid = toNum(p.totalInvestment) / baseGridCount;

    const now = Date.now();
    const currentPrice = tick.price;
    this.lastPrice = currentPrice;

    if (!this.asset) {
      const { base, quote } = parseSymbol(tick.symbol);
      this.asset = base;
      this.quote = quote;
    }

    // Periodic status heartbeat
    if (now - this.lastStatusLog > 30000) {
      this.lastStatusLog = now;
      const balanceStatus = this.insufficientBalance ? ' [INSUFFICIENT BALANCE]' : '';
      const stopStatus = this.isStopLossActive ? ' [STOP LOSS ACTIVE]' : '';
      this.log(`Tick: $${currentPrice.toFixed(6)} | Range: [$${this.currentLowerPrice.toFixed(4)} - $${this.currentUpperPrice.toFixed(4)}] | Auto-Increments: ${this.upperPriceIncrementsCount} | Profit Cycles: ${this.gridProfitCount}${balanceStatus}${stopStatus}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. STOP LOSS PROTECTION (LOWER SIDE)
    // ═══════════════════════════════════════════════════════════════
    if (stopLoss && currentPrice <= stopLoss) {
      if (!this.isStopLossActive) {
        this.isStopLossActive = true;
        this.log(`⚠️ STOP LOSS triggered at $${currentPrice.toFixed(6)} (Stop level: $${stopLoss.toFixed(6)}). Liquidating all positions to cash...`, 'warn');
        for (const grid of this.gridLevels) {
          grid.filled = false;
          grid.orderId = undefined;
          grid.buyCount = 0;
          grid.type = 'buy';
        }
        return this.createExitActions(state, 'STOP_LOSS');
      } else {
        if (now - this.lastStopLossLog > 30000) {
          this.lastStopLossLog = now;
          this.log(`[STOP LOSS ACTIVE] Price $${currentPrice.toFixed(6)} <= Stop $${stopLoss.toFixed(6)}. Waiting for recovery...`);
        }
        return [{ action: 'hold' }];
      }
    }

    // Recover from stop loss if price rebounds
    if (this.isStopLossActive && currentPrice > stopLoss) {
      this.isStopLossActive = false;
      this.log(`🚀 Price recovered to $${currentPrice.toFixed(6)} (above stop loss $${stopLoss.toFixed(6)}). Resuming JARVIS trading!`);
      for (const grid of this.gridLevels) {
        grid.filled = false;
        grid.orderId = undefined;
        grid.buyCount = 0;
        grid.type = grid.price < currentPrice ? 'buy' : 'sell';
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. AUTONOMOUS UPPER PRICE INCREMENT ON SURGE
    // ═══════════════════════════════════════════════════════════════
    if (autoIncrementEnabled && currentPrice >= this.currentUpperPrice) {
      const oldUpper = this.currentUpperPrice;
      // Formula: newUpperPrice = currentPrice + Grid Step Space
      const newUpper = Number((currentPrice + this.gridSpacing).toFixed(6));
      this.currentUpperPrice = newUpper;
      this.upperPriceIncrementsCount++;

      // Recalculate / Extend grid levels up to newUpperPrice
      const maxCurrentIndex = this.gridLevels.reduce((max, g) => Math.max(max, g.index), 0);
      const targetIndex = Math.round((this.currentUpperPrice - this.currentLowerPrice) / this.gridSpacing);

      if (targetIndex > maxCurrentIndex) {
        for (let i = maxCurrentIndex + 1; i <= targetIndex; i++) {
          const levelPrice = Number((this.currentLowerPrice + i * this.gridSpacing).toFixed(6));
          this.gridLevels.push({
            price: levelPrice,
            index: i,
            type: levelPrice < currentPrice ? 'buy' : 'sell',
            filled: false,
            buyCount: 0,
          });
        }
      }

      // Re-evaluate level types relative to currentPrice
      for (const grid of this.gridLevels) {
        if (!grid.orderId) {
          grid.type = grid.price <= currentPrice ? 'buy' : 'sell';
        }
      }

      this.log(`🚀 [JARVIS Auto-Increment] Upper boundary surged! Price $${currentPrice.toFixed(6)} >= Upper $${oldUpper.toFixed(6)}. Autonomously increased Upper Price to $${this.currentUpperPrice.toFixed(6)} (Increment #${this.upperPriceIncrementsCount}, Step Space: +$${this.gridSpacing.toFixed(6)}). Total grid levels: ${this.gridLevels.length}. Resuming active trading cycle!`);

      // Persist live state immediately
      this.customState.currentUpperPrice = this.currentUpperPrice;
      this.customState.upperPriceIncrementsCount = this.upperPriceIncrementsCount;
      this.customState.gridLevels = this.gridLevels;
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. PROCESS ACTIVE GRID TRADING (BUYS & SELLS)
    // ═══════════════════════════════════════════════════════════════
    const holding = state.holdings.find(h => (h.asset || '').toUpperCase() === (this.asset || '').toUpperCase());
    const totalHoldingQty = holding?.quantity || 0;
    const lockedHoldingQty = state.openOrders
      .filter(o => o.side === 'SELL')
      .reduce((sum, o) => sum + (o.quantity - (o.filledQuantity || 0)), 0);
    let availableHoldingQty = Math.max(0, totalHoldingQty - lockedHoldingQty);

    // Sync live order IDs with current state
    for (const grid of this.gridLevels) {
      const openOrder = state.openOrders.find(o =>
        Math.abs(Number(o.price || 0) - grid.price) < this.gridSpacing * 0.45
      );
      grid.orderId = openOrder ? openOrder.id : undefined;
      if (openOrder) {
        grid.type = openOrder.side.toLowerCase() === 'sell' ? 'sell' : 'buy';
        grid.filled = false;
      }
    }

    // A. SELL EXECUTION (Grid 1 to top level)
    for (let i = 1; i < this.gridLevels.length; i++) {
      const grid = this.gridLevels[i];
      if (!grid) continue;

      const isTargetTouched = currentPrice >= (grid.price - this.priceTolerance);

      if (isTargetTouched && availableHoldingQty > 0 && !grid.orderId) {
        if (grid.lastActionTimestamp && now - grid.lastActionTimestamp < 4000) {
          continue;
        }

        const sellQty = Math.min(availableHoldingQty, (investmentPerGrid * 1.05) / currentPrice);
        if (sellQty > 0) {
          actions.push({
            action: 'sell',
            quantity: sellQty,
            price: currentPrice,
            orderType: 'MARKET',
            gridLevel: grid.index,
            metadata: { jarvisGridLevel: grid.index, targetPrice: grid.price }
          });
          availableHoldingQty -= sellQty;
          grid.lastActionTimestamp = now;
          this.log(`⚡ [JARVIS] Profit Sell Triggered at Grid #${grid.index}! Target $${grid.price.toFixed(6)} touched (Current: $${currentPrice.toFixed(6)}). Selling ${sellQty.toFixed(4)} ${this.asset}...`);

          // Reset lower buy grid level for dip re-entry
          const lowerBuyGrid = this.gridLevels[grid.index - 1];
          if (lowerBuyGrid) {
            lowerBuyGrid.buyCount = 0;
            lowerBuyGrid.filled = false;
          }
        }
      }
    }

    // B. BUY DIP EXECUTION (Grid 0 to top level - 1)
    for (let i = 0; i < this.gridLevels.length - 1; i++) {
      const grid = this.gridLevels[i];
      if (!grid) continue;

      const isInBuyZone = Math.abs(currentPrice - grid.price) <= this.priceTolerance || (currentPrice <= grid.price && currentPrice >= (grid.price - this.priceTolerance));

      if (isInBuyZone && !grid.orderId && grid.buyCount < maxBuysPerLevel) {
        if (grid.lastActionTimestamp && now - grid.lastActionTimestamp < 5000) {
          continue;
        }

        if (!this.insufficientBalance && state.availableBalance >= investmentPerGrid) {
          const buyQty = (investmentPerGrid * 1.02) / currentPrice;
          if (buyQty * currentPrice >= 0.50) {
            actions.push({
              action: 'buy',
              quantity: buyQty,
              price: currentPrice,
              orderType: 'MARKET',
              gridLevel: grid.index,
              metadata: { jarvisGridLevel: grid.index, targetPrice: grid.price }
            });
            grid.type = 'buy';
            grid.lastActionTimestamp = now;
            this.log(`⚡ [JARVIS] Dip Buy Triggered at Grid #${grid.index}! Target $${grid.price.toFixed(6)} touched (Current: $${currentPrice.toFixed(6)}). Buying ${buyQty.toFixed(4)} ${this.asset}...`);
          }
        }
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

  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void {
    let grid = this.gridLevels.find(g => g.orderId === orderId);
    if (!grid && filledPrice > 0) {
      grid = this.gridLevels.find(g => Math.abs(g.price - filledPrice) <= (this.gridSpacing * 0.45 + this.priceTolerance));
    }

    if (grid) {
      grid.filled = true;
      if (grid.type === 'buy') {
        grid.buyCount++;
        this.log(`BUY filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} x ${filledQuantity.toFixed(4)} (buy #${grid.buyCount}). Next sell target: Grid #${Math.min(grid.index + 1, this.gridLevels.length - 1)}`);
      } else if (grid.type === 'sell') {
        const profit = filledQuantity * this.gridSpacing;
        this.gridProfit += profit;
        this.gridProfitCount++;
        this.log(`SELL filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} | Profit: +$${profit.toFixed(4)} | Total cycles: ${this.gridProfitCount}`);
        const lowerGrid = this.gridLevels[grid.index - 1];
        if (lowerGrid) {
          lowerGrid.buyCount = 0;
          lowerGrid.filled = false;
        }
      }
    } else {
      this.log(`Order filled: $${filledPrice.toFixed(6)} x ${filledQuantity.toFixed(4)}`);
    }

    this.customState.gridProfit = this.gridProfit;
    this.customState.gridProfitCount = this.gridProfitCount;
    this.customState.gridLevels = this.gridLevels;
    this.customState.currentUpperPrice = this.currentUpperPrice;
    this.customState.upperPriceIncrementsCount = this.upperPriceIncrementsCount;
    this.customState.lastError = this.lastError;
    this.customState.isStopLossActive = this.isStopLossActive;
  }

  onOrderCancelled(orderId: string): void {
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
        gridCount: 0,
        gridSpacing: 0,
        lowerPrice: 0,
        upperPrice: 0,
        initialUpperPrice: 0,
        upperPriceIncrementsCount: 0,
        gridProfit: 0,
        gridProfitCount: 0,
        currentPrice: 0,
        insufficientBalance: this.insufficientBalance ? 1 : 0,
      };
    }
    return {
      gridCount: this.gridLevels.length > 0 ? this.gridLevels.length - 1 : toNum(p.gridCount),
      gridSpacing: this.gridSpacing,
      lowerPrice: this.currentLowerPrice || toNum(p.lowerPrice),
      upperPrice: this.currentUpperPrice || toNum(p.upperPrice),
      initialUpperPrice: this.initialUpperPrice || toNum(p.upperPrice),
      upperPriceIncrementsCount: this.upperPriceIncrementsCount,
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
    this.currentUpperPrice = toNum(customState.currentUpperPrice) || this.currentUpperPrice;
    this.upperPriceIncrementsCount = toNum(customState.upperPriceIncrementsCount) || this.upperPriceIncrementsCount;
    this.lastError = customState.lastError || '';
    this.insufficientBalance = customState.insufficientBalance || false;
    this.isStopLossActive = customState.isStopLossActive || false;

    if (Array.isArray(customState.gridLevels)) {
      this.gridLevels = customState.gridLevels.map((g: any) => ({
        ...g,
        buyCount: g.buyCount || 0,
      }));
    }
  }

  getCustomState(): Record<string, any> {
    return {
      gridProfit: this.gridProfit,
      gridProfitCount: this.gridProfitCount,
      gridLevels: this.gridLevels,
      currentUpperPrice: this.currentUpperPrice,
      initialUpperPrice: this.initialUpperPrice,
      upperPriceIncrementsCount: this.upperPriceIncrementsCount,
      lastError: this.lastError,
      insufficientBalance: this.insufficientBalance,
      isStopLossActive: this.isStopLossActive,
    };
  }
}
