/**
 * GridBot Strategy - Buy low sell high within a price range
 * Best for sideways/ranging markets
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class GridBot extends BaseBotStrategy {
    readonly name = "Grid Trading Bot";
    readonly type: "GRID";
    private gridLevels;
    private gridSpacing;
    private gridProfit;
    private gridProfitCount;
    private lastPrice;
    private asset;
    private quote;
    private lastError;
    private insufficientBalance;
    private lastBalanceCheck;
    private lastStatusLog;
    private lastRangeLog;
    private isStopped;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    handleError(error: string): void;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private createInitialOrders;
    private createExitActions;
    private calculateQuantity;
    private calculateSellQuantity;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;
    onOrderError(error: string): void;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
}
