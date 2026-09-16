/**
 * InfinityGridBot Strategy - Grid bot with no upper limit
 * For assets you're long-term bullish on
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
import type {
  BotParams,
  InfinityGridParams,
  BotState,
  BotAction,
  PriceTick,
  ValidationResult,
} from '../types.js';

interface InfinityGridLevel {
  price: number;
  index: number;
  type: 'buy' | 'sell';
  orderId?: string;
  filled: boolean;
}

export class InfinityGridBot extends BaseBotStrategy {
  readonly name = 'Infinity Grid Bot';
  readonly type = 'INFINITY_GRID' as const;

  private gridLevels: InfinityGridLevel[] = [];
  private highestGridIndex = 0;
  private gridProfit = 0;
  private gridProfitCount = 0;
  private lastPrice = 0;
  private asset = '';
  private isStopLossActive = false;
  private lastStopLossLog = 0;

  validate(params: BotParams): ValidationResult {
    const p = params as InfinityGridParams;
    const errors: string[] = [];

    const lowerPrice = toNum(p.lowerPrice);
    const gridSpacingPercent = toNum(p.gridSpacingPercent);
    const totalInvestment = toNum(p.totalInvestment);
    const stopLoss = toNum(p.stopLoss);

    if (!lowerPrice || lowerPrice <= 0) errors.push('Lower price must be positive');
    if (!gridSpacingPercent || gridSpacingPercent <= 0 || gridSpacingPercent > 10) {
      errors.push('Grid spacing must be between 0 and 10%');
    }
    if (!totalInvestment || totalInvestment <= 0) errors.push('Total investment must be positive');
    if (stopLoss && stopLoss >= lowerPrice) errors.push('Stop loss must be below lower price');

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    const p = this.params as InfinityGridParams;

    if (initialState?.customState) {
      this.restoreState(initialState.customState);
      return;
    }

    // Generate initial grid levels from lower price upward
    this.gridLevels = [];
    const lowerPrice = toNum(p.lowerPrice);
    const gridSpacingPercent = toNum(p.gridSpacingPercent);
    let price = lowerPrice;
    let index = 0;

    // Create 50 initial grid levels (more will be added dynamically)
    for (let i = 0; i < 50; i++) {
      this.gridLevels.push({
        price,
        index,
        type: 'buy',
        filled: false,
      });
      price *= (1 + gridSpacingPercent / 100);
      index++;
    }
    this.highestGridIndex = index - 1;

    console.log(`[InfinityGrid] Initialized with 50 levels starting from ${lowerPrice}`);
  }

  async evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]> {
    const p = this.params as InfinityGridParams;
    const actions: BotAction[] = [];
    const now = Date.now();

    if (!this.asset) {
      const { base } = parseSymbol(tick.symbol);
      this.asset = base;
    }

    const currentPrice = tick.price;
    this.lastPrice = currentPrice;
    const stopLoss = toNum(p.stopLoss);
    const lowerPrice = toNum(p.lowerPrice);

    // Check stop loss
    if (stopLoss && currentPrice <= stopLoss) {
      if (!this.isStopLossActive) {
        this.isStopLossActive = true;
        console.log(`[InfinityGrid] ⚠️ Stop loss triggered at $${currentPrice.toFixed(6)} (stop: $${stopLoss.toFixed(6)}). Liquidating open orders & holdings...`);
        for (const grid of this.gridLevels) {
          grid.filled = false;
          grid.orderId = undefined;
          grid.type = 'buy';
        }
        return this.createExitActions(state, 'STOP_LOSS');
      } else {
        if (now - this.lastStopLossLog > 30000) {
          this.lastStopLossLog = now;
          console.log(`[InfinityGrid] [STOP LOSS ACTIVE] Current price $${currentPrice.toFixed(6)} <= Stop $${stopLoss.toFixed(6)}. Waiting for recovery...`);
        }
        return [{ action: 'hold' }];
      }
    }

    // Price recovery above stop loss
    if (this.isStopLossActive && currentPrice > stopLoss) {
      this.isStopLossActive = false;
      console.log(`[InfinityGrid] 🚀 Price recovered to $${currentPrice.toFixed(6)} (above stop loss $${stopLoss.toFixed(6)}). Resuming infinity grid cycle!`);
      for (const grid of this.gridLevels) {
        grid.filled = false;
        grid.orderId = undefined;
        grid.type = grid.price < currentPrice ? 'buy' : 'sell';
      }
    }

    // Below lower price - nothing to do
    if (currentPrice < lowerPrice) {
      return [{ action: 'hold' }];
    }

    // Extend grid upward if needed
    await this.extendGridIfNeeded(currentPrice, p);

    // Process grid levels for BUY and SELL orders
    const holding = state.holdings.find(h => (h.asset || '').toUpperCase() === (this.asset || '').toUpperCase());
    const totalHoldingQty = holding?.quantity || 0;
    const lockedHoldingQty = state.openOrders
      .filter(o => o.side === 'SELL')
      .reduce((sum, o) => sum + (o.quantity - (o.filledQuantity || 0)), 0);
    let availableHoldingQty = Math.max(0, totalHoldingQty - lockedHoldingQty);

    const levelsToFill = 10;
    const totalInvestment = toNum(p.totalInvestment);
    const investmentPerGrid = totalInvestment / levelsToFill;

    // Synchronize grid order IDs with live open orders
    for (const grid of this.gridLevels) {
      const openOrder = state.openOrders.find(o =>
        Math.abs(Number(o.price || 0) - grid.price) < grid.price * (toNum(p.gridSpacingPercent) / 100) * 0.45
      );
      grid.orderId = openOrder ? openOrder.id : undefined;
      if (openOrder) {
        grid.type = openOrder.side.toLowerCase() === 'sell' ? 'sell' : 'buy';
        grid.filled = false;
      }
    }

    const MIN_NOTIONAL = 0.50; // Minimum order value in USDT

    // A. BUY & DIP BUY LOGIC (Grids BELOW current price)
    for (const grid of this.gridLevels) {
      if (grid.price < currentPrice * 0.9995 && !grid.orderId) {
        if (state.availableBalance >= investmentPerGrid) {
          const buyQty = (investmentPerGrid * 1.02) / grid.price;
          if (buyQty * grid.price >= MIN_NOTIONAL) {
            actions.push({
              action: 'buy',
              quantity: buyQty,
              price: grid.price,
              orderType: 'LIMIT',
              gridLevel: grid.index,
            });
            grid.type = 'buy';
            console.log(`[InfinityGrid] Placing limit BUY on dip at Grid #${grid.index}: ${buyQty.toFixed(4)} @ $${grid.price.toFixed(6)}`);
          }
        }
      }
    }

    // B. SELL TARGET LOGIC (Grids ABOVE current price)
    // Only place sell orders if we have sufficient holdings to form a valid order (>= MIN_NOTIONAL)
    if (availableHoldingQty * currentPrice >= MIN_NOTIONAL) {
      for (const grid of this.gridLevels) {
        if (grid.price > currentPrice * 1.0005 && !grid.orderId && availableHoldingQty * grid.price >= MIN_NOTIONAL) {
          const sellQty = Math.min(availableHoldingQty, (investmentPerGrid * 1.05) / grid.price);
          if (sellQty * grid.price >= MIN_NOTIONAL) {
            actions.push({
              action: 'sell',
              quantity: sellQty,
              price: grid.price,
              orderType: 'LIMIT',
              gridLevel: grid.index,
            });
            availableHoldingQty -= sellQty;
            grid.type = 'sell';
            console.log(`[InfinityGrid] Placing limit SELL target at Grid #${grid.index}: ${sellQty.toFixed(4)} @ $${grid.price.toFixed(6)}`);
          }
        }
      }
    }

    return actions.length > 0 ? actions : [{ action: 'hold' }];
  }

  private findGridIndex(price: number): number {
    const p = this.params as InfinityGridParams;
    const lowerPrice = toNum(p.lowerPrice);
    const gridSpacingPercent = toNum(p.gridSpacingPercent);
    return Math.floor(Math.log(price / lowerPrice) / Math.log(1 + gridSpacingPercent / 100));
  }

  private async extendGridIfNeeded(currentPrice: number, p: InfinityGridParams): Promise<void> {
    const currentIndex = this.findGridIndex(currentPrice);
    const lowerPrice = toNum(p.lowerPrice);
    const gridSpacingPercent = toNum(p.gridSpacingPercent);

    while (currentIndex >= this.highestGridIndex - 5) {
      this.highestGridIndex++;
      const newPrice = lowerPrice * Math.pow(1 + gridSpacingPercent / 100, this.highestGridIndex);
      this.gridLevels.push({
        price: newPrice,
        index: this.highestGridIndex,
        type: 'sell',
        filled: false,
      });
    }
  }

  private createExitActions(state: BotState, reason: string = 'STOP_LOSS'): BotAction[] {
    const actions: BotAction[] = [{ action: 'cancel_all', metadata: { isExit: true, exitReason: reason } }];

    let hasHoldings = false;
    for (const holding of state.holdings) {
      if (holding.quantity > 0) {
        hasHoldings = true;
        actions.push({
          action: 'sell',
          quantity: holding.quantity,
          orderType: 'MARKET',
          metadata: { isExit: true, exitReason: reason },
        });
      }
    }

    if (!hasHoldings) {
      actions.push({
        action: 'sell',
        quantity: 0,
        orderType: 'MARKET',
        metadata: { isExit: true, exitReason: reason, sweepAll: true },
      });
    }

    return actions;
  }

  private calculateQuantity(price: number, totalInvestment: number, state: BotState): number {
    const investmentPerGrid = totalInvestment / 10;
    if (state.availableBalance < investmentPerGrid) return 0;
    return investmentPerGrid / price;
  }

  private calculateSellQuantity(holdingQuantity: number): number {
    return holdingQuantity / 10;
  }

  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void {
    const p = this.params as InfinityGridParams;
    const gridSpacingPercent = toNum(p?.gridSpacingPercent) || 0.5;

    let grid = this.gridLevels.find(g => g.orderId === orderId);
    if (!grid && filledPrice > 0) {
      grid = this.gridLevels.find(g => Math.abs(g.price - filledPrice) < g.price * (gridSpacingPercent / 100) * 0.45);
    }

    if (grid) {
      grid.filled = true;
      if (grid.type === 'buy') {
        console.log(`[InfinityGrid] BUY filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} x ${filledQuantity.toFixed(4)}`);
      } else if (grid.type === 'sell') {
        const profit = filledQuantity * filledPrice * (gridSpacingPercent / 100);
        this.gridProfit += profit;
        this.gridProfitCount++;
        console.log(`[InfinityGrid] SELL filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} | Profit: +$${profit.toFixed(4)}`);
      }
    }
  }

  onOrderPlaced(orderId: string, gridLevel?: number, price?: number, side?: string): void {
    const p = this.params as InfinityGridParams;
    const gridSpacingPercent = toNum(p?.gridSpacingPercent) || 0.5;

    const grid = gridLevel !== undefined && this.gridLevels[gridLevel]
      ? this.gridLevels[gridLevel]
      : this.gridLevels.find(g => price && Math.abs(g.price - price) < g.price * (gridSpacingPercent / 100) * 0.45);

    if (grid) {
      grid.orderId = orderId;
      grid.type = side?.toLowerCase() === 'sell' ? 'sell' : 'buy';
      grid.filled = false;
    }
  }

  onOrderCancelled(orderId: string): void {
    const grid = this.gridLevels.find(g => g.orderId === orderId);
    if (grid) {
      grid.orderId = undefined;
    }
  }

  protected getMetrics(): Record<string, number> {
    const p = this.params as InfinityGridParams | null;
    if (!p) {
      return { gridCount: 0, gridSpacingPercent: 0, gridProfit: 0, gridProfitCount: 0, currentPrice: 0, lowerPrice: 0, highestGridIndex: 0 };
    }
    return {
      gridCount: this.gridLevels.length,
      gridSpacingPercent: toNum(p.gridSpacingPercent),
      gridProfit: this.gridProfit,
      gridProfitCount: this.gridProfitCount,
      currentPrice: this.lastPrice,
      lowerPrice: toNum(p.lowerPrice),
      highestGridIndex: this.highestGridIndex,
    };
  }

  restoreState(customState: Record<string, any>): void {
    super.restoreState(customState);
    this.gridLevels = customState.gridLevels || [];
    this.highestGridIndex = customState.highestGridIndex || 0;
    this.gridProfit = customState.gridProfit || 0;
    this.gridProfitCount = customState.gridProfitCount || 0;
    this.isStopLossActive = customState.isStopLossActive || false;
  }

  getCustomState(): Record<string, any> {
    return {
      gridLevels: this.gridLevels,
      highestGridIndex: this.highestGridIndex,
      gridProfit: this.gridProfit,
      gridProfitCount: this.gridProfitCount,
      isStopLossActive: this.isStopLossActive,
    };
  }
}
