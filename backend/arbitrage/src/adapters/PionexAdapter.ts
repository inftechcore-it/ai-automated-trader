import crypto from 'crypto';
import axios from 'axios';
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
  ExchangeConfig,
  OrderStatusType,
  TickerCallback,
  OrderBookCallback,
  SubscriptionHandle,
  WithdrawalParams,
  WithdrawalResult,
  DepositAddress,
} from '../types/index.js';

const PIONEX_BASE_URL = 'https://api.pionex.com';

export class PionexAdapter extends BaseAdapter {
  readonly exchangeName = 'Pionex';
  private _isTestnet = false;
  private apiKey: string | undefined;
  private apiSecret: string | undefined;

  get isTestnet(): boolean {
    return this._isTestnet;
  }

  async initialize(config: ExchangeConfig): Promise<void> {
    this._isTestnet = config.testnet;

    this.apiKey = config.apiKey
      ? (isEncrypted(config.apiKey) ? decrypt(config.apiKey) : config.apiKey)
      : undefined;
    this.apiSecret = config.apiSecret
      ? (isEncrypted(config.apiSecret) ? decrypt(config.apiSecret) : config.apiSecret)
      : undefined;
  }

  private createSignature(method: string, path: string, queryString: string, body: any): string {
    if (!this.apiSecret) throw new AdapterError(this.exchangeName, 'API secret not configured', 'AUTH_ERROR');

    let signatureBase = method.toUpperCase() + path;
    if (queryString) {
      signatureBase += '?' + queryString;
    }
    if (body) {
      signatureBase += JSON.stringify(body);
    }
    return crypto.createHmac('sha256', this.apiSecret).update(signatureBase).digest('hex');
  }

  private buildQueryString(params: Record<string, any>): string {
    const sorted = Object.keys(params).sort();
    return sorted.map(key => `${key}=${params[key]}`).join('&');
  }

  protected override normalizeSymbol(symbol: string): string {
    return symbol.replace('/', '_').toUpperCase();
  }

  private denormalizePionexSymbol(symbol: string): string {
    return symbol.replace('_', '/');
  }

