/**
 * BotScheduler - Price tick routing to bot instances
 * Subscribes to WebSocket feeds and distributes ticks to relevant bots
 */
import { EventEmitter } from 'events';
import type { PriceTick } from './types.js';

interface SubscriptionKey {
  exchange: string;
  symbol: string;
}

interface BotSubscription {
  botId: string;
  callback: (tick: PriceTick) => void;
}

export class BotScheduler extends EventEmitter {
  private subscriptions: Map<string, BotSubscription[]> = new Map();
  private wsConnections: Map<string, any> = new Map();
  private adapters: Map<string, any> = new Map();
  private priceCache: Map<string, PriceTick> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private stats = {
    ticksProcessed: 0,
    wsConnections: 0,
    activeSubscriptions: 0,
  };

  private makeKey(exchange: string, symbol: string): string {
    return `${exchange}:${symbol}`;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[BotScheduler] Starting...');

    // Start polling fallback (every 3 seconds)
    this.pollInterval = setInterval(() => this.pollPrices(), 3000);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Close all WebSocket connections
    for (const ws of this.wsConnections.values()) {
      try {
        ws?.close?.();
      } catch {}
    }
    this.wsConnections.clear();
    this.adapters.clear();

    console.log('[BotScheduler] Stopped');
    this.emit('stopped');
  }

