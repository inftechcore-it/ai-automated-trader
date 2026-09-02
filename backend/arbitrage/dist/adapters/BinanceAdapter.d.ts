import { BaseAdapter } from './IExchangeAdapter.js';
import type { OrderBook, Ticker, Balance, Order, OrderParams, OrderResult, Trade, TickerCallback, OrderBookCallback, SubscriptionHandle, ExchangeConfig, WithdrawalParams, WithdrawalResult, DepositAddress } from '../types/index.js';
export declare class BinanceAdapter extends BaseAdapter {
    readonly exchangeName = "Binance";
    private _isTestnet;
    private exchange;
    get isTestnet(): boolean;
    initialize(config: ExchangeConfig): Promise<void>;
    private ensureInitialized;
    getOrderBook(symbol: string, limit?: number): Promise<OrderBook>;
    getTicker(symbol: string): Promise<Ticker>;
    getTickers(symbols?: string[]): Promise<Ticker[]>;
    getBalance(): Promise<Balance[]>;
    placeOrder(params: OrderParams): Promise<OrderResult>;
    cancelOrder(orderId: string, symbol: string): Promise<void>;
    getOpenOrders(symbol?: string): Promise<Order[]>;
    getTradeHistory(symbol: string, limit?: number): Promise<Trade[]>;
    getDepositAddress(asset: string, network?: string): Promise<DepositAddress>;
    withdraw(params: WithdrawalParams): Promise<WithdrawalResult>;
    getWithdrawalFee(asset: string, network?: string): Promise<number>;
    subscribeTicker(symbol: string, callback: TickerCallback): SubscriptionHandle;
    subscribeOrderBook(symbol: string, callback: OrderBookCallback): SubscriptionHandle;
    close(): Promise<void>;
    private mapOrderStatus;
}
//# sourceMappingURL=BinanceAdapter.d.ts.map