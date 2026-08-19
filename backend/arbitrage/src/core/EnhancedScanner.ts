/**
 * Enhanced Scanner - High-performance arbitrage opportunity detection
 * Features: Real-time WebSocket, opportunity scoring, market depth analysis
 */
import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { OrderBook, CrossExchangeOpportunity, Ticker } from '../types/index.js';

interface ScannerConfig {
  minProfitPercent: number;
  tradeSizeUSDT: number;
  maxPriceAgeMs: number;
  minLiquidityUSDT: number;
  scoreThreshold: number;
  enableWebSocket: boolean;
  topOpportunities: number;
}

interface OpportunityScore {
  total: number;
  profitScore: number;
  liquidityScore: number;
  freshnessScore: number;
  spreadStabilityScore: number;
  volumeScore: number;
}

interface EnhancedOpportunity extends CrossExchangeOpportunity {
  score: OpportunityScore;
  spreadHistory: number[];
  confidence: 'high' | 'medium' | 'low';
  executionRecommendation: string;
}

interface PriceData {
  bid: number;
  ask: number;
  bidVolume: number;
  askVolume: number;
  timestamp: number;
  exchange: string;
}

const DEFAULT_CONFIG: ScannerConfig = {
  minProfitPercent: 0.1,
  tradeSizeUSDT: 100,
  maxPriceAgeMs: 3000,
  minLiquidityUSDT: 500,
  scoreThreshold: 60,
  enableWebSocket: true,
  topOpportunities: 30,
};

// Priority symbols for arbitrage
const PRIORITY_SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT',
  'ADA/USDT', 'AVAX/USDT', 'LINK/USDT', 'DOT/USDT', 'MATIC/USDT',
  'LTC/USDT', 'UNI/USDT', 'ATOM/USDT', 'APT/USDT', 'ARB/USDT',
  'OP/USDT', 'INJ/USDT', 'TIA/USDT', 'NEAR/USDT', 'FIL/USDT',
  // Stablecoin pairs (high opportunity)
  'USDT/USD', 'USDC/USD', 'USDC/USDT',
];

export class EnhancedScanner extends EventEmitter {
  private adapters: Map<string, IExchangeAdapter>;
  private config: ScannerConfig;
  private isRunning = false;
  private priceCache: Map<string, Map<string, PriceData>> = new Map();
  private spreadHistory: Map<string, number[]> = new Map();
  private opportunities: EnhancedOpportunity[] = [];
  private scanInterval: NodeJS.Timeout | null = null;
  private wsConnections: Map<string, any> = new Map();
  private commonSymbols: string[] = [];
  private stats = {
    scansCompleted: 0,
    opportunitiesFound: 0,
    highConfidenceCount: 0,
    lastScanMs: 0,
    wsConnected: false,
    priceUpdatesPerSec: 0,
  };
  private priceUpdateCount = 0;

  constructor(
    adapters: Map<string, IExchangeAdapter>,
    config: Partial<ScannerConfig> = {}
  ) {
    super();
    this.adapters = adapters;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('[EnhancedScanner] Starting...');
    console.log(`[EnhancedScanner] Exchanges: ${Array.from(this.adapters.keys()).join(', ')}`);

    this.isRunning = true;

    // Discover common symbols
    await this.discoverCommonSymbols();

    // Start WebSocket streams
    if (this.config.enableWebSocket) {
      await this.startWebSocketStreams();
    }

    // Start polling fallback
    await this.runScan();
    this.scanInterval = setInterval(() => this.runScan(), 2000);

    // Track price update rate
    setInterval(() => {
      this.stats.priceUpdatesPerSec = this.priceUpdateCount;
      this.priceUpdateCount = 0;
    }, 1000);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[EnhancedScanner] Stopping...');
    this.isRunning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    // Close WebSocket connections
    for (const ws of this.wsConnections.values()) {
      try { ws.close?.(); } catch {}
    }
    this.wsConnections.clear();

    this.emit('stopped');
  }

