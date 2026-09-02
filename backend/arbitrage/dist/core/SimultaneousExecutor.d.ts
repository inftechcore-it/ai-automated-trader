/**
 * Simultaneous Executor - Executes buy and sell orders at the same time
 * Eliminates withdrawal delay risk by using pre-positioned capital
 */
import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { CrossExchangeOpportunity, ArbitrageExecution, OrderResult } from '../types/index.js';
import { CapitalManager } from './CapitalManager.js';
interface ExecutorConfig {
    maxSlippagePercent: number;
    orderTimeoutMs: number;
    maxRetries: number;
    minProfitAfterSlippage: number;
    dryRun: boolean;
}
interface ExecutionResult {
    success: boolean;
    execution: ArbitrageExecution;
    buyOrder?: OrderResult;
    sellOrder?: OrderResult;
    actualProfit?: number;
    error?: string;
}
export declare class SimultaneousExecutor extends EventEmitter {
    private adapters;
    private capitalManager;
    private config;
    private activeExecutions;
    private executionHistory;
    private stats;
    constructor(adapters: Map<string, IExchangeAdapter>, capitalManager: CapitalManager, config?: Partial<ExecutorConfig>);
    /**
     * Execute cross-exchange arbitrage simultaneously
     * Both buy and sell orders placed at the same time
     */
    executeSimultaneous(opportunity: CrossExchangeOpportunity, amountUSDT: number): Promise<ExecutionResult>;
    private placeOrderWithRetry;
    private simulateExecution;
    private updateStats;
    private sleep;
    getActiveExecutions(): ArbitrageExecution[];
    getExecutionHistory(limit?: number): ArbitrageExecution[];
    getStats(): typeof this.stats;
    setDryRun(dryRun: boolean): void;
    isDryRun(): boolean;
}
export declare function createSimultaneousExecutor(adapters: Map<string, IExchangeAdapter>, capitalManager: CapitalManager, config?: Partial<ExecutorConfig>): SimultaneousExecutor;
export {};
//# sourceMappingURL=SimultaneousExecutor.d.ts.map