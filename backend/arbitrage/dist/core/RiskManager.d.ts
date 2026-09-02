/**
 * Risk Manager - Controls exposure, prevents excessive losses
 */
import { EventEmitter } from 'events';
import type { CrossExchangeOpportunity } from '../types/index.js';
interface RiskConfig {
    maxDailyLossUSDT: number;
    maxPositionSizeUSDT: number;
    maxOpenPositions: number;
    maxExposurePerAsset: number;
    maxExposurePerExchange: number;
    cooldownAfterLossMs: number;
    minProfitToExecute: number;
    maxConsecutiveLosses: number;
    requireHighConfidence: boolean;
}
interface RiskCheck {
    allowed: boolean;
    reason: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    adjustedAmount?: number;
}
export declare class RiskManager extends EventEmitter {
    private config;
    private state;
    private totalCapitalUSDT;
    constructor(config?: Partial<RiskConfig>);
    private createInitialState;
    setTotalCapital(capitalUSDT: number): void;
    /**
     * Check if an opportunity passes risk checks
     */
    checkOpportunity(opportunity: CrossExchangeOpportunity, requestedAmount: number): RiskCheck;
    /**
     * Record a position opening
     */
    openPosition(executionId: string, asset: string, exchanges: string[], amountUSDT: number): void;
    /**
     * Record a position closing
     */
    closePosition(executionId: string, asset: string, exchanges: string[], amountUSDT: number, pnl: number): void;
    /**
     * Lock trading
     */
    lockTrading(reason: string): void;
    /**
     * Unlock trading
     */
    unlockTrading(): void;
    /**
     * Reset daily stats (call at start of new trading day)
     */
    resetDaily(): void;
    getStats(): {
        dailyPnL: number;
        dailyTrades: number;
        winRate: number;
        consecutiveLosses: number;
        openPositions: number;
        isLocked: boolean;
        lockReason: string;
    };
    getConfig(): RiskConfig;
    setConfig(config: Partial<RiskConfig>): void;
}
export declare function createRiskManager(config?: Partial<RiskConfig>): RiskManager;
export {};
//# sourceMappingURL=RiskManager.d.ts.map