/**
 * SmartTradeBot Strategy - Single trade with advanced exit conditions
 * Like a manual trade but with automated TP/SL/Trailing exits
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
import type {
  BotParams,
  SmartTradeParams,
  BotState,
  BotAction,
  PriceTick,
  ValidationResult,
} from '../types.js';

type TradePhase = 'WAITING_ENTRY' | 'IN_POSITION' | 'COMPLETED';

export class SmartTradeBot extends BaseBotStrategy {
  readonly name = 'Smart Trade Bot';
  readonly type = 'SMART_TRADE' as const;

  private phase: TradePhase = 'WAITING_ENTRY';
  private entryPrice = 0;
  private entryQuantity = 0;
  private highestPrice = 0;
  private lowestPrice = Infinity;
  private asset = '';
  private entryOrderId?: string;

  validate(params: BotParams): ValidationResult {
    const p = params as SmartTradeParams;
    const errors: string[] = [];

    const quantity = toNum(p.quantity);
    const entryPrice = toNum(p.entryPrice);
    const takeProfit = toNum(p.takeProfit);
    const takeProfitPercent = toNum(p.takeProfitPercent);
    const stopLoss = toNum(p.stopLoss);
    const stopLossPercent = toNum(p.stopLossPercent);
    const trailingTakeProfit = toNum(p.trailingTakeProfit);

    if (!['long', 'short'].includes(p.side)) errors.push('Side must be long or short');
    if (!['market', 'limit'].includes(p.entryType)) errors.push('Entry type must be market or limit');
    if (p.entryType === 'limit' && !entryPrice) errors.push('Limit entry requires entry price');
    if (!quantity || quantity <= 0) errors.push('Quantity must be positive');

    const hasExit = takeProfit || takeProfitPercent || stopLoss || stopLossPercent || trailingTakeProfit;
    if (!hasExit) errors.push('At least one exit condition required (TP, SL, or trailing)');

    if (trailingTakeProfit && (trailingTakeProfit <= 0 || trailingTakeProfit > 50)) {
      errors.push('Trailing take profit must be between 0 and 50%');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    if (initialState?.customState) {
      this.restoreState(initialState.customState);
      return;
    }

    this.phase = 'WAITING_ENTRY';
    console.log(`[SmartTrade] Initialized: ${(this.params as SmartTradeParams).side} entry`);
  }

  async evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]> {
    const p = this.params as SmartTradeParams;

    if (!this.asset) {
      const { base } = parseSymbol(tick.symbol);
      this.asset = base;
    }

    const currentPrice = tick.price;

    // Phase 1: Entry
    if (this.phase === 'WAITING_ENTRY') {
      return this.handleEntry(p, state);
    }

    // Phase 2: In Position - Monitor exits
    if (this.phase === 'IN_POSITION') {
      // Update tracking prices
      this.highestPrice = Math.max(this.highestPrice, currentPrice);
      this.lowestPrice = Math.min(this.lowestPrice, currentPrice);

      // Calculate exit prices
      const tpPrice = this.calculateTakeProfit(p, currentPrice);
      const slPrice = this.calculateStopLoss(p, currentPrice);
      const trailingExit = this.checkTrailingExit(p, currentPrice);

      // Check exits (in priority order)
      if (trailingExit) {
        console.log(`[SmartTrade] Trailing exit at ${currentPrice} (peak: ${this.highestPrice})`);
        return this.createExitAction(state);
      }

      if (tpPrice !== null && currentPrice >= tpPrice) {
        console.log(`[SmartTrade] Take profit at ${currentPrice} (target: ${tpPrice})`);
        return this.createExitAction(state);
      }

      if (slPrice !== null && currentPrice <= slPrice) {
        console.log(`[SmartTrade] Stop loss at ${currentPrice} (stop: ${slPrice})`);
        return this.createExitAction(state);
      }
    }

    return [{ action: 'hold' }];
  }

  private handleEntry(p: SmartTradeParams, state: BotState): BotAction[] {
    if (this.entryOrderId) {
      // Already placed entry order, wait for fill
      return [{ action: 'hold' }];
    }

    // quantity is the USD value to invest, not coin quantity
    const investAmount = toNum(p.quantity);
    const entryPrice = toNum(p.entryPrice);

    if (p.side === 'long') {
      // Buy entry - quantity is USD to invest
      if (state.availableBalance < investAmount) {
        console.warn(`[SmartTrade] Insufficient balance for entry ($${investAmount} needed, $${state.availableBalance.toFixed(2)} available)`);
        return [{ action: 'hold' }];
      }

      // For market order, we don't know exact price yet, but we'll use available balance
      // For limit order, calculate coin quantity from price
      if (p.entryType === 'limit' && entryPrice > 0) {
        const coinQuantity = investAmount / entryPrice;
        return [{
          action: 'buy',
          quantity: coinQuantity,
          price: entryPrice,
          orderType: 'LIMIT',
        }];
      } else {
        // Market order - quantity is USD value, BotInstance will handle price
        // We pass the USD amount and let the execution use current market price
        return [{
          action: 'buy',
          quantity: investAmount,  // This will be divided by price in BotInstance
          orderType: 'MARKET',
          metadata: { investAmount: true },
        }];
      }
    }

    // Short entry (sell first) - requires existing holdings
    // For short, quantity is coin quantity to sell
    const holding = state.holdings.find(h => h.asset === this.asset);
    const coinQuantity = investAmount; // For short, user specifies coin qty
    if (!holding || holding.quantity < coinQuantity) {
      console.warn(`[SmartTrade] Insufficient holdings for short entry`);
      return [{ action: 'hold' }];
    }

    return [{
      action: 'sell',
      quantity: coinQuantity,
      price: p.entryType === 'limit' ? entryPrice : undefined,
      orderType: p.entryType === 'limit' ? 'LIMIT' : 'MARKET',
    }];
  }

  private calculateTakeProfit(p: SmartTradeParams, currentPrice: number): number | null {
    const takeProfit = toNum(p.takeProfit);
    const takeProfitPercent = toNum(p.takeProfitPercent);

    if (takeProfit) return takeProfit;
    if (takeProfitPercent && this.entryPrice) {
      return this.entryPrice * (1 + takeProfitPercent / 100);
    }
    return null;
  }

  private calculateStopLoss(p: SmartTradeParams, currentPrice: number): number | null {
    const stopLoss = toNum(p.stopLoss);
    const stopLossPercent = toNum(p.stopLossPercent);

    if (stopLoss) return stopLoss;
    if (stopLossPercent && this.entryPrice) {
      return this.entryPrice * (1 - stopLossPercent / 100);
    }
    return null;
  }

  private checkTrailingExit(p: SmartTradeParams, currentPrice: number): boolean {
    const trailingTakeProfit = toNum(p.trailingTakeProfit);
    if (!trailingTakeProfit || this.entryPrice === 0) return false;

    // Only activate trailing after price moved above entry
    if (currentPrice <= this.entryPrice) return false;

    // Check if price dropped from highest by trailing percent
    const trailingPrice = this.highestPrice * (1 - trailingTakeProfit / 100);
    return currentPrice <= trailingPrice;
  }

  private createExitAction(state: BotState): BotAction[] {
    const p = this.params as SmartTradeParams;

    if (p.side === 'long') {
      const holding = state.holdings.find(h => h.asset === this.asset);
      if (!holding || holding.quantity <= 0) {
        this.phase = 'COMPLETED';
        return [{ action: 'hold' }];
      }

      this.phase = 'COMPLETED';
      return [{
        action: 'sell',
        quantity: holding.quantity,
        orderType: 'MARKET',
      }];
    }

    // Short position - buy to close
    this.phase = 'COMPLETED';
    return [{
      action: 'buy',
      quantity: this.entryQuantity,
      orderType: 'MARKET',
    }];
  }

  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void {
    if (this.phase === 'WAITING_ENTRY') {
      this.entryPrice = filledPrice;
      this.entryQuantity = filledQuantity;
      this.highestPrice = filledPrice;
      this.lowestPrice = filledPrice;
      this.phase = 'IN_POSITION';
      this.entryOrderId = orderId;

      console.log(`[SmartTrade] Entry filled at ${filledPrice}`);
    } else if (this.phase === 'IN_POSITION') {
      // Exit filled
      this.phase = 'COMPLETED';
      const profit = (filledPrice - this.entryPrice) * filledQuantity;
      console.log(`[SmartTrade] Exit filled at ${filledPrice}, profit: ${profit.toFixed(4)}`);
    }

    this.customState = this.getCustomState();
  }

  protected getMetrics(): Record<string, number> {
    return {
      entryPrice: this.entryPrice,
      entryQuantity: this.entryQuantity,
      highestPrice: this.highestPrice,
      lowestPrice: this.lowestPrice === Infinity ? 0 : this.lowestPrice,
      phase: this.phase === 'WAITING_ENTRY' ? 0 : this.phase === 'IN_POSITION' ? 1 : 2,
    };
  }

  restoreState(customState: Record<string, any>): void {
    super.restoreState(customState);
    this.phase = customState.phase || 'WAITING_ENTRY';
    this.entryPrice = customState.entryPrice || 0;
    this.entryQuantity = customState.entryQuantity || 0;
    this.highestPrice = customState.highestPrice || 0;
    this.lowestPrice = customState.lowestPrice || Infinity;
    this.entryOrderId = customState.entryOrderId;
  }

  getCustomState(): Record<string, any> {
    return {
      phase: this.phase,
      entryPrice: this.entryPrice,
      entryQuantity: this.entryQuantity,
      highestPrice: this.highestPrice,
      lowestPrice: this.lowestPrice,
      entryOrderId: this.entryOrderId,
    };
  }
}
