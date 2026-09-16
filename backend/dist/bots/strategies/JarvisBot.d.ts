/**
 * JarvisBot Strategy - Autonomous Upper-Bound Expanding Grid Trading Bot
 *
 * Solves the traditional grid limitation where a bot halts/stalls when market price
 * breaks out above the upper bound ("out of grid").
 *
 * When market price surges and reaches or exceeds the upper price:
 * The bot acts AUTONOMOUSLY to increase its upper price:
 *   newUpperPrice = currentPrice + gridSpacing (Step Space)
 * and dynamically recalibrates its grid levels to continue active, profitable trading.
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class JarvisBot extends BaseBotStrategy {
    readonly name = "JARVIS Bot";
    readonly type: "JARVIS";
    private gridLevels;
    private gridSpacing;
    private currentLowerPrice;
    private currentUpperPrice;
    private initialUpperPrice;
    private upperPriceIncrementsCount;
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
    private isStopLossActive;
    private lastStopLossLog;
    private lastIncrementLog;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    handleError(error: string): void;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private createExitActions;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;
    onOrderCancelled(orderId: string): void;
    onOrderError(error: string): void;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
}
