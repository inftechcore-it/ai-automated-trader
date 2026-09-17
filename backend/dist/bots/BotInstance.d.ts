/**
 * BotInstance - Single bot runtime with state machine
 * States: CREATED → RUNNING ↔ PAUSED → STOPPED
 */
import { EventEmitter } from 'events';
import type { IBotStrategy } from './IBotStrategy.js';
import type { BotConfig, BotState, PriceTick, BotStatus, OpenOrder, TradeRecord, OrderSide, OrderType } from './types.js';
interface ExecutionEngine {
    placeOrder(params: {
        userId?: string;
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
        explorerUrl?: string;
        txid?: string;
        isLive?: boolean;
        isPaper?: boolean;
    }>;
    cancelOrder(params: {
        userId?: string;
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
    private lastPrice;
    private tickCount;
    private isPausedForBalance;
    private lastLiveBalanceCheck;
    private lastInsufficientBalanceLog;
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
    /**
     * Take All IN / Panic Sell: Immediately cancels all open orders and places a Market SELL order
     * to liquidate 100% of accumulated coin holdings to cash/quote currency in one click.
     */
    panicSell(reason?: string): Promise<{
        success: boolean;
        soldQuantity: number;
        receivedAmount: number;
        symbol: string;
    }>;
    processTick(tick: PriceTick): Promise<void>;
    syncOrdersWithExchange(): Promise<void>;
    private loadExistingOrders;
    private syncLiveBalance;
    private checkDexLimitOrders;
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
    private getUserLiveBalances;
    getStats(): any;
    getOpenOrders(): OpenOrder[];
}
export {};
