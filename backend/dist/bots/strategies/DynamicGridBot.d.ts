/**
 * DynamicGridBot Strategy - Auto-discovers coins and trades multiple simultaneously
 *
 * Advanced Features:
 * - Auto-discovery: Scans market for coins in price range
 * - Per-coin buy limit: Max buys per individual coin (default: 3)
 * - Total buy limit: Max total buys across ALL coins (default: 30)
 * - Max active coins: Limit how many coins to trade simultaneously
 * - Overall stop loss: Stop bot if portfolio drops X% from peak
 * - Per-coin profit target: Take profit when coin gains X%
 * - Daily loss limit: Pause trading if daily loss exceeds limit
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import type { BotParams, CoinTradeState, BotState, BotAction, PriceTick, ValidationResult } from '../types.js';
export declare class DynamicGridBot extends BaseBotStrategy {
    readonly name = "Dynamic Grid Bot";
    readonly type: "DYNAMIC_GRID";
    private scanner;
    private coinGrids;
    private lastScanTime;
    private scanInterval;
    private initialized;
    private exchange;
    private totalBuysAcrossAllCoins;
    private totalSellsAcrossAllCoins;
    private totalRealizedProfit;
    private peakPortfolioValue;
    private dailyStartValue;
    private dailyStartDate;
    private isStopped;
    private isStopLossActive;
    private lastStopLossLog;
    private stopReason;
    validate(params: BotParams): ValidationResult;
    protected onInitialize(initialState?: Partial<BotState>): Promise<void>;
    evaluate(tick: PriceTick, state: BotState): Promise<BotAction[]>;
    private calculatePortfolioValue;
    private scanAndSetupCoins;
    private setupCoinGrid;
    private processGridLevels;
    private createCoinExitActions;
    private createExitAllActions;
    onOrderFilled(orderId: string, filledPrice: number, filledQuantity: number): void;
    protected getMetrics(): Record<string, number>;
    restoreState(customState: Record<string, any>): void;
    getCustomState(): Record<string, any>;
    getCoinStatuses(): CoinTradeState[];
    getSummary(): {
        totalCoins: number;
        activeCoins: number;
        totalBuys: number;
        maxTotalBuys: number;
        totalProfit: number;
        isStopped: boolean;
        stopReason: string;
    };
}
