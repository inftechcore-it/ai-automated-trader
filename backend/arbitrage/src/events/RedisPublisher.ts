import { createClient, RedisClientType } from 'redis';

export interface PublisherConfig {
  url: string;
  retryAttempts: number;
  retryDelayMs: number;
}

const DEFAULT_CONFIG: PublisherConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retryAttempts: 3,
  retryDelayMs: 1000,
};

export const CHANNELS = {
  OPPORTUNITY_DETECTED: 'arbitrage:opportunity_detected',
  SCANNER_STATUS: 'arbitrage:scanner_status',
  EXECUTION_STARTED: 'arbitrage:execution_started',
  EXECUTION_COMPLETED: 'arbitrage:execution_completed',
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

export class RedisPublisher {
  private client: RedisClientType | null = null;
  private config: PublisherConfig;
  private connected: boolean = false;
  private connecting: boolean = false;

  constructor(config: Partial<PublisherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    this.connecting = true;

    try {
      this.client = createClient({ url: this.config.url });

      this.client.on('error', (err) => {
        console.error('[RedisPublisher] Connection error:', err.message);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('[RedisPublisher] Connected to Redis');
        this.connected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('[RedisPublisher] Reconnecting to Redis...');
      });

      await this.client.connect();
      this.connected = true;
    } catch (error) {
      console.error('[RedisPublisher] Failed to connect:', error);
      this.connected = false;
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  async publish<T>(channel: ChannelName | string, payload: T): Promise<boolean> {
    if (!this.connected || !this.client) {
      console.warn('[RedisPublisher] Not connected, attempting reconnect...');
      try {
        await this.connect();
      } catch {
        return false;
      }
    }

    let attempts = 0;

    while (attempts < this.config.retryAttempts) {
      try {
        const message = JSON.stringify(payload);
        await this.client!.publish(channel, message);
        return true;
      } catch (error) {
        attempts++;
        console.error(
          `[RedisPublisher] Publish failed (attempt ${attempts}/${this.config.retryAttempts}):`,
          error
        );

        if (attempts < this.config.retryAttempts) {
          await this.delay(this.config.retryDelayMs);
        }
      }
    }

    return false;
  }

  async publishOpportunity(opportunity: {
    id: string;
    type: string;
    symbols: string[];
    exchanges: string[];
    spreadPercent: number;
    netProfit: number;
    detectedAt: Date;
  }): Promise<boolean> {
    return this.publish(CHANNELS.OPPORTUNITY_DETECTED, {
      ...opportunity,
      timestamp: Date.now(),
    });
  }

  async publishScannerStatus(status: {
    status: 'running' | 'stopped' | 'error' | 'initializing';
    cyclesScanned: number;
    opportunitiesFound: number;
    lastScanDurationMs?: number;
  }): Promise<boolean> {
    return this.publish(CHANNELS.SCANNER_STATUS, {
      ...status,
      timestamp: Date.now(),
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        console.error('[RedisPublisher] Disconnect error:', error);
      } finally {
        this.client = null;
        this.connected = false;
      }
    }
  }
}

export function createRedisPublisher(config?: Partial<PublisherConfig>): RedisPublisher {
  return new RedisPublisher(config);
}
