/**
 * Capital Manager - Manages pre-positioned capital across exchanges
 * Key for simultaneous execution (no withdrawal delays)
 */
import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { Balance } from '../types/index.js';

export interface CapitalAllocation {
  exchange: string;
  asset: string;
  available: number;
  reserved: number;
  total: number;
  usdValue: number;
  lastUpdated: number;
}

export interface RebalanceRecommendation {
  fromExchange: string;
  toExchange: string;
  asset: string;
  amount: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface CapitalConfig {
  minBalancePerExchange: number;  // Min USDT per exchange
  maxExposurePercent: number;     // Max % of capital per trade
  rebalanceThresholdPercent: number;  // Trigger rebalance when imbalanced
  reservePercent: number;         // Keep as safety reserve
  targetAssets: string[];         // Assets to track
}

const DEFAULT_CONFIG: CapitalConfig = {
  minBalancePerExchange: 100,
  maxExposurePercent: 10,
  rebalanceThresholdPercent: 30,
  reservePercent: 10,
  targetAssets: ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'XRP'],
};

export class CapitalManager extends EventEmitter {
  private adapters: Map<string, IExchangeAdapter>;
  private config: CapitalConfig;
  private allocations: Map<string, CapitalAllocation[]> = new Map();
  private reservedCapital: Map<string, number> = new Map(); // executionId -> amount
  private lastPrices: Map<string, number> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(
    adapters: Map<string, IExchangeAdapter>,
    config: Partial<CapitalConfig> = {}
  ) {
    super();
    this.adapters = adapters;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log('[CapitalManager] Initializing...');
    await this.refreshAllBalances();

    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.refreshAllBalances().catch(console.error);
    }, 30000);

    console.log('[CapitalManager] Initialized with', this.adapters.size, 'exchanges');
  }

  async refreshAllBalances(): Promise<void> {
    const refreshPromises: Promise<void>[] = [];

    for (const [exchangeName, adapter] of this.adapters) {
      refreshPromises.push(this.refreshExchangeBalance(exchangeName, adapter));
    }

    await Promise.allSettled(refreshPromises);
    this.emit('balances:updated', this.getAllAllocations());
  }

  private async refreshExchangeBalance(
    exchangeName: string,
    adapter: IExchangeAdapter
  ): Promise<void> {
    try {
      const balances = await adapter.getBalance();
      const allocations: CapitalAllocation[] = [];

      for (const balance of balances) {
        if (!this.config.targetAssets.includes(balance.asset)) continue;
        if (balance.total < 0.0001) continue;

        const usdValue = await this.getUsdValue(balance.asset, balance.total);

        allocations.push({
          exchange: exchangeName,
          asset: balance.asset,
          available: balance.free,
          reserved: balance.locked,
          total: balance.total,
          usdValue,
          lastUpdated: Date.now(),
        });
      }

      this.allocations.set(exchangeName, allocations);
    } catch (error) {
      console.warn(`[CapitalManager] Failed to refresh ${exchangeName}:`, error);
    }
  }

  private async getUsdValue(asset: string, amount: number): Promise<number> {
    if (asset === 'USDT' || asset === 'USDC' || asset === 'USD') {
      return amount;
    }

    const cachedPrice = this.lastPrices.get(asset);
    if (cachedPrice) {
      return amount * cachedPrice;
    }

    // Estimate based on common prices (will be updated by scanner)
    const estimates: Record<string, number> = {
      BTC: 67000,
      ETH: 3500,
      SOL: 150,
      XRP: 0.5,
      ADA: 0.4,
      DOGE: 0.1,
    };

    return amount * (estimates[asset] || 1);
  }

  updatePrice(asset: string, price: number): void {
    this.lastPrices.set(asset, price);
  }

  /**
   * Check if we have enough capital on both exchanges for arbitrage
   */
  canExecuteArbitrage(
    buyExchange: string,
    sellExchange: string,
    asset: string,
    amountUSDT: number
  ): { canExecute: boolean; reason: string; details: any } {
    const buyAlloc = this.getAllocations(buyExchange);
    const sellAlloc = this.getAllocations(sellExchange);

    // Need USDT on buy exchange
    const buyUSDT = buyAlloc.find(a => a.asset === 'USDT' || a.asset === 'USDC');
    const availableToBuy = (buyUSDT?.available || 0) - this.getReservedAmount(buyExchange, 'USDT');

    // Need the asset on sell exchange
    const sellAsset = sellAlloc.find(a => a.asset === asset);
    const availableToSell = sellAsset?.available || 0;

    const requiredAssetAmount = amountUSDT / (this.lastPrices.get(asset) || 1);

    // Check capital adequacy
    if (availableToBuy < amountUSDT) {
      return {
        canExecute: false,
        reason: `Insufficient USDT on ${buyExchange}. Need $${amountUSDT}, have $${availableToBuy.toFixed(2)}`,
        details: { availableToBuy, required: amountUSDT }
      };
    }

    if (availableToSell < requiredAssetAmount) {
      return {
        canExecute: false,
        reason: `Insufficient ${asset} on ${sellExchange}. Need ${requiredAssetAmount.toFixed(6)}, have ${availableToSell.toFixed(6)}`,
        details: { availableToSell, required: requiredAssetAmount }
      };
    }

    // Check max exposure
    const totalCapital = this.getTotalCapitalUSD();
    const exposurePercent = (amountUSDT / totalCapital) * 100;

    if (exposurePercent > this.config.maxExposurePercent) {
      return {
        canExecute: false,
        reason: `Trade exceeds max exposure (${exposurePercent.toFixed(1)}% > ${this.config.maxExposurePercent}%)`,
        details: { exposurePercent, maxExposure: this.config.maxExposurePercent }
      };
    }

    return {
      canExecute: true,
      reason: 'Capital available for simultaneous execution',
      details: {
        buyExchange: { asset: 'USDT', available: availableToBuy },
        sellExchange: { asset, available: availableToSell },
        exposurePercent
      }
    };
  }

  /**
   * Reserve capital for an execution
   */
  reserveCapital(executionId: string, amount: number): void {
    this.reservedCapital.set(executionId, amount);
    this.emit('capital:reserved', { executionId, amount });
  }

  /**
   * Release reserved capital
   */
  releaseCapital(executionId: string): void {
    const amount = this.reservedCapital.get(executionId);
    this.reservedCapital.delete(executionId);
    if (amount) {
      this.emit('capital:released', { executionId, amount });
    }
  }

  private getReservedAmount(exchange: string, asset: string): number {
    // Sum all reservations for this exchange/asset
    let total = 0;
    for (const amount of this.reservedCapital.values()) {
      total += amount;
    }
    return total / this.adapters.size; // Distribute evenly (simplified)
  }

  /**
   * Get rebalancing recommendations
   */
  getRebalanceRecommendations(): RebalanceRecommendation[] {
    const recommendations: RebalanceRecommendation[] = [];
    const exchangeNames = Array.from(this.allocations.keys());

    if (exchangeNames.length < 2) return recommendations;

    // Check USDT balance across exchanges
    const usdtByExchange: Map<string, number> = new Map();
    let totalUSDT = 0;

    for (const [exchange, allocs] of this.allocations) {
      const usdt = allocs.find(a => a.asset === 'USDT' || a.asset === 'USDC')?.available || 0;
      usdtByExchange.set(exchange, usdt);
      totalUSDT += usdt;
    }

    const targetPerExchange = totalUSDT / exchangeNames.length;

    // Find imbalances
    for (const [exchange, balance] of usdtByExchange) {
      const diff = balance - targetPerExchange;
      const imbalancePercent = Math.abs(diff / targetPerExchange) * 100;

      if (imbalancePercent > this.config.rebalanceThresholdPercent) {
        if (diff > 0) {
          // This exchange has excess - find one that needs it
          for (const [otherExchange, otherBalance] of usdtByExchange) {
            if (otherExchange !== exchange && otherBalance < targetPerExchange) {
              const transferAmount = Math.min(diff, targetPerExchange - otherBalance);
              recommendations.push({
                fromExchange: exchange,
                toExchange: otherExchange,
                asset: 'USDT',
                amount: transferAmount,
                reason: `Rebalance: ${exchange} has ${imbalancePercent.toFixed(0)}% excess`,
                priority: imbalancePercent > 50 ? 'high' : 'medium'
              });
            }
          }
        }
      }
    }

    return recommendations;
  }

  getAllocations(exchange?: string): CapitalAllocation[] {
    if (exchange) {
      return this.allocations.get(exchange.toLowerCase()) || [];
    }
    return Array.from(this.allocations.values()).flat();
  }

  getAllAllocations(): Map<string, CapitalAllocation[]> {
    return new Map(this.allocations);
  }

  getTotalCapitalUSD(): number {
    let total = 0;
    for (const allocs of this.allocations.values()) {
      for (const alloc of allocs) {
        total += alloc.usdValue;
      }
    }
    return total;
  }

  getCapitalSummary(): {
    totalUSD: number;
    byExchange: Record<string, number>;
    byAsset: Record<string, number>;
    reservedUSD: number;
  } {
    const byExchange: Record<string, number> = {};
    const byAsset: Record<string, number> = {};
    let totalUSD = 0;

    for (const [exchange, allocs] of this.allocations) {
      byExchange[exchange] = 0;
      for (const alloc of allocs) {
        byExchange[exchange] += alloc.usdValue;
        byAsset[alloc.asset] = (byAsset[alloc.asset] || 0) + alloc.usdValue;
        totalUSD += alloc.usdValue;
      }
    }

    let reservedUSD = 0;
    for (const amount of this.reservedCapital.values()) {
      reservedUSD += amount;
    }

    return { totalUSD, byExchange, byAsset, reservedUSD };
  }

  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

export function createCapitalManager(
  adapters: Map<string, IExchangeAdapter>,
  config?: Partial<CapitalConfig>
): CapitalManager {
  return new CapitalManager(adapters, config);
}
