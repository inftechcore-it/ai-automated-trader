import type { IExchangeAdapter } from './IExchangeAdapter.js';
declare class AdapterFactory {
    private prisma;
    private adapters;
    private initPromises;
    constructor();
    getAdapter(exchangeName: string): Promise<IExchangeAdapter>;
    private createAdapter;
    private loadExchangeConfig;
    closeAdapter(exchangeName: string): Promise<void>;
    closeAll(): Promise<void>;
    getSupportedExchanges(): string[];
    isSupported(exchangeName: string): boolean;
    isInitialized(exchangeName: string): boolean;
}
export declare const adapterFactory: AdapterFactory;
export declare function getAdapter(exchangeName: string): Promise<IExchangeAdapter>;
export declare function closeAdapter(exchangeName: string): Promise<void>;
export declare function closeAllAdapters(): Promise<void>;
export declare function getSupportedExchanges(): string[];
export declare function isExchangeSupported(exchangeName: string): boolean;
export declare function getAdapters(exchangeNames: string[]): Promise<Map<string, IExchangeAdapter>>;
export {};
//# sourceMappingURL=AdapterFactory.d.ts.map