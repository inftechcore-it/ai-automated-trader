export class RouteGraph {
    graph = null;
    topNAssets;
    constructor(topNAssets = 30) {
        this.topNAssets = topNAssets;
    }
    async buildGraph(adapter) {
        const pairs = await this.fetchTradingPairs(adapter);
        const topAssets = this.getTopAssets(pairs);
        const assets = new Set();
        const edges = new Map();
        for (const pair of pairs) {
            if (!topAssets.has(pair.base) || !topAssets.has(pair.quote)) {
                continue;
            }
            assets.add(pair.base);
            assets.add(pair.quote);
            const buyEdge = {
                symbol: pair.symbol,
                from: pair.quote,
                to: pair.base,
                direction: 'buy',
            };
            const sellEdge = {
                symbol: pair.symbol,
                from: pair.base,
                to: pair.quote,
                direction: 'sell',
            };
            if (!edges.has(pair.quote))
                edges.set(pair.quote, []);
            if (!edges.has(pair.base))
                edges.set(pair.base, []);
            edges.get(pair.quote).push(buyEdge);
            edges.get(pair.base).push(sellEdge);
        }
        this.graph = { assets, edges, pairs };
        return this.graph;
    }
    async fetchTradingPairs(adapter) {
        const pairs = [];
        try {
            const tickers = await this.fetchAllTickers(adapter);
            for (const [symbol, ticker] of Object.entries(tickers)) {
                const parsed = this.parseSymbol(symbol);
                if (parsed) {
                    pairs.push({
                        symbol,
                        base: parsed.base,
                        quote: parsed.quote,
                        volume24h: ticker.quoteVolume || ticker.volume || 0,
                    });
                }
            }
        }
        catch (error) {
            console.error('[RouteGraph] Failed to fetch trading pairs:', error);
        }
        return pairs;
    }
    async fetchAllTickers(adapter) {
        const commonPairs = [
            'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
            'ADA/USDT', 'DOGE/USDT', 'DOT/USDT', 'MATIC/USDT', 'LTC/USDT',
            'ETH/BTC', 'BNB/BTC', 'SOL/BTC', 'XRP/BTC', 'ADA/BTC',
            'DOGE/BTC', 'DOT/BTC', 'MATIC/BTC', 'LTC/BTC', 'AVAX/BTC',
            'BNB/ETH', 'SOL/ETH', 'MATIC/ETH', 'LINK/ETH', 'UNI/ETH',
            'AVAX/USDT', 'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'ETC/USDT',
            'XLM/USDT', 'ALGO/USDT', 'VET/USDT', 'FIL/USDT', 'THETA/USDT',
            'LINK/BTC', 'UNI/BTC', 'ATOM/BTC', 'ETC/BTC', 'XLM/BTC',
        ];
        const tickers = {};
        const results = await Promise.allSettled(commonPairs.map(async (symbol) => {
            try {
                const ticker = await adapter.getTicker(symbol);
                return { symbol, ticker };
            }
            catch {
                return null;
            }
        }));
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                tickers[result.value.symbol] = result.value.ticker;
            }
        }
        return tickers;
    }
    parseSymbol(symbol) {
        if (symbol.includes('/')) {
            const [base, quote] = symbol.split('/');
            return { base, quote };
        }
        const quoteAssets = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB'];
        for (const quote of quoteAssets) {
            if (symbol.endsWith(quote)) {
                const base = symbol.slice(0, -quote.length);
                if (base.length > 0) {
                    return { base, quote };
                }
            }
        }
        return null;
    }
    getTopAssets(pairs) {
        const volumeByAsset = new Map();
        for (const pair of pairs) {
            const vol = pair.volume24h || 0;
            volumeByAsset.set(pair.base, (volumeByAsset.get(pair.base) || 0) + vol);
            volumeByAsset.set(pair.quote, (volumeByAsset.get(pair.quote) || 0) + vol);
        }
        const stableAssets = ['USDT', 'USDC', 'BUSD', 'DAI'];
        for (const stable of stableAssets) {
            volumeByAsset.set(stable, volumeByAsset.get(stable) || 0 + 1e18);
        }
        const sorted = [...volumeByAsset.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, this.topNAssets)
            .map(([asset]) => asset);
        return new Set(sorted);
    }
    findTriangularCycles(baseAsset = 'USDT') {
        if (!this.graph) {
            throw new Error('Graph not built. Call buildGraph() first.');
        }
        const cycles = [];
        const visited = new Set();
        const edgesFromBase = this.graph.edges.get(baseAsset) || [];
        for (const edge1 of edgesFromBase) {
            const asset1 = edge1.to;
            if (asset1 === baseAsset)
                continue;
            const edgesFrom1 = this.graph.edges.get(asset1) || [];
            for (const edge2 of edgesFrom1) {
                const asset2 = edge2.to;
                if (asset2 === baseAsset || asset2 === asset1)
                    continue;
                const edgesFrom2 = this.graph.edges.get(asset2) || [];
                for (const edge3 of edgesFrom2) {
                    if (edge3.to === baseAsset) {
                        const cycleKey = [baseAsset, asset1, asset2].sort().join('-');
                        if (!visited.has(cycleKey)) {
                            visited.add(cycleKey);
                            cycles.push({
                                assets: [baseAsset, asset1, asset2],
                                legs: [edge1, edge2, edge3],
                                symbols: [edge1.symbol, edge2.symbol, edge3.symbol],
                            });
                        }
                    }
                }
            }
        }
        return cycles;
    }
    getGraph() {
        return this.graph;
    }
    getUniqueSymbols() {
        if (!this.graph)
            return [];
        return this.graph.pairs.map((p) => p.symbol);
    }
    getCycleCount(baseAsset = 'USDT') {
        return this.findTriangularCycles(baseAsset).length;
    }
}
export function createRouteGraph(topNAssets) {
    return new RouteGraph(topNAssets);
}
