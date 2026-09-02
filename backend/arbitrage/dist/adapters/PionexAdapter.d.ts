import { BaseAdapter } from './IExchangeAdapter.js';
import type { OrderBook, Ticker, Balance, Order, OrderParams, OrderResult, Trade, ExchangeConfig, TickerCallback, OrderBookCallback, SubscriptionHandle, WithdrawalParams, WithdrawalResult, DepositAddress } from '../types/index.js';
export declare class PionexAdapter extends BaseAdapter {
    readonly exchangeName = "Pionex";
    private _isTestnet;
    private apiKey;
    private apiSecret;
    get isTestnet(): boolean;
    initialize(config: ExchangeConfig): Promise<void>;
    private createSignature;
    private buildQueryString;
    protected normalizeSymbol(symbol: string): string;
    private denormalizePionexSymbol;
    private request;
    getOrderBook(symbol: string, limit?: number): Promise<OrderBook>;
    getTicker(symbol: string): Promise<Ticker>;
    getTickers(symbols?: string[]): Promise<Ticker[]>;
    getMarkets(): Promise<any[]>;
    getBalance(): Promise<Balance[]>;
    placeOrder(params: OrderParams): Promise<OrderResult>;
    cancelOrder(orderId: string, symbol: string): Promise<void>;
    getOpenOrders(symbol?: string): Promise<Order[]>;
    getTradeHistory(symbol: string, limit?: number): Promise<Trade[]>;
    private mapOrderStatus;
    getDepositAddress(asset: string, network?: string): Promise<DepositAddress>;
    withdraw(params: WithdrawalParams): Promise<WithdrawalResult>;
    getWithdrawalFee(asset: string, network?: string): Promise<number>;
    subscribeTicker(symbol: string, callback: TickerCallback): SubscriptionHandle;
    subscribeOrderBook(symbol: string, callback: OrderBookCallback): SubscriptionHandle;
    close(): Promise<void>;
}
//# sourceMappingURL=PionexAdapter.d.ts.map