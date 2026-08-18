/**
 * IBotStrategy - Interface that every bot strategy must implement
 */
import type { IExchangeAdapter } from '../../arbitrage/dist/adapters/IExchangeAdapter.js';
import type {
  BotParams,
  BotState,
  BotAction,
  PriceTick,
  StrategyStatus,
  ValidationResult,
  BotStrategyType,
} from './types.js';

export interface IBotStrategy {
  /** Strategy name for display */
  readonly name: string;

  /** Strategy type identifier */
  readonly type: BotStrategyType;

  /**
   * Validate strategy parameters before bot creation
   */
  validate(params: BotParams): ValidationResult;

  /**
   * Initialize the strategy with params and exchange adapter
   * Called once when bot starts
   */
  initialize(
    params: BotParams,
    adapter: IExchangeAdapter,
    initialState?: Partial<BotState>
  ): Promise<void>;

  /**
   * Evaluate current market conditions and return action
   * Called on each price tick
   */
  evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;

  /**
   * Get current strategy status and metrics
   */
  getStatus(): StrategyStatus;

  /**
   * Get strategy-specific state for persistence
   */
  getCustomState(): Record<string, any>;

  /**
   * Restore strategy state from persistence
   */
  restoreState(customState: Record<string, any>): void;

  /**
   * Cleanup resources when bot stops
   */
  cleanup(): Promise<void>;

  /**
   * Handle order fill notification
   */
  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;

  /**
   * Handle order cancellation
   */
  onOrderCancelled(orderId: string): void;
}

/**
 * Base class with common functionality for strategies
 */
export type LogCallback = (message: string, level: 'info' | 'warn' | 'error') => void;

export abstract class BaseBotStrategy implements IBotStrategy {
  abstract readonly name: string;
  abstract readonly type: BotStrategyType;

  protected params: BotParams | null = null;
  protected adapter: IExchangeAdapter | null = null;
  protected isInitialized = false;
  protected lastAction: BotAction | null = null;
  protected lastActionTime: Date | null = null;
  protected customState: Record<string, any> = {};
  protected logCallback: LogCallback | null = null;

  /** Set external log callback for UI streaming */
  setLogCallback(cb: LogCallback): void {
    this.logCallback = cb;
  }

  /** Log to console and optionally to UI */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = `[${this.name}]`;
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
    this.logCallback?.(message, level);
  }

  abstract validate(params: BotParams): ValidationResult;

  async initialize(
    params: BotParams,
    adapter: IExchangeAdapter,
    initialState?: Partial<BotState>
  ): Promise<void> {
    this.params = params;
    this.adapter = adapter;
    this.isInitialized = true;
    await this.onInitialize(initialState);
  }

  protected abstract onInitialize(initialState?: Partial<BotState>): Promise<void>;

  abstract evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;

  getStatus(): StrategyStatus {
    return {
      isHealthy: this.isInitialized,
      message: this.isInitialized ? 'Running' : 'Not initialized',
      metrics: this.getMetrics(),
      lastAction: this.lastAction ?? undefined,
      lastActionTime: this.lastActionTime ?? undefined,
    };
  }

  protected abstract getMetrics(): Record<string, number>;

  getCustomState(): Record<string, any> {
    return { ...this.customState };
  }

  restoreState(customState: Record<string, any>): void {
    this.customState = { ...customState };
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false;
    this.params = null;
    this.adapter = null;
  }

  onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void {
    // Override in subclasses
  }

  onOrderCancelled(orderId: string): void {
    // Override in subclasses
  }

  protected recordAction(action: BotAction): void {
    this.lastAction = action;
    this.lastActionTime = new Date();
  }

  protected validateNumber(value: any, name: string, min?: number, max?: number): string | null {
    if (typeof value !== 'number' || isNaN(value)) {
      return `${name} must be a valid number`;
    }
    if (min !== undefined && value < min) {
      return `${name} must be at least ${min}`;
    }
    if (max !== undefined && value > max) {
      return `${name} must be at most ${max}`;
    }
    return null;
  }
}
