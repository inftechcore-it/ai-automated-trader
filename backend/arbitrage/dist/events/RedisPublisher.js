import { createClient } from 'redis';
const DEFAULT_CONFIG = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    retryAttempts: 3,
    retryDelayMs: 1000,
};
export const CHANNELS = {
    OPPORTUNITY_DETECTED: 'arbitrage:opportunity_detected',
    SCANNER_STATUS: 'arbitrage:scanner_status',
    EXECUTION_STARTED: 'arbitrage:execution_started',
    EXECUTION_COMPLETED: 'arbitrage:execution_completed',
};
export class RedisPublisher {
    client = null;
    config;
    connected = false;
    connecting = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    async connect() {
        if (this.connected || this.connecting)
            return;
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
        }
        catch (error) {
            console.error('[RedisPublisher] Failed to connect:', error);
            this.connected = false;
            throw error;
        }
        finally {
            this.connecting = false;
        }
    }
    async publish(channel, payload) {
        if (!this.connected || !this.client) {
            console.warn('[RedisPublisher] Not connected, attempting reconnect...');
            try {
                await this.connect();
            }
            catch {
                return false;
            }
        }
        let attempts = 0;
        while (attempts < this.config.retryAttempts) {
            try {
                const message = JSON.stringify(payload);
                await this.client.publish(channel, message);
                return true;
            }
            catch (error) {
                attempts++;
                console.error(`[RedisPublisher] Publish failed (attempt ${attempts}/${this.config.retryAttempts}):`, error);
                if (attempts < this.config.retryAttempts) {
                    await this.delay(this.config.retryDelayMs);
                }
            }
        }
        return false;
    }
    async publishOpportunity(opportunity) {
        return this.publish(CHANNELS.OPPORTUNITY_DETECTED, {
            ...opportunity,
            timestamp: Date.now(),
        });
    }
    async publishScannerStatus(status) {
        return this.publish(CHANNELS.SCANNER_STATUS, {
            ...status,
            timestamp: Date.now(),
        });
    }
    isConnected() {
        return this.connected;
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async disconnect() {
        if (this.client) {
            try {
                await this.client.quit();
            }
            catch (error) {
                console.error('[RedisPublisher] Disconnect error:', error);
            }
            finally {
                this.client = null;
                this.connected = false;
            }
        }
    }
}
export function createRedisPublisher(config) {
    return new RedisPublisher(config);
}