  async subscribe(
    botId: string,
    exchange: string,
    symbol: string,
    callback: (tick: PriceTick) => void
  ): Promise<void> {
    const key = this.makeKey(exchange, symbol);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, []);
    }

    const subs = this.subscriptions.get(key)!;

    // Don't add duplicate
    if (subs.some(s => s.botId === botId)) {
      return;
    }

    subs.push({ botId, callback });
    this.stats.activeSubscriptions++;

    console.log(`[BotScheduler] Bot ${botId} subscribed to ${key}`);

    // Start WebSocket for this symbol if not already
    if (subs.length === 1) {
      await this.startWebSocket(exchange, symbol);
    }
  }

  unsubscribe(botId: string, exchange: string, symbol: string): void {
    const key = this.makeKey(exchange, symbol);
    const subs = this.subscriptions.get(key);

    if (!subs) return;

    const index = subs.findIndex(s => s.botId === botId);
    if (index !== -1) {
      subs.splice(index, 1);
      this.stats.activeSubscriptions--;
      console.log(`[BotScheduler] Bot ${botId} unsubscribed from ${key}`);
    }

    // If no more subscribers, close WebSocket
    if (subs.length === 0) {
      this.subscriptions.delete(key);
      this.closeWebSocket(exchange, symbol);
    }
  }

  unsubscribeAll(botId: string): void {
    for (const [key, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(s => s.botId === botId);
      if (index !== -1) {
        subs.splice(index, 1);
        this.stats.activeSubscriptions--;

        if (subs.length === 0) {
          const [exchange, symbol] = key.split(':');
          this.subscriptions.delete(key);
          this.closeWebSocket(exchange, symbol);
        }
      }
    }
    console.log(`[BotScheduler] Bot ${botId} unsubscribed from all`);
  }

  private async startWebSocket(exchange: string, symbol: string): Promise<void> {
    const key = this.makeKey(exchange, symbol);

    try {
      const adapter = await this.getAdapter(exchange);
      if (!adapter) {
        console.log(`[BotScheduler] No adapter for ${exchange}, using polling only`);
        return;
      }

      const ccxtExchange = (adapter as any).exchange;
      if (!ccxtExchange || typeof ccxtExchange.watchTicker !== 'function') {
        console.log(`[BotScheduler] WebSocket not available for ${exchange}, using polling`);
        return;
      }

      // Start watch loop - only mark as connected after first successful tick
      const watchLoop = async () => {
        let connected = false;
        let failCount = 0;
        const MAX_FAILS = 3;

        while (this.isRunning && this.subscriptions.has(key)) {
          try {
            const ticker = await ccxtExchange.watchTicker(symbol);

            if (!connected) {
              connected = true;
              this.stats.wsConnections++;
              this.wsConnections.set(key, ccxtExchange);
              console.log(`[BotScheduler] WebSocket connected for ${key}`);
            }

            failCount = 0;
            const tick: PriceTick = {
              symbol,
              exchange,
              price: ticker.last || ticker.close || 0,
              bid: ticker.bid || 0,
              ask: ticker.ask || 0,
              volume: ticker.baseVolume || 0,
              timestamp: ticker.timestamp || Date.now(),
            };

            this.distributeTick(key, tick);
          } catch (error: any) {
            failCount++;
            console.warn(`[BotScheduler] WebSocket error for ${key} (${failCount}/${MAX_FAILS}):`, error.message);

            if (failCount >= MAX_FAILS) {
              console.log(`[BotScheduler] WebSocket failed for ${key}, falling back to polling`);
              if (connected) {
                this.wsConnections.delete(key);
                this.stats.wsConnections = Math.max(0, this.stats.wsConnections - 1);
              }
              return; // Exit loop, let polling take over
            }

            if (this.isRunning) {
              await this.sleep(2000);
            }
          }
        }
      };

      watchLoop().catch((err) => {
        console.error(`[BotScheduler] Watch loop crashed for ${key}:`, err);
      });

    } catch (error) {
      console.error(`[BotScheduler] Failed to start WebSocket for ${key}:`, error);
    }
  }

  private closeWebSocket(exchange: string, symbol: string): void {
    const key = this.makeKey(exchange, symbol);
    this.wsConnections.delete(key);
    this.stats.wsConnections = Math.max(0, this.stats.wsConnections - 1);
  }

  private async pollPrices(): Promise<void> {
    if (!this.isRunning) return;

    // Poll ALL subscriptions - this ensures price updates even if WebSocket is flaky
    const toPoll: Array<{ exchange: string; symbol: string; key: string }> = [];

    for (const key of this.subscriptions.keys()) {
      const [exchange, symbol] = key.split(':');
      toPoll.push({ exchange, symbol, key });
    }

    if (toPoll.length === 0) return;

    // Poll in parallel
    await Promise.allSettled(
      toPoll.map(async ({ exchange, symbol, key }) => {
        try {
          const adapter = await this.getAdapter(exchange);
          if (!adapter) return;

          const ticker = await adapter.getTicker(symbol);
          const tick: PriceTick = {
            symbol,
            exchange,
            price: ticker.last || ticker.close || 0,
            bid: ticker.bid || 0,
            ask: ticker.ask || 0,
            volume: ticker.baseVolume || 0,
            timestamp: ticker.timestamp || Date.now(),
          };

          this.distributeTick(key, tick);
        } catch (error: any) {
          console.warn(`[BotScheduler] Poll failed for ${key}:`, error.message);
        }
      })
    );
  }

  private distributeTick(key: string, tick: PriceTick): void {
    this.priceCache.set(key, tick);
    this.stats.ticksProcessed++;

    const subs = this.subscriptions.get(key);
    if (!subs) return;

    for (const sub of subs) {
      try {
        sub.callback(tick);
      } catch (error) {
        console.error(`[BotScheduler] Error delivering tick to bot ${sub.botId}:`, error);
      }
    }
  }

  private async getAdapter(exchange: string): Promise<any> {
    if (this.adapters.has(exchange)) {
      return this.adapters.get(exchange);
    }

    try {
      const { getAdapter } = await import('../../arbitrage/dist/adapters/index.js');
      const adapter = await getAdapter(exchange);
      this.adapters.set(exchange, adapter);
      return adapter;
    } catch (error) {
      console.error(`[BotScheduler] Failed to get adapter for ${exchange}:`, error);
      return null;
    }
  }

  getLastPrice(exchange: string, symbol: string): PriceTick | undefined {
    return this.priceCache.get(this.makeKey(exchange, symbol));
  }

  getStats() {
    return {
      ...this.stats,
      subscriptionCount: this.subscriptions.size,
      cachedPrices: this.priceCache.size,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton
let schedulerInstance: BotScheduler | null = null;

export function getBotScheduler(): BotScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new BotScheduler();
  }
  return schedulerInstance;
}
