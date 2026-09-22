import crypto from 'crypto';
import axios from 'axios';
import { BaseAdapter } from './IExchangeAdapter.js';
import { AdapterError } from '../utils/errors.js';
import { decrypt, isEncrypted } from '../utils/encryption.js';
import type {
  OrderBook,
  OrderBookEntry,
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

const COINDCX_BASE_URL = 'https://api.coindcx.com';
const COINDCX_PUBLIC_URL = 'https://public.coindcx.com';

export class CoinDCXAdapter extends BaseAdapter {
  readonly exchangeName = 'CoinDCX';
  private _isTestnet = false;
  private apiKey: string | undefined;
  private apiSecret: string | undefined;
  private intervals: Set<NodeJS.Timeout> = new Set();

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

  private createSignature(body: Record<string, any>): string {
    if (!this.apiSecret) throw new AdapterError(this.exchangeName, 'API secret not configured', 'AUTH_ERROR');
    const payload = JSON.stringify(body);
    return crypto.createHmac('sha256', this.apiSecret).update(payload).digest('hex');
  }

  protected override normalizeSymbol(symbol: string): string {
    const clean = symbol.replace(/[-_]/g, '/').toUpperCase();
    const parts = clean.split('/');
    if (parts.length === 2) {
      const [base, quote] = parts;
      if (quote === 'USDT') return `B-${base}_USDT`;
      if (quote === 'INR') return `I-${base}_INR`;
      if (quote === 'USDC') return `B-${base}_USDC`;
      return `B-${base}_${quote}`;
    }
    return symbol;
  }

  private toMarketSymbol(symbol: string): string {
    return symbol.replace(/^[BI]-/, '').replace(/[/_]/g, '').toUpperCase();
  }

  protected override toUnifiedSymbol(symbol: string): string {
    if (symbol.includes('B-') || symbol.includes('I-')) {
      const clean = symbol.replace(/^[BI]-/, '');
      return clean.replace('_', '/');
    }
    const quotes = ['USDT', 'USDC', 'INR', 'BTC', 'ETH'];
    for (const q of quotes) {
      if (symbol.endsWith(q) && symbol.length > q.length) {
        return `${symbol.slice(0, symbol.length - q.length)}/${q}`;
      }
    }
    return symbol;
  }

  private async request(method: string, path: string, body: Record<string, any> = {}, isPublic = false): Promise<any> {
    const baseUrl = isPublic ? COINDCX_PUBLIC_URL : COINDCX_BASE_URL;
    const timestamp = Date.now();
    const payload = { ...body, timestamp };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!isPublic && this.apiKey && this.apiSecret) {
      headers['X-AUTH-APIKEY'] = this.apiKey;
      headers['X-AUTH-SIGNATURE'] = this.createSignature(payload);
    }

    try {
      const response = await axios({
        method,
        url: `${baseUrl}${path}`,
        headers,
        data: method.toUpperCase() === 'GET' ? undefined : payload,
        params: method.toUpperCase() === 'GET' ? body : undefined,
        timeout: 15000,
      });

      return response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Request failed';
      throw new AdapterError(this.exchangeName, errorMsg, error.response?.status?.toString() || 'NETWORK_ERROR');
    }
  }

  async getOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
    const pair = this.normalizeSymbol(symbol);
    try {
      const data = await this.request('GET', '/market_data/orderbook', { pair }, true);
      const bids: OrderBookEntry[] = [];
      const asks: OrderBookEntry[] = [];

      if (data.bids && typeof data.bids === 'object' && !Array.isArray(data.bids)) {
        Object.entries(data.bids).forEach(([p, q]) => bids.push({ price: parseFloat(p), amount: parseFloat(q as string) }));
        bids.sort((a, b) => b.price - a.price);
      } else if (Array.isArray(data.bids)) {
        data.bids.forEach((b: any) => bids.push({ price: parseFloat(b[0] || b.price), amount: parseFloat(b[1] || b.quantity) }));
      }

      if (data.asks && typeof data.asks === 'object' && !Array.isArray(data.asks)) {
        Object.entries(data.asks).forEach(([p, q]) => asks.push({ price: parseFloat(p), amount: parseFloat(q as string) }));
        asks.sort((a, b) => a.price - b.price);
      } else if (Array.isArray(data.asks)) {
        data.asks.forEach((a: any) => asks.push({ price: parseFloat(a[0] || a.price), amount: parseFloat(a[1] || a.quantity) }));
      }

      return {
        symbol: this.toUnifiedSymbol(symbol),
        exchange: this.exchangeName,
        timestamp: Date.now(),
        bids: bids.slice(0, limit),
        asks: asks.slice(0, limit),
      };
    } catch (error: any) {
      throw new AdapterError(this.exchangeName, `Failed to get orderbook: ${error.message}`);
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const market = this.toMarketSymbol(symbol);
    try {
      const tickers = await this.request('GET', '/exchange/ticker', {}, false);
      const ticker = Array.isArray(tickers) ? tickers.find((t: any) => t.market === market) : null;

      if (!ticker) {
        throw new AdapterError(this.exchangeName, `Ticker not found for ${symbol}`);
      }

      const lastPrice = parseFloat(ticker.last_price || 0);
      return {
        symbol: this.toUnifiedSymbol(symbol),
        exchange: this.exchangeName,
        timestamp: ticker.timestamp ? ticker.timestamp * 1000 : Date.now(),
        bid: parseFloat(ticker.bid || lastPrice),
        ask: parseFloat(ticker.ask || lastPrice),
        last: lastPrice,
        volume: parseFloat(ticker.volume || 0),
        high: parseFloat(ticker.high || lastPrice),
        low: parseFloat(ticker.low || lastPrice),
        changePercent: parseFloat(ticker.change_24_hour || 0),
      };
    } catch (error: any) {
      throw new AdapterError(this.exchangeName, `Failed to get ticker: ${error.message}`);
    }
  }

  async getTickers(symbols?: string[]): Promise<Ticker[]> {
    try {
      const data = await this.request('GET', '/exchange/ticker', {}, false);
      if (!Array.isArray(data)) return [];

      const targetMarkets = symbols ? new Set(symbols.map(s => this.toMarketSymbol(s))) : null;

      return data
        .filter((t: any) => !targetMarkets || targetMarkets.has(t.market))
        .map((t: any) => {
          const lastPrice = parseFloat(t.last_price || 0);
          return {
            symbol: this.toUnifiedSymbol(t.market),
            exchange: this.exchangeName,
            timestamp: t.timestamp ? t.timestamp * 1000 : Date.now(),
            bid: parseFloat(t.bid || lastPrice),
            ask: parseFloat(t.ask || lastPrice),
            last: lastPrice,
            volume: parseFloat(t.volume || 0),
            high: parseFloat(t.high || lastPrice),
            low: parseFloat(t.low || lastPrice),
            changePercent: parseFloat(t.change_24_hour || 0),
          };
        });
    } catch (error: any) {
      throw new AdapterError(this.exchangeName, `Failed to get tickers: ${error.message}`);
    }
  }

  async getBalance(): Promise<Balance[]> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AdapterError(this.exchangeName, 'API credentials not configured', 'AUTH_ERROR');
    }

    try {
      const data = await this.request('POST', '/exchange/v1/users/balances', {});
      if (!Array.isArray(data)) return [];

      return data
        .filter((b: any) => parseFloat(b.balance || 0) > 0 || parseFloat(b.locked_balance || 0) > 0)
        .map((b: any) => ({
          asset: b.currency?.toUpperCase(),
          free: parseFloat(b.balance || 0),
          locked: parseFloat(b.locked_balance || 0),
          total: parseFloat(b.balance || 0) + parseFloat(b.locked_balance || 0),
        }));
    } catch (error: any) {
      throw new AdapterError(this.exchangeName, `Failed to get balance: ${error.message}`);
    }
  }

  async placeOrder(params: OrderParams): Promise<OrderResult> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AdapterError(this.exchangeName, 'API credentials not configured', 'AUTH_ERROR');
    }

    const market = this.toMarketSymbol(params.symbol);
    const side = params.side.toLowerCase();
    let orderType = 'market_order';
    if (params.type === 'limit') orderType = 'limit_order';
    else if (params.type === 'stop_limit') orderType = 'stop_limit';

    const body: Record<string, any> = {
      side,
      order_type: orderType,
      market,
      total_quantity: params.quantity,
    };

    if (params.price && orderType === 'limit_order') {
      body.price_per_unit = params.price;
    }

    if (params.clientOrderId) {
      body.client_order_id = params.clientOrderId;
    }

    try {
      const data = await this.request('POST', '/exchange/v1/orders/create', body);
      const order = Array.isArray(data.orders) ? data.orders[0] : data;

      return {
        orderId: String(order.id || data.id),
        clientOrderId: order.client_order_id || params.clientOrderId,
        symbol: this.toUnifiedSymbol(params.symbol),
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        price: params.price,
        status: this.mapStatus(order.status),
        filledQuantity: parseFloat(order.filled_quantity || 0),
        avgFillPrice: parseFloat(order.avg_price || params.price || 0),
        timestamp: Date.now(),
      };
    } catch (error: any) {
      throw new AdapterError(this.exchangeName, `Failed to place order: ${error.message}`);
    }
  }

  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AdapterError(this.exchangeName, 'API credentials not configured', 'AUTH_ERROR');
    }

    try {
      await this.request('POST', '/exchange/v1/orders/cancel', { id: orderId });
    } catch (error: any) {
      throw new AdapterError(this.exchangeName, `Failed to cancel order: ${error.message}`);
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AdapterError(this.exchangeName, 'API credentials not configured', 'AUTH_ERROR');
    }

    const body: Record<string, any> = {};
    if (symbol) {
      body.market = this.toMarketSymbol(symbol);
    }

    try {
      const data = await this.request('POST', '/exchange/v1/orders/active_orders', body);
      const orders = Array.isArray(data) ? data : (data.orders || []);

      return orders.map((o: any) => ({
        orderId: String(o.id),
        clientOrderId: o.client_order_id,
        symbol: this.toUnifiedSymbol(o.market),
        side: (o.side || 'buy').toLowerCase() as 'buy' | 'sell',
        type: (o.order_type || 'limit').replace('_order', '').toLowerCase(),
        status: this.mapStatus(o.status),
        price: parseFloat(o.price_per_unit || 0),
        quantity: parseFloat(o.total_quantity || 0),
        filledQuantity: parseFloat(o.filled_quantity || 0),
        avgFillPrice: parseFloat(o.avg_price || 0),
        createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
        updatedAt: o.updated_at ? new Date(o.updated_at).getTime() : Date.now(),
      }));
    } catch (error: any) {
      throw new AdapterError(this.exchangeName, `Failed to get open orders: ${error.message}`);
    }
  }

  async getTradeHistory(symbol: string, limit: number = 50): Promise<Trade[]> {
    const pair = this.normalizeSymbol(symbol);
    try {
      const data = await this.request('GET', '/market_data/trade_history', { pair, limit }, true);
      if (!Array.isArray(data)) return [];

      return data.map((t: any, idx: number) => ({
        tradeId: String(t.trade_id || t.id || idx),
        orderId: String(t.order_id || ''),
        symbol: this.toUnifiedSymbol(symbol),
        side: (t.m === true || t.side === 'sell') ? 'sell' : 'buy',
        price: parseFloat(t.p || t.price),
        quantity: parseFloat(t.q || t.quantity),
        fee: 0,
        feeAsset: 'USDT',
        timestamp: t.T || Date.now(),
      }));
    } catch (error: any) {
      throw new AdapterError(this.exchangeName, `Failed to get trade history: ${error.message}`);
    }
  }

  async getDepositAddress(asset: string, network?: string): Promise<DepositAddress> {
    return {
      asset: asset.toUpperCase(),
      address: '',
      network: network || '',
      exchange: this.exchangeName,
    };
  }

  async withdraw(params: WithdrawalParams): Promise<WithdrawalResult> {
    throw new AdapterError(this.exchangeName, 'Withdrawals via API not enabled for CoinDCX', 'UNSUPPORTED');
  }

  async getWithdrawalFee(asset: string, network?: string): Promise<number> {
    return 0;
  }

  subscribeTicker(symbol: string, callback: TickerCallback): SubscriptionHandle {
    const interval = setInterval(async () => {
      try {
        const ticker = await this.getTicker(symbol);
        callback(ticker);
      } catch (err) {
        // silently retry on next tick
      }
    }, 3000);

    this.intervals.add(interval);
    return {
      unsubscribe: () => {
        clearInterval(interval);
        this.intervals.delete(interval);
      }
    };
  }

  subscribeOrderBook(symbol: string, callback: OrderBookCallback): SubscriptionHandle {
    const interval = setInterval(async () => {
      try {
        const ob = await this.getOrderBook(symbol);
        callback(ob);
      } catch (err) {
        // silently retry on next tick
      }
    }, 3000);

    this.intervals.add(interval);
    return {
      unsubscribe: () => {
        clearInterval(interval);
        this.intervals.delete(interval);
      }
    };
  }

  async close(): Promise<void> {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  private mapStatus(status: string): OrderStatusType {
    if (!status) return 'open';
    const s = status.toLowerCase();
    if (s === 'filled') return 'filled';
    if (s === 'partially_filled' || s === 'partially filled') return 'partially_filled';
    if (s === 'cancelled' || s === 'canceled' || s === 'expired') return 'cancelled';
    if (s === 'rejected') return 'rejected';
    return 'open';
  }
}
