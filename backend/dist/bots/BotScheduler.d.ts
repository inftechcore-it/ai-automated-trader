/**
 * BotScheduler - Price tick routing to bot instances
 * Subscribes to WebSocket feeds and distributes ticks to relevant bots
 */
import { EventEmitter } from 'events';
import type { PriceTick } from './types.js';
export declare class BotScheduler extends EventEmitter {
    private subscriptions;
    private wsConnections;
    private adapters;
    private priceCache;
    private pollInterval;
    private isRunning;
    private stats;
    private makeKey;
    start(): Promise<void>;
    stop(): Promise<void>;
    subscribe(botId: string, exchange: string, symbol: string, callback: (tick: PriceTick) => void): Promise<void>;
    unsubscribe(botId: string, exchange: string, symbol: string): void;
    unsubscribeAll(botId: string): void;
    private startWebSocket;
    private closeWebSocket;
    private pollPrices;
    private distributeTick;
    private getAdapter;
    getLastPrice(exchange: string, symbol: string): PriceTick | undefined;
    getStats(): {
        subscriptionCount: number;
        cachedPrices: number;
        ticksProcessed: number;
        wsConnections: number;
        activeSubscriptions: number;
    };
    private sleep;
}
export declare function getBotScheduler(): BotScheduler;
