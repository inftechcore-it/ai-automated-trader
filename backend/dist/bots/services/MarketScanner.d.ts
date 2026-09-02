/**
 * MarketScanner - Scans market for coins matching criteria
 * Used by DynamicGridBot to auto-discover tradeable coins
 */
interface CoinInfo {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    price: number;
    volume24h: number;
    priceChange24h: number;
    high24h: number;
    low24h: number;
}
interface ScanCriteria {
    priceMin: number;
    priceMax: number;
    topN: number;
    quoteAsset?: string;
}
interface ScanResult {
    coins: CoinInfo[];
    scannedAt: Date;
    criteria: ScanCriteria;
}
export declare class MarketScanner {
    private exchange;
    private cache;
    private cacheTTL;
    constructor(exchange: string);
    scanForCoins(criteria: ScanCriteria): Promise<ScanResult>;
    fetchTopCoins(limit: number, quoteAsset: string): Promise<CoinInfo[]>;
    getPrice(symbol: string): Promise<number>;
    clearCache(): void;
}
export declare const createMarketScanner: (exchange: string) => MarketScanner;
export {};
