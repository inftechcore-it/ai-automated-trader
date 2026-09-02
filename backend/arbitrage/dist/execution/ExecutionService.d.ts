import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { CrossExchangeOpportunity, TriangularOpportunity } from '../types/index.js';
export interface ExecutionStep {
    step: number;
    label: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    data?: Record<string, any>;
    error?: string;
    timestamp?: number;
}
export interface ExecutionSession {
    id: string;
    type: 'cross-exchange' | 'triangular';
    opportunity: CrossExchangeOpportunity | TriangularOpportunity;
    steps: ExecutionStep[];
    status: 'validating' | 'executing' | 'completed' | 'failed';
    dryRun: boolean;
    startedAt: number;
    completedAt?: number;
    expectedProfit: number;
    actualProfit?: number;
}
interface ExecutionConfig {
    dryRun: boolean;
    maxTradeAmountUSDT: number;
    orderTimeoutS: number;
    transferTimeoutS: number;
    slippageTolerancePercent: number;
}
export declare class ExecutionService extends EventEmitter {
    private adapters;
    private config;
    private activeSessions;
    private sessionHistory;
    constructor(adapters: Map<string, IExchangeAdapter>, config?: Partial<ExecutionConfig>);
    executeCrossExchange(opportunity: CrossExchangeOpportunity, amount: number): Promise<string>;
    private runCrossExchangeExecution;
    private executeStep1Validate;
    private executeStep2Buy;
    private executeStep3Transfer;
    private executeStep4Sell;
    private executeStep5Summary;
    executeTriangular(opportunity: TriangularOpportunity, amount: number): Promise<string>;
    private runTriangularExecution;
    private emitStepUpdate;
    private simulateDelay;
    getSession(sessionId: string): ExecutionSession | undefined;
    getActiveSessions(): ExecutionSession[];
    getSessionHistory(limit?: number): ExecutionSession[];
    setConfig(config: Partial<ExecutionConfig>): void;
    setDryRun(dryRun: boolean): void;
    isDryRun(): boolean;
}
export declare function createExecutionService(adapters: Map<string, IExchangeAdapter>, config?: Partial<ExecutionConfig>): ExecutionService;
export {};
//# sourceMappingURL=ExecutionService.d.ts.map