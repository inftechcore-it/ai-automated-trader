/**
 * JarvisBot Strategy - Autonomous Dynamic Trailing Window Grid Bot with Precision 4th-Decimal Corridor
 *
 * Solves the traditional grid limitation where a bot halts/stalls when market price
 * breaks out above the upper bound ("out of grid") or misses fills due to sub-cent fluctuations.
 *
 * 1. Precision 4th-Decimal Point Matching (Corridor ±0.0009):
 *    Enables instant market-on-touch execution when price reaches 1-9 of the 4th decimal point
 *    (e.g., target 1.48200 triggers between 1.48110 and 1.48290), eliminating stranded/missed fills.
 *
 * 2. Autonomous Upper Breakout (Auto-Upgrade):
 *    When price surges and reaches or exceeds the upper bound, JARVIS dynamically shifts its
 *    entire trading window upwards by exact integer multiples of gridSpacing:
 *      currentUpperPrice += stepsUp * gridSpacing
 *      currentLowerPrice += stepsUp * gridSpacing
 *    Immediately generates fresh dip-buy levels right beneath the new market peak!
 *
 * 3. Autonomous Pullback Recalibration (Auto-Downgrade):
 *    When price pulls back below the elevated upper zone (>= 2 step spaces below upper),
 *    JARVIS smoothly steps down its active range back towards the initial baseline:
 *      currentUpperPrice = Math.max(initialUpperPrice, currentUpperPrice - stepsDown * gridSpacing)
 *      currentLowerPrice = Math.max(initialLowerPrice, currentLowerPrice - stepsDown * gridSpacing)
 *    Ensuring the active grid envelope stays perfectly centered around live market price
 *    with 100% uniform step spacing at all times!
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
    private initialLowerPrice;
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
    /**
     * Rebuilds exact, uniform grid levels across the active [currentLowerPrice, currentUpperPrice] window
     */
    private rebuildGridLevels;
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
