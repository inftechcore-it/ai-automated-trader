/**
 * TrailingBot Strategy - Ride a trend and exit when it reverses
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class TrailingBot extends BaseBotStrategy {
    readonly name = "Trailing Bot";
    readonly type: "TRAILING";
    private phase;
    private peakPrice;
    private troughPrice;
    private triggerActivatedAt;
    private asset;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private evaluateTrailingSell;
    private evaluateTrailingBuy;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
}
