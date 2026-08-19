import { PrismaClient, ArbitrageType, OpportunityStatus } from '@prisma/client';
import { EventEmitter } from 'events';
import { RouteGraph, Cycle } from './RouteGraph.js';
import { PriceCache } from './PriceCache.js';
import { ArbitrageCalculator, ArbResult } from './ArbitrageCalculator.js';
import { RedisPublisher } from '../events/RedisPublisher.js';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';

export interface ScannerConfig {
  scanIntervalMs: number;
  minProfitThresholdPercent: number;
  topNAssets: number;
  feeRate: number;
  dedupWindowMs: number;
  dedupProfitChangeThreshold: number;
  baseAsset: string;
  enableRedis: boolean;
  enableDatabase: boolean;
}

const DEFAULT_CONFIG: ScannerConfig = {
  scanIntervalMs: parseInt(process.env.SCAN_INTERVAL_MS || '500'),
  minProfitThresholdPercent: parseFloat(process.env.MIN_PROFIT_THRESHOLD_PERCENT || '0.1'),
  topNAssets: parseInt(process.env.TOP_N_ASSETS || '30'),
  feeRate: parseFloat(process.env.FEE_RATE_DEFAULT || '0.001'),
  dedupWindowMs: 5000,
  dedupProfitChangeThreshold: 0.05,
  baseAsset: 'USDT',
  enableRedis: true,
  enableDatabase: true,
};

interface EmittedOpportunity {
  cycleKey: string;
  netProfitPercent: number;
  timestamp: number;
}

export interface ScannerStats {
  status: 'running' | 'stopped' | 'initializing';
  cyclesScanned: number;
  opportunitiesFound: number;
  lastScanDurationMs: number;
  totalScans: number;
  startedAt: number;
}

export class ArbitrageScanner extends EventEmitter {
  private config: ScannerConfig;
  private adapter: IExchangeAdapter;
  private routeGraph: RouteGraph;
  private priceCache: PriceCache;
  private calculator: ArbitrageCalculator;
  private publisher: RedisPublisher | null = null;
  private prisma: PrismaClient | null = null;

  private cycles: Cycle[] = [];
  private scanInterval: NodeJS.Timeout | null = null;
  private recentlyEmitted: Map<string, EmittedOpportunity> = new Map();

  private stats: ScannerStats = {
    status: 'stopped',
    cyclesScanned: 0,
    opportunitiesFound: 0,
    lastScanDurationMs: 0,
    totalScans: 0,
    startedAt: 0,
  };

  constructor(adapter: IExchangeAdapter, config: Partial<ScannerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adapter = adapter;

    this.routeGraph = new RouteGraph(this.config.topNAssets);
    this.priceCache = new PriceCache();
    this.calculator = new ArbitrageCalculator({
      feeRate: this.config.feeRate,
      minProfitThresholdPercent: this.config.minProfitThresholdPercent,
    });
  }

  async start(): Promise<void> {
    if (this.stats.status === 'running') {
      console.log('[Scanner] Already running');
      return;
    }

    this.stats.status = 'initializing';
    this.stats.startedAt = Date.now();
    console.log('[Scanner] Starting arbitrage scanner...');

    try {
      if (this.config.enableRedis) {
        this.publisher = new RedisPublisher();
        await this.publisher.connect();
      }

      if (this.config.enableDatabase) {
        this.prisma = new PrismaClient();
      }

      console.log('[Scanner] Building route graph...');
      await this.routeGraph.buildGraph(this.adapter);

      this.cycles = this.routeGraph.findTriangularCycles(this.config.baseAsset);
      console.log(`[Scanner] Found ${this.cycles.length} triangular cycles`);

      const symbols = this.getUniqueSymbols();
      console.log(`[Scanner] Subscribing to ${symbols.length} unique symbols...`);

      await this.priceCache.subscribeAll(this.adapter, symbols);

      this.priceCache.on('stale', (symbol, lastUpdate) => {
        console.warn(`[Scanner] Stale price for ${symbol}, last update: ${new Date(lastUpdate).toISOString()}`);
      });

      console.log('[Scanner] Waiting for initial price data...');
      await this.waitForPriceData(5000);

      this.startScanLoop();
      this.stats.status = 'running';

      console.log('[Scanner] Arbitrage scanner started successfully');
      this.emit('started', this.stats);
    } catch (error) {
      console.error('[Scanner] Failed to start:', error);
      this.stats.status = 'stopped';
      throw error;
    }
  }

  private getUniqueSymbols(): string[] {
    const symbols = new Set<string>();
    for (const cycle of this.cycles) {
      for (const symbol of cycle.symbols) {
        symbols.add(symbol);
      }
    }
    return [...symbols];
  }

