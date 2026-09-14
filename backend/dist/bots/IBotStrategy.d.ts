/**
 * IBotStrategy - Interface that every bot strategy must implement
 */
import type { IExchangeAdapter } from '../../arbitrage/dist/adapters/IExchangeAdapter.js';
import type { BotParams, BotState, BotAction, PriceTick, StrategyStatus, ValidationResult, BotStrategyType } from './types.js';
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
    initialize(params: BotParams, adapter: IExchangeAdapter, initialState?: Partial<BotState>): Promise<void>;
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
    /**
     * Handle order placement notification
     */
    onOrderPlaced?(orderId: string, gridLevel?: number, price?: number, side?: string): void;
}
/**
 * Base class with common functionality for strategies
 */
export type LogCallback = (message: string, level: 'info' | 'warn' | 'error') => void;
export declare abstract class BaseBotStrategy implements IBotStrategy {
    abstract readonly name: string;
    abstract readonly type: BotStrategyType;
    protected params: BotParams | null;
    protected adapter: IExchangeAdapter | null;
    protected isInitialized: boolean;
    protected lastAction: BotAction | null;
    protected lastActionTime: Date | null;
    protected customState: Record<string, any>;
    protected logCallback: LogCallback | null;
    /** Set external log callback for UI streaming */
    setLogCallback(cb: LogCallback): void;
    /** Log to console and optionally to UI */
    protected log(message: string, level?: 'info' | 'warn' | 'error'): void;
    abstract validate(params: BotParams): ValidationResult;
    initialize(params: BotParams, adapter: IExchangeAdapter, initialState?: Partial<BotState>): Promise<void>;
    protected abstract onInitialize(initialState?: Partial<BotState>): Promise<void>;
    abstract evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    getStatus(): StrategyStatus;
    protected abstract getMetrics(): Record<string, number>;
    getCustomState(): Record<string, any>;
    restoreState(customState: Record<string, any>): void;
    cleanup(): Promise<void>;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;
    onOrderCancelled(orderId: string): void;
    onOrderPlaced(orderId: string, gridLevel?: number, price?: number, side?: string): void;
    protected recordAction(action: BotAction): void;
    protected validateNumber(value: any, name: string, min?: number, max?: number): string | null;
}
