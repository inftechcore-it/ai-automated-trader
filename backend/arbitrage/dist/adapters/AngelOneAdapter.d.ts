import { BaseAdapter } from './IExchangeAdapter.js';
import type { OrderBook, Ticker, Balance, Order, OrderParams, OrderResult, Trade, TickerCallback, OrderBookCallback, SubscriptionHandle, ExchangeConfig, WithdrawalParams, WithdrawalResult, DepositAddress } from '../types/index.js';
export declare class AngelOneAdapter extends BaseAdapter {
    readonly exchangeName = "AngelOne";
    private _isTestnet;
    private apiKey?;
    private clientCode?;
    private password?;
    private totpSecret?;
    private jwtToken?;
    private refreshToken?;
    private feedToken?;
    private scripMasterCache?;
    private scripMasterLastFetch;
    private pollingIntervals;
    get isTestnet(): boolean;
    initialize(config: ExchangeConfig): Promise<void>;
    private base32Decode;
    private generateTOTP;
    private ensureSession;
    private fetchScripMaster;
    getMarkets(): Promise<any[]>;
    getOrderBook(symbol: string, limit?: number): Promise<OrderBook>;
    getTicker(symbol: string): Promise<Ticker>;
    getTickers(symbols?: string[]): Promise<Ticker[]>;
    getBalance(): Promise<Balance[]>;
    resolveSymbolToken(symbol: string, exchange?: string): Promise<{
        token: string;
        tradingsymbol: string;
    }>;
    placeOrder(params: OrderParams): Promise<OrderResult>;
    cancelOrder(orderId: string, _symbol: string): Promise<void>;
    getOpenOrders(_symbol?: string): Promise<Order[]>;
    getTradeHistory(_symbol: string, _limit?: number): Promise<Trade[]>;
    getDepositAddress(asset: string, _network?: string): Promise<DepositAddress>;
    withdraw(_params: WithdrawalParams): Promise<WithdrawalResult>;
    getWithdrawalFee(_asset: string, _network?: string): Promise<number>;
    subscribeTicker(symbol: string, callback: TickerCallback): SubscriptionHandle;
    subscribeOrderBook(symbol: string, callback: OrderBookCallback): SubscriptionHandle;
    close(): Promise<void>;
}
//# sourceMappingURL=AngelOneAdapter.d.ts.map