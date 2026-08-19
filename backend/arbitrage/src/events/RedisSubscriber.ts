import { createClient, RedisClientType } from 'redis';
import { CHANNELS, ChannelName } from './RedisPublisher.js';

export interface SubscriberConfig {
  url: string;
}

const DEFAULT_CONFIG: SubscriberConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

export type MessageHandler<T = unknown> = (payload: T, channel: string) => void;

export class RedisSubscriber {
  private client: RedisClientType | null = null;
  private config: SubscriberConfig;
  private connected: boolean = false;
  private handlers: Map<string, MessageHandler[]> = new Map();

  constructor(config: Partial<SubscriberConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      this.client = createClient({ url: this.config.url });

      this.client.on('error', (err) => {
        console.error('[RedisSubscriber] Connection error:', err.message);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('[RedisSubscriber] Connected to Redis');
        this.connected = true;
      });

      await this.client.connect();
      this.connected = true;
    } catch (error) {
      console.error('[RedisSubscriber] Failed to connect:', error);
      throw error;
    }
  }

  async subscribe<T = unknown>(
    channel: ChannelName | string,
    handler: MessageHandler<T>
  ): Promise<void> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, []);

      await this.client!.subscribe(channel, (message, receivedChannel) => {
        this.handleMessage(receivedChannel, message);
      });
    }

    this.handlers.get(channel)!.push(handler as MessageHandler);
    console.log(`[RedisSubscriber] Subscribed to ${channel}`);
  }

  private handleMessage(channel: string, message: string): void {
    const handlers = this.handlers.get(channel);
    if (!handlers || handlers.length === 0) return;

    let payload: unknown;

    try {
      payload = JSON.parse(message);
    } catch (error) {
      console.error(
        `[RedisSubscriber] Failed to parse message on ${channel}:`,
        message.substring(0, 100)
      );
      return;
    }

    for (const handler of handlers) {
      try {
        handler(payload, channel);
      } catch (error) {
        console.error(`[RedisSubscriber] Handler error on ${channel}:`, error);
      }
    }
  }

  async unsubscribe(channel: ChannelName | string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.unsubscribe(channel);
      this.handlers.delete(channel);
      console.log(`[RedisSubscriber] Unsubscribed from ${channel}`);
    } catch (error) {
      console.error(`[RedisSubscriber] Unsubscribe error:`, error);
    }
  }

  async subscribeToOpportunities(
    handler: MessageHandler<{
      id: string;
      type: string;
      symbols: string[];
      spreadPercent: number;
      netProfit: number;
      timestamp: number;
    }>
  ): Promise<void> {
    await this.subscribe(CHANNELS.OPPORTUNITY_DETECTED, handler);
  }

  async subscribeToScannerStatus(
    handler: MessageHandler<{
      status: string;
      cyclesScanned: number;
      opportunitiesFound: number;
      timestamp: number;
    }>
  ): Promise<void> {
    await this.subscribe(CHANNELS.SCANNER_STATUS, handler);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        console.error('[RedisSubscriber] Disconnect error:', error);
      } finally {
        this.client = null;
        this.connected = false;
        this.handlers.clear();
      }
    }
  }
}

export function createRedisSubscriber(config?: Partial<SubscriberConfig>): RedisSubscriber {
  return new RedisSubscriber(config);
}

export { CHANNELS };
