/**
 * DynamicGridBot Strategy - Auto-discovers coins and trades multiple simultaneously
 *
 * Advanced Features:
 * - Auto-discovery: Scans market for coins in price range
 * - Per-coin buy limit: Max buys per individual coin (default: 3)
 * - Total buy limit: Max total buys across ALL coins (default: 30)
 * - Max active coins: Limit how many coins to trade simultaneously
 * - Overall stop loss: Stop bot if portfolio drops X% from peak
 * - Per-coin profit target: Take profit when coin gains X%
 * - Daily loss limit: Pause trading if daily loss exceeds limit
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
import { MarketScanner } from '../services/MarketScanner.js';
import type {
  BotParams,
  DynamicGridParams,
  CoinTradeState,
  BotState,
  BotAction,
  PriceTick,
  ValidationResult,
} from '../types.js';

interface CoinGrid {
  symbol: string;
  baseAsset: string;
  lowerPrice: number;
  upperPrice: number;
  gridSpacing: number;
  levels: Array<{
    price: number;
    index: number;
    type: 'buy' | 'sell';
    orderId?: string;
    filled: boolean;
    fillPrice?: number;
  }>;
  buyCount: number;
  totalBought: number;
  totalInvested: number;
  avgEntryPrice: number;
  sellCount: number;
  realizedProfit: number;
  unrealizedProfit: number;
  currentPrice: number;
  status: 'active' | 'maxed_out' | 'completed' | 'stopped';
  addedAt: number;
}

interface DynamicGridState {
  coinGrids: Record<string, CoinGrid>;
  lastScanTime: number;
  initialized: boolean;
  totalBuysAcrossAllCoins: number;
  totalSellsAcrossAllCoins: number;
  totalRealizedProfit: number;
  peakPortfolioValue: number;
  dailyStartValue: number;
  dailyStartDate: string;
  isStopped: boolean;
  stopReason?: string;
}

export class DynamicGridBot extends BaseBotStrategy {
  readonly name = 'Dynamic Grid Bot';
  readonly type = 'DYNAMIC_GRID' as const;

  private scanner: MarketScanner | null = null;
  private coinGrids: Map<string, CoinGrid> = new Map();
  private lastScanTime = 0;
  private scanInterval = 5 * 60 * 1000; // Rescan every 5 minutes
  private initialized = false;
  private exchange = '';

  // Global tracking
  private totalBuysAcrossAllCoins = 0;
  private totalSellsAcrossAllCoins = 0;
  private totalRealizedProfit = 0;
  private peakPortfolioValue = 0;
  private dailyStartValue = 0;
  private dailyStartDate = '';
  private isStopped = false;
  private stopReason = '';

  validate(params: BotParams): ValidationResult {
    const p = params as DynamicGridParams;
    const errors: string[] = [];

    const priceRangeLow = toNum(p.priceRangeLow);
    const priceRangeHigh = toNum(p.priceRangeHigh);
    const totalInvestment = toNum(p.totalInvestment);
    const gridCount = toNum(p.gridCount) || 5;
    const maxBuysPerCoin = toNum(p.maxBuysPerCoin) || 3;
    const maxTotalBuys = toNum(p.maxTotalBuys) || 30;
    const maxActiveCoins = toNum(p.maxActiveCoins) || 10;

    if (!priceRangeLow || priceRangeLow <= 0) errors.push('Price range low must be positive');
    if (!priceRangeHigh || priceRangeHigh <= 0) errors.push('Price range high must be positive');
    if (priceRangeLow >= priceRangeHigh) errors.push('Price range low must be less than high');

    if (!p.scanPoolSize || p.scanPoolSize < 5 || p.scanPoolSize > 100) {
      errors.push('Scan pool size must be between 5 and 100');
    }

    if (!totalInvestment || totalInvestment <= 0) errors.push('Total investment must be positive');
    if (gridCount < 2 || gridCount > 50) errors.push('Grid count must be between 2 and 50');
    if (maxBuysPerCoin < 1 || maxBuysPerCoin > 20) errors.push('Max buys per coin must be between 1 and 20');
    if (maxTotalBuys < 1 || maxTotalBuys > 100) errors.push('Max total buys must be between 1 and 100');
    if (maxActiveCoins < 1 || maxActiveCoins > 50) errors.push('Max active coins must be between 1 and 50');

    // Validate stop loss / take profit percentages
    const overallStopLossPercent = toNum(p.overallStopLossPercent);
    const profitTargetPercent = toNum(p.profitTargetPercent);
    const dailyLossLimitPercent = toNum(p.dailyLossLimitPercent);

    if (overallStopLossPercent && (overallStopLossPercent < 1 || overallStopLossPercent > 50)) {
      errors.push('Overall stop loss must be between 1% and 50%');
    }
    if (profitTargetPercent && (profitTargetPercent < 1 || profitTargetPercent > 100)) {
      errors.push('Profit target must be between 1% and 100%');
    }
    if (dailyLossLimitPercent && (dailyLossLimitPercent < 1 || dailyLossLimitPercent > 30)) {
      errors.push('Daily loss limit must be between 1% and 30%');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    const p = this.params as DynamicGridParams;

    if (initialState?.customState?.coinGrids) {
      this.restoreState(initialState.customState);
      this.initialized = true;
      return;
    }

    // Set defaults
    const maxBuysPerCoin = toNum(p.maxBuysPerCoin) || 3;
    const maxTotalBuys = toNum(p.maxTotalBuys) || 30;
    const maxActiveCoins = toNum(p.maxActiveCoins) || 10;

    this.log(`Initializing Auto-Discovery mode`);
    this.log(`Price range: $${p.priceRangeLow} - $${p.priceRangeHigh}`);
    this.log(`Limits: ${maxBuysPerCoin} buys/coin, ${maxTotalBuys} total buys, ${maxActiveCoins} max coins`);

    if (p.overallStopLossPercent) {
      this.log(`Overall stop loss: ${p.overallStopLossPercent}%`);
    }
    if (p.profitTargetPercent) {
      this.log(`Per-coin profit target: ${p.profitTargetPercent}%`);
    }
  }

  async evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]> {
    const p = this.params as DynamicGridParams;
    const actions: BotAction[] = [];

    // Check if bot is stopped
    if (this.isStopped) {
      return [{ action: 'hold', metadata: { reason: this.stopReason } }];
    }

    // Initialize scanner on first tick
    if (!this.scanner) {
      this.exchange = tick.exchange || 'binance';
      this.scanner = new MarketScanner(this.exchange);
    }

    // Initialize daily tracking
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyStartDate !== today) {
      this.dailyStartDate = today;
      this.dailyStartValue = this.calculatePortfolioValue(state);
      this.log(` New trading day. Starting value: $${this.dailyStartValue.toFixed(2)}`);
    }

    // Calculate current portfolio value
    const currentValue = this.calculatePortfolioValue(state);

    // Update peak value for drawdown calculation
    if (currentValue > this.peakPortfolioValue) {
      this.peakPortfolioValue = currentValue;
    }

    // Check overall stop loss (drawdown from peak)
    const overallStopLossPercent = toNum(p.overallStopLossPercent);
    if (overallStopLossPercent && this.peakPortfolioValue > 0) {
      const drawdownPercent = ((this.peakPortfolioValue - currentValue) / this.peakPortfolioValue) * 100;
      if (drawdownPercent >= overallStopLossPercent) {
        this.log(` OVERALL STOP LOSS triggered! Drawdown: ${drawdownPercent.toFixed(2)}% (limit: ${overallStopLossPercent}%)`);
        this.isStopped = true;
        this.stopReason = `Overall stop loss: ${drawdownPercent.toFixed(2)}% drawdown from peak`;
        return this.createExitAllActions(state);
      }
    }

    // Check daily loss limit
    const dailyLossLimitPercent = toNum(p.dailyLossLimitPercent);
    if (dailyLossLimitPercent && this.dailyStartValue > 0) {
      const dailyLossPercent = ((this.dailyStartValue - currentValue) / this.dailyStartValue) * 100;
      if (dailyLossPercent >= dailyLossLimitPercent) {
        this.log(` DAILY LOSS LIMIT triggered! Loss: ${dailyLossPercent.toFixed(2)}% (limit: ${dailyLossLimitPercent}%)`);
        this.isStopped = true;
        this.stopReason = `Daily loss limit: ${dailyLossPercent.toFixed(2)}% loss today`;
        return this.createExitAllActions(state);
      }
    }

    // Check if we've hit max total buys
    const maxTotalBuys = toNum(p.maxTotalBuys) || 30;
    if (this.totalBuysAcrossAllCoins >= maxTotalBuys) {
      // Don't stop, but don't place new buys - only process sells
      this.log(` Max total buys reached (${maxTotalBuys}). Processing sells only.`);
    }

    // Scan for coins periodically
    const now = Date.now();
    if (now - this.lastScanTime > this.scanInterval || !this.initialized) {
      await this.scanAndSetupCoins(p, state);
      this.lastScanTime = now;
      this.initialized = true;
    }

    // Process each active coin
    for (const [symbol, grid] of this.coinGrids) {
      if (grid.status === 'stopped' || grid.status === 'completed') continue;

      // Get current price for this coin
      const currentPrice = symbol === tick.symbol
        ? tick.price
        : await this.scanner?.getPrice(symbol) || 0;

      if (currentPrice <= 0) continue;

      // Update current price
      grid.currentPrice = currentPrice;

      // Calculate unrealized P&L
      if (grid.totalBought > 0 && grid.avgEntryPrice > 0) {
        grid.unrealizedProfit = (currentPrice - grid.avgEntryPrice) * grid.totalBought;
      }

      // Check per-coin profit target
      const profitTargetPercent = toNum(p.profitTargetPercent);
      if (profitTargetPercent && grid.avgEntryPrice > 0 && grid.totalBought > 0) {
        const profitPercent = ((currentPrice - grid.avgEntryPrice) / grid.avgEntryPrice) * 100;
        if (profitPercent >= profitTargetPercent) {
          this.log(` ${symbol} PROFIT TARGET hit! Gain: ${profitPercent.toFixed(2)}% (target: ${profitTargetPercent}%)`);
          actions.push(...this.createCoinExitActions(grid, state, 'profit_target'));
          grid.status = 'completed';
          continue;
        }
      }

      // Check per-coin stop loss (percentage based)
      const stopLossPercent = toNum(p.stopLossPercent);
      if (stopLossPercent && grid.avgEntryPrice > 0 && grid.totalBought > 0) {
        const lossPercent = ((grid.avgEntryPrice - currentPrice) / grid.avgEntryPrice) * 100;
        if (lossPercent >= stopLossPercent) {
          this.log(` ${symbol} STOP LOSS hit! Loss: ${lossPercent.toFixed(2)}% (limit: ${stopLossPercent}%)`);
          actions.push(...this.createCoinExitActions(grid, state, 'stop_loss'));
          grid.status = 'stopped';
          continue;
        }
      }

      // Process grid levels (with global buy limit check)
      const gridActions = this.processGridLevels(grid, currentPrice, p, state);
      actions.push(...gridActions);
    }

    // Log summary periodically
    if (actions.length > 0) {
      const activeCoins = Array.from(this.coinGrids.values()).filter(g => g.status === 'active').length;
      this.log(` ${actions.length} actions | ${activeCoins} active coins | ${this.totalBuysAcrossAllCoins}/${maxTotalBuys} total buys`);
    }

    return actions.length > 0 ? actions : [{ action: 'hold' }];
  }

  private calculatePortfolioValue(state: BotState): number {
    let value = state.availableBalance;

    for (const grid of this.coinGrids.values()) {
      if (grid.totalBought > 0 && grid.currentPrice > 0) {
        value += grid.totalBought * grid.currentPrice;
      }
    }

    return value;
  }

  private async scanAndSetupCoins(p: DynamicGridParams, state: BotState): Promise<void> {
    if (!this.scanner) return;

    const maxActiveCoins = toNum(p.maxActiveCoins) || 10;
    const currentActiveCoins = Array.from(this.coinGrids.values()).filter(g => g.status === 'active').length;

    if (currentActiveCoins >= maxActiveCoins) {
      this.log(` Max active coins reached (${maxActiveCoins}). Skipping scan.`);
      return;
    }

    this.log(` Scanning for coins in range $${p.priceRangeLow} - $${p.priceRangeHigh}`);

    const result = await this.scanner.scanForCoins({
      priceMin: toNum(p.priceRangeLow),
      priceMax: toNum(p.priceRangeHigh),
      topN: p.scanPoolSize || 20,
      quoteAsset: 'USDT',
    });

    this.log(` Found ${result.coins.length} coins matching criteria`);

    // Sort by volume and add coins up to limit
    const sortedCoins = result.coins.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

    for (const coin of sortedCoins) {
      if (this.coinGrids.size >= maxActiveCoins) {
        this.log(` Reached max active coins limit (${maxActiveCoins})`);
        break;
      }

      if (!this.coinGrids.has(coin.symbol)) {
        await this.setupCoinGrid(coin.symbol, coin.price, p, state);
      }
    }
  }

  private async setupCoinGrid(
    symbol: string,
    currentPrice: number,
    p: DynamicGridParams,
    state: BotState
  ): Promise<void> {
    const { base } = parseSymbol(symbol);
    const gridCount = toNum(p.gridCount) || 5;

    // Use price range for grid bounds
    const lowerPrice = toNum(p.priceRangeLow);
    const upperPrice = toNum(p.priceRangeHigh);
    const gridSpacing = (upperPrice - lowerPrice) / gridCount;

    const levels = [];
    for (let i = 0; i <= gridCount; i++) {
      const price = lowerPrice + i * gridSpacing;
      levels.push({
        price,
        index: i,
        type: price < currentPrice ? 'buy' : 'sell' as 'buy' | 'sell',
        filled: false,
      });
    }

    const grid: CoinGrid = {
      symbol,
      baseAsset: base,
      lowerPrice,
      upperPrice,
      gridSpacing,
      levels,
      buyCount: 0,
      totalBought: 0,
      totalInvested: 0,
      avgEntryPrice: 0,
      sellCount: 0,
      realizedProfit: 0,
      unrealizedProfit: 0,
      currentPrice,
      status: 'active',
      addedAt: Date.now(),
    };

    this.coinGrids.set(symbol, grid);
    this.log(` Added ${symbol}: $${currentPrice.toFixed(6)} | Grid: $${lowerPrice.toFixed(4)} - $${upperPrice.toFixed(4)}`);
  }

  private processGridLevels(
    grid: CoinGrid,
    currentPrice: number,
    p: DynamicGridParams,
    state: BotState
  ): BotAction[] {
    const actions: BotAction[] = [];
    const maxBuysPerCoin = toNum(p.maxBuysPerCoin) || 3;
    const maxTotalBuys = toNum(p.maxTotalBuys) || 30;
    const totalInvestment = toNum(p.totalInvestment);
    const maxActiveCoins = toNum(p.maxActiveCoins) || 10;

    // Investment per coin = total / max active coins
    const investmentPerCoin = totalInvestment / maxActiveCoins;
    const gridCount = toNum(p.gridCount) || 5;
    const investmentPerGrid = investmentPerCoin / gridCount;

    // Check minimum notional
    const MIN_NOTIONAL = 1.10;
    if (investmentPerGrid < MIN_NOTIONAL) {
      return [];
    }

    // Check if this coin has hit its buy limit
    const coinAtBuyLimit = grid.buyCount >= maxBuysPerCoin;

    // Check if global buy limit reached
    const globalBuyLimitReached = this.totalBuysAcrossAllCoins >= maxTotalBuys;

    for (const level of grid.levels) {
      // Skip if order already placed and not filled
      if (level.orderId && !level.filled) continue;

      // BUY logic
      if (level.type === 'buy' && currentPrice <= level.price * 1.005) {
        // Check all buy limits
        if (coinAtBuyLimit) {
          if (grid.status !== 'maxed_out') {
            this.log(` ${grid.symbol} reached per-coin buy limit (${maxBuysPerCoin})`);
            grid.status = 'maxed_out';
          }
          continue;
        }

        if (globalBuyLimitReached) {
          continue; // Silently skip - already logged at evaluate level
        }

        // Place buy order
        const quantity = (investmentPerGrid * 1.02) / level.price;
        actions.push({
          action: 'buy',
          quantity,
          price: level.price,
          orderType: 'LIMIT',
          gridLevel: level.index,
          metadata: {
            symbol: grid.symbol,
            gridType: 'dynamic',
            buyNumber: grid.buyCount + 1,
            totalBuys: this.totalBuysAcrossAllCoins + 1,
          },
        });
      }

      // SELL logic - only for filled buy levels
      else if (level.type === 'sell' && level.filled && currentPrice >= level.price * 0.995) {
        const holding = state.holdings.find(h => h.asset === grid.baseAsset);
        if (holding && holding.quantity > 0) {
          // Sell proportional amount
          const sellQuantity = Math.min(
            holding.quantity / Math.max(grid.buyCount, 1),
            holding.quantity
          );

          if (sellQuantity > 0) {
            actions.push({
              action: 'sell',
              quantity: sellQuantity,
              price: level.price,
              orderType: 'LIMIT',
              gridLevel: level.index,
              metadata: {
                symbol: grid.symbol,
                gridType: 'dynamic',
                sellNumber: grid.sellCount + 1,
              },
            });
          }
        }
      }
    }

    return actions;
  }

  private createCoinExitActions(grid: CoinGrid, state: BotState, reason: string): BotAction[] {
    const actions: BotAction[] = [];

    // Cancel all pending orders for this coin
    for (const order of state.openOrders) {
      if (order.symbol === grid.symbol) {
        actions.push({ action: 'cancel', orderId: order.id });
      }
    }

    // Sell all holdings of this coin
    const holding = state.holdings.find(h => h.asset === grid.baseAsset);
    if (holding && holding.quantity > 0) {
      actions.push({
        action: 'sell',
        quantity: holding.quantity,
        orderType: 'MARKET',
        metadata: {
          symbol: grid.symbol,
          exitReason: reason,
          avgEntry: grid.avgEntryPrice,
        },
      });
    }

    return actions;
  }

  private createExitAllActions(state: BotState): BotAction[] {
    const actions: BotAction[] = [];

    // Cancel all pending orders
    for (const order of state.openOrders) {
      actions.push({ action: 'cancel', orderId: order.id });
    }

    // Sell all holdings
    for (const grid of this.coinGrids.values()) {
      const holding = state.holdings.find(h => h.asset === grid.baseAsset);
      if (holding && holding.quantity > 0) {
        actions.push({
          action: 'sell',
          quantity: holding.quantity,
          orderType: 'MARKET',
          metadata: {
            symbol: grid.symbol,
            exitReason: this.stopReason,
          },
        });
        grid.status = 'stopped';
      }
    }

    return actions;
  }

  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void {
    // Find which grid this order belongs to
    for (const [symbol, grid] of this.coinGrids) {
      const level = grid.levels.find(l => l.orderId === orderId);
      if (!level) continue;

      level.filled = true;
      level.fillPrice = filledPrice;

      if (level.type === 'buy') {
        // Update per-coin stats
        grid.buyCount++;
        const cost = filledPrice * filledQuantity;
        grid.totalInvested += cost;
        const newTotal = grid.totalBought + filledQuantity;
        grid.avgEntryPrice = (grid.avgEntryPrice * grid.totalBought + cost) / newTotal;
        grid.totalBought = newTotal;

        // Update global stats
        this.totalBuysAcrossAllCoins++;

        this.log(` BUY ${symbol} #${grid.buyCount}: ${filledQuantity.toFixed(6)} @ $${filledPrice.toFixed(6)} | Total buys: ${this.totalBuysAcrossAllCoins}`);

        // Check if coin hit its limit
        const p = this.params as DynamicGridParams;
        const maxBuysPerCoin = toNum(p.maxBuysPerCoin) || 3;
        if (grid.buyCount >= maxBuysPerCoin) {
          grid.status = 'maxed_out';
          this.log(` ${symbol} reached max buys (${maxBuysPerCoin}), waiting for sells`);
        }

        // Flip level to sell
        level.type = 'sell';
      }
      else if (level.type === 'sell') {
        // Calculate profit
        const sellValue = filledPrice * filledQuantity;
        const costBasis = grid.avgEntryPrice * filledQuantity;
        const profit = sellValue - costBasis;

        // Update per-coin stats
        grid.sellCount++;
        grid.realizedProfit += profit;
        grid.totalBought = Math.max(0, grid.totalBought - filledQuantity);

        // Update global stats
        this.totalSellsAcrossAllCoins++;
        this.totalRealizedProfit += profit;

        this.log(` SELL ${symbol} #${grid.sellCount}: ${filledQuantity.toFixed(6)} @ $${filledPrice.toFixed(6)} | Profit: $${profit.toFixed(4)}`);

        // Re-enable buying after a sell
        if (grid.status === 'maxed_out') {
          grid.status = 'active';
          grid.buyCount = Math.max(0, grid.buyCount - 1);
        }

        // Flip level back to buy
        level.type = 'buy';
        level.filled = false;
        level.fillPrice = undefined;
      }

      break;
    }

    this.customState = this.getCustomState();
  }

  protected getMetrics(): Record<string, number> {
    const p = this.params as DynamicGridParams | null;
    if (!p) {
      return {
        totalCoins: 0, activeCoins: 0, totalBuys: 0, totalSells: 0,
        realizedProfit: 0, unrealizedProfit: 0
      };
    }

    let unrealizedProfit = 0;
    let activeCoins = 0;
    let maxedOutCoins = 0;

    for (const grid of this.coinGrids.values()) {
      unrealizedProfit += grid.unrealizedProfit;
      if (grid.status === 'active') activeCoins++;
      if (grid.status === 'maxed_out') maxedOutCoins++;
    }

    const maxBuysPerCoin = toNum(p.maxBuysPerCoin) || 3;
    const maxTotalBuys = toNum(p.maxTotalBuys) || 30;
    const maxActiveCoins = toNum(p.maxActiveCoins) || 10;

    return {
      // Coin stats
      totalCoins: this.coinGrids.size,
      activeCoins,
      maxedOutCoins,
      maxActiveCoins,

      // Trade stats
      totalBuys: this.totalBuysAcrossAllCoins,
      totalSells: this.totalSellsAcrossAllCoins,
      maxBuysPerCoin,
      maxTotalBuys,
      buysRemaining: Math.max(0, maxTotalBuys - this.totalBuysAcrossAllCoins),

      // Profit stats
      realizedProfit: this.totalRealizedProfit,
      unrealizedProfit,
      totalProfit: this.totalRealizedProfit + unrealizedProfit,

      // Risk stats
      peakValue: this.peakPortfolioValue,
      drawdownPercent: this.peakPortfolioValue > 0
        ? ((this.peakPortfolioValue - this.calculatePortfolioValue({ availableBalance: 0, holdings: [], openOrders: [] } as BotState)) / this.peakPortfolioValue) * 100
        : 0,
    };
  }

  restoreState(customState: Record<string, any>): void {
    super.restoreState(customState);

    if (customState.coinGrids) {
      this.coinGrids = new Map(Object.entries(customState.coinGrids));
    }

    this.lastScanTime = customState.lastScanTime || 0;
    this.initialized = customState.initialized || false;
    this.totalBuysAcrossAllCoins = customState.totalBuysAcrossAllCoins || 0;
    this.totalSellsAcrossAllCoins = customState.totalSellsAcrossAllCoins || 0;
    this.totalRealizedProfit = customState.totalRealizedProfit || 0;
    this.peakPortfolioValue = customState.peakPortfolioValue || 0;
    this.dailyStartValue = customState.dailyStartValue || 0;
    this.dailyStartDate = customState.dailyStartDate || '';
    this.isStopped = customState.isStopped || false;
    this.stopReason = customState.stopReason || '';
  }

  getCustomState(): Record<string, any> {
    return {
      coinGrids: Object.fromEntries(this.coinGrids),
      lastScanTime: this.lastScanTime,
      initialized: this.initialized,
      totalBuysAcrossAllCoins: this.totalBuysAcrossAllCoins,
      totalSellsAcrossAllCoins: this.totalSellsAcrossAllCoins,
      totalRealizedProfit: this.totalRealizedProfit,
      peakPortfolioValue: this.peakPortfolioValue,
      dailyStartValue: this.dailyStartValue,
      dailyStartDate: this.dailyStartDate,
      isStopped: this.isStopped,
      stopReason: this.stopReason,
    };
  }

  // Get detailed status for UI display
  getCoinStatuses(): CoinTradeState[] {
    const states: CoinTradeState[] = [];

    for (const [symbol, grid] of this.coinGrids) {
      states.push({
        symbol,
        buyCount: grid.buyCount,
        totalBought: grid.totalBought,
        avgEntryPrice: grid.avgEntryPrice,
        currentPrice: grid.currentPrice,
        gridLevels: grid.levels,
        profit: grid.realizedProfit + grid.unrealizedProfit,
        status: grid.status,
      });
    }

    return states;
  }

  // Get summary for dashboard
  getSummary(): {
    totalCoins: number;
    activeCoins: number;
    totalBuys: number;
    maxTotalBuys: number;
    totalProfit: number;
    isStopped: boolean;
    stopReason: string;
  } {
    const p = this.params as DynamicGridParams;
    return {
      totalCoins: this.coinGrids.size,
      activeCoins: Array.from(this.coinGrids.values()).filter(g => g.status === 'active').length,
      totalBuys: this.totalBuysAcrossAllCoins,
      maxTotalBuys: toNum(p.maxTotalBuys) || 30,
      totalProfit: this.totalRealizedProfit,
      isStopped: this.isStopped,
      stopReason: this.stopReason,
    };
  }
}
