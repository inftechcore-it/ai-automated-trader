/**
 * GridBot Strategy - Buy low sell high within a price range
 * Best for sideways/ranging markets
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
import type {
  BotParams,
  GridBotParams,
  BotState,
  BotAction,
  PriceTick,
  ValidationResult,
} from '../types.js';

interface GridLevel {
  price: number;
  index: number;
  type: 'buy' | 'sell';
  orderId?: string;
  filled: boolean;
  buyCount: number;  // Track buys per grid level
}

export class GridBot extends BaseBotStrategy {
  readonly name = 'Grid Trading Bot';
  readonly type = 'GRID' as const;

  private gridLevels: GridLevel[] = [];
  private gridSpacing = 0;
  private gridProfit = 0;
  private gridProfitCount = 0;
  private lastPrice = 0;
  private asset = '';
  private quote = '';

  // Error handling state
  private lastError = '';
  private insufficientBalance = false;
  private lastBalanceCheck = 0;
  private isStopped = false;  // Only true when stop loss or take profit is hit

  validate(params: BotParams): ValidationResult {
    const p = params as GridBotParams;
    const errors: string[] = [];

    const lowerPrice = toNum(p.lowerPrice);
    const upperPrice = toNum(p.upperPrice);
    const gridCount = toNum(p.gridCount);
    const totalInvestment = toNum(p.totalInvestment);
    const stopLoss = toNum(p.stopLoss);
    const takeProfit = toNum(p.takeProfit);
    const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;

    if (!lowerPrice || lowerPrice <= 0) errors.push('Lower price must be positive');
    if (!upperPrice || upperPrice <= 0) errors.push('Upper price must be positive');
    if (lowerPrice >= upperPrice) errors.push('Lower price must be less than upper price');
    if (!gridCount || gridCount < 2 || gridCount > 200) errors.push('Grid count must be between 2 and 200');
    if (!totalInvestment || totalInvestment <= 0) errors.push('Total investment must be positive');
    if (stopLoss && stopLoss >= lowerPrice) errors.push('Stop loss must be below lower price');
    if (takeProfit && takeProfit <= upperPrice) errors.push('Take profit must be above upper price');
    if (maxBuysPerLevel < 1 || maxBuysPerLevel > 10) errors.push('Max buys per level must be between 1 and 10');

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    const p = this.params as GridBotParams;

    const lowerPrice = toNum(p.lowerPrice);
    const upperPrice = toNum(p.upperPrice);
    const gridCount = toNum(p.gridCount);
    const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;

    this.gridSpacing = (upperPrice - lowerPrice) / gridCount;

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

    this.log(`Initialized with ${gridCount} grids, spacing: $${this.gridSpacing.toFixed(6)}`);
    this.log(`Max buys per grid level: ${maxBuysPerLevel}`);
    this.log(`Grid range: $${lowerPrice.toFixed(6)} - $${upperPrice.toFixed(6)}`);

    if (initialState?.customState) {
      this.gridProfit = toNum(initialState.customState.gridProfit);
      this.gridProfitCount = toNum(initialState.customState.gridProfitCount);
      this.lastError = initialState.customState.lastError || '';
      this.insufficientBalance = initialState.customState.insufficientBalance || false;
      this.isStopped = initialState.customState.isStopped || false;

      // Restore buy counts per grid
      if (Array.isArray(initialState.customState.gridLevels)) {
        for (const savedGrid of initialState.customState.gridLevels) {
          const grid = this.gridLevels.find(g => g.index === savedGrid.index);
          if (grid) {
            grid.buyCount = savedGrid.buyCount || 0;
            grid.filled = savedGrid.filled || false;
            grid.type = savedGrid.type || 'buy';
          }
        }
      }
    }
  }

  // Handle errors from order execution
  handleError(error: string): void {
    this.lastError = error;
    this.log(`ERROR: ${error}`, 'error');

    // Check if it's a balance-related error
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
    const p = this.params as GridBotParams;
    const actions: BotAction[] = [];

    const lowerPrice = toNum(p.lowerPrice);
    const upperPrice = toNum(p.upperPrice);
    const stopLoss = toNum(p.stopLoss);
    const takeProfit = toNum(p.takeProfit);
    const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;
    const investmentPerGrid = toNum(p.totalInvestment) / toNum(p.gridCount);

    // Check balance status every 30 seconds
    const now = Date.now();
    if (this.insufficientBalance && now - this.lastBalanceCheck > 30000) {
      this.lastBalanceCheck = now;
      if (state.availableBalance >= investmentPerGrid) {
        this.insufficientBalance = false;
        this.lastError = '';
        this.log(`Balance restored: $${state.availableBalance.toFixed(2)} - resuming BUY orders`);
      } else {
        this.log(`Waiting for balance. Need: $${investmentPerGrid.toFixed(2)}, Have: $${state.availableBalance.toFixed(2)}`, 'warn');
      }
    }

    // Show balance status in tick log
    const balanceStatus = this.insufficientBalance ? ' [INSUFFICIENT BALANCE]' : '';
    this.log(`Tick: $${tick.price.toFixed(6)} | Balance: $${state.availableBalance.toFixed(2)} | Orders: ${state.openOrders.length} | Profits: ${this.gridProfitCount}${balanceStatus}`);

    if (!this.asset) {
      const { base, quote } = parseSymbol(tick.symbol);
      this.asset = base;
      this.quote = quote;
    }

    const currentPrice = tick.price;
    this.lastPrice = currentPrice;

    // Check stop loss
    if (stopLoss && currentPrice <= stopLoss) {
      this.log(`STOP LOSS triggered at $${currentPrice.toFixed(6)}`, 'warn');
      this.isStopped = true;
      return this.createExitActions(state);
    }

    // Check take profit
    if (takeProfit && currentPrice >= takeProfit) {
      this.log(`TAKE PROFIT triggered at $${currentPrice.toFixed(6)}`);
      this.isStopped = true;
      return this.createExitActions(state);
    }

    // Check if price is in range
    if (currentPrice < lowerPrice || currentPrice > upperPrice) {
      this.log(`Price $${currentPrice.toFixed(6)} outside range [$${lowerPrice.toFixed(6)} - $${upperPrice.toFixed(6)}]`);
      return [{ action: 'hold' }];
    }

    const currentGridIndex = Math.floor((currentPrice - lowerPrice) / this.gridSpacing);

    // Process grid levels for buy/sell signals
    for (const grid of this.gridLevels) {
      if (grid.orderId && !grid.filled) continue;

      if (grid.index < currentGridIndex) {
        // Price is above this grid - check if we should buy
        if (grid.type === 'sell' && grid.filled) {
          // Skip buy if insufficient balance
          if (this.insufficientBalance) {
            continue;
          }

          // Check max buys per level
          if (grid.buyCount >= maxBuysPerLevel) {
            this.log(`Grid ${grid.index} reached max buys (${maxBuysPerLevel}), skipping to next grid`);
            continue;
          }

          // Check balance before placing buy
          if (state.availableBalance < investmentPerGrid) {
            this.insufficientBalance = true;
            this.log(`Insufficient balance for Grid ${grid.index} buy. Need: $${investmentPerGrid.toFixed(2)}, Have: $${state.availableBalance.toFixed(2)}`, 'warn');
            continue;
          }

          const quantity = this.calculateQuantity(grid.price, state);
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
        // Price is below this grid - check if we should sell
        if (grid.type === 'buy' && grid.filled) {
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

    // Initial order setup - skip if insufficient balance
    if (state.openOrders.length === 0 && this.gridProfitCount === 0) {
      if (this.insufficientBalance) {
        this.log(`Skipping initial orders - insufficient balance`, 'warn');
      } else {
        this.log(`Setting up initial orders at price $${currentPrice.toFixed(6)}`);
        const initialActions = this.createInitialOrders(currentPrice, currentGridIndex, state, maxBuysPerLevel);
        actions.push(...initialActions);
      }
    } else if (state.openOrders.length > 0 && this.gridProfitCount === 0) {
      this.log(`Syncing ${state.openOrders.length} existing orders with grid state`);
      for (const order of state.openOrders) {
        const matchingGrid = this.gridLevels.find(g => Math.abs(g.price - toNum(order.price)) < 0.00001);
        if (matchingGrid) {
          matchingGrid.orderId = order.id;
          matchingGrid.type = order.side?.toLowerCase() === 'buy' ? 'buy' : 'sell';
        }
      }
    }

    if (actions.length > 0) {
      this.log(`Placing ${actions.length} orders: ${actions.map(a => `${a.action} @ $${a.price?.toFixed(6) || 'market'}`).join(', ')}`);
    }
    return actions.length > 0 ? actions : [{ action: 'hold' }];
  }

  private createInitialOrders(currentPrice: number, currentGridIndex: number, state: BotState, maxBuysPerLevel: number): BotAction[] {
    const p = this.params as GridBotParams;
    const actions: BotAction[] = [];

    const totalInvestment = toNum(p.totalInvestment);
    const gridCount = toNum(p.gridCount);
    const investmentPerGrid = totalInvestment / gridCount;

    // Binance minimum notional is ~$5 for most pairs
    const MIN_NOTIONAL = 5.0;
    if (investmentPerGrid < MIN_NOTIONAL) {
      this.lastError = `Investment per grid ($${investmentPerGrid.toFixed(2)}) is below Binance minimum ($${MIN_NOTIONAL}). Increase investment to $${(MIN_NOTIONAL * gridCount).toFixed(0)} or reduce grid count.`;
      this.log(this.lastError, 'error');
      this.insufficientBalance = true;
      return [];
    }

    // Check available balance
    if (state.availableBalance < investmentPerGrid) {
      this.insufficientBalance = true;
      this.log(`Insufficient balance. Need: $${investmentPerGrid.toFixed(2)}, Have: $${state.availableBalance.toFixed(2)}. Waiting for balance...`, 'warn');
      return [];
    }

    this.log(`Investment per grid: $${investmentPerGrid.toFixed(2)}`);

    let buyOrderCount = 0;
    for (const grid of this.gridLevels) {
      if (grid.price < currentPrice) {
        // Check max buys per level
        if (grid.buyCount >= maxBuysPerLevel) {
          this.log(`Grid ${grid.index} ($${grid.price.toFixed(6)}) already has ${grid.buyCount} buys, skipping`);
          continue;
        }

        const quantity = (investmentPerGrid * 1.05) / grid.price;
        actions.push({
          action: 'buy',
          quantity,
          price: grid.price,
          orderType: 'LIMIT',
          gridLevel: grid.index,
        });
        grid.type = 'buy';
        buyOrderCount++;
        this.log(`BUY order at Grid ${grid.index}: $${grid.price.toFixed(6)} x ${quantity.toFixed(2)}`);
      } else if (grid.price > currentPrice) {
        grid.type = 'sell';
      }
    }

    this.log(`Placed ${buyOrderCount} initial BUY orders below current price`);
    return actions;
  }

  private createExitActions(state: BotState): BotAction[] {
    const actions: BotAction[] = [];
    actions.push({ action: 'cancel_all' });

    for (const holding of state.holdings) {
      if (holding.quantity > 0) {
        actions.push({
          action: 'sell',
          quantity: holding.quantity,
          orderType: 'MARKET',
        });
      }
    }

    this.log(`Exiting: Cancelling all orders and selling holdings`);
    return actions;
  }

  private calculateQuantity(price: number, state: BotState): number {
    const p = this.params as GridBotParams;
    const totalInvestment = toNum(p.totalInvestment);
    const gridCount = toNum(p.gridCount);
    const investmentPerGrid = totalInvestment / gridCount;
    const quantity = investmentPerGrid / price;

    if (state.availableBalance < investmentPerGrid) {
      this.log(`Insufficient balance for grid buy. Need: $${investmentPerGrid.toFixed(2)}, Have: $${state.availableBalance.toFixed(2)}`, 'warn');
      return 0;
    }

    return quantity;
  }

  private calculateSellQuantity(holdingQuantity: number): number {
    const p = this.params as GridBotParams;
    const gridCount = toNum(p.gridCount);
    const quantityPerGrid = holdingQuantity / gridCount;
    return Math.min(quantityPerGrid, holdingQuantity);
  }

  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void {
    const grid = this.gridLevels.find(g => g.orderId === orderId);
    if (!grid) return;

    grid.filled = true;

    if (grid.type === 'buy') {
      grid.buyCount++;
      this.log(`BUY filled at Grid ${grid.index}: $${filledPrice.toFixed(6)} x ${filledQuantity.toFixed(4)} (buy #${grid.buyCount})`);
    } else if (grid.type === 'sell') {
      const profit = filledQuantity * this.gridSpacing;
      this.gridProfit += profit;
      this.gridProfitCount++;
      this.log(`SELL filled at Grid ${grid.index}: $${filledPrice.toFixed(6)} | Profit: $${profit.toFixed(4)} | Total cycles: ${this.gridProfitCount}`);
    }

    this.customState.gridProfit = this.gridProfit;
    this.customState.gridProfitCount = this.gridProfitCount;
    this.customState.gridLevels = this.gridLevels;
    this.customState.lastError = this.lastError;
    this.customState.insufficientBalance = this.insufficientBalance;
    this.customState.isStopped = this.isStopped;
  }

  // Called when order fails
  onOrderError(error: string): void {
    this.lastError = error;
    this.log(`Order error: ${error}`, 'error');

    // Check for balance-related errors - pause buying but don't stop bot
    if (error.includes('NOTIONAL') ||
        error.toLowerCase().includes('insufficient') ||
        error.includes('MIN_NOTIONAL') ||
        error.toLowerCase().includes('balance')) {
      this.insufficientBalance = true;
      this.log(`Balance issue detected - pausing BUY orders until balance is sufficient`, 'warn');
    }
  }

  protected getMetrics(): Record<string, number> {
    const p = this.params as GridBotParams | null;
    if (!p) {
      return {
        gridCount: 0,
        gridSpacing: 0,
        gridProfit: 0,
        gridProfitCount: 0,
        currentPrice: 0,
        lowerPrice: 0,
        upperPrice: 0,
        insufficientBalance: this.insufficientBalance ? 1 : 0,
      };
    }
    return {
      gridCount: toNum(p.gridCount),
      gridSpacing: this.gridSpacing,
      gridProfit: this.gridProfit,
      gridProfitCount: this.gridProfitCount,
      currentPrice: this.lastPrice,
      lowerPrice: toNum(p.lowerPrice),
      upperPrice: toNum(p.upperPrice),
      maxBuysPerLevel: toNum(p.maxBuysPerLevel) || 1,
      insufficientBalance: this.insufficientBalance ? 1 : 0,
    };
  }

  restoreState(customState: Record<string, any>): void {
    super.restoreState(customState);
    this.gridProfit = toNum(customState.gridProfit);
    this.gridProfitCount = toNum(customState.gridProfitCount);
    this.lastError = customState.lastError || '';
    this.insufficientBalance = customState.insufficientBalance || false;
    this.isStopped = customState.isStopped || false;

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
      lastError: this.lastError,
      insufficientBalance: this.insufficientBalance,
      isStopped: this.isStopped,
    };
  }
}
