/**
 * PrecisionGridBot Strategy - Precision Tolerance Band Grid Trading Bot
 * Solves slow execution & missed fills by executing orders within a configurable
 * decimal tolerance corridor (e.g., matching 0.5820 - 0.5829 when target is 0.5823).
 * Eliminates stranded limit orders by executing instant market fills on corridor touch.
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class PrecisionGridBot extends BaseBotStrategy {
    readonly name = "Precision Grid Bot";
    readonly type: "PRECISION_GRID";
    private gridLevels;
    private gridSpacing;
    private priceTolerance;
    private gridProfit;
    private gridProfitCount;
    private lastPrice;
    private asset;
    private quote;
    private lastError;
    private insufficientBalance;
    private lastBalanceCheck;
    private lastStatusLog;
    private lastRangeLog;
    private isStopLossActive;
    private isTakeProfitActive;
    private lastStopLossLog;
    private lastTakeProfitLog;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    handleError(error: string): void;
    /**
     * Helper to determine if current market price is within the tolerance band of a target price
     */
    private isWithinTolerance;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private createExitActions;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;
    onOrderCancelled(orderId: string): void;
    onOrderError(error: string): void;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
}