  private async discoverCommonSymbols(): Promise<void> {
    const symbolsByExchange: Map<string, Set<string>> = new Map();

    for (const [name, adapter] of this.adapters) {
      try {
        const exchange = (adapter as any).exchange;
        if (!exchange?.markets) continue;

        const symbols = new Set<string>();
        for (const [symbol, market] of Object.entries(exchange.markets)) {
          const m = market as any;
          if (m.active && m.spot) {
            symbols.add(symbol);
          }
        }
        symbolsByExchange.set(name, symbols);
      } catch (err) {
        console.warn(`[EnhancedScanner] Failed to load markets from ${name}`);
      }
    }

    // Find symbols available on 2+ exchanges
    const symbolCount = new Map<string, number>();
    for (const symbols of symbolsByExchange.values()) {
      for (const s of symbols) {
        symbolCount.set(s, (symbolCount.get(s) || 0) + 1);
      }
    }

    // Prioritize PRIORITY_SYMBOLS first
    this.commonSymbols = [];
    for (const s of PRIORITY_SYMBOLS) {
      if (symbolCount.get(s) && symbolCount.get(s)! >= 2) {
        this.commonSymbols.push(s);
      }
    }

    // Add other common symbols
    for (const [symbol, count] of symbolCount) {
      if (count >= 2 && !this.commonSymbols.includes(symbol)) {
        this.commonSymbols.push(symbol);
      }
    }

    this.commonSymbols = this.commonSymbols.slice(0, 50);
    console.log(`[EnhancedScanner] Found ${this.commonSymbols.length} common symbols`);
  }

  private async startWebSocketStreams(): Promise<void> {
    for (const [name, adapter] of this.adapters) {
      try {
        const exchange = (adapter as any).exchange;
        if (!exchange || typeof exchange.watchTicker !== 'function') continue;

        this.stats.wsConnected = true;

        // Watch tickers for priority symbols
        for (const symbol of this.commonSymbols.slice(0, 20)) {
          this.watchTicker(name, exchange, symbol);
        }

        console.log(`[EnhancedScanner] WebSocket streams started for ${name}`);
      } catch (err) {
        console.warn(`[EnhancedScanner] WebSocket not available for ${name}`);
      }
    }
  }

  private async watchTicker(exchangeName: string, exchange: any, symbol: string): Promise<void> {
    const watchLoop = async () => {
      while (this.isRunning) {
        try {
          const ticker = await exchange.watchTicker(symbol);
          this.updatePriceCache(exchangeName, symbol, {
            bid: ticker.bid || 0,
            ask: ticker.ask || 0,
            bidVolume: ticker.bidVolume || 0,
            askVolume: ticker.askVolume || 0,
            timestamp: ticker.timestamp || Date.now(),
            exchange: exchangeName,
          });
          this.priceUpdateCount++;
        } catch (err) {
          if (this.isRunning) await this.sleep(1000);
        }
      }
    };
    watchLoop().catch(() => {});
  }

  private updatePriceCache(exchange: string, symbol: string, data: PriceData): void {
    if (!this.priceCache.has(symbol)) {
      this.priceCache.set(symbol, new Map());
    }
    this.priceCache.get(symbol)!.set(exchange, data);

    // Check opportunity immediately on price update
    if (this.priceCache.get(symbol)!.size >= 2) {
      this.checkOpportunity(symbol);
    }
  }

  private async runScan(): Promise<void> {
    const startTime = Date.now();

    try {
      // Fetch prices via REST for symbols not covered by WS
      await this.fetchRestPrices();

      // Find all opportunities
      const opportunities = this.findAllOpportunities();

      // Sort by score and keep top N
      this.opportunities = opportunities
        .sort((a, b) => b.score.total - a.score.total)
        .slice(0, this.config.topOpportunities);

      this.stats.scansCompleted++;
      this.stats.lastScanMs = Date.now() - startTime;

      // Emit high-confidence opportunities
      for (const opp of this.opportunities.filter(o => o.profitable && o.confidence === 'high')) {
        this.stats.opportunitiesFound++;
        this.stats.highConfidenceCount++;
        this.emit('opportunity', opp);
      }

      // Log summary every 10 scans
      if (this.stats.scansCompleted % 10 === 0) {
        const profitable = this.opportunities.filter(o => o.profitable).length;
        console.log(
          `[EnhancedScanner] Scan #${this.stats.scansCompleted}: ` +
          `${profitable} profitable, ${this.stats.highConfidenceCount} high-confidence | ` +
          `${this.stats.priceUpdatesPerSec} updates/s`
        );
      }

    } catch (err) {
      console.error('[EnhancedScanner] Scan error:', err);
    }
  }

