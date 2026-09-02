import type { Cycle } from './RouteGraph.js';
import type { PriceCache } from './PriceCache.js';
export interface LegResult {
    symbol: string;
    direction: 'buy' | 'sell';
    from: string;
    to: string;
    price: number;
    amountIn: number;
    amountOut: number;
    fee: number;
}
export interface ArbResult {
    cycle: Cycle;
    profitable: boolean;
    grossProfitPercent: number;
    netProfitPercent: number;
    legs: LegResult[];
    feeRate: number;
    startAmount: number;
    finalAmount: number;
    timestamp: number;
}
export interface CalculatorConfig {
    feeRate: number;
    minProfitThresholdPercent: number;
    startAmount: number;
}
export declare class ArbitrageCalculator {
    private config;
    constructor(config?: Partial<CalculatorConfig>);
    calculateTriangularProfit(cycle: Cycle, priceCache: PriceCache, feeRate?: number): ArbResult | null;
    private calculateLeg;
    calculateBatchProfits(cycles: Cycle[], priceCache: PriceCache, feeRate?: number): ArbResult[];
    getProfitableOpportunities(cycles: Cycle[], priceCache: PriceCache, feeRate?: number): ArbResult[];
    setConfig(config: Partial<CalculatorConfig>): void;
    getConfig(): CalculatorConfig;
    static formatResult(result: ArbResult): string;
}
export declare function createArbitrageCalculator(config?: Partial<CalculatorConfig>): ArbitrageCalculator;
//# sourceMappingURL=ArbitrageCalculator.d.ts.map