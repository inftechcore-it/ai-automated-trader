/**
 * SuperZeeBot Strategy - Autonomous Predictive AI Quant Engine
 * Real-time dynamic boundaries ($X, $Y, $Z), Local Microsecond Guard (<50ms),
 * Hysteresis Action Cooldowns, State Persistence, and Live AI Thought Stream.
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class SuperZeeBot extends BaseBotStrategy {
    readonly name = "Super Zee Bot";
    readonly type: "SUPER_ZEE";
    private dynamicLower;
    private dynamicUpper;
    private dynamicSpacing;
    private emergencyFloorPrice;
    private takeProfitCeilingPrice;
    private trailingStopLoss;
    private baseInvestment;
    private initialEntryFilled;
    private activeHoldingsQuantity;
    private avgEntryPrice;
    private realizedProfit;
    private totalHarvests;
    private totalDipBuys;
    private marketRegime;
    private lastThought;
    private lastDirectiveAction;
    private actionCooldownMs;
    private lastActionTimestamp;
    private lastDirectiveFetchTime;
    private asset;
    private quote;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    /**
     * Background async helper to refresh directive and update in-memory safeguards
     */
    private refreshPredictiveDirective;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number, side?: string): void;
    onOrderCancelled(orderId: string): void;
    protected getMetrics(): Record<string, number>;
    getCustomState(): Record<string, any>;
    restoreState(customState: Record<string, any>): void;
    cleanup(): Promise<void>;
}
export default SuperZeeBot;
