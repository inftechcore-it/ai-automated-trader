/**
 * Power Arbitrage Engine - Production-ready arbitrage trading system
 * Combines: Enhanced Scanner, Capital Manager, Simultaneous Executor, Risk Manager
 */
import { EventEmitter } from 'events';
import { getAdapters, closeAllAdapters } from './adapters/index.js';
import { createEnhancedScanner } from './core/EnhancedScanner.js';
import { createDemoScanner } from './core/DemoScanner.js';
import { createCapitalManager } from './core/CapitalManager.js';
import { createSimultaneousExecutor } from './core/SimultaneousExecutor.js';
import { createRiskManager } from './core/RiskManager.js';
const DEFAULT_CONFIG = {
    exchanges: ['binance', 'bybit', 'kraken'],
    tradeSizeUSDT: 100,
    minProfitPercent: 0.1,
    maxDailyLossUSDT: 50,
    maxPositionSizeUSDT: 200,
    autoExecute: false,
    dryRun: true,
    requireHighConfidence: true,
    demoMode: false,
};
export class PowerArbitrageEngine extends EventEmitter {
    config;
    adapters = new Map();
    scanner = null;
    capitalManager = null;
    executor = null;
    riskManager = null;
    isInitialized = false;
    isRunning = false;
    startTime = 0;
    executionQueue = [];
    isProcessingQueue = false;
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    async initialize() {
        if (this.isInitialized)
            return;
        console.log('[PowerEngine] Initializing...');
        console.log(`[PowerEngine] Exchanges: ${this.config.exchanges.join(', ')}`);
        console.log(`[PowerEngine] Trade size: $${this.config.tradeSizeUSDT}`);
        console.log(`[PowerEngine] Dry run: ${this.config.dryRun}`);
        // 1. Initialize adapters
        this.adapters = await getAdapters(this.config.exchanges);
        console.log(`[PowerEngine] Connected to ${this.adapters.size} exchanges`);
        // 2. Initialize Capital Manager
        this.capitalManager = createCapitalManager(this.adapters, {
            maxExposurePercent: 15,
            targetAssets: ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE'],
        });
        await this.capitalManager.initialize();
        // 3. Initialize Risk Manager
        this.riskManager = createRiskManager({
            maxDailyLossUSDT: this.config.maxDailyLossUSDT,
            maxPositionSizeUSDT: this.config.maxPositionSizeUSDT,
            minProfitToExecute: this.config.minProfitPercent,
            requireHighConfidence: this.config.requireHighConfidence,
        });
        // Set total capital for risk calculations
        const capitalSummary = this.capitalManager.getCapitalSummary();
        this.riskManager.setTotalCapital(capitalSummary.totalUSD);
        // 4. Initialize Executor
        this.executor = createSimultaneousExecutor(this.adapters, this.capitalManager, {
            maxSlippagePercent: 0.3,
            dryRun: this.config.dryRun,
        });
        // 5. Initialize Scanner (Demo or Real)
        if (this.config.demoMode) {
            console.log('[PowerEngine] Using DEMO scanner - simulated opportunities');
            this.scanner = createDemoScanner({
                tradeSizeUSDT: this.config.tradeSizeUSDT,
                generateRate: 3000,
            });
        }
        else {
            this.scanner = createEnhancedScanner(this.adapters, {
                minProfitPercent: this.config.minProfitPercent,
                tradeSizeUSDT: this.config.tradeSizeUSDT,
                scoreThreshold: 60,
            });
        }
        // 6. Setup event handlers
        this.setupEventHandlers();
        this.isInitialized = true;
        console.log('[PowerEngine] Initialized successfully');
        this.emit('initialized');
    }
    setupEventHandlers() {
        // Scanner events
        this.scanner?.on('opportunity', (opp) => {
            this.emit('opportunity', opp);
            if (this.config.autoExecute && opp.profitable) {
                if (this.config.requireHighConfidence && opp.confidence !== 'high') {
                    console.log(`[PowerEngine] Skipping ${opp.asset}: Not high confidence`);
                    return;
                }
                this.queueExecution(opp);
            }
        });
        // Executor events
        this.executor?.on('execution:started', (exec) => {
            this.emit('execution:started', exec);
        });
        this.executor?.on('execution:completed', (exec) => {
            this.handleExecutionComplete(exec);
            this.emit('execution:completed', exec);
        });
        this.executor?.on('execution:failed', (exec) => {
            this.handleExecutionFailed(exec);
            this.emit('execution:failed', exec);
        });
        // Risk Manager events
        this.riskManager?.on('trading:locked', (data) => {
            console.warn('[PowerEngine] Trading locked:', data.reason);
            this.emit('trading:locked', data);
        });
        // Capital Manager events
        this.capitalManager?.on('balances:updated', () => {
            const summary = this.capitalManager.getCapitalSummary();
            this.riskManager?.setTotalCapital(summary.totalUSD);
        });
    }
    handleExecutionComplete(exec) {
        const pnl = exec.netProfit || 0;
        const asset = exec.legs[0]?.asset || 'UNKNOWN';
        const exchanges = [exec.legs[0]?.exchange, exec.legs[1]?.exchange].filter(Boolean);
        this.riskManager?.closePosition(exec.id, asset, exchanges, exec.initialAmount, pnl);
        if (pnl > 0) {
            console.log(`[PowerEngine] ✓ Profit: $${pnl.toFixed(4)} on ${asset}`);
        }
        else {
            console.log(`[PowerEngine] ✗ Loss: $${Math.abs(pnl).toFixed(4)} on ${asset}`);
        }
    }
    handleExecutionFailed(exec) {
        const asset = exec.legs[0]?.asset || 'UNKNOWN';
        const exchanges = [exec.legs[0]?.exchange, exec.legs[1]?.exchange].filter(Boolean);
        // Record as loss for risk management
        this.riskManager?.closePosition(exec.id, asset, exchanges, exec.initialAmount, -exec.initialAmount * 0.01);
        console.error(`[PowerEngine] Execution failed: ${exec.error}`);
    }
    async start() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (this.isRunning)
            return;
        console.log('[PowerEngine] Starting...');
        this.isRunning = true;
        this.startTime = Date.now();
        await this.scanner?.start();
        console.log('[PowerEngine] Running');
        this.emit('started');
    }
    async stop() {
        if (!this.isRunning)
            return;
        console.log('[PowerEngine] Stopping...');
        this.isRunning = false;
        await this.scanner?.stop();
        this.capitalManager?.stop();
        console.log('[PowerEngine] Stopped');
        this.emit('stopped');
    }
    queueExecution(opportunity) {
        // Don't queue duplicates
        if (this.executionQueue.some(o => o.asset === opportunity.asset)) {
            return;
        }
        this.executionQueue.push(opportunity);
        this.processQueue();
    }
    async processQueue() {
        if (this.isProcessingQueue || this.executionQueue.length === 0)
            return;
        this.isProcessingQueue = true;
        while (this.executionQueue.length > 0 && this.isRunning) {
            const opportunity = this.executionQueue.shift();
            // Risk check
            const riskCheck = this.riskManager?.checkOpportunity(opportunity, this.config.tradeSizeUSDT);
            if (!riskCheck?.allowed) {
                console.log(`[PowerEngine] Risk blocked ${opportunity.asset}: ${riskCheck?.reason}`);
                continue;
            }
            const amount = riskCheck.adjustedAmount || this.config.tradeSizeUSDT;
            // Track position
            this.riskManager?.openPosition(opportunity.id, opportunity.asset, [opportunity.buyExchange, opportunity.sellExchange], amount);
            // Execute
            try {
                await this.executor?.executeSimultaneous(opportunity, amount);
            }
            catch (err) {
                console.error('[PowerEngine] Execution error:', err);
            }
            // Small delay between executions
            await this.sleep(500);
        }
        this.isProcessingQueue = false;
    }
    /**
     * Manually execute an opportunity
     */
    async executeOpportunity(opportunity, amount) {
        if (!this.executor || !this.riskManager) {
            console.error('[PowerEngine] Engine not initialized');
            return null;
        }
        const tradeAmount = amount || this.config.tradeSizeUSDT;
        // Risk check
        const riskCheck = this.riskManager.checkOpportunity(opportunity, tradeAmount);
        if (!riskCheck.allowed) {
            console.warn(`[PowerEngine] Execution blocked: ${riskCheck.reason}`);
            this.emit('execution:blocked', { opportunity, reason: riskCheck.reason });
            return null;
        }
        const finalAmount = riskCheck.adjustedAmount || tradeAmount;
        // Track position
        this.riskManager.openPosition(opportunity.id, opportunity.asset, [opportunity.buyExchange, opportunity.sellExchange], finalAmount);
        // Execute
        const result = await this.executor.executeSimultaneous(opportunity, finalAmount);
        return result.execution;
    }
    getOpportunities() {
        return this.scanner?.getOpportunities() || [];
    }
    getProfitableOpportunities() {
        return this.scanner?.getProfitableOpportunities() || [];
    }
    getHighConfidenceOpportunities() {
        return this.scanner?.getHighConfidenceOpportunities?.() || [];
    }
    getExecutionHistory(limit) {
        return this.executor?.getExecutionHistory(limit) || [];
    }
    getCapitalSummary() {
        return this.capitalManager?.getCapitalSummary() || null;
    }
    getRebalanceRecommendations() {
        return this.capitalManager?.getRebalanceRecommendations() || [];
    }
    getRiskStats() {
        return this.riskManager?.getStats() || null;
    }
    getStats() {
        const uptime = this.isRunning ? Date.now() - this.startTime : 0;
        const opportunities = this.getOpportunities();
        return {
            isRunning: this.isRunning,
            uptime,
            scanner: this.scanner?.getStats() || {},
            capital: this.capitalManager?.getCapitalSummary() || {},
            execution: this.executor?.getStats() || {},
            risk: this.riskManager?.getStats() || {},
            opportunities: {
                total: opportunities.length,
                profitable: opportunities.filter(o => o.profitable).length,
                highConfidence: this.getHighConfidenceOpportunities().length,
            },
        };
    }
    setAutoExecute(enabled) {
        this.config.autoExecute = enabled;
        console.log(`[PowerEngine] Auto-execute: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        this.emit('config:changed', { autoExecute: enabled });
    }
    setDryRun(enabled) {
        this.config.dryRun = enabled;
        this.executor?.setDryRun(enabled);
        console.log(`[PowerEngine] Dry run: ${enabled ? 'ENABLED' : 'DISABLED - LIVE TRADING'}`);
        this.emit('config:changed', { dryRun: enabled });
    }
    isDemoMode() {
        return this.config.demoMode;
    }
    unlockTrading() {
        this.riskManager?.unlockTrading();
    }
    resetDailyStats() {
        this.riskManager?.resetDaily();
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async close() {
        await this.stop();
        await closeAllAdapters();
        this.isInitialized = false;
        console.log('[PowerEngine] Closed');
    }
}
// Singleton instance
let engineInstance = null;
export function getPowerEngine(config) {
    if (!engineInstance) {
        engineInstance = new PowerArbitrageEngine(config);
    }
    return engineInstance;
}
export function createPowerEngine(config) {
    return new PowerArbitrageEngine(config);
}
