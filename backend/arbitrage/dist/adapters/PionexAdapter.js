import crypto from 'crypto';
import axios from 'axios';
import { BaseAdapter } from './IExchangeAdapter.js';
import { AdapterError } from '../utils/errors.js';
import { decrypt, isEncrypted } from '../utils/encryption.js';
const PIONEX_BASE_URL = 'https://api.pionex.com';
export class PionexAdapter extends BaseAdapter {
    exchangeName = 'Pionex';
    _isTestnet = false;
    apiKey;
    apiSecret;
    get isTestnet() {
        return this._isTestnet;
    }
    async initialize(config) {
        this._isTestnet = config.testnet;
        this.apiKey = config.apiKey
            ? (isEncrypted(config.apiKey) ? decrypt(config.apiKey) : config.apiKey)
            : undefined;
        this.apiSecret = config.apiSecret
            ? (isEncrypted(config.apiSecret) ? decrypt(config.apiSecret) : config.apiSecret)
            : undefined;
    }
    createSignature(method, path, queryString, body) {
        if (!this.apiSecret)
            throw new AdapterError(this.exchangeName, 'API secret not configured', 'AUTH_ERROR');
        let signatureBase = method.toUpperCase() + path;
        if (queryString) {
            signatureBase += '?' + queryString;
        }
        if (body) {
            signatureBase += JSON.stringify(body);
        }
        return crypto.createHmac('sha256', this.apiSecret).update(signatureBase).digest('hex');
    }
    buildQueryString(params) {
        const sorted = Object.keys(params).sort();
        return sorted.map(key => `${key}=${params[key]}`).join('&');
    }
    normalizeSymbol(symbol) {
        return symbol.replace('/', '_').toUpperCase();
    }
    denormalizePionexSymbol(symbol) {
        return symbol.replace('_', '/');
    }
    async request(method, path, params = {}, body) {
        const timestamp = Date.now();
        const queryParams = { ...params, timestamp };
        const queryString = this.buildQueryString(queryParams);
        const headers = {
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
        }
        catch (error) {
            const message = error.response?.data?.message || error.message;
            throw new AdapterError(this.exchangeName, message, error.response?.data?.code || 'API_ERROR');
        }
    }
    async getOrderBook(symbol, limit = 20) {
        try {
            const data = await this.request('GET', '/api/v1/market/depth', {
                symbol: this.normalizeSymbol(symbol),
                limit,
            });
            return {
                symbol,
                exchange: this.exchangeName,
                bids: (data.bids || []).map(([price, amount]) => ({
                    price: parseFloat(price),
                    amount: parseFloat(amount),
                })),
                asks: (data.asks || []).map(([price, amount]) => ({
                    price: parseFloat(price),
                    amount: parseFloat(amount),
                })),
                timestamp: data.updateTime || Date.now(),
            };
        }
        catch (error) {
            throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
        }
    }
    async getTicker(symbol) {
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
        }
        catch (error) {
            throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
        }
    }
    async getTickers(symbols) {
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
                tickers = tickers.filter((t) => normalizedSymbols.has(t.symbol));
            }
            return tickers.map((ticker) => ({
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
        }
        catch (error) {
            throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
        }
    }
    async getMarkets() {
        try {
            const response = await axios.get(`${PIONEX_BASE_URL}/api/v1/common/symbols`, {
                params: { type: 'SPOT' },
                timeout: 10000,
            });
            if (!response.data.result || !response.data.data?.symbols) {
                return [];
            }
            return response.data.data.symbols
                .filter((s) => s.enable)
                .map((s) => ({
                symbol: `${s.baseCurrency}/${s.quoteCurrency}`,
                base: s.baseCurrency,
                baseAsset: s.baseCurrency,
                quote: s.quoteCurrency,
                quoteAsset: s.quoteCurrency,
                active: s.enable,
            }));
        }
        catch (error) {
            console.error(`[PionexAdapter] getMarkets error:`, error.message);
            return [];
        }
    }
    async getBalance() {
        try {
            const data = await this.request('GET', '/api/v1/account/balances');
            return (data.balances || [])
                .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.frozen) > 0)
                .map((b) => ({
                asset: b.coin,
                free: parseFloat(b.free),
                locked: parseFloat(b.frozen),
                total: parseFloat(b.free) + parseFloat(b.frozen),
            }));
        }
        catch (error) {
            throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
        }
    }
    async placeOrder(params) {
        try {
            const body = {
                symbol: this.normalizeSymbol(params.symbol),
                side: params.side.toUpperCase(),
                type: params.type.toUpperCase(),
            };
            if (params.type === 'limit') {
                body.size = params.quantity.toString();
                body.price = params.price?.toString();
            }
            else if (params.type === 'market') {
                if (params.side === 'buy') {
                    body.amount = ((params.quantity * (params.price || 0)) || params.quantity).toString();
                }
                else {
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
                status: 'open',
                quantity: params.quantity,
                filledQuantity: 0,
                price: params.price,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
        }
    }
    async cancelOrder(orderId, symbol) {
        try {
            const body = {
                symbol: this.normalizeSymbol(symbol),
                orderId,
            };
            await this.request('DELETE', '/api/v1/trade/order', {}, body);
        }
        catch (error) {
            throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
        }
    }
    async getOpenOrders(symbol) {
        try {
            const params = {};
            if (symbol) {
                params.symbol = this.normalizeSymbol(symbol);
            }
            const data = await this.request('GET', '/api/v1/trade/openOrders', params);
            return (data.orders || []).map((order) => ({
                orderId: order.orderId,
                clientOrderId: order.clientOrderId,
                symbol: this.denormalizePionexSymbol(order.symbol),
                side: order.side.toLowerCase(),
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
        }
        catch (error) {
            throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
        }
    }
    async getTradeHistory(symbol, limit = 100) {
        try {
            const data = await this.request('GET', '/api/v1/trade/fills', {
                symbol: this.normalizeSymbol(symbol),
            });
            return (data.fills || []).slice(0, limit).map((fill) => ({
                tradeId: fill.id,
                orderId: fill.orderId,
                symbol: this.denormalizePionexSymbol(fill.symbol),
                side: fill.side.toLowerCase(),
                quantity: parseFloat(fill.size),
                price: parseFloat(fill.price),
                fee: parseFloat(fill.fee) || 0,
                feeAsset: fill.feeCurrency || '',
                timestamp: fill.createTime || Date.now(),
            }));
        }
        catch (error) {
            throw error instanceof AdapterError ? error : new AdapterError(this.exchangeName, error.message, 'API_ERROR');
        }
    }
    mapOrderStatus(status) {
        const statusMap = {
            'OPEN': 'open',
            'PARTIALLY_FILLED': 'partially_filled',
            'FILLED': 'filled',
            'CANCELED': 'cancelled',
            'CANCELLED': 'cancelled',
            'REJECTED': 'rejected',
        };
        return statusMap[status?.toUpperCase()] || 'open';
    }
    async getDepositAddress(asset, network) {
        throw new AdapterError(this.exchangeName, 'Deposit address not supported via API', 'NOT_SUPPORTED');
    }
    async withdraw(params) {
        throw new AdapterError(this.exchangeName, 'Withdrawal not supported via API', 'NOT_SUPPORTED');
    }
    async getWithdrawalFee(asset, network) {
        throw new AdapterError(this.exchangeName, 'Withdrawal fee lookup not supported', 'NOT_SUPPORTED');
    }
    subscribeTicker(symbol, callback) {
        // WebSocket not implemented - return dummy handle
        return { unsubscribe: () => { } };
    }
    subscribeOrderBook(symbol, callback) {
        // WebSocket not implemented - return dummy handle
        return { unsubscribe: () => { } };
    }
    async close() {
        // Clean up any resources
    }
}
