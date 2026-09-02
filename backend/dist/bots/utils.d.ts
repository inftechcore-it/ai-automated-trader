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
