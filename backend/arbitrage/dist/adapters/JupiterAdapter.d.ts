import { BaseAdapter } from './IExchangeAdapter.js';
import type { OrderBook, Ticker, Balance, Order, OrderParams, OrderResult, Trade, ExchangeConfig, TickerCallback, OrderBookCallback, SubscriptionHandle, WithdrawalParams, WithdrawalResult, DepositAddress } from '../types/index.js';
export declare class JupiterAdapter extends BaseAdapter {
    readonly exchangeName = "Jupiter";
    private _isTestnet;
    private apiKey;
    get isTestnet(): boolean;
    initialize(config: ExchangeConfig): Promise<void>;
    private getHeaders;
    protected normalizeSymbol(symbol: string): string;
    private resolveMint;
    getMarkets(): Promise<string[]>;
    getTicker(symbol: string): Promise<Ticker>;
    getTickers(symbols?: string[]): Promise<Ticker[]>;
    getOrderBook(symbol: string, depth?: number): Promise<OrderBook>;
    getBalance(): Promise<Balance[]>;
    placeOrder(params: OrderParams): Promise<OrderResult>;
    cancelOrder(orderId: string, symbol: string): Promise<boolean>;
    getOrder(orderId: string, symbol: string): Promise<Order>;
    getOpenOrders(symbol?: string): Promise<Order[]>;
    getTrades(symbol: string, limit?: number): Promise<Trade[]>;
    getDepositAddress(asset: string): Promise<DepositAddress>;
    withdraw(params: WithdrawalParams): Promise<WithdrawalResult>;
    subscribeTicker(symbol: string, callback: TickerCallback): SubscriptionHandle;
    subscribeOrderBook(symbol: string, callback: OrderBookCallback): SubscriptionHandle;
}
//# sourceMappingURL=JupiterAdapter.d.ts.map