import type { OrderBook } from '../types/index.js';
export interface ExecutablePriceResult {
    avgPrice: number;
    worstPrice: number;
    slippagePercent: number;
    filled: boolean;
    filledQuantity: number;
    totalCost: number;
}
export declare function getExecutablePrice(orderBook: OrderBook, side: 'buy' | 'sell', quantityUSDT: number): ExecutablePriceResult;
export declare function getOrderBookAge(orderBook: OrderBook): number;
export declare function isOrderBookFresh(orderBook: OrderBook, maxAgeMs?: number): boolean;
export declare function getPriceAgeStatus(ageMs: number): 'live' | 'delayed' | 'stale';
//# sourceMappingURL=orderBookUtils.d.ts.map