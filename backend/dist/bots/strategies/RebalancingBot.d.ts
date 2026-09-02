/**
 * RebalancingBot Strategy - Maintain fixed portfolio ratios
 * Automatically rebalances when allocations drift beyond threshold
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class RebalancingBot extends BaseBotStrategy {
    readonly name = "Rebalancing Bot";
    readonly type: "REBALANCING";
    private prices;
    private nextRebalanceTime;
    private rebalanceCount;
    private hasInitialBuy;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private createInitialBuys;
    private calculateAllocations;
    private createRebalanceActions;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
}
