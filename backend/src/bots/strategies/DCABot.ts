/**
 * DCABot Strategy - Dollar Cost Averaging
 * Buy fixed amount at regular intervals regardless of price
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
import type {
  BotParams,
  DCABotParams,
  BotState,
  BotAction,
  PriceTick,
  ValidationResult,
} from '../types.js';

const INTERVAL_MS: Record<string, number> = {
  'hourly': 60 * 60 * 1000,
  'every_4h': 4 * 60 * 60 * 1000,
  'every_12h': 12 * 60 * 60 * 1000,
  'daily': 24 * 60 * 60 * 1000,
  'weekly': 7 * 24 * 60 * 60 * 1000,
};

export class DCABot extends BaseBotStrategy {
  readonly name = 'DCA Bot';
  readonly type = 'DCA' as const;

  private nextBuyTime = 0;
  private totalSpent = 0;
  private totalQuantity = 0;
  private avgBuyPrice = 0;
  private buyCount = 0;
  private asset = '';

  validate(params: BotParams): ValidationResult {
    const p = params as DCABotParams;
    const errors: string[] = [];

    const amountPerBuy = toNum(p.amountPerBuy);
    const totalBudget = toNum(p.totalBudget);
    const takeProfitPercent = toNum(p.takeProfitPercent);
    const stopLossPercent = toNum(p.stopLossPercent);

    if (!amountPerBuy || amountPerBuy <= 0) errors.push('Amount per buy must be positive');
    if (!p.interval || !INTERVAL_MS[p.interval]) errors.push('Invalid interval');
    if (!totalBudget || totalBudget <= 0) errors.push('Total budget must be positive');
    if (amountPerBuy > totalBudget) errors.push('Amount per buy cannot exceed total budget');
    if (p.takeProfitPercent !== undefined && takeProfitPercent <= 0) errors.push('Take profit must be positive');
    if (p.stopLossPercent !== undefined && stopLossPercent <= 0) errors.push('Stop loss must be positive');

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    const p = this.params as DCABotParams;

    if (initialState?.customState) {
      this.restoreState(initialState.customState);
    } else {
      // Schedule first buy immediately
      this.nextBuyTime = Date.now();
    }

    console.log(`[DCABot] Initialized: $${toNum(p.amountPerBuy)} ${p.interval}, budget: $${toNum(p.totalBudget)}`);
  }

  async evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]> {
    const p = this.params as DCABotParams;
    const actions: BotAction[] = [];

    if (!this.asset) {
      const { base } = parseSymbol(tick.symbol);
      this.asset = base;
    }

    const currentPrice = tick.price;
    const now = Date.now();
    const takeProfitPercent = toNum(p.takeProfitPercent);
    const stopLossPercent = toNum(p.stopLossPercent);
    const totalBudget = toNum(p.totalBudget);
    const amountPerBuy = toNum(p.amountPerBuy);

    // Check take profit
    if (takeProfitPercent && this.avgBuyPrice > 0) {
      const targetPrice = this.avgBuyPrice * (1 + takeProfitPercent / 100);
      if (currentPrice >= targetPrice) {
        console.log(`[DCABot] Take profit triggered at ${currentPrice} (target: ${targetPrice.toFixed(2)})`);
        return this.createSellAllAction(state);
      }
    }

    // Check stop loss
    if (stopLossPercent && this.avgBuyPrice > 0) {
      const stopPrice = this.avgBuyPrice * (1 - stopLossPercent / 100);
      if (currentPrice <= stopPrice) {
        console.log(`[DCABot] Stop loss triggered at ${currentPrice} (stop: ${stopPrice.toFixed(2)})`);
        return this.createSellAllAction(state);
      }
    }

    // Check if it's time to buy
    if (now >= this.nextBuyTime) {
      // Check if we have budget remaining
      const remainingBudget = totalBudget - this.totalSpent;
      const buyAmount = Math.min(amountPerBuy, remainingBudget);

      if (buyAmount > 0 && state.availableBalance >= buyAmount) {
        const quantity = buyAmount / currentPrice;

        actions.push({
          action: 'buy',
          quantity,
          orderType: 'MARKET',
          metadata: { dcaBuy: this.buyCount + 1 },
        });

        // Schedule next buy
        this.nextBuyTime = now + (INTERVAL_MS[p.interval] || INTERVAL_MS['daily']);

        console.log(`[DCABot] Buy #${this.buyCount + 1}: ${quantity.toFixed(6)} @ ${currentPrice}`);
      } else if (remainingBudget <= 0) {
        console.log(`[DCABot] Budget exhausted after ${this.buyCount} buys`);
        // Keep holding, waiting for TP/SL
      }
    }

    return actions.length > 0 ? actions : [{ action: 'hold' }];
  }

  private createSellAllAction(state: BotState): BotAction[] {
    const holding = state.holdings.find(h => h.asset === this.asset);
    if (!holding || holding.quantity <= 0) {
      return [{ action: 'hold' }];
    }

    return [{
      action: 'sell',
      quantity: holding.quantity,
      orderType: 'MARKET',
    }];
  }

  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void {
    // Update DCA stats
    const cost = filledPrice * filledQuantity;
    const newTotalQuantity = this.totalQuantity + filledQuantity;

    // Calculate new average price
    this.avgBuyPrice = (this.avgBuyPrice * this.totalQuantity + cost) / newTotalQuantity;
    this.totalQuantity = newTotalQuantity;
    this.totalSpent += cost;
    this.buyCount++;

    console.log(`[DCABot] Avg price updated to ${this.avgBuyPrice.toFixed(4)} after ${this.buyCount} buys`);

    this.customState = this.getCustomState();
  }

  protected getMetrics(): Record<string, number> {
    const p = this.params as DCABotParams | null;
    if (!p) {
      return { buyCount: 0, totalSpent: 0, totalQuantity: 0, avgBuyPrice: 0, remainingBudget: 0, nextBuyIn: 0 };
    }
    return {
      buyCount: this.buyCount,
      totalSpent: this.totalSpent,
      totalQuantity: this.totalQuantity,
      avgBuyPrice: this.avgBuyPrice,
      remainingBudget: toNum(p.totalBudget) - this.totalSpent,
      nextBuyIn: Math.max(0, this.nextBuyTime - Date.now()) / 1000 / 60,
    };
  }

  restoreState(customState: Record<string, any>): void {
    super.restoreState(customState);
    this.nextBuyTime = customState.nextBuyTime || Date.now();
    this.totalSpent = customState.totalSpent || 0;
    this.totalQuantity = customState.totalQuantity || 0;
    this.avgBuyPrice = customState.avgBuyPrice || 0;
    this.buyCount = customState.buyCount || 0;
  }

  getCustomState(): Record<string, any> {
    return {
      nextBuyTime: this.nextBuyTime,
      totalSpent: this.totalSpent,
      totalQuantity: this.totalQuantity,
      avgBuyPrice: this.avgBuyPrice,
      buyCount: this.buyCount,
    };
  }
}
