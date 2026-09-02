/**
 * Power Arbitrage Engine - Production-ready arbitrage trading system
 * Combines: Enhanced Scanner, Capital Manager, Simultaneous Executor, Risk Manager
 */
import { EventEmitter } from 'events';
import { EnhancedScanner } from './core/EnhancedScanner.js';
import { CapitalManager } from './core/CapitalManager.js';
import { SimultaneousExecutor } from './core/SimultaneousExecutor.js';
import { RiskManager } from './core/RiskManager.js';
import type { CrossExchangeOpportunity, ArbitrageExecution } from './types/index.js';
interface EngineConfig {
    exchanges: string[];
    tradeSizeUSDT: number;
    minProfitPercent: number;
    maxDailyLossUSDT: number;
    maxPositionSizeUSDT: number;
    autoExecute: boolean;
    dryRun: boolean;
    requireHighConfidence: boolean;
    demoMode: boolean;
}
interface EngineStats {
    isRunning: boolean;
    uptime: number;
    scanner: ReturnType<EnhancedScanner['getStats']>;
    capital: ReturnType<CapitalManager['getCapitalSummary']>;
    execution: ReturnType<SimultaneousExecutor['getStats']>;
    risk: ReturnType<RiskManager['getStats']>;
    opportunities: {
        total: number;
        profitable: number;
        highConfidence: number;
    };
}
export declare class PowerArbitrageEngine extends EventEmitter {
    private config;
    private adapters;
    private scanner;
    private capitalManager;
    private executor;
    private riskManager;
    private isInitialized;
    private isRunning;
    private startTime;
    private executionQueue;
    private isProcessingQueue;
    constructor(config?: Partial<EngineConfig>);
    initialize(): Promise<void>;
    private setupEventHandlers;
    private handleExecutionComplete;
    private handleExecutionFailed;
    start(): Promise<void>;
    stop(): Promise<void>;
    private queueExecution;
    private processQueue;
    /**
     * Manually execute an opportunity
     */
    executeOpportunity(opportunity: CrossExchangeOpportunity, amount?: number): Promise<ArbitrageExecution | null>;
    getOpportunities(): CrossExchangeOpportunity[];
    getProfitableOpportunities(): CrossExchangeOpportunity[];
    getHighConfidenceOpportunities(): CrossExchangeOpportunity[];
    getExecutionHistory(limit?: number): ArbitrageExecution[];
    getCapitalSummary(): ReturnType<CapitalManager['getCapitalSummary']> | null;
    getRebalanceRecommendations(): ReturnType<CapitalManager['getRebalanceRecommendations']>;
    getRiskStats(): ReturnType<RiskManager['getStats']> | null;
    getStats(): EngineStats;
    setAutoExecute(enabled: boolean): void;
    setDryRun(enabled: boolean): void;
    isDemoMode(): boolean;
    unlockTrading(): void;
    resetDailyStats(): void;
    private sleep;
    close(): Promise<void>;
}
export declare function getPowerEngine(config?: Partial<EngineConfig>): PowerArbitrageEngine;
export declare function createPowerEngine(config?: Partial<EngineConfig>): PowerArbitrageEngine;
export {};
//# sourceMappingURL=PowerArbitrageEngine.d.ts.map