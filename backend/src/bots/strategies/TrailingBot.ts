/**
 * TrailingBot Strategy - Ride a trend and exit when it reverses
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
import type {
  BotParams,
  TrailingBotParams,
  BotState,
  BotAction,
  PriceTick,
  ValidationResult,
} from '../types.js';

type TrailingPhase = 'WAITING_TRIGGER' | 'TRAILING' | 'COMPLETED';

export class TrailingBot extends BaseBotStrategy {
  readonly name = 'Trailing Bot';
  readonly type = 'TRAILING' as const;

  private phase: TrailingPhase = 'WAITING_TRIGGER';
  private peakPrice = 0;
  private troughPrice = Infinity;
  private triggerActivatedAt = 0;
  private asset = '';

  validate(params: BotParams): ValidationResult {
    const p = params as TrailingBotParams;
    const errors: string[] = [];

    const triggerPrice = toNum(p.triggerPrice);
    const trailingPercent = toNum(p.trailingPercent);
    const quantity = toNum(p.quantity);

    if (!['trailing_sell', 'trailing_buy'].includes(p.side)) {
      errors.push('Side must be trailing_sell or trailing_buy');
    }
    if (!triggerPrice || triggerPrice <= 0) errors.push('Trigger price must be positive');
    if (!trailingPercent || trailingPercent <= 0 || trailingPercent > 50) {
      errors.push('Trailing percent must be between 0 and 50');
    }
    if (!quantity || quantity <= 0) errors.push('Quantity must be positive');

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async onInitialize(initialState?: Partial<BotState>): Promise<void> {
    if (initialState?.customState) {
      this.restoreState(initialState.customState);
      return;
    }

    this.phase = 'WAITING_TRIGGER';
    const p = this.params as TrailingBotParams;
    console.log(`[TrailingBot] Initialized: ${p.side} trigger at ${p.triggerPrice}`);
  }

  async evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]> {
    const p = this.params as TrailingBotParams;

    if (!this.asset) {
      const { base } = parseSymbol(tick.symbol);
      this.asset = base;
    }

    const currentPrice = tick.price;

    if (this.phase === 'COMPLETED') {
      return [{ action: 'hold' }];
    }

    if (p.side === 'trailing_sell') {
      return this.evaluateTrailingSell(currentPrice, state, p);
    } else {
      return this.evaluateTrailingBuy(currentPrice, state, p);
    }
  }

  private evaluateTrailingSell(currentPrice: number, state: BotState, p: TrailingBotParams): BotAction[] {
    const triggerPrice = toNum(p.triggerPrice);
    const trailingPercent = toNum(p.trailingPercent);
    const quantity = toNum(p.quantity);

    // Trailing sell: activate when price >= trigger, sell when drops from peak
    if (this.phase === 'WAITING_TRIGGER') {
      if (currentPrice >= triggerPrice) {
        this.phase = 'TRAILING';
        this.peakPrice = currentPrice;
        this.triggerActivatedAt = Date.now();
        console.log(`[TrailingBot] Trailing activated at ${currentPrice}`);
      }
      return [{ action: 'hold' }];
    }

    if (this.phase === 'TRAILING') {
      // Update peak
      if (currentPrice > this.peakPrice) {
        this.peakPrice = currentPrice;
      }

      // Check trailing exit
      const exitPrice = this.peakPrice * (1 - trailingPercent / 100);
      if (currentPrice <= exitPrice) {
        console.log(`[TrailingBot] Trailing sell triggered at ${currentPrice} (peak: ${this.peakPrice})`);

        const holding = state.holdings.find(h => h.asset === this.asset);
        const sellQty = Math.min(quantity, holding?.quantity || 0);

        if (sellQty > 0) {
          this.phase = 'COMPLETED';
          return [{
            action: 'sell',
            quantity: sellQty,
            orderType: 'MARKET',
          }];
        }
      }
    }

    return [{ action: 'hold' }];
  }

  private evaluateTrailingBuy(currentPrice: number, state: BotState, p: TrailingBotParams): BotAction[] {
    const triggerPrice = toNum(p.triggerPrice);
    const trailingPercent = toNum(p.trailingPercent);
    const quantity = toNum(p.quantity);

    // Trailing buy: activate when price <= trigger, buy when rises from trough
    if (this.phase === 'WAITING_TRIGGER') {
      if (currentPrice <= triggerPrice) {
        this.phase = 'TRAILING';
        this.troughPrice = currentPrice;
        this.triggerActivatedAt = Date.now();
        console.log(`[TrailingBot] Trailing activated at ${currentPrice}`);
      }
      return [{ action: 'hold' }];
    }

    if (this.phase === 'TRAILING') {
      // Update trough
      if (currentPrice < this.troughPrice) {
        this.troughPrice = currentPrice;
      }

      // Check trailing exit
      const exitPrice = this.troughPrice * (1 + trailingPercent / 100);
      if (currentPrice >= exitPrice) {
        console.log(`[TrailingBot] Trailing buy triggered at ${currentPrice} (trough: ${this.troughPrice})`);

        const cost = quantity * currentPrice;
        if (state.availableBalance >= cost) {
          this.phase = 'COMPLETED';
          return [{
            action: 'buy',
            quantity: quantity / currentPrice,
            orderType: 'MARKET',
          }];
        }
      }
    }

    return [{ action: 'hold' }];
  }

  protected getMetrics(): Record<string, number> {
    return {
      phase: this.phase === 'WAITING_TRIGGER' ? 0 : this.phase === 'TRAILING' ? 1 : 2,
      peakPrice: this.peakPrice,
      troughPrice: this.troughPrice === Infinity ? 0 : this.troughPrice,
      triggerActivatedAt: this.triggerActivatedAt,
    };
  }

  restoreState(customState: Record<string, any>): void {
    super.restoreState(customState);
    this.phase = customState.phase || 'WAITING_TRIGGER';
    this.peakPrice = customState.peakPrice || 0;
    this.troughPrice = customState.troughPrice || Infinity;
    this.triggerActivatedAt = customState.triggerActivatedAt || 0;
  }

  getCustomState(): Record<string, any> {
    return {
      phase: this.phase,
      peakPrice: this.peakPrice,
      troughPrice: this.troughPrice,
      triggerActivatedAt: this.triggerActivatedAt,
    };
  }
}
