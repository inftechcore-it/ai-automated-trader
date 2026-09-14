/**
 * InfinityGridBot Strategy - Grid bot with no upper limit
 * For assets you're long-term bullish on
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class InfinityGridBot extends BaseBotStrategy {
    readonly name = "Infinity Grid Bot";
    readonly type: "INFINITY_GRID";
    private gridLevels;
    private highestGridIndex;
    private gridProfit;
    private gridProfitCount;
    private lastPrice;
    private asset;
    private isStopLossActive;
    private lastStopLossLog;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private findGridIndex;
    private extendGridIfNeeded;
    private createExitActions;
    private calculateQuantity;
    private calculateSellQuantity;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;
    onOrderPlaced(orderId: string, gridLevel?: number, price?: number, side?: string): void;
    onOrderCancelled(orderId: string): void;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
}
