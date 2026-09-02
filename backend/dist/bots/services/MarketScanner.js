/**
 * MarketScanner - Scans market for coins matching criteria
 * Used by DynamicGridBot to auto-discover tradeable coins
 */
export class MarketScanner {
    exchange;
    cache = new Map();
    cacheTTL = 60 * 1000; // 1 minute cache
    constructor(exchange) {
        this.exchange = exchange;
    }
    async scanForCoins(criteria) {
        const { priceMin, priceMax, topN, quoteAsset = 'USDT' } = criteria;
        // Get all coins from exchange
        const allCoins = await this.fetchTopCoins(topN * 2, quoteAsset);
        // Filter by price range
        const matchingCoins = allCoins
            .filter(coin => coin.price >= priceMin && coin.price <= priceMax)
            .sort((a, b) => {
            // Sort by how close they are to the low price (best buy opportunities first)
            const aDistance = Math.abs(a.price - priceMin);
            const bDistance = Math.abs(b.price - priceMin);
            return aDistance - bDistance;
        })
            .slice(0, topN);
        console.log(`[MarketScanner] Found ${matchingCoins.length} coins in range $${priceMin}-$${priceMax}`);
        matchingCoins.forEach(c => console.log(`  - ${c.symbol}: $${c.price.toFixed(4)}`));
        return {
            coins: matchingCoins,
            scannedAt: new Date(),
            criteria,
        };
    }
    async fetchTopCoins(limit, quoteAsset) {
        const cacheKey = `${this.exchange}_${quoteAsset}_${limit}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const { getAdapter } = await import('../../../arbitrage/dist/adapters/index.js');
            const adapter = await getAdapter(this.exchange);
            // Get all USDT pairs via exchange info or markets
            let markets = [];
            if (adapter.getMarkets) {
                markets = await adapter.getMarkets();
            }
            else if (adapter.fetchMarkets) {
                markets = await adapter.fetchMarkets();
            }
            else if (this.exchange?.toLowerCase() === 'pionex') {
                const axios = (await import('axios')).default;
                const { data } = await axios.get('https://api.pionex.com/api/v1/common/symbols', { params: { type: 'SPOT' } });
                markets = (data?.data?.symbols || [])
                    .filter((s) => s.enable && s.quoteCurrency === quoteAsset)
                    .map((s) => ({
                    symbol: `${s.baseCurrency}/${s.quoteCurrency}`,
                    base: s.baseCurrency,
                    quote: s.quoteCurrency,
                    active: true,
                }));
            }
            else {
                // Fallback: use Binance API directly
                const axios = (await import('axios')).default;
                const { data } = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
                markets = data.symbols
                    .filter((s) => s.status === 'TRADING' && s.quoteAsset === quoteAsset)
                    .map((s) => ({
                    symbol: `${s.baseAsset}/${s.quoteAsset}`,
                    base: s.baseAsset,
                    quote: s.quoteAsset,
                    active: true,
                }));
            }
            const usdtPairs = markets
                .filter((m) => (m.quote === quoteAsset || m.quoteAsset === quoteAsset) && m.active !== false)
                .slice(0, 100);
            // Get tickers for all pairs
            const coins = [];
            // Check if adapter supports batch getTickers
            if (adapter.getTickers) {
                try {
                    const pairSymbols = usdtPairs.map((m) => m.symbol || `${m.base}/${m.quote}`);
                    const tickers = await adapter.getTickers(pairSymbols);
                    const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));
                    for (const market of usdtPairs.slice(0, limit)) {
                        const symbol = market.symbol || `${market.base}/${market.quote}`;
                        const ticker = tickerMap.get(symbol);
                        const price = ticker?.last || ticker?.close || 0;
                        if (price > 0) {
                            coins.push({
                                symbol,
                                baseAsset: market.base || market.baseAsset,
                                quoteAsset: market.quote || market.quoteAsset,
                                price,
                                volume24h: ticker?.quoteVolume || (ticker?.volume || 0) * price || 0,
                                priceChange24h: ticker?.change || ticker?.percentage || ticker?.changePercent || 0,
                                high24h: ticker?.high || price,
                                low24h: ticker?.low || price,
                            });
                        }
                    }
                }
                catch (e) {
                    console.warn(`[MarketScanner] Batch getTickers failed, falling back to individual getTicker:`, e);
                }
            }
            if (coins.length === 0) {
                for (const market of usdtPairs.slice(0, limit)) {
                    try {
                        const symbol = market.symbol || `${market.base}/${market.quote}`;
                        let ticker = null;
                        if (adapter.getTicker) {
                            ticker = await adapter.getTicker(symbol);
                        }
                        else if (adapter.fetchTicker) {
                            ticker = await adapter.fetchTicker(symbol);
                        }
                        const price = ticker?.last || ticker?.close || 0;
                        if (price > 0) {
                            coins.push({
                                symbol,
                                baseAsset: market.base || market.baseAsset,
                                quoteAsset: market.quote || market.quoteAsset,
                                price,
                                volume24h: ticker?.quoteVolume || (ticker?.volume || 0) * price || 0,
                                priceChange24h: ticker?.change || ticker?.percentage || 0,
                                high24h: ticker?.high || price,
                                low24h: ticker?.low || price,
                            });
                        }
                    }
                    catch (e) {
                        // Skip coins that fail to fetch
                    }
                }
            }
            // Sort by volume and take top N
            coins.sort((a, b) => b.volume24h - a.volume24h);
            const topCoins = coins.slice(0, limit);
            this.cache.set(cacheKey, { data: topCoins, timestamp: Date.now() });
            return topCoins;
        }
        catch (error) {
            console.error(`[MarketScanner] Failed to fetch coins:`, error.message);
            return [];
        }
    }
    async getPrice(symbol) {
        try {
            const { getAdapter } = await import('../../../arbitrage/dist/adapters/index.js');
            const adapter = await getAdapter(this.exchange);
            const ticker = await adapter.getTicker?.(symbol);
            return ticker?.last || 0;
        }
        catch {
            return 0;
        }
    }
    clearCache() {
        this.cache.clear();
    }
}
export const createMarketScanner = (exchange) => {
    return new MarketScanner(exchange);
};
