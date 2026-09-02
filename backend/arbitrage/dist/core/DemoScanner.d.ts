/**
 * Demo Scanner - Simulates arbitrage opportunities for testing
 * Use this to test the UI and execution flow without real market conditions
 */
import { EventEmitter } from 'events';
interface DemoOpportunity {
    id: string;
    type: 'cross-exchange';
    asset: string;
    symbol: string;
    route: string;
    buyExchange: string;
    sellExchange: string;
    buyPrice: number;
    sellPrice: number;
    spreadPercent: number;
    grossProfitPercent: number;
    fees: {
        tradingFeeBuy: number;
        tradingFeeSell: number;
        withdrawalFee: number;
        networkFee: number;
        totalFees: number;
    };
    netProfit: number;
    netProfitPercent: number;
    netProfitUSDT: number;
    tradeSize: number;
    profitable: boolean;
    liquidityOk: boolean;
    priceAge: {
        buy: number;
        sell: number;
    };
    volume: number;
    confidence: 'high' | 'medium' | 'low';
    score: {
        total: number;
        profitScore: number;
        liquidityScore: number;
        freshnessScore: number;
        spreadStabilityScore?: number;
        volumeScore?: number;
    };
    executionRecommendation: string;
    detectedAt: number;
    timestamp: number;
}
export declare class DemoScanner extends EventEmitter {
    private config;
    private isRunning;
    private scanInterval;
    private opportunities;
    private scanCount;
    constructor(config?: {
        tradeSizeUSDT?: number;
        generateRate?: number;
    });
    start(): Promise<void>;
    stop(): Promise<void>;
    private generateOpportunities;
    getOpportunities(): DemoOpportunity[];
    getProfitableOpportunities(): DemoOpportunity[];
    getHighConfidenceOpportunities(): DemoOpportunity[];
    getStats(): {
        scansCompleted: number;
        opportunitiesFound: number;
        highConfidenceCount: number;
        isDemo: boolean;
    };
}
export declare function createDemoScanner(config?: {
    tradeSizeUSDT?: number;
    generateRate?: number;
}): DemoScanner;
export {};
//# sourceMappingURL=DemoScanner.d.ts.map