import { EventEmitter } from 'events';
import { Cycle } from './RouteGraph.js';
import { ArbResult } from './ArbitrageCalculator.js';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
export interface ScannerConfig {
    scanIntervalMs: number;
    minProfitThresholdPercent: number;
    topNAssets: number;
    feeRate: number;
    dedupWindowMs: number;
    dedupProfitChangeThreshold: number;
    baseAsset: string;
    enableRedis: boolean;
    enableDatabase: boolean;
}
export interface ScannerStats {
    status: 'running' | 'stopped' | 'initializing';
    cyclesScanned: number;
    opportunitiesFound: number;
    lastScanDurationMs: number;
    totalScans: number;
    startedAt: number;
}
export declare class ArbitrageScanner extends EventEmitter {
    private config;
    private adapter;
    private routeGraph;
    private priceCache;
    private calculator;
    private publisher;
    private prisma;
    private cycles;
    private scanInterval;
    private recentlyEmitted;
    private stats;
    constructor(adapter: IExchangeAdapter, config?: Partial<ScannerConfig>);
    start(): Promise<void>;
    private getUniqueSymbols;
    private waitForPriceData;
    private startScanLoop;
    private scan;
    private processOpportunity;
    private cleanupRecentlyEmitted;
    private publishStatus;
    private logStats;
    stop(): Promise<void>;
    getStats(): ScannerStats;
    getCycles(): Cycle[];
    getRecentOpportunities(): ArbResult[];
    setConfig(config: Partial<ScannerConfig>): void;
}
export declare function createArbitrageScanner(adapter: IExchangeAdapter, config?: Partial<ScannerConfig>): ArbitrageScanner;
//# sourceMappingURL=ArbitrageScanner.d.ts.map