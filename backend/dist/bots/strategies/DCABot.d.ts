/**
 * DCABot Strategy - Dollar Cost Averaging
 * Buy fixed amount at regular intervals regardless of price
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class DCABot extends BaseBotStrategy {
    readonly name = "DCA Bot";
    readonly type: "DCA";
    private nextBuyTime;
    private totalSpent;
    private totalQuantity;
    private avgBuyPrice;
    private buyCount;
    private asset;
    private isStopLossActive;
    private isTakeProfitActive;
    private lastStopLossPrice;
    private lastStopLossLog;
    private lastTakeProfitLog;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private createSellAllAction;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
}
