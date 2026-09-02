import { CHANNELS, ChannelName } from './RedisPublisher.js';
export interface SubscriberConfig {
    url: string;
}
export type MessageHandler<T = unknown> = (payload: T, channel: string) => void;
export declare class RedisSubscriber {
    private client;
    private config;
    private connected;
    private handlers;
    constructor(config?: Partial<SubscriberConfig>);
    connect(): Promise<void>;
    subscribe<T = unknown>(channel: ChannelName | string, handler: MessageHandler<T>): Promise<void>;
    private handleMessage;
    unsubscribe(channel: ChannelName | string): Promise<void>;
    subscribeToOpportunities(handler: MessageHandler<{
        id: string;
        type: string;
        symbols: string[];
        spreadPercent: number;
        netProfit: number;
        timestamp: number;
    }>): Promise<void>;
    subscribeToScannerStatus(handler: MessageHandler<{
        status: string;
        cyclesScanned: number;
        opportunitiesFound: number;
        timestamp: number;
    }>): Promise<void>;
    isConnected(): boolean;
    disconnect(): Promise<void>;
}
export declare function createRedisSubscriber(config?: Partial<SubscriberConfig>): RedisSubscriber;
export { CHANNELS };
//# sourceMappingURL=RedisSubscriber.d.ts.map