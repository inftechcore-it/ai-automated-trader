/**
 * Enhanced Scanner - High-performance arbitrage opportunity detection
 * Features: Real-time WebSocket, opportunity scoring, market depth analysis
 */
import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { CrossExchangeOpportunity } from '../types/index.js';
interface ScannerConfig {
    minProfitPercent: number;
    tradeSizeUSDT: number;
    maxPriceAgeMs: number;
    minLiquidityUSDT: number;
    scoreThreshold: number;
    enableWebSocket: boolean;
    topOpportunities: number;
}
interface OpportunityScore {
    total: number;
    profitScore: number;
    liquidityScore: number;
    freshnessScore: number;
    spreadStabilityScore: number;
    volumeScore: number;
}
interface EnhancedOpportunity extends CrossExchangeOpportunity {
    score: OpportunityScore;
    spreadHistory: number[];
    confidence: 'high' | 'medium' | 'low';
    executionRecommendation: string;
}
export declare class EnhancedScanner extends EventEmitter {
    private adapters;
    private config;
    private isRunning;
    private priceCache;
    private spreadHistory;
    private opportunities;
    private scanInterval;
    private wsConnections;
    private commonSymbols;
    private stats;
    private priceUpdateCount;
    constructor(adapters: Map<string, IExchangeAdapter>, config?: Partial<ScannerConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    private discoverCommonSymbols;
    private startWebSocketStreams;
    private watchTicker;
    private updatePriceCache;
    private runScan;
    private fetchRestPrices;
    private checkOpportunity;
    private findAllOpportunities;
    private findOpportunityForSymbol;
    private calculateScore;
    private sleep;
    getOpportunities(): EnhancedOpportunity[];
    getProfitableOpportunities(): EnhancedOpportunity[];
    getHighConfidenceOpportunities(): EnhancedOpportunity[];
    getStats(): typeof this.stats;
}
export declare function createEnhancedScanner(adapters: Map<string, IExchangeAdapter>, config?: Partial<ScannerConfig>): EnhancedScanner;
export {};
//# sourceMappingURL=EnhancedScanner.d.ts.map