  private async request(method: string, path: string, params: Record<string, any> = {}, body?: any): Promise<any> {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };
    const queryString = this.buildQueryString(queryParams);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey && this.apiSecret) {
      headers['PIONEX-KEY'] = this.apiKey;
      headers['PIONEX-SIGNATURE'] = this.createSignature(method, path, queryString, body);
    }

    try {
      const url = `${PIONEX_BASE_URL}${path}?${queryString}`;
      const response = await axios({
        method,
        url,
        headers,
        data: body,
        timeout: 15000,
      });

      if (!response.data.result) {
        throw new Error(response.data.message || 'Request failed');
      }

      return response.data.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message;
      throw new AdapterError(this.exchangeName, message, error.response?.data?.code || 'API_ERROR');
    }
  }

  async getOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
    try {
      const data = await this.request('GET', '/api/v1/market/depth', {
        symbol: this.normalizeSymbol(symbol),
        limit,
      });

      return {
        symbol,
        exchange: this.exchangeName,
        bids: (data.bids || []).map(([price, amount]: [string, string]) => ({
          price: parseFloat(price),
          amount: parseFloat(amount),
        })),
        asks: (data.asks || []).map(([price, amount]: [string, string]) => ({
          price: parseFloat(price),
          amount: parseFloat(amount),
        })),
        timestamp: data.updateTime || Date.now(),
      };
    } catch (error: any) {
      throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const pionexSymbol = this.normalizeSymbol(symbol);
      const response = await axios.get(`${PIONEX_BASE_URL}/api/v1/market/tickers`, {
        params: { symbol: pionexSymbol },
        timeout: 5000,
      });

      if (!response.data.result || !response.data.data?.tickers?.length) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      const ticker = response.data.data.tickers[0];
      return {
        symbol,
        exchange: this.exchangeName,
        bid: parseFloat(ticker.close) * 0.999, // Approximate
        ask: parseFloat(ticker.close) * 1.001, // Approximate
        last: parseFloat(ticker.close),
        high: parseFloat(ticker.high),
        low: parseFloat(ticker.low),
        open: parseFloat(ticker.open),
        close: parseFloat(ticker.close),
        change: parseFloat(ticker.close) - parseFloat(ticker.open),
        changePercent: ((parseFloat(ticker.close) - parseFloat(ticker.open)) / parseFloat(ticker.open)) * 100,
        volume: parseFloat(ticker.volume),
        quoteVolume: parseFloat(ticker.amount),
        timestamp: ticker.time || Date.now(),
      };
    } catch (error: any) {
      throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
    }
  }

  async getTickers(symbols?: string[]): Promise<Ticker[]> {
    try {
      const response = await axios.get(`${PIONEX_BASE_URL}/api/v1/market/tickers`, {
        timeout: 10000,
      });

      if (!response.data.result) {
        throw new Error('Failed to fetch tickers');
      }

      let tickers = response.data.data.tickers;

      if (symbols) {
        const normalizedSymbols = new Set(symbols.map(s => this.normalizeSymbol(s)));
        tickers = tickers.filter((t: any) => normalizedSymbols.has(t.symbol));
      }

      return tickers.map((ticker: any) => ({
        symbol: this.denormalizePionexSymbol(ticker.symbol),
        exchange: this.exchangeName,
        bid: parseFloat(ticker.close) * 0.999,
        ask: parseFloat(ticker.close) * 1.001,
        last: parseFloat(ticker.close),
        high: parseFloat(ticker.high),
        low: parseFloat(ticker.low),
        open: parseFloat(ticker.open),
        close: parseFloat(ticker.close),
        change: parseFloat(ticker.close) - parseFloat(ticker.open),
        changePercent: ((parseFloat(ticker.close) - parseFloat(ticker.open)) / parseFloat(ticker.open)) * 100,
        volume: parseFloat(ticker.volume),
        quoteVolume: parseFloat(ticker.amount),
        timestamp: ticker.time || Date.now(),
      }));
    } catch (error: any) {
      throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
    }
  }

  async getBalance(): Promise<Balance[]> {
    try {
      const data = await this.request('GET', '/api/v1/account/balances');

      return (data.balances || [])
        .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.frozen) > 0)
        .map((b: any) => ({
          asset: b.coin,
          free: parseFloat(b.free),
          locked: parseFloat(b.frozen),
          total: parseFloat(b.free) + parseFloat(b.frozen),
        }));
    } catch (error: any) {
      throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
    }
  }

  async placeOrder(params: OrderParams): Promise<OrderResult> {
    try {
      const body: any = {
        symbol: this.normalizeSymbol(params.symbol),
        side: params.side.toUpperCase(),
        type: params.type.toUpperCase(),
      };

      if (params.type === 'limit') {
        body.size = params.quantity.toString();
        body.price = params.price?.toString();
      } else if (params.type === 'market') {
        if (params.side === 'buy') {
          body.amount = ((params.quantity * (params.price || 0)) || params.quantity).toString();
        } else {
          body.size = params.quantity.toString();
        }
      }

      if (params.clientOrderId) {
        body.clientOrderId = params.clientOrderId;
      }

      const data = await this.request('POST', '/api/v1/trade/order', {}, body);

      return {
        orderId: data.orderId,
        clientOrderId: data.clientOrderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        status: 'open' as OrderStatusType,
        quantity: params.quantity,
        filledQuantity: 0,
        price: params.price,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
    }
  }

  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    try {
      const body = {
        symbol: this.normalizeSymbol(symbol),
        orderId,
      };

      await this.request('DELETE', '/api/v1/trade/order', {}, body);
    } catch (error: any) {
      throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const params: Record<string, any> = {};
      if (symbol) {
        params.symbol = this.normalizeSymbol(symbol);
      }

      const data = await this.request('GET', '/api/v1/trade/openOrders', params);

      return (data.orders || []).map((order: any) => ({
        orderId: order.orderId,
        clientOrderId: order.clientOrderId,
        symbol: this.denormalizePionexSymbol(order.symbol),
        side: order.side.toLowerCase() as 'buy' | 'sell',
        type: order.type.toLowerCase(),
        status: this.mapOrderStatus(order.status),
        quantity: parseFloat(order.size),
        filledQuantity: parseFloat(order.filledSize) || 0,
        price: parseFloat(order.price) || undefined,
        avgFillPrice: order.filledAmount && order.filledSize
          ? parseFloat(order.filledAmount) / parseFloat(order.filledSize)
          : undefined,
        createdAt: order.createTime || 0,
        updatedAt: order.updateTime || order.createTime || 0,
      }));
    } catch (error: any) {
      throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
    }
  }

  async getTradeHistory(symbol: string, limit: number = 100): Promise<Trade[]> {
    try {
      const data = await this.request('GET', '/api/v1/trade/fills', {
        symbol: this.normalizeSymbol(symbol),
      });

      return (data.fills || []).slice(0, limit).map((fill: any) => ({
        tradeId: fill.id,
        orderId: fill.orderId,
        symbol: this.denormalizePionexSymbol(fill.symbol),
        side: fill.side.toLowerCase() as 'buy' | 'sell',
        quantity: parseFloat(fill.size),
        price: parseFloat(fill.price),
        fee: parseFloat(fill.fee) || 0,
        feeAsset: fill.feeCurrency || '',
        timestamp: fill.createTime || Date.now(),
      }));
    } catch (error: any) {
      throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
    }
  }

  private mapOrderStatus(status: string): OrderStatusType {
    const statusMap: Record<string, OrderStatusType> = {
      'OPEN': 'open',
      'PARTIALLY_FILLED': 'partially_filled',
      'FILLED': 'filled',
      'CANCELED': 'cancelled',
      'CANCELLED': 'cancelled',
      'REJECTED': 'rejected',
    };
    return statusMap[status?.toUpperCase()] || 'open';
  }

  async getDepositAddress(asset: string, network?: string): Promise<DepositAddress> {
    throw new AdapterError(this.exchangeName, 'Deposit address not supported via API', 'NOT_SUPPORTED');
  }

  async withdraw(params: WithdrawalParams): Promise<WithdrawalResult> {
    throw new AdapterError(this.exchangeName, 'Withdrawal not supported via API', 'NOT_SUPPORTED');
  }

  async getWithdrawalFee(asset: string, network?: string): Promise<number> {
    throw new AdapterError(this.exchangeName, 'Withdrawal fee lookup not supported', 'NOT_SUPPORTED');
  }

  subscribeTicker(symbol: string, callback: TickerCallback): SubscriptionHandle {
    // WebSocket not implemented - return dummy handle
    return { unsubscribe: () => {} };
  }

  subscribeOrderBook(symbol: string, callback: OrderBookCallback): SubscriptionHandle {
    // WebSocket not implemented - return dummy handle
    return { unsubscribe: () => {} };
  }

  async close(): Promise<void> {
    // Clean up any resources
  }
}
