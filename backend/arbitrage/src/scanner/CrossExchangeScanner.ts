import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { OrderBook, CrossExchangeOpportunity, Balance, FeeBreakdown } from '../types/index.js';
import { getExecutablePrice, isOrderBookFresh, getOrderBookAge, getPriceAgeStatus } from '../utils/orderBookUtils.js';
import { FeeService, createFeeService } from '../services/FeeService.js';

interface CrossExchangeScannerConfig {
  minProfitThresholdPercent: number;
  tradeSize: number;
  priceMaxAgeMs: number;
  minVolume24h: number;
  quoteAssets: string[];
  showAllMode: boolean;
  topN: number;
  scanIntervalMs?: number;
  tradingFeePercent?: number;
  assets?: string[];
  includeStablecoins: boolean;
}

interface OrderBookCache {
  orderBook: OrderBook;
  timestamp: number;
}

interface ScannerStats {
  status: 'running' | 'stopped';
  scansCompleted: number;
  opportunitiesFound: number;
  lastScanDurationMs: number;
  startedAt: number | null;
  connectedExchanges: string[];
  pairsScanned: number;
  wsConnected: boolean;
}

const DEFAULT_CONFIG: CrossExchangeScannerConfig = {
  minProfitThresholdPercent: 0.05, // Lowered to catch more opportunities
  tradeSize: 100,
  priceMaxAgeMs: 5000,
  minVolume24h: 100000,
  quoteAssets: ['USDT', 'USD', 'USDC', 'BUSD'], // Multiple quote assets
  showAllMode: true, // Show all by default for visibility
  topN: 50,
  includeStablecoins: true, // Enable stablecoin arbitrage
};

// Priority pairs for stablecoin arbitrage
const STABLECOIN_PAIRS = [
  'USDT/USD', 'USDC/USD', 'DAI/USD', 'BUSD/USD',
  'USDC/USDT', 'DAI/USDT', 'BUSD/USDT',
];

// High-volume crypto pairs to prioritize
const PRIORITY_ASSETS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT', 'MATIC',
  'LTC', 'UNI', 'ATOM', 'FIL', 'APT', 'ARB', 'OP', 'NEAR', 'INJ', 'TIA',
];

export class CrossExchangeScanner extends EventEmitter {
  private adapters: Map<string, IExchangeAdapter>;
  private config: CrossExchangeScannerConfig;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private stats: ScannerStats;
  private orderBookCache: Map<string, Map<string, OrderBookCache>> = new Map();
  private recentOpportunities: CrossExchangeOpportunity[] = [];
  private feeService: FeeService;
  private commonPairs: string[] = [];
  private wsStreams: Map<string, any> = new Map();

