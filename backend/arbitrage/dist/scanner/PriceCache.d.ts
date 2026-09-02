import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
export interface PriceEntry {
    bid: number;
    ask: number;
    last: number;
    timestamp: number;
}
export interface PriceCacheEvents {
    update: (symbol: string, price: PriceEntry) => void;
    stale: (symbol: string, lastUpdate: number) => void;
    error: (symbol: string, error: Error) => void;
}
export declare class PriceCache extends EventEmitter {
    private cache;
    private adapter;
    private symbols;
    private refreshInterval;
    private isRefreshing;
    constructor();
    subscribeAll(adapter: IExchangeAdapter, symbols: string[]): Promise<void>;
    private startPolling;
    private updatePrice;
    getPrice(symbol: string): PriceEntry | null;
    getBidAsk(symbol: string): {
        bid: number;
        ask: number;
    } | null;
    getAllPrices(): Map<string, PriceEntry>;
    getSymbolCount(): number;
    isStale(symbol: string): boolean;
    getStaleSymbols(): string[];
    refreshPrice(symbol: string): Promise<PriceEntry | null>;
    refreshAllPrices(): Promise<void>;
    unsubscribeAll(): Promise<void>;
    clear(): void;
    close(): Promise<void>;
}
export declare function createPriceCache(): PriceCache;
//# sourceMappingURL=PriceCache.d.ts.map