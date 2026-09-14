/**
 * MartingaleBot Strategy - Double down after losses
 * HIGH RISK: Position size increases after losses
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class MartingaleBot extends BaseBotStrategy {
    readonly name = "Martingale Bot";
    readonly type: "MARTINGALE";
    private safetyOrderCount;
    private lastBuyPrice;
    private lastBuyAmount;
    private avgEntryPrice;
    private totalQuantity;
    private totalSpent;
    private asset;
    private hasInitialBuy;
    private isStopLossActive;
    private lastStopLossPrice;
    private lastStopLossLog;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private createSellAllAction;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
}
