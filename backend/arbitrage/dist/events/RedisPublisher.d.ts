export interface PublisherConfig {
    url: string;
    retryAttempts: number;
    retryDelayMs: number;
}
export declare const CHANNELS: {
    readonly OPPORTUNITY_DETECTED: "arbitrage:opportunity_detected";
    readonly SCANNER_STATUS: "arbitrage:scanner_status";
    readonly EXECUTION_STARTED: "arbitrage:execution_started";
    readonly EXECUTION_COMPLETED: "arbitrage:execution_completed";
};
export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];
export declare class RedisPublisher {
    private client;
    private config;
    private connected;
    private connecting;
    constructor(config?: Partial<PublisherConfig>);
    connect(): Promise<void>;
    publish<T>(channel: ChannelName | string, payload: T): Promise<boolean>;
    publishOpportunity(opportunity: {
        id: string;
        type: string;
        symbols: string[];
        exchanges: string[];
        spreadPercent: number;
        netProfit: number;
        detectedAt: Date;
    }): Promise<boolean>;
    publishScannerStatus(status: {
        status: 'running' | 'stopped' | 'error' | 'initializing';
        cyclesScanned: number;
        opportunitiesFound: number;
        lastScanDurationMs?: number;
    }): Promise<boolean>;
    isConnected(): boolean;
    private delay;
    disconnect(): Promise<void>;
}
export declare function createRedisPublisher(config?: Partial<PublisherConfig>): RedisPublisher;
//# sourceMappingURL=RedisPublisher.d.ts.map