import ccxt from 'ccxt';
import { BaseAdapter } from './IExchangeAdapter.js';
import { AdapterError } from '../utils/errors.js';
import { decrypt, isEncrypted } from '../utils/encryption.js';
const BINANCE_TESTNET_URL = 'https://testnet.binance.vision';
export class BinanceAdapter extends BaseAdapter {
    exchangeName = 'Binance';
    _isTestnet = true;
    exchange = null;
    get isTestnet() {
        return this._isTestnet;
    }
    async initialize(config) {
        this._isTestnet = config.testnet;
        const apiKey = config.apiKey
            ? (isEncrypted(config.apiKey) ? decrypt(config.apiKey) : config.apiKey)
            : undefined;
        const apiSecret = config.apiSecret
            ? (isEncrypted(config.apiSecret) ? decrypt(config.apiSecret) : config.apiSecret)
            : undefined;
        const options = {
            apiKey,
            secret: apiSecret,
            enableRateLimit: true,
            options: {
                defaultType: config.type === 'futures' ? 'future' : 'spot',
                adjustForTimeDifference: true,
            },
        };
        if (this._isTestnet) {
            options.urls = {
                api: {
                    public: BINANCE_TESTNET_URL,
                    private: BINANCE_TESTNET_URL,
                },
            };
        }
        this.exchange = new ccxt.binance(options);
        if (this._isTestnet) {
            this.exchange.setSandboxMode(true);
        }
        try {
            await this.exchange.loadMarkets();
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    ensureInitialized() {
        if (!this.exchange) {
            throw new AdapterError(this.exchangeName, 'Adapter not initialized. Call initialize() first.', 'NOT_INITIALIZED');
        }
        return this.exchange;
    }
    async getOrderBook(symbol, limit = 20) {
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
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async getTicker(symbol) {
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
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async getTickers(symbols) {
        const exchange = this.ensureInitialized();
        try {
            const tickers = await exchange.fetchTickers(symbols);
            return Object.values(tickers).map((ticker) => ({
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
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async getBalance() {
        const exchange = this.ensureInitialized();
        try {
            const balance = await exchange.fetchBalance();
            const balances = [];
            for (const [asset, data] of Object.entries(balance.total)) {
                const total = data;
                if (total > 0) {
                    const free = balance.free[asset] || 0;
                    const locked = balance.used[asset] || 0;
                    balances.push({ asset, free, locked, total });
                }
            }
            return balances;
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async placeOrder(params) {
        const exchange = this.ensureInitialized();
        try {
            const orderTypeMap = {
                market: 'market',
                limit: 'limit',
                stop_loss: 'STOP_LOSS',
                stop_limit: 'STOP_LOSS_LIMIT',
                take_profit: 'TAKE_PROFIT',
            };
            const ccxtParams = {};
            if (params.timeInForce) {
                ccxtParams.timeInForce = params.timeInForce;
            }
            if (params.stopPrice) {
                ccxtParams.stopPrice = params.stopPrice;
            }
            if (params.clientOrderId) {
                ccxtParams.clientOrderId = params.clientOrderId;
            }
            if (params.reduceOnly) {
                ccxtParams.reduceOnly = params.reduceOnly;
            }
            const order = await exchange.createOrder(params.symbol, orderTypeMap[params.type] || params.type, params.side, params.quantity, params.price, ccxtParams);
            return {
                orderId: order.id,
                clientOrderId: order.clientOrderId,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                status: this.mapOrderStatus(order.status),
                quantity: order.amount,
                filledQuantity: order.filled || 0,
                price: order.price,
                avgFillPrice: order.average,
                timestamp: order.timestamp || Date.now(),
            };
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async cancelOrder(orderId, symbol) {
        const exchange = this.ensureInitialized();
        try {
            await exchange.cancelOrder(orderId, symbol);
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async getOpenOrders(symbol) {
        const exchange = this.ensureInitialized();
        try {
            const orders = await exchange.fetchOpenOrders(symbol);
            return orders.map((order) => ({
                orderId: order.id,
                clientOrderId: order.clientOrderId,
                symbol: order.symbol,
                side: order.side,
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
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async getTradeHistory(symbol, limit = 100) {
        const exchange = this.ensureInitialized();
        try {
            const trades = await exchange.fetchMyTrades(symbol, undefined, limit);
            return trades.map((trade) => ({
                tradeId: trade.id,
                orderId: trade.order || '',
                symbol: trade.symbol,
                side: trade.side,
                quantity: trade.amount,
                price: trade.price,
                fee: trade.fee?.cost || 0,
                feeAsset: trade.fee?.currency || '',
                timestamp: trade.timestamp,
            }));
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async getDepositAddress(asset, network) {
        const exchange = this.ensureInitialized();
        try {
            const params = {};
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
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async withdraw(params) {
        const exchange = this.ensureInitialized();
        try {
            const ccxtParams = {};
            if (params.network) {
                ccxtParams.network = params.network;
            }
            const result = await exchange.withdraw(params.asset, params.amount, params.address, params.tag, ccxtParams);
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
        }
        catch (error) {
            throw AdapterError.fromCCXTError(this.exchangeName, error);
        }
    }
    async getWithdrawalFee(asset, network) {
        const exchange = this.ensureInitialized();
        try {
            const currencies = await exchange.fetchCurrencies();
            const currency = currencies[asset];
            if (currency && currency.networks && network) {
                const networkInfo = currency.networks[network];
                if (networkInfo && networkInfo.fee) {
                    return networkInfo.fee;
                }
            }
            if (currency && currency.fee) {
                return currency.fee;
            }
            return 0;
        }
        catch (error) {
            return 0;
        }
    }
    subscribeTicker(symbol, callback) {
        return { unsubscribe: () => { } };
    }
    subscribeOrderBook(symbol, callback) {
        return { unsubscribe: () => { } };
    }
    async close() {
        if (this.exchange) {
            await this.exchange.close();
            this.exchange = null;
        }
    }
    mapOrderStatus(status) {
        const statusMap = {
            open: 'open',
            closed: 'filled',
            canceled: 'cancelled',
            expired: 'expired',
            rejected: 'rejected',
        };
        return statusMap[status || ''] || 'pending';
    }
}
