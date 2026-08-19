import { EventEmitter } from 'events';
import { getAdapter, getAdapters, closeAllAdapters } from './adapters/index.js';
import { ArbitrageScanner, createArbitrageScanner } from './scanner/ArbitrageScanner.js';
import { CrossExchangeScanner, createCrossExchangeScanner } from './scanner/CrossExchangeScanner.js';
import { ExecutionEngine, createExecutionEngine } from './execution/index.js';
import { ExecutionService, createExecutionService } from './execution/ExecutionService.js';
import type { IExchangeAdapter } from './adapters/IExchangeAdapter.js';
import type { ArbitrageMode, CrossExchangeOpportunity, TriangularOpportunity, ArbitrageExecution, Balance } from './types/index.js';

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

export class ArbitrageOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private adapters: Map<string, IExchangeAdapter> = new Map();
  private triangularScanner: ArbitrageScanner | null = null;
  private crossExchangeScanner: CrossExchangeScanner | null = null;
  private executionEngine: ExecutionEngine | null = null;
  private executionService: ExecutionService | null = null;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private executionStats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalProfit: 0,
  };

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();

    this.config = {
      mode: config.mode || 'both',
      exchanges: config.exchanges || ['binance', 'bybit', 'kraken'],
      scanIntervalMs: config.scanIntervalMs || 3000,
      minProfitThresholdPercent: config.minProfitThresholdPercent ?? 0.1,
      tradingFeePercent: config.tradingFeePercent || 0.1,
      maxTradeAmountUSDT: config.maxTradeAmountUSDT || 100,
      dryRun: config.dryRun ?? true,
      autoExecute: config.autoExecute ?? false,
      triangularExchange: config.triangularExchange || 'binance',
      crossExchangeAssets: config.crossExchangeAssets || ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE', 'LTC', 'LINK'],
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Orchestrator] Already initialized');
      return;
    }

    console.log('[Orchestrator] Initializing...');
    console.log(`[Orchestrator] Mode: ${this.config.mode}`);
    console.log(`[Orchestrator] Exchanges: ${this.config.exchanges.join(', ')}`);
    console.log(`[Orchestrator] Dry Run: ${this.config.dryRun}`);

    this.adapters = await getAdapters(this.config.exchanges);
    console.log(`[Orchestrator] Connected to ${this.adapters.size} exchanges`);

    if (this.config.mode === 'triangular' || this.config.mode === 'both') {
      const triangularAdapter = this.adapters.get(this.config.triangularExchange.toLowerCase());
      if (triangularAdapter) {
        this.triangularScanner = createArbitrageScanner(triangularAdapter, {
          enableRedis: false,
          enableDatabase: false,
          scanIntervalMs: this.config.scanIntervalMs,
          minProfitThresholdPercent: this.config.minProfitThresholdPercent,
        });

        this.setupTriangularEvents();
        console.log(`[Orchestrator] Triangular scanner initialized for ${this.config.triangularExchange}`);
      }
    }

    if (this.config.mode === 'cross-exchange' || this.config.mode === 'both') {
      this.crossExchangeScanner = createCrossExchangeScanner(this.adapters, {
        scanIntervalMs: this.config.scanIntervalMs,
        minProfitThresholdPercent: this.config.minProfitThresholdPercent,
        tradingFeePercent: this.config.tradingFeePercent,
        assets: this.config.crossExchangeAssets,
      });

      this.setupCrossExchangeEvents();
      console.log('[Orchestrator] Cross-exchange scanner initialized');
    }

    this.executionEngine = createExecutionEngine(this.adapters, {
      maxTradeAmountUSDT: this.config.maxTradeAmountUSDT,
      dryRun: this.config.dryRun,
    });

    this.executionService = createExecutionService(this.adapters, {
      maxTradeAmountUSDT: this.config.maxTradeAmountUSDT,
      dryRun: this.config.dryRun,
    });

    this.setupExecutionEvents();
    this.setupExecutionServiceEvents();
    console.log('[Orchestrator] Execution engine initialized');

    this.isInitialized = true;
    this.emit('initialized');
  }

  private setupTriangularEvents(): void {
    if (!this.triangularScanner) return;

    this.triangularScanner.on('opportunity', (opp) => {
      this.emit('triangular:opportunity', opp);

      if (this.config.autoExecute && opp.profitable && this.executionEngine) {
        this.executeTriangular(opp);
      }
    });

    this.triangularScanner.on('started', (stats) => {
      this.emit('triangular:started', stats);
    });

    this.triangularScanner.on('stopped', (stats) => {
      this.emit('triangular:stopped', stats);
    });
  }

  private setupCrossExchangeEvents(): void {
    if (!this.crossExchangeScanner) return;

    this.crossExchangeScanner.on('opportunity', (opp: CrossExchangeOpportunity) => {
      this.emit('crossExchange:opportunity', opp);

      if (this.config.autoExecute && opp.profitable && this.executionEngine) {
        this.executeCrossExchange(opp);
      }
    });

    this.crossExchangeScanner.on('started', (stats) => {
      this.emit('crossExchange:started', stats);
    });

    this.crossExchangeScanner.on('stopped', (stats) => {
      this.emit('crossExchange:stopped', stats);
    });
  }

  private setupExecutionEvents(): void {
    if (!this.executionEngine) return;

    this.executionEngine.on('execution:started', (execution: ArbitrageExecution) => {
      this.executionStats.totalExecutions++;
      this.emit('execution:started', execution);
    });

    this.executionEngine.on('execution:completed', (execution: ArbitrageExecution) => {
      this.executionStats.successfulExecutions++;
      this.executionStats.totalProfit += execution.netProfit || 0;
      this.emit('execution:completed', execution);
    });

    this.executionEngine.on('execution:failed', ({ execution, error }) => {
      this.executionStats.failedExecutions++;
      this.emit('execution:failed', { execution, error });
    });

    this.executionEngine.on('execution:leg_completed', (data) => {
      this.emit('execution:leg_completed', data);
    });
  }

  private setupExecutionServiceEvents(): void {
    if (!this.executionService) return;

    this.executionService.on('execution:step_update', (data) => {
      this.emit('execution:step_update', data);
    });

    this.executionService.on('execution:complete', (data) => {
      this.executionStats.successfulExecutions++;
      this.emit('execution:complete', data);
    });

    this.executionService.on('execution:failed', (data) => {
      this.executionStats.failedExecutions++;
      this.emit('execution:failed', data);
    });
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      console.log('[Orchestrator] Already running');
      return;
    }

    console.log('[Orchestrator] Starting scanners...');
    this.isRunning = true;

    const startPromises: Promise<void>[] = [];

    if (this.triangularScanner && (this.config.mode === 'triangular' || this.config.mode === 'both')) {
      startPromises.push(this.triangularScanner.start());
    }

    if (this.crossExchangeScanner && (this.config.mode === 'cross-exchange' || this.config.mode === 'both')) {
      startPromises.push(this.crossExchangeScanner.start());
    }

    await Promise.all(startPromises);

    this.emit('started', this.getStats());
    console.log('[Orchestrator] All scanners started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[Orchestrator] Stopping scanners...');
    this.isRunning = false;

    const stopPromises: Promise<void>[] = [];

    if (this.triangularScanner) {
      stopPromises.push(this.triangularScanner.stop());
    }

    if (this.crossExchangeScanner) {
      stopPromises.push(this.crossExchangeScanner.stop());
    }

    await Promise.all(stopPromises);

    this.emit('stopped', this.getStats());
    console.log('[Orchestrator] All scanners stopped');
  }

  async setMode(mode: ArbitrageModeType): Promise<void> {
    if (mode === this.config.mode) {
      return;
    }

    const wasRunning = this.isRunning;

    if (wasRunning) {
      await this.stop();
    }

    this.config.mode = mode;
    console.log(`[Orchestrator] Mode changed to: ${mode}`);

    if (wasRunning) {
      await this.start();
    }

    this.emit('mode:changed', mode);
  }

  async executeCrossExchange(opportunity: CrossExchangeOpportunity, amount?: number): Promise<ArbitrageExecution | null> {
    if (!this.executionEngine) {
      console.error('[Orchestrator] Execution engine not initialized');
      return null;
    }

    const tradeAmount = amount || this.config.maxTradeAmountUSDT;
    return this.executionEngine.executeCrossExchangeArbitrage(opportunity, tradeAmount);
  }

  async executeTriangular(opportunity: any, amount?: number): Promise<ArbitrageExecution | null> {
    if (!this.executionEngine) {
      console.error('[Orchestrator] Execution engine not initialized');
      return null;
    }

    const tradeAmount = amount || this.config.maxTradeAmountUSDT;
    return this.executionEngine.executeTriangularArbitrage(opportunity, tradeAmount);
  }

  async executeCrossExchangeWithSteps(opportunity: CrossExchangeOpportunity, amount?: number): Promise<string | null> {
    if (!this.executionService) {
      console.error('[Orchestrator] Execution service not initialized');
      return null;
    }

    const tradeAmount = amount || this.config.maxTradeAmountUSDT;
    return this.executionService.executeCrossExchange(opportunity, tradeAmount);
  }

  async executeTriangularWithSteps(opportunity: TriangularOpportunity, amount?: number): Promise<string | null> {
    if (!this.executionService) {
      console.error('[Orchestrator] Execution service not initialized');
      return null;
    }

    const tradeAmount = amount || this.config.maxTradeAmountUSDT;
    return this.executionService.executeTriangular(opportunity, tradeAmount);
  }

  getExecutionSession(sessionId: string): any {
    return this.executionService?.getSession(sessionId);
  }

  getActiveExecutionSessions(): any[] {
    return this.executionService?.getActiveSessions() || [];
  }

  getTriangularOpportunities(limit: number = 20): any[] {
    return this.triangularScanner?.getRecentOpportunities() || [];
  }

  getCrossExchangeOpportunities(limit: number = 20): CrossExchangeOpportunity[] {
    return this.crossExchangeScanner?.getRecentOpportunities(limit) || [];
  }

  getExecutionHistory(limit: number = 20): ArbitrageExecution[] {
    return this.executionEngine?.getExecutionHistory(limit) || [];
  }

  getActiveExecutions(): ArbitrageExecution[] {
    return this.executionEngine?.getActiveExecutions() || [];
  }

  async getBalances(): Promise<Map<string, Balance[]>> {
    const balances = new Map<string, Balance[]>();

    for (const [name, adapter] of this.adapters) {
      try {
        const exchangeBalances = await adapter.getBalance();
        balances.set(name, exchangeBalances);
      } catch (error) {
        console.warn(`[Orchestrator] Failed to get balances from ${name}:`, error);
        balances.set(name, []);
      }
    }

    return balances;
  }

  getStats(): OrchestratorStats {
    return {
      mode: this.config.mode,
      isRunning: this.isRunning,
      connectedExchanges: Array.from(this.adapters.keys()),
      triangularStats: this.triangularScanner?.getStats() || null,
      crossExchangeStats: this.crossExchangeScanner?.getStats() || null,
      executionStats: { ...this.executionStats },
    };
  }

  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<OrchestratorConfig>): void {
    const modeChanged = config.mode && config.mode !== this.config.mode;

    Object.assign(this.config, config);

    if (this.executionEngine) {
      this.executionEngine.setConfig({
        dryRun: this.config.dryRun,
        maxTradeAmountUSDT: this.config.maxTradeAmountUSDT,
      });
    }

    if (modeChanged) {
      this.setMode(this.config.mode);
    }

    this.emit('config:changed', this.config);
  }

  setDryRun(dryRun: boolean): void {
    this.config.dryRun = dryRun;
    if (this.executionEngine) {
      this.executionEngine.setDryRun(dryRun);
    }
    if (this.executionService) {
      this.executionService.setDryRun(dryRun);
    }
    console.log(`[Orchestrator] Dry run: ${dryRun ? 'ENABLED' : 'DISABLED - LIVE TRADING'}`);
  }

  setAutoExecute(autoExecute: boolean): void {
    this.config.autoExecute = autoExecute;
    console.log(`[Orchestrator] Auto-execute: ${autoExecute ? 'ENABLED' : 'DISABLED'}`);
  }

  async close(): Promise<void> {
    await this.stop();
    await closeAllAdapters();
    this.isInitialized = false;
    console.log('[Orchestrator] Closed');
  }
}

let orchestratorInstance: ArbitrageOrchestrator | null = null;

export function getOrchestrator(config?: Partial<OrchestratorConfig>): ArbitrageOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ArbitrageOrchestrator(config);
  }
  return orchestratorInstance;
}

export async function initializeOrchestrator(config?: Partial<OrchestratorConfig>): Promise<ArbitrageOrchestrator> {
  const orchestrator = getOrchestrator(config);
  await orchestrator.initialize();
  return orchestrator;
}

export function createOrchestrator(config?: Partial<OrchestratorConfig>): ArbitrageOrchestrator {
  return new ArbitrageOrchestrator(config);
}