  constructor(
    adapters: Map<string, IExchangeAdapter>,
    config: Partial<CrossExchangeScannerConfig> = {}
  ) {
    super();
    this.adapters = adapters;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.feeService = createFeeService(adapters);

    this.stats = {
      status: 'stopped',
      scansCompleted: 0,
      opportunitiesFound: 0,
      lastScanDurationMs: 0,
      startedAt: null,
      connectedExchanges: Array.from(adapters.keys()),
      pairsScanned: 0,
      wsConnected: false,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[CrossExchange] Scanner already running');
      return;
    }

    console.log('[CrossExchange] Starting enhanced cross-exchange scanner...');
    console.log(`[CrossExchange] Exchanges: ${Array.from(this.adapters.keys()).join(', ')}`);
    console.log(`[CrossExchange] Trade size: ${this.config.tradeSize} USDT`);
    console.log(`[CrossExchange] Min profit: ${this.config.minProfitThresholdPercent}%`);

    this.isRunning = true;
    this.stats.status = 'running';
    this.stats.startedAt = Date.now();

    // Discover common pairs across exchanges
    await this.discoverCommonPairs();
    console.log(`[CrossExchange] Found ${this.commonPairs.length} common pairs to scan`);

    // Try WebSocket streaming first
    await this.startWebSocketStreams();

    // Initial scan
    await this.scan();

    // Fallback polling (runs less frequently since WS provides updates)
    this.scanInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.scan();
      }
    }, 5000); // 5s polling as fallback

    this.emit('started', this.stats);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[CrossExchange] Stopping scanner...');

    this.isRunning = false;
    this.stats.status = 'stopped';

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    // Close WebSocket streams
    for (const [key, stream] of this.wsStreams) {
      try {
        if (stream && typeof stream.close === 'function') {
          stream.close();
        }
      } catch (e) {
        // Ignore close errors
      }
    }
    this.wsStreams.clear();

    this.emit('stopped', this.stats);
  }

  private async discoverCommonPairs(): Promise<void> {
    const pairsByExchange: Map<string, Set<string>> = new Map();
    const allPairs: Set<string> = new Set();

    for (const [exchangeName, adapter] of this.adapters) {
      try {
        const exchange = (adapter as any).exchange;
        if (!exchange || !exchange.markets) continue;

        const pairs = new Set<string>();
        for (const [symbol, market] of Object.entries(exchange.markets)) {
          const mkt = market as any;
          if (!mkt.active) continue;

          // Include pairs with any of our quote assets
          if (this.config.quoteAssets.includes(mkt.quote)) {
            pairs.add(symbol);
            allPairs.add(symbol);
          }

          // Also include stablecoin pairs if enabled
          if (this.config.includeStablecoins && STABLECOIN_PAIRS.includes(symbol)) {
            pairs.add(symbol);
            allPairs.add(symbol);
          }
        }
        pairsByExchange.set(exchangeName, pairs);
        console.log(`[CrossExchange] ${exchangeName}: ${pairs.size} tradeable pairs`);
      } catch (error) {
        console.warn(`[CrossExchange] Failed to load markets from ${exchangeName}:`, error);
      }
    }

    // Find pairs available on at least 2 exchanges (not strict intersection)
    const exchangeNames = Array.from(pairsByExchange.keys());
    if (exchangeNames.length < 2) {
      this.commonPairs = [
        ...STABLECOIN_PAIRS,
        ...PRIORITY_ASSETS.map(a => `${a}/USDT`),
      ];
      return;
    }

    // Count how many exchanges have each pair
    const pairCounts: Map<string, number> = new Map();
    for (const pairs of pairsByExchange.values()) {
      for (const pair of pairs) {
        pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
      }
    }

    // Get pairs on 2+ exchanges, prioritize high-volume assets
    const commonPairs: string[] = [];

    // First add stablecoin pairs (high opportunity)
    for (const pair of STABLECOIN_PAIRS) {
      if (pairCounts.get(pair) && pairCounts.get(pair)! >= 2) {
        commonPairs.push(pair);
      }
    }

    // Then add priority crypto pairs
    for (const asset of PRIORITY_ASSETS) {
      for (const quote of this.config.quoteAssets) {
        const pair = `${asset}/${quote}`;
        if (pairCounts.get(pair) && pairCounts.get(pair)! >= 2 && !commonPairs.includes(pair)) {
          commonPairs.push(pair);
        }
      }
    }

    // Fill rest with other common pairs
    for (const [pair, count] of pairCounts) {
      if (count >= 2 && !commonPairs.includes(pair)) {
        commonPairs.push(pair);
      }
    }

    this.commonPairs = commonPairs.slice(0, 150); // Increased limit
    this.stats.pairsScanned = this.commonPairs.length;

    console.log(`[CrossExchange] Discovered ${this.commonPairs.length} common pairs across ${exchangeNames.length} exchanges`);
    console.log(`[CrossExchange] Stablecoin pairs: ${commonPairs.filter(p => STABLECOIN_PAIRS.includes(p)).join(', ') || 'none'}`);
  }

  // Helper to get quote asset from symbol
  private getQuoteAsset(symbol: string): string {
    const parts = symbol.split('/');
    return parts[1] || 'USDT';
  }

  // Helper to get base asset from symbol
  private getBaseAsset(symbol: string): string {
    const parts = symbol.split('/');
    return parts[0] || symbol;
  }

  private async discoverCommonPairsLegacy(): Promise<void> {
    const pairsByExchange: Map<string, Set<string>> = new Map();

    for (const [exchangeName, adapter] of this.adapters) {
      try {
        const exchange = (adapter as any).exchange;
        if (!exchange || !exchange.markets) continue;

        const pairs = new Set<string>();
        for (const [symbol, market] of Object.entries(exchange.markets)) {
          const mkt = market as any;
          if (this.config.quoteAssets.includes(mkt.quote) && mkt.active) {
            pairs.add(symbol);
          }
        }
        pairsByExchange.set(exchangeName, pairs);
      } catch (error) {
        console.warn(`[CrossExchange] Failed to load markets from ${exchangeName}:`, error);
      }
    }

    const exchangeNames = Array.from(pairsByExchange.keys());
    if (exchangeNames.length < 2) {
      this.commonPairs = ['BTC/USDT', 'ETH/USDT', 'XRP/USDT', 'SOL/USDT', 'ADA/USDT', 'DOGE/USDT', 'LTC/USDT', 'LINK/USDT'];
      return;
    }

    let common = pairsByExchange.get(exchangeNames[0])!;
    for (let i = 1; i < exchangeNames.length; i++) {
      const otherPairs = pairsByExchange.get(exchangeNames[i])!;
      common = new Set([...common].filter(x => otherPairs.has(x)));
    }

    this.commonPairs = Array.from(common).slice(0, 100); // Limit to top 100
    this.stats.pairsScanned = this.commonPairs.length;
  }

  private async startWebSocketStreams(): Promise<void> {
    for (const [exchangeName, adapter] of this.adapters) {
      try {
        const exchange = (adapter as any).exchange;
        if (!exchange) continue;

        // Check if CCXT Pro WebSocket is available
        if (typeof exchange.watchOrderBook === 'function') {
          this.stats.wsConnected = true;

          // Start watching order books for all common pairs
          for (const symbol of this.commonPairs.slice(0, 20)) { // Limit WS connections
            this.watchOrderBook(exchangeName, exchange, symbol);
          }
          console.log(`[CrossExchange] WebSocket streams started for ${exchangeName}`);
        }
      } catch (error) {
        console.warn(`[CrossExchange] WebSocket not available for ${exchangeName}:`, error);
      }
    }
  }

  private async watchOrderBook(exchangeName: string, exchange: any, symbol: string): Promise<void> {
    const key = `${exchangeName}:${symbol}`;

    try {
      const watchLoop = async () => {
        while (this.isRunning) {
          try {
            const orderBook = await exchange.watchOrderBook(symbol, 20);
            this.updateOrderBookCache(exchangeName, symbol, orderBook);
          } catch (error) {
            if (this.isRunning) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
      };

      // Run in background
      watchLoop().catch(() => {});
      this.wsStreams.set(key, { close: () => {} });
    } catch (error) {
      console.warn(`[CrossExchange] Failed to watch ${symbol} on ${exchangeName}`);
    }
  }

  private updateOrderBookCache(exchange: string, symbol: string, orderBook: any): void {
    // Use full symbol as key (not just base asset) to support different quote currencies
    if (!this.orderBookCache.has(symbol)) {
      this.orderBookCache.set(symbol, new Map());
    }

    const formatted: OrderBook = {
      symbol,
      exchange,
      bids: (orderBook.bids || []).slice(0, 20).map(([price, amount]: [number, number]) => ({ price, amount })),
      asks: (orderBook.asks || []).slice(0, 20).map(([price, amount]: [number, number]) => ({ price, amount })),
      timestamp: orderBook.timestamp || Date.now(),
    };

    this.orderBookCache.get(symbol)!.set(exchange, {
      orderBook: formatted,
      timestamp: Date.now(),
    });

    // Trigger opportunity check on new data
    this.checkOpportunityForSymbol(symbol);
  }

  private async scan(): Promise<void> {
    const startTime = Date.now();

    try {
      // Refresh order books via REST if WS not available
      if (!this.stats.wsConnected) {
        await this.refreshOrderBooks();
      }

      // Find all opportunities
      const opportunities = this.findOpportunities();

      // Update recent opportunities list
      this.recentOpportunities = opportunities;
      this.stats.scansCompleted++;
      this.stats.lastScanDurationMs = Date.now() - startTime;

      // Emit profitable opportunities
      for (const opp of opportunities.filter(o => o.profitable)) {
        this.stats.opportunitiesFound++;
        this.emit('opportunity', opp);
      }

      if (this.stats.scansCompleted % 10 === 0) {
        const profitable = opportunities.filter(o => o.profitable);
        console.log(
          `[CrossExchange] Scan #${this.stats.scansCompleted}: ` +
          `${profitable.length}/${opportunities.length} profitable opportunities`
        );
      }
    } catch (error) {
      console.error('[CrossExchange] Scan error:', error);
    }
  }

  private async refreshOrderBooks(): Promise<void> {
    const fetchPromises: Promise<void>[] = [];

    // Prioritize stablecoin pairs first, then crypto pairs
    const priorityPairs = [
      ...this.commonPairs.filter(p => STABLECOIN_PAIRS.includes(p)),
      ...this.commonPairs.filter(p => !STABLECOIN_PAIRS.includes(p)),
    ].slice(0, 60); // Increased limit for more coverage

    for (const [exchangeName, adapter] of this.adapters) {
      for (const symbol of priorityPairs) {
        fetchPromises.push(
          (async () => {
            try {
              const orderBook = await adapter.getOrderBook(symbol, 20);
              this.updateOrderBookCache(exchangeName, symbol, {
                bids: orderBook.bids.map(b => [b.price, b.amount]),
                asks: orderBook.asks.map(a => [a.price, a.amount]),
                timestamp: orderBook.timestamp,
              });
            } catch (error) {
              // Silently ignore individual failures
            }
          })()
        );
      }
    }

    await Promise.allSettled(fetchPromises);
  }

  private checkOpportunityForSymbol(symbol: string): void {
    // Called on WS update - quick check for this symbol
    const opportunities = this.findOpportunitiesForSymbol(symbol);
    for (const opp of opportunities.filter(o => o.profitable)) {
      this.emit('opportunity', opp);
    }
  }

  private findOpportunities(): CrossExchangeOpportunity[] {
    const opportunities: CrossExchangeOpportunity[] = [];

    for (const symbol of this.orderBookCache.keys()) {
      const symbolOpps = this.findOpportunitiesForSymbol(symbol);
      opportunities.push(...symbolOpps);
    }

    // Sort by net profit and return top N
    return opportunities
      .sort((a, b) => b.netProfitUSDT - a.netProfitUSDT)
      .slice(0, this.config.topN);
  }

  private findOpportunitiesForSymbol(symbol: string): CrossExchangeOpportunity[] {
    const opportunities: CrossExchangeOpportunity[] = [];
    const orderBooks = this.orderBookCache.get(symbol);

    if (!orderBooks || orderBooks.size < 2) return opportunities;

    const asset = this.getBaseAsset(symbol);
    const tradeSize = this.config.tradeSize;

    // Find best buy (lowest ask) and best sell (highest bid) across exchanges
    let bestBuy = { exchange: '', price: Infinity, book: null as OrderBook | null, age: 0 };
    let bestSell = { exchange: '', price: 0, book: null as OrderBook | null, age: 0 };

    for (const [exchangeName, cache] of orderBooks) {
      const { orderBook, timestamp } = cache;
      const age = Date.now() - timestamp;

      // Skip stale data
      if (age > this.config.priceMaxAgeMs && !this.config.showAllMode) continue;

      // Calculate executable prices for trade size
      const buyResult = getExecutablePrice(orderBook, 'buy', tradeSize);
      const sellResult = getExecutablePrice(orderBook, 'sell', tradeSize);

      if (buyResult.filled && buyResult.avgPrice > 0 && buyResult.avgPrice < bestBuy.price) {
        bestBuy = { exchange: exchangeName, price: buyResult.avgPrice, book: orderBook, age };
      }

      if (sellResult.filled && sellResult.avgPrice > 0 && sellResult.avgPrice > bestSell.price) {
        bestSell = { exchange: exchangeName, price: sellResult.avgPrice, book: orderBook, age };
      }
    }

    // Only create opportunity if buy and sell are on different exchanges
    if (bestBuy.exchange && bestSell.exchange && bestBuy.exchange !== bestSell.exchange && bestBuy.book && bestSell.book) {
      const buyPrice = bestBuy.price;
      const sellPrice = bestSell.price;

      // Calculate spread
      const spreadPercent = ((sellPrice - buyPrice) / buyPrice) * 100;

      // Debug: Log spreads for key pairs (stablecoins + major crypto)
      const isStablecoin = STABLECOIN_PAIRS.includes(symbol);
      const isMajorCrypto = ['BTC', 'ETH', 'SOL', 'XRP'].includes(asset);
      if ((isStablecoin || isMajorCrypto) && this.stats.scansCompleted % 20 === 0) {
        const profitStatus = spreadPercent > 0.05 ? '✓' : '✗';
        console.log(`[CrossExchange] ${profitStatus} ${symbol}: Buy $${buyPrice.toFixed(6)} on ${bestBuy.exchange}, Sell $${sellPrice.toFixed(6)} on ${bestSell.exchange} → Spread: ${spreadPercent.toFixed(4)}%`);
      }
      const grossProfitPercent = spreadPercent;

      // Get fee breakdown
      const withdrawalFee = 0; // Will be fetched async
      const tradingFeeRate = 0.001; // 0.1% default
      const tradingFeeBuy = tradeSize * tradingFeeRate;
      const tradingFeeSell = tradeSize * tradingFeeRate;
      const networkFee = 0;
      const totalFees = tradingFeeBuy + tradingFeeSell + withdrawalFee + networkFee;
      const totalFeesPercent = (totalFees / tradeSize) * 100;

      const netProfitPercent = grossProfitPercent - totalFeesPercent;
      const netProfitUSDT = (netProfitPercent / 100) * tradeSize;

      // Check if profitable based on threshold
      const profitable = netProfitPercent >= this.config.minProfitThresholdPercent;

      // Check liquidity
      const buyLiquidity = getExecutablePrice(bestBuy.book, 'buy', tradeSize);
      const sellLiquidity = getExecutablePrice(bestSell.book, 'sell', tradeSize);
      const liquidityOk = buyLiquidity.filled && sellLiquidity.filled;

      // Always add opportunity for tracking (UI filters by profitable)
      opportunities.push({
          id: `cross_${asset}_${bestBuy.exchange}_${bestSell.exchange}_${Date.now()}`,
          type: 'cross-exchange',
          asset,
          symbol,
          route: `BUY ${asset} on ${bestBuy.exchange} → SELL on ${bestSell.exchange}`,
          buyExchange: bestBuy.exchange,
          sellExchange: bestSell.exchange,
          buyPrice,
          sellPrice,
          spreadPercent,
          grossProfitPercent,
          fees: {
            tradingFeeBuy,
            tradingFeeSell,
            withdrawalFee,
            networkFee,
            totalFees,
            totalFeeUSDT: totalFees, // Alias for frontend
          },
          netProfit: netProfitUSDT,
          netProfitPercent,
          netProfitUSDT,
          tradeSize,
          profitable,
          liquidityOk,
          priceAge: {
            buy: bestBuy.age,
            sell: bestSell.age,
          },
          volume: Math.min(bestBuy.book.asks[0]?.amount || 0, bestSell.book.bids[0]?.amount || 0) * buyPrice,
          detectedAt: Date.now(),
          timestamp: Date.now(),
        });
    }

    return opportunities;
  }

  getRecentOpportunities(limit: number = 20): CrossExchangeOpportunity[] {
    return this.recentOpportunities.slice(0, limit);
  }

  getProfitableOpportunities(minProfitPercent: number = 0): CrossExchangeOpportunity[] {
    return this.recentOpportunities.filter((o) => o.netProfitPercent >= minProfitPercent);
  }

  getStats(): ScannerStats {
    return { ...this.stats };
  }

  setConfig(config: Partial<CrossExchangeScannerConfig>): void {
    Object.assign(this.config, config);
  }

  async getBalances(): Promise<Map<string, Balance[]>> {
    const balances = new Map<string, Balance[]>();

    for (const [exchangeName, adapter] of this.adapters) {
      try {
        const exchangeBalances = await adapter.getBalance();
        balances.set(exchangeName, exchangeBalances);
      } catch (error) {
        console.warn(`[CrossExchange] Failed to fetch balances from ${exchangeName}:`, error);
        balances.set(exchangeName, []);
      }
    }

    return balances;
  }
}

export function createCrossExchangeScanner(
  adapters: Map<string, IExchangeAdapter>,
  config?: Partial<CrossExchangeScannerConfig>
): CrossExchangeScanner {
  return new CrossExchangeScanner(adapters, config);
}
