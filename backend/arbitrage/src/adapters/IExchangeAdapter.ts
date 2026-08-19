import type {
  OrderBook,
  Ticker,
  Balance,
  Order,
  OrderParams,
  OrderResult,
  Trade,
  TickerCallback,
  OrderBookCallback,
  SubscriptionHandle,
  ExchangeConfig,
  WithdrawalParams,
  WithdrawalResult,
  DepositAddress,
} from '../types/index.js';

export interface IExchangeAdapter {
  readonly exchangeName: string;
  readonly isTestnet: boolean;

  initialize(config: ExchangeConfig): Promise<void>;

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
}

export abstract class BaseAdapter implements IExchangeAdapter {
  abstract readonly exchangeName: string;
  abstract readonly isTestnet: boolean;

  abstract initialize(config: ExchangeConfig): Promise<void>;
  abstract getOrderBook(symbol: string, limit?: number): Promise<OrderBook>;
  abstract getTicker(symbol: string): Promise<Ticker>;
  abstract getTickers(symbols?: string[]): Promise<Ticker[]>;
  abstract getBalance(): Promise<Balance[]>;
  abstract placeOrder(params: OrderParams): Promise<OrderResult>;
  abstract cancelOrder(orderId: string, symbol: string): Promise<void>;
  abstract getOpenOrders(symbol?: string): Promise<Order[]>;
  abstract getTradeHistory(symbol: string, limit?: number): Promise<Trade[]>;
  abstract getDepositAddress(asset: string, network?: string): Promise<DepositAddress>;
  abstract withdraw(params: WithdrawalParams): Promise<WithdrawalResult>;
  abstract getWithdrawalFee(asset: string, network?: string): Promise<number>;
  abstract subscribeTicker(symbol: string, callback: TickerCallback): SubscriptionHandle;
  abstract subscribeOrderBook(symbol: string, callback: OrderBookCallback): SubscriptionHandle;
  abstract close(): Promise<void>;

  protected normalizeSymbol(symbol: string): string {
    return symbol.replace('/', '').toUpperCase();
  }

  protected toUnifiedSymbol(symbol: string): string {
    const match = symbol.match(/^([A-Z]+)(USDT|BUSD|BTC|ETH|USD)$/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return symbol;
  }
}
