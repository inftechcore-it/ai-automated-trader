import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
export interface FeeRates {
    maker: number;
    taker: number;
    timestamp: number;
}
export interface WithdrawalFeeInfo {
    asset: string;
    fee: number;
    network?: string;
    timestamp: number;
}
export interface FeeBreakdown {
    tradingFeeBuy: number;
    tradingFeeSell: number;
    withdrawalFee: number;
    networkFee: number;
    totalFees: number;
}
export declare class FeeService {
    private tradingFeeCache;
    private withdrawalFeeCache;
    private adapters;
    constructor(adapters: Map<string, IExchangeAdapter>);
    private getCacheKey;
    getTradingFee(exchange: string, symbol: string): Promise<FeeRates>;
    getWithdrawalFee(exchange: string, asset: string, network?: string): Promise<number>;
    getNetworkFee(asset: string): number;
    calculateFeeBreakdown(buyExchange: string, sellExchange: string, symbol: string, asset: string, tradeAmountUSDT: number): Promise<FeeBreakdown>;
    clearCache(): void;
}
export declare function createFeeService(adapters: Map<string, IExchangeAdapter>): FeeService;
//# sourceMappingURL=FeeService.d.ts.map