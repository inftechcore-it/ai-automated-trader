/**
 * Bot utility functions
 */
/**
 * Safely convert any value to a number
 * Returns 0 for NaN, null, undefined, or non-numeric strings
 */
export declare const toNum: (v: unknown) => number;
/**
 * Safely parse a trading symbol into base and quote assets
 */
export declare const parseSymbol: (symbol: string | undefined) => {
    base: string;
    quote: string;
};
/**
 * Format price with appropriate decimal places
 */
export declare const formatPrice: (price: number, decimals?: number) => string;
/**
 * Calculate percentage change
 */
export declare const percentChange: (current: number, previous: number) => number;
/**
 * Universal Fee Rate Registry for all supported exchanges
 * Returns taker/maker fee rate (e.g. 0.0010 for 0.10%)
 */
export declare const getExchangeFeeRate: (exchange?: string, symbol?: string) => number;
/**
 * Dynamic Minimum Breakeven Price Calculation
 * P_breakeven = ((P_avgEntry * Q_sell) + Sum(F_buy) + MinNetBuffer) / (Q_sell * (1 - r_exchange))
 */
export declare const calculateFeeBreakevenPrice: (avgEntryPrice: number, quantity: number, accumulatedBuyFees?: number, feeRate?: number, minNetBuffer?: number) => number;
/**
 * Universal Fee-Aware Net Profit Check
 */
export declare const calculateNetProfit: (params: {
    sellPrice: number;
    avgEntryPrice: number;
    quantity: number;
    accumulatedBuyFees?: number;
    feeRate?: number;
    minBuffer?: number;
}) => {
    grossProfit: number;
    upcomingSellFee: number;
    totalCycleFees: number;
    netProfit: number;
    breakevenPrice: number;
    isProfitable: boolean;
};
