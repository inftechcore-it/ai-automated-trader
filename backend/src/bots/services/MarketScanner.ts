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

export class MarketScanner {
  private cache: Map<string, { data: CoinInfo[]; timestamp: number }> = new Map();
  private cacheTTL = 60 * 1000; // 1 minute cache

  constructor(private exchange: string) {}

  async scanForCoins(criteria: ScanCriteria): Promise<ScanResult> {
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

  async fetchTopCoins(limit: number, quoteAsset: string): Promise<CoinInfo[]> {
    const cacheKey = `${this.exchange}_${quoteAsset}_${limit}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const { getAdapter } = await import('../../../arbitrage/dist/adapters/index.js');
      const adapter = await getAdapter(this.exchange) as any;

      // Get all USDT pairs via exchange info or markets
      let markets: any[] = [];
      if (adapter.getMarkets) {
        markets = await adapter.getMarkets();
      } else if (adapter.fetchMarkets) {
        markets = await adapter.fetchMarkets();
      } else {
        // Fallback: use Binance API directly
        const axios = (await import('axios')).default;
        const { data } = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
        markets = data.symbols
          .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === quoteAsset)
          .map((s: any) => ({
            symbol: `${s.baseAsset}/${s.quoteAsset}`,
            base: s.baseAsset,
            quote: s.quoteAsset,
            active: true,
          }));
      }

      const usdtPairs = markets
        .filter((m: any) => (m.quote === quoteAsset || m.quoteAsset === quoteAsset) && m.active !== false)
        .slice(0, 100);

      // Get tickers for all pairs
      const coins: CoinInfo[] = [];

      for (const market of usdtPairs.slice(0, limit)) {
        try {
          const symbol = market.symbol || `${market.base}/${market.quote}`;
          let ticker: any = null;

          if (adapter.getTicker) {
            ticker = await adapter.getTicker(symbol);
          } else if (adapter.fetchTicker) {
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
        } catch (e) {
          // Skip coins that fail to fetch
        }
      }

      // Sort by volume and take top N
      coins.sort((a, b) => b.volume24h - a.volume24h);
      const topCoins = coins.slice(0, limit);

      this.cache.set(cacheKey, { data: topCoins, timestamp: Date.now() });
      return topCoins;
    } catch (error: any) {
      console.error(`[MarketScanner] Failed to fetch coins:`, error.message);
      return [];
    }
  }

  async getPrice(symbol: string): Promise<number> {
    try {
      const { getAdapter } = await import('../../../arbitrage/dist/adapters/index.js');
      const adapter = await getAdapter(this.exchange);
      const ticker = await adapter.getTicker?.(symbol);
      return ticker?.last || 0;
    } catch {
      return 0;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const createMarketScanner = (exchange: string): MarketScanner => {
  return new MarketScanner(exchange);
};
