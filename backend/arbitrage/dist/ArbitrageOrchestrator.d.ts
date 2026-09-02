import { EventEmitter } from 'events';
import type { CrossExchangeOpportunity, TriangularOpportunity, ArbitrageExecution, Balance } from './types/index.js';
export type ArbitrageModeType = 'triangular' | 'cross-exchange' | 'both';
interface OrchestratorConfig {
    mode: ArbitrageModeType;
    exchanges: string[];
    scanIntervalMs: number;
    minProfitThresholdPercent: number;
    tradingFeePercent: number;
    maxTradeAmountUSDT: number;
    dryRun: boolean;
    autoExecute: boolean;
    triangularExchange: string;
    crossExchangeAssets: string[];
}
interface OrchestratorStats {
    mode: ArbitrageModeType;
    isRunning: boolean;
    connectedExchanges: string[];
    triangularStats: any;
    crossExchangeStats: any;
    executionStats: {
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        totalProfit: number;
    };
}
export declare class ArbitrageOrchestrator extends EventEmitter {
    private config;
    private adapters;
    private triangularScanner;
    private crossExchangeScanner;
    private executionEngine;
    private executionService;
    private isInitialized;
    private isRunning;
    private executionStats;
    constructor(config?: Partial<OrchestratorConfig>);
    initialize(): Promise<void>;
    private setupTriangularEvents;
    private setupCrossExchangeEvents;
    private setupExecutionEvents;
    private setupExecutionServiceEvents;
    start(): Promise<void>;
    stop(): Promise<void>;
    setMode(mode: ArbitrageModeType): Promise<void>;
    executeCrossExchange(opportunity: CrossExchangeOpportunity, amount?: number): Promise<ArbitrageExecution | null>;
    executeTriangular(opportunity: any, amount?: number): Promise<ArbitrageExecution | null>;
    executeCrossExchangeWithSteps(opportunity: CrossExchangeOpportunity, amount?: number): Promise<string | null>;
    executeTriangularWithSteps(opportunity: TriangularOpportunity, amount?: number): Promise<string | null>;
    getExecutionSession(sessionId: string): any;
    getActiveExecutionSessions(): any[];
    getTriangularOpportunities(limit?: number): any[];
    getCrossExchangeOpportunities(limit?: number): CrossExchangeOpportunity[];
    getExecutionHistory(limit?: number): ArbitrageExecution[];
    getActiveExecutions(): ArbitrageExecution[];
    getBalances(): Promise<Map<string, Balance[]>>;
    getStats(): OrchestratorStats;
    getConfig(): OrchestratorConfig;
    setConfig(config: Partial<OrchestratorConfig>): void;
    setDryRun(dryRun: boolean): void;
    setAutoExecute(autoExecute: boolean): void;
    close(): Promise<void>;
}
export declare function getOrchestrator(config?: Partial<OrchestratorConfig>): ArbitrageOrchestrator;
export declare function initializeOrchestrator(config?: Partial<OrchestratorConfig>): Promise<ArbitrageOrchestrator>;
export declare function createOrchestrator(config?: Partial<OrchestratorConfig>): ArbitrageOrchestrator;
export {};
//# sourceMappingURL=ArbitrageOrchestrator.d.ts.map