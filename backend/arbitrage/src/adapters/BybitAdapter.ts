import ccxt from 'ccxt';
import { BaseAdapter } from './IExchangeAdapter.js';
import { AdapterError } from '../utils/errors.js';
import { decrypt, isEncrypted } from '../utils/encryption.js';
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
  OrderStatusType,
  WithdrawalParams,
  WithdrawalResult,
  DepositAddress,
} from '../types/index.js';

const BYBIT_TESTNET_REST = 'https://api-testnet.bybit.com';

export class BybitAdapter extends BaseAdapter {
  readonly exchangeName = 'Bybit';
  private _isTestnet = true;
  private exchange: any = null;
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map();

  get isTestnet(): boolean {
    return this._isTestnet;
  }

  async initialize(config: ExchangeConfig): Promise<void> {
    this._isTestnet = config.testnet;

    const apiKey = config.apiKey
      ? (isEncrypted(config.apiKey) ? decrypt(config.apiKey) : config.apiKey)
      : undefined;
    const apiSecret = config.apiSecret
      ? (isEncrypted(config.apiSecret) ? decrypt(config.apiSecret) : config.apiSecret)
      : undefined;

    const options: any = {
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: config.type === 'futures' ? 'linear' : 'spot',
        adjustForTimeDifference: true,
      },
    };

    if (this._isTestnet) {
      options.urls = {
        api: {
          public: BYBIT_TESTNET_REST,
          private: BYBIT_TESTNET_REST,
        },
      };
    }

    this.exchange = new ccxt.bybit(options);

    if (this._isTestnet) {
      this.exchange.setSandboxMode(true);
    }