  private async fetchRestPrices(): Promise<void> {
    const fetchPromises: Promise<void>[] = [];

    for (const [name, adapter] of this.adapters) {
      for (const symbol of this.commonSymbols) {
        // Skip if we have fresh WS data
        const cached = this.priceCache.get(symbol)?.get(name);
        if (cached && Date.now() - cached.timestamp < 2000) continue;

        fetchPromises.push(
          (async () => {
            try {
              const ticker = await adapter.getTicker(symbol);
              this.updatePriceCache(name, symbol, {
                bid: ticker.bid,
                ask: ticker.ask,
                bidVolume: ticker.bidVolume || 0,
                askVolume: ticker.askVolume || 0,
                timestamp: ticker.timestamp,
                exchange: name,
              });
            } catch {}
          })()
        );
      }
    }

    await Promise.allSettled(fetchPromises);
  }

  private checkOpportunity(symbol: string): void {
    const opportunities = this.findOpportunityForSymbol(symbol);
    for (const opp of opportunities) {
      if (opp.profitable && opp.score.total >= this.config.scoreThreshold) {
        this.emit('opportunity', opp);
      }
    }
  }

  private findAllOpportunities(): EnhancedOpportunity[] {
    const opportunities: EnhancedOpportunity[] = [];

    for (const symbol of this.priceCache.keys()) {
      const symbolOpps = this.findOpportunityForSymbol(symbol);
      opportunities.push(...symbolOpps);
    }

    return opportunities;
  }

  private findOpportunityForSymbol(symbol: string): EnhancedOpportunity[] {
    const opportunities: EnhancedOpportunity[] = [];
    const prices = this.priceCache.get(symbol);

    if (!prices || prices.size < 2) return opportunities;

    const priceList = Array.from(prices.entries());
    const now = Date.now();

    // Find best buy (lowest ask) and best sell (highest bid)
    let bestBuy = { exchange: '', ask: Infinity, data: null as PriceData | null };
    let bestSell = { exchange: '', bid: 0, data: null as PriceData | null };

    for (const [exchange, data] of priceList) {
      const age = now - data.timestamp;
      if (age > this.config.maxPriceAgeMs) continue;

      if (data.ask > 0 && data.ask < bestBuy.ask) {
        bestBuy = { exchange, ask: data.ask, data };
      }
      if (data.bid > 0 && data.bid > bestSell.bid) {
        bestSell = { exchange, bid: data.bid, data };
      }
    }

    // Must be different exchanges
    if (!bestBuy.data || !bestSell.data || bestBuy.exchange === bestSell.exchange) {
      return opportunities;
    }

    // Calculate opportunity
    const buyPrice = bestBuy.ask;
    const sellPrice = bestSell.bid;
    const spreadPercent = ((sellPrice - buyPrice) / buyPrice) * 100;

    // Update spread history
    const historyKey = `${symbol}_${bestBuy.exchange}_${bestSell.exchange}`;
    if (!this.spreadHistory.has(historyKey)) {
      this.spreadHistory.set(historyKey, []);
    }
    const history = this.spreadHistory.get(historyKey)!;
    history.push(spreadPercent);
    if (history.length > 30) history.shift();

    // Calculate fees (0.1% per trade)
    const feePercent = 0.2;
    const netProfitPercent = spreadPercent - feePercent;
    const netProfitUSDT = (netProfitPercent / 100) * this.config.tradeSizeUSDT;

    const profitable = netProfitPercent >= this.config.minProfitPercent;

    // Calculate liquidity
    const buyLiquidityUSDT = (bestBuy.data.askVolume || 0) * buyPrice;
    const sellLiquidityUSDT = (bestSell.data.bidVolume || 0) * sellPrice;
    const liquidityOk = Math.min(buyLiquidityUSDT, sellLiquidityUSDT) >= this.config.minLiquidityUSDT;

    // Calculate scores
    const score = this.calculateScore(
      netProfitPercent,
      Math.min(buyLiquidityUSDT, sellLiquidityUSDT),
      Math.max(now - bestBuy.data.timestamp, now - bestSell.data.timestamp),
      history
    );

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (score.total >= 80 && profitable && liquidityOk) {
      confidence = 'high';
    } else if (score.total >= 60 && profitable) {
      confidence = 'medium';
    }

    // Generate recommendation
    let recommendation = '';
    if (confidence === 'high') {
      recommendation = `Execute immediately: Strong ${netProfitPercent.toFixed(3)}% opportunity`;
    } else if (confidence === 'medium') {
      recommendation = `Consider execution: ${netProfitPercent.toFixed(3)}% potential`;
    } else if (profitable) {
      recommendation = `Monitor: Marginal ${netProfitPercent.toFixed(3)}% spread`;
    } else {
      recommendation = `No action: Negative or insufficient spread`;
    }

    const asset = symbol.split('/')[0];

    const opportunity: EnhancedOpportunity = {
      id: `opp_${asset}_${bestBuy.exchange}_${bestSell.exchange}_${Date.now()}`,
      type: 'cross-exchange',
      asset,
      symbol,
      route: `BUY on ${bestBuy.exchange} → SELL on ${bestSell.exchange}`,
      buyExchange: bestBuy.exchange,
      sellExchange: bestSell.exchange,
      buyPrice,
      sellPrice,
      spreadPercent,
      grossProfitPercent: spreadPercent,
      fees: {
        tradingFeeBuy: this.config.tradeSizeUSDT * 0.001,
        tradingFeeSell: this.config.tradeSizeUSDT * 0.001,
        withdrawalFee: 0,
        networkFee: 0,
        totalFees: this.config.tradeSizeUSDT * 0.002,
      },
      netProfit: netProfitUSDT,
      netProfitPercent,
      netProfitUSDT,
      tradeSize: this.config.tradeSizeUSDT,
      profitable,
      liquidityOk,
      priceAge: {
        buy: now - bestBuy.data.timestamp,
        sell: now - bestSell.data.timestamp,
      },
      volume: Math.min(buyLiquidityUSDT, sellLiquidityUSDT),
      detectedAt: now,
      timestamp: now,
      score,
      spreadHistory: history.slice(-10),
      confidence,
      executionRecommendation: recommendation,
    };

    opportunities.push(opportunity);
    return opportunities;
  }

