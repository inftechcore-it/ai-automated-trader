/**
 * JarvisBot Strategy - 3-Grid Progressive Execution Engine
 *
 * 1. Fixed 3-Grid Architecture (4 Levels: Grid #0, #1, #2, #3):
 *    - Grid #0: Base Buy Level (Initial 75% Investment Entry, 25% Cash Reserve)
 *    - Grid #1: 50% Take Profit Sell + 25% Cash Reserve Buy
 *    - Grid #2: 70% Profit Harvest, 30% Runner Bag Retention, Dynamic Midpoint Inter-Grid SL Activation
 *    - Grid #3: 50% Runner Exit & Autonomous Auto-Surge Upgrade
 *
 * 2. Midpoint Inter-Grid Stop-Loss:
 *    - Formula: Inter-Grid SL = (Grid #2 Price + Grid #1 Price) / 2
 *    - Trigger: Liquidates 100% of remaining holdings to cash when price drops <= Inter-Grid SL.
 *
 * 3. Post-SL Re-entry Controller:
 *    - If price drops to Grid #1: Re-buys with 25% of fixed investment budget.
 *    - If price rebounds to Grid #2: Re-buys with 25% of fixed investment budget after a 30s stabilization cooldown.
 *
 * 4. Binance Notional Guard ($5.20 USDT):
 *    - If any fractional sell order value < $5.20, sells 100% of the remaining bag to prevent -1013 NOTIONAL errors.
 *
 * 5. Primary Hard Stop Loss:
 *    - Immediate 100% full liquidation if price <= stopLoss (below Grid #0).
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export interface JarvisLevel {
    price: number;
    index: number;
    role: string;
    type: 'buy' | 'sell';
    orderId?: string;
    filled: boolean;
    buyCount: number;
    lastActionTimestamp?: number;
}
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
    private stageStatus;
    private interGridStopLossPrice;
    private interGridSLActive;
    private lastInterGridSLTime;
    private lastStageActionTime;
    private lastError;
    private insufficientBalance;
    private lastStatusLog;
    private isStopLossActive;
    private lastStopLossLog;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    private getGridRole;
    /**
     * Rebuilds exact 3-grid spaces (4 levels: #0, #1, #2, #3) across active window
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
