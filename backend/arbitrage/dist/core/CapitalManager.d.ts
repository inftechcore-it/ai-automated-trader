/**
 * Capital Manager - Manages pre-positioned capital across exchanges
 * Key for simultaneous execution (no withdrawal delays)
 */
import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
export interface CapitalAllocation {
    exchange: string;
    asset: string;
    available: number;
    reserved: number;
    total: number;
    usdValue: number;
    lastUpdated: number;
}
export interface RebalanceRecommendation {
    fromExchange: string;
    toExchange: string;
    asset: string;
    amount: number;
    reason: string;
    priority: 'high' | 'medium' | 'low';
}
interface CapitalConfig {
    minBalancePerExchange: number;
    maxExposurePercent: number;
    rebalanceThresholdPercent: number;
    reservePercent: number;
    targetAssets: string[];
}
export declare class CapitalManager extends EventEmitter {
    private adapters;
    private config;
    private allocations;
    private reservedCapital;
    private lastPrices;
    private refreshInterval;
    constructor(adapters: Map<string, IExchangeAdapter>, config?: Partial<CapitalConfig>);
    initialize(): Promise<void>;
    refreshAllBalances(): Promise<void>;
    private refreshExchangeBalance;
    private getUsdValue;
    updatePrice(asset: string, price: number): void;
    /**
     * Check if we have enough capital on both exchanges for arbitrage
     */
    canExecuteArbitrage(buyExchange: string, sellExchange: string, asset: string, amountUSDT: number): {
        canExecute: boolean;
        reason: string;
        details: any;
    };
    /**
     * Reserve capital for an execution
     */
    reserveCapital(executionId: string, amount: number): void;
    /**
     * Release reserved capital
     */
    releaseCapital(executionId: string): void;
    private getReservedAmount;
    /**
     * Get rebalancing recommendations
     */
    getRebalanceRecommendations(): RebalanceRecommendation[];
    getAllocations(exchange?: string): CapitalAllocation[];
    getAllAllocations(): Map<string, CapitalAllocation[]>;
    getTotalCapitalUSD(): number;
    getCapitalSummary(): {
        totalUSD: number;
        byExchange: Record<string, number>;
        byAsset: Record<string, number>;
        reservedUSD: number;
    };
    stop(): void;
}
export declare function createCapitalManager(adapters: Map<string, IExchangeAdapter>, config?: Partial<CapitalConfig>): CapitalManager;
export {};
//# sourceMappingURL=CapitalManager.d.ts.map