import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { CrossExchangeOpportunity, ArbitrageExecution } from '../types/index.js';
interface ExecutionConfig {
    maxTradeAmountUSDT: number;
    slippageTolerancePercent: number;
    withdrawalTimeoutMs: number;
    confirmationPollingMs: number;
    dryRun: boolean;
}
interface TriangularOpportunity {
    id: string;
    exchange: string;
    cycle: {
        assets: string[];
        symbols: string[];
    };
    legs: Array<{
        symbol: string;
        direction: 'buy' | 'sell';
        price: number;
        amountIn: number;
        amountOut: number;
    }>;
    grossProfitPercent: number;
    netProfitPercent: number;
    profitable: boolean;
    timestamp: number;
}
export declare class ExecutionEngine extends EventEmitter {
    private adapters;
    private config;
    private activeExecutions;
    private executionHistory;
    private depositAddressCache;
    constructor(adapters: Map<string, IExchangeAdapter>, config?: Partial<ExecutionConfig>);
    executeCrossExchangeArbitrage(opportunity: CrossExchangeOpportunity, amount: number): Promise<ArbitrageExecution>;
    executeTriangularArbitrage(opportunity: TriangularOpportunity, initialAmount: number): Promise<ArbitrageExecution>;
    private executeBuy;
    private executeSell;
    private getDepositAddress;
    private executeWithdrawal;
    private waitForDeposit;
    private sleep;
    getActiveExecutions(): ArbitrageExecution[];
    getExecutionHistory(limit?: number): ArbitrageExecution[];
    getExecution(executionId: string): ArbitrageExecution | undefined;
    setConfig(config: Partial<ExecutionConfig>): void;
    getConfig(): ExecutionConfig;
    isDryRun(): boolean;
    setDryRun(dryRun: boolean): void;
}
export declare function createExecutionEngine(adapters: Map<string, IExchangeAdapter>, config?: Partial<ExecutionConfig>): ExecutionEngine;
export {};
//# sourceMappingURL=ExecutionEngine.d.ts.map