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
    while (index < 50) {
      this.gridLevels.push({
        price,
        index,
        type: 'buy',
        filled: false,
      });
      price = price * (1 + gridSpacingPercent / 100);
      index++;
    }

    this.highestGridIndex = index - 1;
    console.log(`[InfinityGrid] Initialized with ${this.gridLevels.length} levels, spacing: ${p.gridSpacingPercent}%`);
  }

  async evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]> {
    const p = this.params as InfinityGridParams;
    const actions: BotAction[] = [];

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
      console.log(`[InfinityGrid] Stop loss triggered at ${currentPrice}`);
      return this.createExitActions(state);
    }

    // Below lower price - nothing to do
    if (currentPrice < lowerPrice) {
      return [{ action: 'hold' }];
    }

    // Extend grid upward if needed
    await this.extendGridIfNeeded(currentPrice, p);

    // Find current grid position
    const currentGridIndex = this.findGridIndex(currentPrice);

    // Process grid levels
    for (const grid of this.gridLevels) {
      if (grid.orderId && !grid.filled) continue;

      if (grid.index < currentGridIndex) {
        // Grid is below current price
        if (grid.type === 'sell' && grid.filled) {
          // Place new buy order
          const quantity = this.calculateQuantity(grid.price, p.totalInvestment, state);
          if (quantity > 0) {
            actions.push({
              action: 'buy',
              quantity,
              price: grid.price,
              orderType: 'LIMIT',
              gridLevel: grid.index,
            });
            grid.type = 'buy';
            grid.filled = false;
          }
        }
      } else if (grid.index > currentGridIndex) {
        // Grid is above current price
        if (grid.type === 'buy' && grid.filled) {
          // Place new sell order
          const holding = state.holdings.find(h => h.asset === this.asset);
          const quantity = this.calculateSellQuantity(holding?.quantity || 0);
          if (quantity > 0) {
            actions.push({
              action: 'sell',
              quantity,
              price: grid.price,
              orderType: 'LIMIT',
              gridLevel: grid.index,
            });
            grid.type = 'sell';
            grid.filled = false;
          }
        }
      }
    }

    // Initial setup
    if (state.openOrders.length === 0 && this.gridProfitCount === 0) {
      const initialActions = this.createInitialOrders(currentPrice, currentGridIndex, state, p);
      actions.push(...initialActions);
    }

    return actions.length > 0 ? actions : [{ action: 'hold' }];
  }

  private findGridIndex(price: number): number {
    const p = this.params as InfinityGridParams;
    const lowerPrice = toNum(p.lowerPrice);
    const gridSpacingPercent = toNum(p.gridSpacingPercent);
    // Calculate index based on percentage spacing
    return Math.floor(Math.log(price / lowerPrice) / Math.log(1 + gridSpacingPercent / 100));
  }

  private async extendGridIfNeeded(currentPrice: number, p: InfinityGridParams): Promise<void> {
    const currentIndex = this.findGridIndex(currentPrice);
    const lowerPrice = toNum(p.lowerPrice);
    const gridSpacingPercent = toNum(p.gridSpacingPercent);

    // Extend if within 5 levels of highest
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

  private createInitialOrders(
    currentPrice: number,
    currentGridIndex: number,
    state: BotState,
    p: InfinityGridParams
  ): BotAction[] {
    const actions: BotAction[] = [];
    const levelsToFill = 10;
    const totalInvestment = toNum(p.totalInvestment);
    const investmentPerGrid = totalInvestment / levelsToFill;

    // Place buy orders below current price
    let count = 0;
    for (const grid of this.gridLevels) {
      if (grid.index < currentGridIndex && count < levelsToFill) {
        const quantity = investmentPerGrid / grid.price;
        actions.push({
          action: 'buy',
          quantity,
          price: grid.price,
          orderType: 'LIMIT',
          gridLevel: grid.index,
        });
        grid.type = 'buy';
        count++;
      }
    }

    console.log(`[InfinityGrid] Placed ${actions.length} initial buy orders`);
    return actions;
  }

  private createExitActions(state: BotState): BotAction[] {
    const actions: BotAction[] = [{ action: 'cancel_all' }];

    for (const holding of state.holdings) {
      if (holding.quantity > 0) {
        actions.push({
          action: 'sell',
          quantity: holding.quantity,
          orderType: 'MARKET',
        });
      }
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
    const grid = this.gridLevels.find(g => g.orderId === orderId);
    if (!grid) return;

    grid.filled = true;

    if (grid.type === 'sell') {
      const p = this.params as InfinityGridParams;
      const gridSpacingPercent = toNum(p.gridSpacingPercent);
      const profit = filledQuantity * filledPrice * (gridSpacingPercent / 100);
      this.gridProfit += profit;
      this.gridProfitCount++;

      console.log(`[InfinityGrid] Grid ${grid.index} profit: ${profit.toFixed(4)}`);
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
  }

  getCustomState(): Record<string, any> {
    return {
      gridLevels: this.gridLevels,
      highestGridIndex: this.highestGridIndex,
      gridProfit: this.gridProfit,
      gridProfitCount: this.gridProfitCount,
    };
  }
}
