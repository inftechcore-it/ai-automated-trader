/**
 * BotEngine - Master orchestrator for all trading bots
 * Manages bot lifecycle, enforces limits, handles persistence
 */
import { EventEmitter } from 'events';
import { BotInstance } from './BotInstance.js';
import type { BotConfig, BotStrategyType, BotMode, BotParams } from './types.js';
interface BotEngineConfig {
    maxBotsPerUser: number;
    maxTotalBots: number;
    snapshotIntervalMs: number;
}
interface CreateBotParams {
    userId: string;
    name: string;
    strategyType: BotStrategyType;
    exchangeName: string;
    symbol: string;
    mode: BotMode;
    params: BotParams;
    investedAmount: number;
}
export declare class BotEngine extends EventEmitter {
    private prisma;
    private config;
    private bots;
    private scheduler;
    private isInitialized;
    private executionEngine;
    private socketIo;
    constructor(config?: Partial<BotEngineConfig>);
    initialize(socketIo?: any): Promise<void>;
    shutdown(): Promise<void>;
    private loadActiveBots;
    createBot(params: CreateBotParams): Promise<BotConfig>;
    startBot(botId: string): Promise<void>;
    stopBot(botId: string, reason?: string): Promise<void>;
    pauseBot(botId: string): Promise<void>;
    resumeBot(botId: string): Promise<void>;
    deleteBot(botId: string): Promise<void>;
    updateBotParams(botId: string, params: BotParams): Promise<BotConfig>;
    getBot(botId: string): BotInstance | undefined;
    getBotStats(botId: string): any;
    getUserBots(userId: string): Promise<any[]>;
    getBotOrders(botId: string, limit?: number): Promise<any[]>;
    getBotSnapshots(botId: string, limit?: number): Promise<any[]>;
    getAllBots(): Map<string, BotInstance>;
    getStats(): {
        totalBots: number;
        runningBots: number;
        pausedBots: number;
        maxBots: number;
        scheduler: {
            subscriptionCount: number;
            cachedPrices: number;
            ticksProcessed: number;
            wsConnections: number;
            activeSubscriptions: number;
        };
    };
    private createStrategy;
    private handleStateChange;
    private handleTrade;
    private handleError;
    private emitSocket;
    emitLog(botId: string, message: string, level?: 'info' | 'warn' | 'error', metadata?: any): void;
    getBotLogs(botId: string, limit?: number): Promise<any[]>;
    private createExecutionEngine;
    private getMarketPrice;
    private dbToConfig;
}
export declare function getBotEngine(): BotEngine;
export declare function initializeBotEngine(socketIo?: any): Promise<BotEngine>;
export {};