  private async waitForPriceData(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const requiredCount = Math.min(this.getUniqueSymbols().length, 10);

    while (Date.now() - startTime < timeoutMs) {
      if (this.priceCache.getSymbolCount() >= requiredCount) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.warn(`[Scanner] Timeout waiting for price data, proceeding with ${this.priceCache.getSymbolCount()} symbols`);
  }

  private startScanLoop(): void {
    this.scanInterval = setInterval(() => {
      this.scan();
    }, this.config.scanIntervalMs);
  }

  private async scan(): Promise<void> {
    const scanStart = Date.now();
    this.stats.totalScans++;

    const results = this.calculator.calculateBatchProfits(
      this.cycles,
      this.priceCache,
      this.config.feeRate
    );

    this.stats.cyclesScanned = results.length;

    // Process top 5 results by profit (including negative)
    const topResults = results.slice(0, 5);

    for (const result of topResults) {
      if (result.netProfitPercent > this.config.minProfitThresholdPercent) {
        await this.processOpportunity(result);
      }
    }

    // Log best opportunity every 50 scans
    if (this.stats.totalScans % 50 === 0 && results.length > 0) {
      const best = results[0];
      console.log(`[Scanner] Best: ${best.cycle.assets.join('→')} | Net: ${best.netProfitPercent.toFixed(4)}%`);
    }

    this.stats.lastScanDurationMs = Date.now() - scanStart;
    this.cleanupRecentlyEmitted();

    if (this.stats.totalScans % 100 === 0) {
      this.logStats();
      this.publishStatus();
    }
  }

  private async processOpportunity(result: ArbResult): Promise<void> {
    const cycleKey = result.cycle.symbols.sort().join('-');
    const recent = this.recentlyEmitted.get(cycleKey);

    if (recent) {
      const timeSinceEmit = Date.now() - recent.timestamp;
      const profitChange = Math.abs(result.netProfitPercent - recent.netProfitPercent);

      if (
        timeSinceEmit < this.config.dedupWindowMs &&
        profitChange < this.config.dedupProfitChangeThreshold
      ) {
        return;
      }
    }

    this.stats.opportunitiesFound++;
    this.recentlyEmitted.set(cycleKey, {
      cycleKey,
      netProfitPercent: result.netProfitPercent,
      timestamp: Date.now(),
    });

    const opportunity = {
      id: `arb_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: 'TRIANGULAR' as const,
      symbols: result.cycle.symbols,
      exchanges: [this.adapter.exchangeName],
      spreadPercent: result.grossProfitPercent,
      grossProfit: result.grossProfitPercent,
      netProfit: result.netProfitPercent,
      legs: result.legs,
      detectedAt: new Date(),
    };

    this.emit('opportunity', opportunity);
    console.log(`[Scanner] ${ArbitrageCalculator.formatResult(result)}`);

    if (this.publisher && this.config.enableRedis) {
      await this.publisher.publishOpportunity(opportunity);
    }

    if (this.prisma && this.config.enableDatabase) {
      try {
        await this.prisma.arbitrageOpportunity.create({
          data: {
            type: ArbitrageType.TRIANGULAR,
            symbols: result.cycle.symbols,
            exchanges: [this.adapter.exchangeName],
            spreadPercent: result.grossProfitPercent,
            grossProfit: result.grossProfitPercent,
            netProfit: result.netProfitPercent,
            status: OpportunityStatus.DETECTED,
          },
        });
      } catch (error) {
        console.error('[Scanner] Failed to save opportunity:', error);
      }
    }
  }

  private cleanupRecentlyEmitted(): void {
    const now = Date.now();
    for (const [key, entry] of this.recentlyEmitted) {
      if (now - entry.timestamp > this.config.dedupWindowMs * 2) {
        this.recentlyEmitted.delete(key);
      }
    }
  }

  private async publishStatus(): Promise<void> {
    if (this.publisher && this.config.enableRedis) {
      await this.publisher.publishScannerStatus({
        status: this.stats.status,
        cyclesScanned: this.stats.cyclesScanned,
        opportunitiesFound: this.stats.opportunitiesFound,
        lastScanDurationMs: this.stats.lastScanDurationMs,
      });
    }
  }

  private logStats(): void {
    const uptime = Math.floor((Date.now() - this.stats.startedAt) / 1000);
    console.log(
      `[Scanner] Stats: ${this.stats.totalScans} scans | ${this.stats.opportunitiesFound} opportunities | ${this.stats.lastScanDurationMs}ms/scan | Uptime: ${uptime}s`
    );
  }

  async stop(): Promise<void> {
    if (this.stats.status !== 'running') return;

    console.log('[Scanner] Stopping arbitrage scanner...');

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    await this.priceCache.close();

    if (this.publisher) {
      await this.publisher.disconnect();
      this.publisher = null;
    }

    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }

    this.stats.status = 'stopped';
    this.emit('stopped', this.stats);
    console.log('[Scanner] Arbitrage scanner stopped');
  }

  getStats(): ScannerStats {
    return { ...this.stats };
  }

  getCycles(): Cycle[] {
    return this.cycles;
  }

  getRecentOpportunities(): ArbResult[] {
    return this.calculator.calculateBatchProfits(
      this.cycles,
      this.priceCache,
      this.config.feeRate
    );
  }

  setConfig(config: Partial<ScannerConfig>): void {
    Object.assign(this.config, config);

    if (config.feeRate !== undefined || config.minProfitThresholdPercent !== undefined) {
      this.calculator.setConfig({
        feeRate: this.config.feeRate,
        minProfitThresholdPercent: this.config.minProfitThresholdPercent,
      });
    }
  }
}

export function createArbitrageScanner(
  adapter: IExchangeAdapter,
  config?: Partial<ScannerConfig>
): ArbitrageScanner {
  return new ArbitrageScanner(adapter, config);
}
