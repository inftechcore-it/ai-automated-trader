import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';

export interface FeeRates {
  maker: number;
  taker: number;
  timestamp: number;
}

export interface WithdrawalFeeInfo {
  asset: string;
  fee: number;
  network?: string;
  timestamp: number;
}

export interface FeeBreakdown {
  tradingFeeBuy: number;
  tradingFeeSell: number;
  withdrawalFee: number;
  networkFee: number;
  totalFees: number;
}

const FEE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_TRADING_FEE = 0.001; // 0.1%
const DEFAULT_NETWORK_FEES: Record<string, number> = {
  BTC: 0.0001,
  ETH: 0.001,
  USDT: 1,
  default: 0,
};

export class FeeService {
  private tradingFeeCache: Map<string, FeeRates> = new Map();
  private withdrawalFeeCache: Map<string, WithdrawalFeeInfo> = new Map();
  private adapters: Map<string, IExchangeAdapter>;

  constructor(adapters: Map<string, IExchangeAdapter>) {
    this.adapters = adapters;
  }

  private getCacheKey(exchange: string, symbol?: string): string {
    return symbol ? `${exchange}:${symbol}` : exchange;
  }

  async getTradingFee(exchange: string, symbol: string): Promise<FeeRates> {
    const cacheKey = this.getCacheKey(exchange, symbol);
    const cached = this.tradingFeeCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < FEE_CACHE_TTL_MS) {
      return cached;
    }

    const adapter = this.adapters.get(exchange.toLowerCase());
    if (!adapter) {
      return { maker: DEFAULT_TRADING_FEE, taker: DEFAULT_TRADING_FEE, timestamp: Date.now() };
    }

    try {
      // CCXT fetchTradingFee if available
      const exchange_instance = (adapter as any).exchange;
      if (exchange_instance && typeof exchange_instance.fetchTradingFee === 'function') {
        const fee = await exchange_instance.fetchTradingFee(symbol);
        const rates: FeeRates = {
          maker: fee.maker || DEFAULT_TRADING_FEE,
          taker: fee.taker || DEFAULT_TRADING_FEE,
          timestamp: Date.now(),
        };
        this.tradingFeeCache.set(cacheKey, rates);
        return rates;
      }
    } catch (error) {
      console.warn(`[FeeService] Failed to fetch trading fee for ${exchange}:${symbol}`, error);
    }

    // Default fallback
    const defaultRates: FeeRates = {
      maker: DEFAULT_TRADING_FEE,
      taker: DEFAULT_TRADING_FEE,
      timestamp: Date.now(),
    };
    this.tradingFeeCache.set(cacheKey, defaultRates);
    return defaultRates;
  }

  async getWithdrawalFee(exchange: string, asset: string, network?: string): Promise<number> {
    const cacheKey = `${exchange}:${asset}:${network || 'default'}`;
    const cached = this.withdrawalFeeCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < FEE_CACHE_TTL_MS) {
      return cached.fee;
    }

    const adapter = this.adapters.get(exchange.toLowerCase());
    if (!adapter) {
      return 0;
    }

    try {
      const fee = await adapter.getWithdrawalFee(asset, network);
      this.withdrawalFeeCache.set(cacheKey, {
        asset,
        fee,
        network,
        timestamp: Date.now(),
      });
      return fee;
    } catch (error) {
      console.warn(`[FeeService] Failed to fetch withdrawal fee for ${exchange}:${asset}`, error);
      return 0;
    }
  }

  getNetworkFee(asset: string): number {
    return DEFAULT_NETWORK_FEES[asset] || DEFAULT_NETWORK_FEES.default;
  }

  async calculateFeeBreakdown(
    buyExchange: string,
    sellExchange: string,
    symbol: string,
    asset: string,
    tradeAmountUSDT: number
  ): Promise<FeeBreakdown> {
    const [buyFeeRates, sellFeeRates, withdrawalFee] = await Promise.all([
      this.getTradingFee(buyExchange, symbol),
      this.getTradingFee(sellExchange, symbol),
      this.getWithdrawalFee(buyExchange, asset),
    ]);

    const tradingFeeBuy = tradeAmountUSDT * buyFeeRates.taker;
    const tradingFeeSell = tradeAmountUSDT * sellFeeRates.taker;
    const networkFee = this.getNetworkFee(asset);
    const totalFees = tradingFeeBuy + tradingFeeSell + withdrawalFee + networkFee;

    return {
      tradingFeeBuy,
      tradingFeeSell,
      withdrawalFee,
      networkFee,
      totalFees,
    };
  }

  clearCache(): void {
    this.tradingFeeCache.clear();
    this.withdrawalFeeCache.clear();
  }
}

export function createFeeService(adapters: Map<string, IExchangeAdapter>): FeeService {
  return new FeeService(adapters);
}