    try {
      await this.exchange.loadMarkets();
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  private ensureInitialized(): any {
    if (!this.exchange) {
      throw new AdapterError(
        this.exchangeName,
        'Adapter not initialized. Call initialize() first.',
        'NOT_INITIALIZED'
      );
    }
    return this.exchange;
  }

  async getOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
    const exchange = this.ensureInitialized();

    try {
      const orderBook = await exchange.fetchOrderBook(symbol, limit);

      return {
        symbol,
        exchange: this.exchangeName,
        bids: orderBook.bids.map(([price, amount]) => ({ price, amount })),
        asks: orderBook.asks.map(([price, amount]) => ({ price, amount })),
        timestamp: orderBook.timestamp || Date.now(),
        nonce: orderBook.nonce,
      };
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const exchange = this.ensureInitialized();

    try {
      const ticker = await exchange.fetchTicker(symbol);

      return {
        symbol,
        exchange: this.exchangeName,
        bid: ticker.bid ?? 0,
        bidVolume: ticker.bidVolume,
        ask: ticker.ask ?? 0,
        askVolume: ticker.askVolume,
        last: ticker.last ?? 0,
        high: ticker.high ?? 0,
        low: ticker.low ?? 0,
        open: ticker.open,
        close: ticker.close,
        change: ticker.change,
        changePercent: ticker.percentage,
        volume: ticker.baseVolume ?? 0,
        quoteVolume: ticker.quoteVolume,
        timestamp: ticker.timestamp || Date.now(),
      };
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async getTickers(symbols?: string[]): Promise<Ticker[]> {
    const exchange = this.ensureInitialized();

    try {
      const tickers = await exchange.fetchTickers(symbols);
      return Object.values(tickers).map((ticker: any) => ({
        symbol: ticker.symbol,
        exchange: this.exchangeName,
        bid: ticker.bid ?? 0,
        bidVolume: ticker.bidVolume,
        ask: ticker.ask ?? 0,
        askVolume: ticker.askVolume,
        last: ticker.last ?? 0,
        high: ticker.high ?? 0,
        low: ticker.low ?? 0,
        open: ticker.open,
        close: ticker.close,
        change: ticker.change,
        changePercent: ticker.percentage,
        volume: ticker.baseVolume ?? 0,
        quoteVolume: ticker.quoteVolume,
        timestamp: ticker.timestamp || Date.now(),
      }));
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async getBalance(): Promise<Balance[]> {
    const exchange = this.ensureInitialized();

    try {
      const balance = await exchange.fetchBalance();
      const balances: Balance[] = [];

      for (const [asset, data] of Object.entries(balance.total)) {
        const total = data as number;
        if (total > 0) {
          const free = (balance.free[asset] as number) || 0;
          const locked = (balance.used[asset] as number) || 0;
          balances.push({ asset, free, locked, total });
        }
      }

      return balances;
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async placeOrder(params: OrderParams): Promise<OrderResult> {
    const exchange = this.ensureInitialized();

    try {
      const orderTypeMap: Record<string, string> = {
        market: 'market',
        limit: 'limit',
        stop_loss: 'Stop',
        stop_limit: 'StopLimit',
        take_profit: 'TakeProfit',
      };

      const ccxtParams: any = {};
      if (params.timeInForce) {
        ccxtParams.timeInForce = params.timeInForce;
      }
      if (params.stopPrice) {
        ccxtParams.triggerPrice = params.stopPrice;
      }
      if (params.clientOrderId) {
        ccxtParams.orderLinkId = params.clientOrderId;
      }
      if (params.reduceOnly) {
        ccxtParams.reduceOnly = params.reduceOnly;
      }

      const order = await exchange.createOrder(
        params.symbol,
        orderTypeMap[params.type] || params.type,
        params.side,
        params.quantity,
        params.price,
        ccxtParams
      );

      return {
        orderId: order.id,
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        type: order.type,
        status: this.mapOrderStatus(order.status),
        quantity: order.amount,
        filledQuantity: order.filled || 0,
        price: order.price,
        avgFillPrice: order.average,
        timestamp: order.timestamp || Date.now(),
      };
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    const exchange = this.ensureInitialized();

    try {
      await exchange.cancelOrder(orderId, symbol);
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const exchange = this.ensureInitialized();

    try {
      const orders = await exchange.fetchOpenOrders(symbol);

      return orders.map((order) => ({
        orderId: order.id,
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        type: order.type,
        status: this.mapOrderStatus(order.status),
        quantity: order.amount,
        filledQuantity: order.filled || 0,
        price: order.price,
        avgFillPrice: order.average,
        stopPrice: order.stopPrice,
        createdAt: order.timestamp || 0,
        updatedAt: order.lastTradeTimestamp || order.timestamp || 0,
      }));
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async getTradeHistory(symbol: string, limit: number = 100): Promise<Trade[]> {
    const exchange = this.ensureInitialized();

    try {
      const trades = await exchange.fetchMyTrades(symbol, undefined, limit);

      return trades.map((trade) => ({
        tradeId: trade.id,
        orderId: trade.order || '',
        symbol: trade.symbol,
        side: trade.side as 'buy' | 'sell',
        quantity: trade.amount,
        price: trade.price,
        fee: trade.fee?.cost || 0,
        feeAsset: trade.fee?.currency || '',
        timestamp: trade.timestamp,
      }));
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async getDepositAddress(asset: string, network?: string): Promise<DepositAddress> {
    const exchange = this.ensureInitialized();

    try {
      const params: any = {};
      if (network) {
        params.network = network;
      }

      const address = await exchange.fetchDepositAddress(asset, params);

      return {
        asset,
        network: network || 'default',
        address: address.address,
        tag: address.tag,
        exchange: this.exchangeName,
      };
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async withdraw(params: WithdrawalParams): Promise<WithdrawalResult> {
    const exchange = this.ensureInitialized();

    try {
      const ccxtParams: any = {};
      if (params.network) {
        ccxtParams.network = params.network;
      }

      const result = await exchange.withdraw(
        params.asset,
        params.amount,
        params.address,
        params.tag,
        ccxtParams
      );

      return {
        withdrawalId: result.id,
        asset: params.asset,
        amount: params.amount,
        address: params.address,
        network: params.network,
        fee: result.fee?.cost || 0,
        status: 'pending',
        timestamp: Date.now(),
      };
    } catch (error) {
      throw AdapterError.fromCCXTError(this.exchangeName, error);
    }
  }

  async getWithdrawalFee(asset: string, network?: string): Promise<number> {
    const exchange = this.ensureInitialized();

    try {
      const currencies = await exchange.fetchCurrencies();
      const currency = currencies[asset];

      if (currency && currency.fee) {
        return currency.fee;
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  subscribeTicker(symbol: string, callback: TickerCallback): SubscriptionHandle {
    return { unsubscribe: () => {} };
  }

  subscribeOrderBook(symbol: string, callback: OrderBookCallback): SubscriptionHandle {
    return { unsubscribe: () => {} };
  }

  async close(): Promise<void> {
    for (const [key, interval] of this.pingIntervals) {
      clearInterval(interval);
      this.pingIntervals.delete(key);
    }

    if (this.exchange) {
      await this.exchange.close();
      this.exchange = null;
    }
  }

  private mapOrderStatus(status: string | undefined): OrderStatusType {
    const statusMap: Record<string, OrderStatusType> = {
      open: 'open',
      closed: 'filled',
      canceled: 'cancelled',
      expired: 'expired',
      rejected: 'rejected',
      New: 'open',
      Filled: 'filled',
      PartiallyFilled: 'partially_filled',
      Cancelled: 'cancelled',
      Rejected: 'rejected',
    };
    return statusMap[status || ''] || 'pending';
  }
}