  private calculateScore(
    profitPercent: number,
    liquidityUSDT: number,
    maxAgeMs: number,
    spreadHistory: number[]
  ): OpportunityScore {
    // Profit score (0-30 points)
    let profitScore = Math.min(profitPercent * 50, 30);
    if (profitPercent < 0) profitScore = 0;

    // Liquidity score (0-25 points)
    let liquidityScore = Math.min(liquidityUSDT / 100, 25);

    // Freshness score (0-20 points)
    let freshnessScore = 20;
    if (maxAgeMs > 1000) freshnessScore = 15;
    if (maxAgeMs > 2000) freshnessScore = 10;
    if (maxAgeMs > 3000) freshnessScore = 5;

    // Spread stability score (0-15 points)
    let spreadStabilityScore = 15;
    if (spreadHistory.length >= 5) {
      const avg = spreadHistory.reduce((a, b) => a + b, 0) / spreadHistory.length;
      const variance = spreadHistory.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / spreadHistory.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0.1) spreadStabilityScore = 5;
      else if (stdDev > 0.05) spreadStabilityScore = 10;
    }

    // Volume score (0-10 points)
    let volumeScore = Math.min(liquidityUSDT / 200, 10);

    const total = profitScore + liquidityScore + freshnessScore + spreadStabilityScore + volumeScore;

    return {
      total: Math.round(total),
      profitScore: Math.round(profitScore),
      liquidityScore: Math.round(liquidityScore),
      freshnessScore: Math.round(freshnessScore),
      spreadStabilityScore: Math.round(spreadStabilityScore),
      volumeScore: Math.round(volumeScore),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getOpportunities(): EnhancedOpportunity[] {
    return this.opportunities;
  }

  getProfitableOpportunities(): EnhancedOpportunity[] {
    return this.opportunities.filter(o => o.profitable);
  }

  getHighConfidenceOpportunities(): EnhancedOpportunity[] {
    return this.opportunities.filter(o => o.profitable && o.confidence === 'high');
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }
}

export function createEnhancedScanner(
  adapters: Map<string, IExchangeAdapter>,
  config?: Partial<ScannerConfig>
): EnhancedScanner {
  return new EnhancedScanner(adapters, config);
}
