/**
 * RebalancingBot Strategy - Maintain fixed portfolio ratios
 * Automatically rebalances when allocations drift beyond threshold
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
import type {
  BotParams,
  RebalancingParams,
  BotState,
  BotAction,
  PriceTick,
  ValidationResult,
} from '../types.js';

interface Allocation {
  symbol: string;
  targetPercent: number;
  currentPercent: number;
  currentValue: number;
  deviation: number;
}

const INTERVAL_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

export class RebalancingBot extends BaseBotStrategy {
  readonly name = 'Rebalancing Bot';
  readonly type = 'REBALANCING' as const;

  private prices: Map<string, number> = new Map();
  private nextRebalanceTime = 0;
  private rebalanceCount = 0;
  private hasInitialBuy = false;

  validate(params: BotParams): ValidationResult {
    const p = params as RebalancingParams;
    const errors: string[] = [];

    const totalInvestment = toNum(p.totalInvestment);
    const rebalanceThreshold = toNum(p.rebalanceThreshold);

    if (!p.allocations || p.allocations.length < 2) {
      errors.push('At least 2 allocations required');
    }

    const totalPercent = p.allocations?.reduce((sum, a) => sum + toNum(a.targetPercent), 0) || 0;
    if (Math.abs(totalPercent - 100) > 0.01) {
      errors.push(`Allocations must sum to 100% (currently ${totalPercent}%)`);
    }

    for (const alloc of p.allocations || []) {
      if (!alloc.symbol) errors.push('Each allocation needs a symbol');
      const targetPercent = toNum(alloc.targetPercent);
      if (targetPercent <= 0 || targetPercent > 100) {
        errors.push(`Invalid target percent for ${alloc.symbol}`);
      }
    }

    if (!totalInvestment || totalInvestment <= 0) {
      errors.push('Total investment must be positive');
    }
    if (!rebalanceThreshold || rebalanceThreshold <= 0 || rebalanceThreshold > 50) {
      errors.push('Rebalance threshold must be between 0 and 50%');
    }
    if (!p.rebalanceInterval || !INTERVAL_MS[p.rebalanceInterval]) {
      errors.push('Invalid rebalance interval');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    if (initialState?.customState) {
      this.restoreState(initialState.customState);
      return;
    }

    const p = this.params as RebalancingParams;
    console.log(`[Rebalancing] Initialized with ${p.allocations.length} assets, threshold: ${p.rebalanceThreshold}%`);
  }

  async evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]> {
    const p = this.params as RebalancingParams;

    // Update price for this symbol
    this.prices.set(tick.symbol, tick.price);

    // Check if we have all prices
    const missingPrices = p.allocations.filter(a => !this.prices.has(a.symbol));
    if (missingPrices.length > 0) {
      return [{ action: 'hold' }];
    }

    // Initial buy
    if (!this.hasInitialBuy) {
      return this.createInitialBuys(state, p);
    }

    // Check if it's time to rebalance
    const now = Date.now();
    if (now < this.nextRebalanceTime) {
      return [{ action: 'hold' }];
    }

    // Calculate current allocations
    const allocations = this.calculateAllocations(state, p);

    // Check if rebalance needed
    const rebalanceThreshold = toNum(p.rebalanceThreshold);
    const needsRebalance = allocations.some(a => Math.abs(a.deviation) > rebalanceThreshold);

    if (!needsRebalance) {
      this.nextRebalanceTime = now + INTERVAL_MS[p.rebalanceInterval];
      return [{ action: 'hold' }];
    }

    // Perform rebalance
    console.log(`[Rebalancing] Rebalancing triggered at check #${this.rebalanceCount + 1}`);
    return this.createRebalanceActions(allocations, state, p);
  }

  private createInitialBuys(state: BotState, p: RebalancingParams): BotAction[] {
    const actions: BotAction[] = [];
    const totalInvestment = toNum(p.totalInvestment);

    for (const alloc of p.allocations) {
      const targetPercent = toNum(alloc.targetPercent);
      const targetValue = totalInvestment * (targetPercent / 100);
      const price = this.prices.get(alloc.symbol) || 0;

      if (price > 0 && state.availableBalance >= targetValue) {
        const quantity = targetValue / price;
        actions.push({
          action: 'buy',
          quantity,
          orderType: 'MARKET',
          metadata: { symbol: alloc.symbol, initialBuy: true },
        });
      }
    }

    if (actions.length === p.allocations.length) {
      this.hasInitialBuy = true;
      this.nextRebalanceTime = Date.now() + INTERVAL_MS[p.rebalanceInterval];
      console.log(`[Rebalancing] Initial buys placed for ${actions.length} assets`);
    }

    return actions;
  }

  private calculateAllocations(state: BotState, p: RebalancingParams): Allocation[] {
    const allocations: Allocation[] = [];
    let totalValue = 0;

    // Calculate current values
    for (const alloc of p.allocations) {
      const { base } = parseSymbol(alloc.symbol);
      const holding = state.holdings.find(h => h.asset === base);
      const price = this.prices.get(alloc.symbol) || 0;
      const value = (holding?.quantity || 0) * price;
      totalValue += value;

      allocations.push({
        symbol: alloc.symbol,
        targetPercent: toNum(alloc.targetPercent),
        currentPercent: 0,
        currentValue: value,
        deviation: 0,
      });
    }

    // Include cash as part of portfolio (optional)
    totalValue += state.availableBalance;

    // Calculate percentages and deviations
    for (const alloc of allocations) {
      alloc.currentPercent = totalValue > 0 ? (alloc.currentValue / totalValue) * 100 : 0;
      alloc.deviation = alloc.currentPercent - alloc.targetPercent;
    }

    return allocations;
  }

  private createRebalanceActions(
    allocations: Allocation[],
    state: BotState,
    p: RebalancingParams
  ): BotAction[] {
    const actions: BotAction[] = [];
    const totalValue = state.currentEquity;
    const rebalanceThreshold = toNum(p.rebalanceThreshold);

    // Sort: sell overweight first, then buy underweight
    const overweight = allocations.filter(a => a.deviation > rebalanceThreshold);
    const underweight = allocations.filter(a => a.deviation < -rebalanceThreshold);

    // Sell overweight assets
    for (const alloc of overweight) {
      const targetValue = totalValue * (alloc.targetPercent / 100);
      const sellValue = alloc.currentValue - targetValue;
      const price = this.prices.get(alloc.symbol) || 0;

      if (price > 0 && sellValue > 0) {
        const quantity = sellValue / price;
        const { base } = parseSymbol(alloc.symbol);
        const holding = state.holdings.find(h => h.asset === base);

        if (holding && holding.quantity >= quantity) {
          actions.push({
            action: 'sell',
            quantity,
            orderType: 'MARKET',
            metadata: { symbol: alloc.symbol, rebalance: true },
          });
          console.log(`[Rebalancing] Sell ${quantity.toFixed(6)} ${base} (${alloc.deviation.toFixed(1)}% overweight)`);
        }
      }
    }

    // Buy underweight assets
    for (const alloc of underweight) {
      const targetValue = totalValue * (alloc.targetPercent / 100);
      const buyValue = targetValue - alloc.currentValue;
      const price = this.prices.get(alloc.symbol) || 0;

      if (price > 0 && buyValue > 0 && state.availableBalance >= buyValue) {
        const quantity = buyValue / price;
        actions.push({
          action: 'buy',
          quantity,
          orderType: 'MARKET',
          metadata: { symbol: alloc.symbol, rebalance: true },
        });
        const { base } = parseSymbol(alloc.symbol);
        console.log(`[Rebalancing] Buy ${quantity.toFixed(6)} ${base} (${Math.abs(alloc.deviation).toFixed(1)}% underweight)`);
      }
    }

    if (actions.length > 0) {
      this.rebalanceCount++;
      this.nextRebalanceTime = Date.now() + INTERVAL_MS[p.rebalanceInterval];
    }

    return actions;
  }

  protected getMetrics(): Record<string, number> {
    const p = this.params as RebalancingParams | null;
    if (!p) {
      return { assetCount: 0, rebalanceCount: 0, nextRebalanceIn: 0, hasInitialBuy: 0 };
    }
    return {
      assetCount: p.allocations.length,
      rebalanceCount: this.rebalanceCount,
      nextRebalanceIn: Math.max(0, this.nextRebalanceTime - Date.now()) / 1000 / 60,
      hasInitialBuy: this.hasInitialBuy ? 1 : 0,
    };
  }

  restoreState(customState: Record<string, any>): void {
    super.restoreState(customState);
    this.nextRebalanceTime = customState.nextRebalanceTime || 0;
    this.rebalanceCount = customState.rebalanceCount || 0;
    this.hasInitialBuy = customState.hasInitialBuy || false;
    this.prices = new Map(customState.prices || []);
  }

  getCustomState(): Record<string, any> {
    return {
      nextRebalanceTime: this.nextRebalanceTime,
      rebalanceCount: this.rebalanceCount,
      hasInitialBuy: this.hasInitialBuy,
      prices: Array.from(this.prices.entries()),
    };
  }
}
