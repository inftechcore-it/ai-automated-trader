import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { Ticker } from '../types/index.js';

export interface PriceEntry {
  bid: number;
  ask: number;
  last: number;
  timestamp: number;
}

export interface PriceCacheEvents {
  update: (symbol: string, price: PriceEntry) => void;
  stale: (symbol: string, lastUpdate: number) => void;
  error: (symbol: string, error: Error) => void;
}

const STALE_THRESHOLD_MS = 15000;
const REFRESH_INTERVAL_MS = 2000;

export class PriceCache extends EventEmitter {
  private cache: Map<string, PriceEntry> = new Map();
  private adapter: IExchangeAdapter | null = null;
  private symbols: string[] = [];
  private refreshInterval: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;

  constructor() {
    super();
  }

  async subscribeAll(adapter: IExchangeAdapter, symbols: string[]): Promise<void> {
    this.adapter = adapter;
    this.symbols = symbols;

    console.log(`[PriceCache] Setting up polling for ${symbols.length} symbols...`);

    await this.refreshAllPrices();

    this.startPolling();

    console.log(`[PriceCache] Polling started, ${this.cache.size} symbols cached`);
  }

  private startPolling(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      if (!this.isRefreshing) {
        await this.refreshAllPrices();
      }
    }, REFRESH_INTERVAL_MS);
  }

  private updatePrice(symbol: string, ticker: Ticker): void {
    const entry: PriceEntry = {
      bid: ticker.bid || ticker.last * 0.999,
      ask: ticker.ask || ticker.last * 1.001,
      last: ticker.last,
      timestamp: Date.now(),
    };

    this.cache.set(symbol, entry);
    this.emit('update', symbol, entry);
  }

  getPrice(symbol: string): PriceEntry | null {
    return this.cache.get(symbol) || null;
  }

  getBidAsk(symbol: string): { bid: number; ask: number } | null {
    const entry = this.cache.get(symbol);
    if (!entry) return null;
    return { bid: entry.bid, ask: entry.ask };
  }

  getAllPrices(): Map<string, PriceEntry> {
    return new Map(this.cache);
  }

  getSymbolCount(): number {
    return this.cache.size;
  }

  isStale(symbol: string): boolean {
    const entry = this.cache.get(symbol);
    if (!entry) return true;
    return Date.now() - entry.timestamp > STALE_THRESHOLD_MS;
  }

  getStaleSymbols(): string[] {
    const stale: string[] = [];
    const now = Date.now();

    for (const [symbol, entry] of this.cache) {
      if (now - entry.timestamp > STALE_THRESHOLD_MS) {
        stale.push(symbol);
      }
    }

    return stale;
  }

  async refreshPrice(symbol: string): Promise<PriceEntry | null> {
    if (!this.adapter) return null;

    try {
      const ticker = await this.adapter.getTicker(symbol);
      this.updatePrice(symbol, ticker);
      return this.cache.get(symbol) || null;
    } catch (error) {
      return null;
    }
  }

  async refreshAllPrices(): Promise<void> {
    if (!this.adapter || this.symbols.length === 0) return;

    this.isRefreshing = true;

    const batchSize = 5;
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map((symbol) => this.refreshPrice(symbol))
      );
    }

    this.isRefreshing = false;
  }

  async unsubscribeAll(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  clear(): void {
    this.cache.clear();
  }

  async close(): Promise<void> {
    await this.unsubscribeAll();
    this.clear();
    this.removeAllListeners();
  }
}

export function createPriceCache(): PriceCache {
  return new PriceCache();
}
