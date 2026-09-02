/**
 * BotInstance - Single bot runtime with state machine
 * States: CREATED → RUNNING ↔ PAUSED → STOPPED
 */
import { EventEmitter } from 'events';
import type { IBotStrategy } from './IBotStrategy.js';
import type { BotConfig, BotState, PriceTick, BotStatus, TradeRecord, OrderSide, OrderType } from './types.js';
interface ExecutionEngine {
    placeOrder(params: {
        exchange: string;
        symbol: string;
        side: OrderSide;
        type: OrderType;
        quantity: number;
        price?: number;
        dryRun: boolean;
    }): Promise<{
        orderId: string;
        status: string;
        filledPrice?: number;
        filledQuantity?: number;
    }>;
    cancelOrder(params: {
        exchange: string;
        orderId: string;
        symbol: string;
    }): Promise<{
        success: boolean;
    }>;
}
interface BotInstanceDeps {
    strategy: IBotStrategy;
    config: BotConfig;
    executionEngine: ExecutionEngine;
    onStateChange: (botId: string, status: BotStatus, data?: any) => void;
    onTrade: (botId: string, trade: TradeRecord) => void;
    onError: (botId: string, error: string, severity: 'warning' | 'error' | 'critical') => void;
    onLog?: (botId: string, message: string, level: 'info' | 'warn' | 'error') => void;
}
export declare class BotInstance extends EventEmitter {
    private deps;
    private strategy;
    private config;
    private executionEngine;
    private status;
    private state;
    private lastTickTime;
    private tickCount;
    private snapshotInterval;
    constructor(deps: BotInstanceDeps);
    get id(): string;
    get currentStatus(): BotStatus;
    get currentConfig(): BotConfig;
    get currentState(): BotState;
    private log;
    start(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    stop(reason?: string): Promise<void>;
    processTick(tick: PriceTick): Promise<void>;
    syncOrdersWithExchange(): Promise<void>;
    private loadExistingOrders;
    private syncLiveBalance;
    private executeAction;
    private placeOrder;
    private cancelOrder;
    private processOrderFill;
    private updateHoldingsPrice;
    private updateEquity;
    private startSnapshotTimer;
    private stopSnapshotTimer;
    private takeSnapshot;
    private getAdapter;
    getStats(): any;
}
export {};
