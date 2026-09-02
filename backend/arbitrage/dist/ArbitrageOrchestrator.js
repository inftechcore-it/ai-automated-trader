import { EventEmitter } from 'events';
import { getAdapters, closeAllAdapters } from './adapters/index.js';
import { createArbitrageScanner } from './scanner/ArbitrageScanner.js';
import { createCrossExchangeScanner } from './scanner/CrossExchangeScanner.js';
import { createExecutionEngine } from './execution/index.js';
import { createExecutionService } from './execution/ExecutionService.js';
export class ArbitrageOrchestrator extends EventEmitter {
    config;
    adapters = new Map();
    triangularScanner = null;
    crossExchangeScanner = null;
    executionEngine = null;
    executionService = null;
    isInitialized = false;
    isRunning = false;
    executionStats = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalProfit: 0,
    };
    constructor(config = {}) {
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
    async initialize() {
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
    setupTriangularEvents() {
        if (!this.triangularScanner)
            return;
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
    setupCrossExchangeEvents() {
        if (!this.crossExchangeScanner)
            return;
        this.crossExchangeScanner.on('opportunity', (opp) => {
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
    setupExecutionEvents() {
        if (!this.executionEngine)
            return;
        this.executionEngine.on('execution:started', (execution) => {
            this.executionStats.totalExecutions++;
            this.emit('execution:started', execution);
        });
        this.executionEngine.on('execution:completed', (execution) => {
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
    setupExecutionServiceEvents() {
        if (!this.executionService)
            return;
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
    async start() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (this.isRunning) {
            console.log('[Orchestrator] Already running');
            return;
        }
        console.log('[Orchestrator] Starting scanners...');
        this.isRunning = true;
        const startPromises = [];
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
    async stop() {
        if (!this.isRunning) {
            return;
        }
        console.log('[Orchestrator] Stopping scanners...');
        this.isRunning = false;
        const stopPromises = [];
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
    async setMode(mode) {
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
    async executeCrossExchange(opportunity, amount) {
        if (!this.executionEngine) {
            console.error('[Orchestrator] Execution engine not initialized');
            return null;
        }
        const tradeAmount = amount || this.config.maxTradeAmountUSDT;
        return this.executionEngine.executeCrossExchangeArbitrage(opportunity, tradeAmount);
    }
    async executeTriangular(opportunity, amount) {
        if (!this.executionEngine) {
            console.error('[Orchestrator] Execution engine not initialized');
            return null;
        }
        const tradeAmount = amount || this.config.maxTradeAmountUSDT;
        return this.executionEngine.executeTriangularArbitrage(opportunity, tradeAmount);
    }
    async executeCrossExchangeWithSteps(opportunity, amount) {
        if (!this.executionService) {
            console.error('[Orchestrator] Execution service not initialized');
            return null;
        }
        const tradeAmount = amount || this.config.maxTradeAmountUSDT;
        return this.executionService.executeCrossExchange(opportunity, tradeAmount);
    }
    async executeTriangularWithSteps(opportunity, amount) {
        if (!this.executionService) {
            console.error('[Orchestrator] Execution service not initialized');
            return null;
        }
        const tradeAmount = amount || this.config.maxTradeAmountUSDT;
        return this.executionService.executeTriangular(opportunity, tradeAmount);
    }
    getExecutionSession(sessionId) {
        return this.executionService?.getSession(sessionId);
    }
    getActiveExecutionSessions() {
        return this.executionService?.getActiveSessions() || [];
    }
    getTriangularOpportunities(limit = 20) {
        return this.triangularScanner?.getRecentOpportunities() || [];
    }
    getCrossExchangeOpportunities(limit = 20) {
        return this.crossExchangeScanner?.getRecentOpportunities(limit) || [];
    }
    getExecutionHistory(limit = 20) {
        return this.executionEngine?.getExecutionHistory(limit) || [];
    }
    getActiveExecutions() {
        return this.executionEngine?.getActiveExecutions() || [];
    }
    async getBalances() {
        const balances = new Map();
        for (const [name, adapter] of this.adapters) {
            try {
                const exchangeBalances = await adapter.getBalance();
                balances.set(name, exchangeBalances);
            }
            catch (error) {
                console.warn(`[Orchestrator] Failed to get balances from ${name}:`, error);
                balances.set(name, []);
            }
        }
        return balances;
    }
    getStats() {
        return {
            mode: this.config.mode,
            isRunning: this.isRunning,
            connectedExchanges: Array.from(this.adapters.keys()),
            triangularStats: this.triangularScanner?.getStats() || null,
            crossExchangeStats: this.crossExchangeScanner?.getStats() || null,
            executionStats: { ...this.executionStats },
        };
    }
    getConfig() {
        return { ...this.config };
    }
    setConfig(config) {
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
    setDryRun(dryRun) {
        this.config.dryRun = dryRun;
        if (this.executionEngine) {
            this.executionEngine.setDryRun(dryRun);
        }
        if (this.executionService) {
            this.executionService.setDryRun(dryRun);
        }
        console.log(`[Orchestrator] Dry run: ${dryRun ? 'ENABLED' : 'DISABLED - LIVE TRADING'}`);
    }
    setAutoExecute(autoExecute) {
        this.config.autoExecute = autoExecute;
        console.log(`[Orchestrator] Auto-execute: ${autoExecute ? 'ENABLED' : 'DISABLED'}`);
    }
    async close() {
        await this.stop();
        await closeAllAdapters();
        this.isInitialized = false;
        console.log('[Orchestrator] Closed');
    }
}
let orchestratorInstance = null;
export function getOrchestrator(config) {
    if (!orchestratorInstance) {
        orchestratorInstance = new ArbitrageOrchestrator(config);
    }
    return orchestratorInstance;
}
export async function initializeOrchestrator(config) {
    const orchestrator = getOrchestrator(config);
    await orchestrator.initialize();
    return orchestrator;
}
export function createOrchestrator(config) {
    return new ArbitrageOrchestrator(config);
}
