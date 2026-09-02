import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { CrossExchangeOpportunity, Balance } from '../types/index.js';
interface CrossExchangeScannerConfig {
    minProfitThresholdPercent: number;
    tradeSize: number;
    priceMaxAgeMs: number;
    minVolume24h: number;
    quoteAssets: string[];
    showAllMode: boolean;
    topN: number;
    scanIntervalMs?: number;
    tradingFeePercent?: number;
    assets?: string[];
    includeStablecoins: boolean;
}
interface ScannerStats {
    status: 'running' | 'stopped';
    scansCompleted: number;
    opportunitiesFound: number;
    lastScanDurationMs: number;
    startedAt: number | null;
    connectedExchanges: string[];
    pairsScanned: number;
    wsConnected: boolean;
}
export declare class CrossExchangeScanner extends EventEmitter {
    private adapters;
    private config;
    private isRunning;
    private scanInterval;
    private stats;
    private orderBookCache;
    private recentOpportunities;
    private feeService;
    private commonPairs;
    private wsStreams;
    constructor(adapters: Map<string, IExchangeAdapter>, config?: Partial<CrossExchangeScannerConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    private discoverCommonPairs;
    private getQuoteAsset;
    private getBaseAsset;
    private discoverCommonPairsLegacy;
    private startWebSocketStreams;
    private watchOrderBook;
    private updateOrderBookCache;
    private scan;
    private refreshOrderBooks;
    private checkOpportunityForSymbol;
    private findOpportunities;
    private findOpportunitiesForSymbol;
    getRecentOpportunities(limit?: number): CrossExchangeOpportunity[];
    getProfitableOpportunities(minProfitPercent?: number): CrossExchangeOpportunity[];
    getStats(): ScannerStats;
    setConfig(config: Partial<CrossExchangeScannerConfig>): void;
    getBalances(): Promise<Map<string, Balance[]>>;
}
export declare function createCrossExchangeScanner(adapters: Map<string, IExchangeAdapter>, config?: Partial<CrossExchangeScannerConfig>): CrossExchangeScanner;
export {};
//# sourceMappingURL=CrossExchangeScanner.d.ts.map