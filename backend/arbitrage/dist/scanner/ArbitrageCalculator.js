const DEFAULT_CONFIG = {
    feeRate: 0.001,
    minProfitThresholdPercent: 0.1,
    startAmount: 1,
};
export class ArbitrageCalculator {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    calculateTriangularProfit(cycle, priceCache, feeRate) {
        const effectiveFeeRate = feeRate ?? this.config.feeRate;
        const legs = [];
        let amount = this.config.startAmount;
        let grossAmount = this.config.startAmount;
        for (let i = 0; i < 3; i++) {
            const edge = cycle.legs[i];
            const prices = priceCache.getBidAsk(edge.symbol);
            if (!prices || prices.bid <= 0 || prices.ask <= 0) {
                return null;
            }
            const legResult = this.calculateLeg(edge, amount, prices, effectiveFeeRate);
            legs.push(legResult);
            amount = legResult.amountOut;
            const grossLeg = this.calculateLeg(edge, grossAmount, prices, 0);
            grossAmount = grossLeg.amountOut;
        }
        const grossProfitPercent = ((grossAmount - this.config.startAmount) / this.config.startAmount) * 100;
        const netProfitPercent = ((amount - this.config.startAmount) / this.config.startAmount) * 100;
        return {
            cycle,
            profitable: netProfitPercent > this.config.minProfitThresholdPercent,
            grossProfitPercent,
            netProfitPercent,
            legs,
            feeRate: effectiveFeeRate,
            startAmount: this.config.startAmount,
            finalAmount: amount,
            timestamp: Date.now(),
        };
    }
    calculateLeg(edge, amountIn, prices, feeRate) {
        let amountOut;
        let price;
        if (edge.direction === 'buy') {
            price = prices.ask;
            amountOut = amountIn / price;
        }
        else {
            price = prices.bid;
            amountOut = amountIn * price;
        }
        const fee = amountOut * feeRate;
        amountOut = amountOut - fee;
        return {
            symbol: edge.symbol,
            direction: edge.direction,
            from: edge.from,
            to: edge.to,
            price,
            amountIn,
            amountOut,
            fee,
        };
    }
    calculateBatchProfits(cycles, priceCache, feeRate) {
        const results = [];
        for (const cycle of cycles) {
            const result = this.calculateTriangularProfit(cycle, priceCache, feeRate);
            if (result) {
                results.push(result);
            }
        }
        return results.sort((a, b) => b.netProfitPercent - a.netProfitPercent);
    }
    getProfitableOpportunities(cycles, priceCache, feeRate) {
        return this.calculateBatchProfits(cycles, priceCache, feeRate).filter((r) => r.profitable);
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    static formatResult(result) {
        const route = result.cycle.assets.join(' → ') + ' → ' + result.cycle.assets[0];
        const profit = result.netProfitPercent.toFixed(4);
        const status = result.profitable ? '✓ PROFITABLE' : '✗ Unprofitable';
        return `${status} | ${route} | Net: ${profit}%`;
    }
}
export function createArbitrageCalculator(config) {
    return new ArbitrageCalculator(config);
}
