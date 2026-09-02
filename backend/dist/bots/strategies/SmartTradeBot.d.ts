/**
 * SmartTradeBot Strategy - Single trade with advanced exit conditions
 * Like a manual trade but with automated TP/SL/Trailing exits
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class SmartTradeBot extends BaseBotStrategy {
    readonly name = "Smart Trade Bot";
    readonly type: "SMART_TRADE";
    private phase;
    private entryPrice;
    private entryQuantity;
    private highestPrice;
    private lowestPrice;
    private asset;
    private entryOrderId?;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private handleEntry;
    private calculateTakeProfit;
    private calculateStopLoss;
    private checkTrailingExit;
    private createExitAction;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
}
