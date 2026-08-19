/**
 * Demo Scanner - Simulates arbitrage opportunities for testing
 * Use this to test the UI and execution flow without real market conditions
 */
import { EventEmitter } from 'events';

interface DemoOpportunity {
  id: string;
  type: 'cross-exchange';
  asset: string;
  symbol: string;
  route: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPercent: number;
  grossProfitPercent: number;
  fees: {
    tradingFeeBuy: number;
    tradingFeeSell: number;
    withdrawalFee: number;
    networkFee: number;
    totalFees: number;
  };
  netProfit: number;
  netProfitPercent: number;
  netProfitUSDT: number;
  tradeSize: number;
  profitable: boolean;
  liquidityOk: boolean;
  priceAge: { buy: number; sell: number };
  volume: number;
  confidence: 'high' | 'medium' | 'low';
  score: { total: number; profitScore: number; liquidityScore: number; freshnessScore: number; spreadStabilityScore?: number; volumeScore?: number };
  executionRecommendation: string;
  detectedAt: number;
  timestamp: number;
}

const DEMO_ASSETS = [
  { asset: 'USDT', basePrice: 1.0, volatility: 0.002 },
  { asset: 'BTC', basePrice: 64000, volatility: 0.001 },
  { asset: 'ETH', basePrice: 3400, volatility: 0.0015 },
  { asset: 'SOL', basePrice: 140, volatility: 0.003 },
  { asset: 'XRP', basePrice: 0.52, volatility: 0.004 },
];

const EXCHANGES = ['binance', 'kraken', 'bybit', 'kucoin'];

export class DemoScanner extends EventEmitter {
  private isRunning = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private opportunities: DemoOpportunity[] = [];
  private scanCount = 0;

  constructor(private config: { tradeSizeUSDT?: number; generateRate?: number } = {}) {
    super();
    this.config.tradeSizeUSDT = config.tradeSizeUSDT || 100;
    this.config.generateRate = config.generateRate || 3000;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('[DemoScanner] Starting demo opportunity generator...');
    this.isRunning = true;

    this.generateOpportunities();
    this.scanInterval = setInterval(() => this.generateOpportunities(), this.config.generateRate);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[DemoScanner] Stopping...');
    this.isRunning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.emit('stopped');
  }

  private generateOpportunities(): void {
    this.scanCount++;
    const now = Date.now();
    const newOpps: DemoOpportunity[] = [];

    for (const { asset, basePrice, volatility } of DEMO_ASSETS) {
      const shouldGenerate = Math.random() < 0.6;
      if (!shouldGenerate) continue;

      const buyExchange = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)];
      let sellExchange = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)];
      while (sellExchange === buyExchange) {
        sellExchange = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)];
      }

      const buyPrice = basePrice * (1 - Math.random() * volatility);
      const spreadPercent = 0.15 + Math.random() * 0.35;
      const sellPrice = buyPrice * (1 + spreadPercent / 100);

      const fees = 0.2;
      const netProfitPercent = spreadPercent - fees;
      const netProfitUSDT = (netProfitPercent / 100) * this.config.tradeSizeUSDT!;

      let confidence: 'high' | 'medium' | 'low';
      let score: number;
      if (netProfitPercent >= 0.25) {
        confidence = 'high';
        score = 80 + Math.floor(Math.random() * 15);
      } else if (netProfitPercent >= 0.1) {
        confidence = 'medium';
        score = 60 + Math.floor(Math.random() * 20);
      } else {
        confidence = 'low';
        score = 40 + Math.floor(Math.random() * 20);
      }

      const tradeSize = this.config.tradeSizeUSDT!;
      const feeAmount = tradeSize * 0.001;

      const opp: DemoOpportunity = {
        id: `demo_${asset}_${now}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'cross-exchange',
        asset,
        symbol: `${asset}/USDT`,
        route: `BUY on ${buyExchange} → SELL on ${sellExchange}`,
        buyExchange,
        sellExchange,
        buyPrice,
        sellPrice,
        spreadPercent,
        grossProfitPercent: spreadPercent,
        fees: {
          tradingFeeBuy: feeAmount,
          tradingFeeSell: feeAmount,
          withdrawalFee: 0,
          networkFee: 0,
          totalFees: feeAmount * 2,
        },
        netProfit: netProfitUSDT,
        netProfitPercent,
        netProfitUSDT,
        tradeSize,
        profitable: netProfitPercent > 0,
        liquidityOk: true,
        priceAge: { buy: 50, sell: 75 },
        volume: 5000 + Math.random() * 10000,
        confidence,
        score: {
          total: score,
          profitScore: Math.min(netProfitPercent * 50, 30),
          liquidityScore: 20 + Math.floor(Math.random() * 5),
          freshnessScore: 18 + Math.floor(Math.random() * 2),
          spreadStabilityScore: 12 + Math.floor(Math.random() * 3),
          volumeScore: 8 + Math.floor(Math.random() * 2),
        },
        executionRecommendation:
          confidence === 'high'
            ? `Execute immediately: Strong ${netProfitPercent.toFixed(3)}% opportunity`
            : confidence === 'medium'
            ? `Consider execution: ${netProfitPercent.toFixed(3)}% potential`
            : `Monitor: Marginal opportunity`,
        detectedAt: now,
        timestamp: now,
      };

      newOpps.push(opp);
    }

    this.opportunities = newOpps.sort((a, b) => b.score.total - a.score.total);

    const highConf = this.opportunities.filter((o) => o.confidence === 'high');
    for (const opp of highConf) {
      this.emit('opportunity', opp);
    }

    if (this.scanCount % 5 === 0) {
      console.log(
        `[DemoScanner] Scan #${this.scanCount}: ${this.opportunities.length} opportunities, ` +
          `${highConf.length} high-confidence`
      );
    }
  }

  getOpportunities(): DemoOpportunity[] {
    return this.opportunities;
  }

  getProfitableOpportunities(): DemoOpportunity[] {
    return this.opportunities.filter((o) => o.profitable);
  }

  getHighConfidenceOpportunities(): DemoOpportunity[] {
    return this.opportunities.filter((o) => o.confidence === 'high');
  }

  getStats() {
    return {
      scansCompleted: this.scanCount,
      opportunitiesFound: this.opportunities.length,
      highConfidenceCount: this.opportunities.filter((o) => o.confidence === 'high').length,
      isDemo: true,
    };
  }
}

export function createDemoScanner(config?: { tradeSizeUSDT?: number; generateRate?: number }): DemoScanner {
  return new DemoScanner(config);
}
