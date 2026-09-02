import { createClient } from 'redis';
import { CHANNELS } from './RedisPublisher.js';
const DEFAULT_CONFIG = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
};
export class RedisSubscriber {
    client = null;
    config;
    connected = false;
    handlers = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    async connect() {
        if (this.connected)
            return;
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
        }
        catch (error) {
            console.error('[RedisSubscriber] Failed to connect:', error);
            throw error;
        }
    }
    async subscribe(channel, handler) {
        if (!this.connected || !this.client) {
            await this.connect();
        }
        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, []);
            await this.client.subscribe(channel, (message, receivedChannel) => {
                this.handleMessage(receivedChannel, message);
            });
        }
        this.handlers.get(channel).push(handler);
        console.log(`[RedisSubscriber] Subscribed to ${channel}`);
    }
    handleMessage(channel, message) {
        const handlers = this.handlers.get(channel);
        if (!handlers || handlers.length === 0)
            return;
        let payload;
        try {
            payload = JSON.parse(message);
        }
        catch (error) {
            console.error(`[RedisSubscriber] Failed to parse message on ${channel}:`, message.substring(0, 100));
            return;
        }
        for (const handler of handlers) {
            try {
                handler(payload, channel);
            }
            catch (error) {
                console.error(`[RedisSubscriber] Handler error on ${channel}:`, error);
            }
        }
    }
    async unsubscribe(channel) {
        if (!this.client)
            return;
        try {
            await this.client.unsubscribe(channel);
            this.handlers.delete(channel);
            console.log(`[RedisSubscriber] Unsubscribed from ${channel}`);
        }
        catch (error) {
            console.error(`[RedisSubscriber] Unsubscribe error:`, error);
        }
    }
    async subscribeToOpportunities(handler) {
        await this.subscribe(CHANNELS.OPPORTUNITY_DETECTED, handler);
    }
    async subscribeToScannerStatus(handler) {
        await this.subscribe(CHANNELS.SCANNER_STATUS, handler);
    }
    isConnected() {
        return this.connected;
    }
    async disconnect() {
        if (this.client) {
            try {
                await this.client.quit();
            }
            catch (error) {
                console.error('[RedisSubscriber] Disconnect error:', error);
            }
            finally {
                this.client = null;
                this.connected = false;
                this.handlers.clear();
            }
        }
    }
}
export function createRedisSubscriber(config) {
    return new RedisSubscriber(config);
}
export { CHANNELS };
