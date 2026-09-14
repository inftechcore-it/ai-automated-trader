import axios from 'axios';
import crypto from 'crypto';
import { BaseAdapter } from './IExchangeAdapter.js';
import { AdapterError } from '../utils/errors.js';
import { decrypt, isEncrypted } from '../utils/encryption.js';
const ANGELONE_BASE_URL = 'https://apiconnect.angelone.in';
const SCRIP_MASTER_URL = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
export class AngelOneAdapter extends BaseAdapter {
    exchangeName = 'AngelOne';
    _isTestnet = false;
    apiKey;
    clientCode;
    password;
    totpSecret;
    jwtToken;
    refreshToken;
    feedToken;
    scripMasterCache;
    scripMasterLastFetch = 0;
    pollingIntervals = [];
    get isTestnet() {
        return this._isTestnet;
    }
    async initialize(config) {
        this._isTestnet = config.testnet || false;
        this.apiKey = config.apiKey
            ? (isEncrypted(config.apiKey) ? decrypt(config.apiKey) : config.apiKey)
            : undefined;
        this.clientCode = config.apiSecret
            ? (isEncrypted(config.apiSecret) ? decrypt(config.apiSecret) : config.apiSecret)
            : undefined;
        // Check environment fallbacks
        if (!this.apiKey && process.env.ANGELONE_API_KEY) {
            this.apiKey = process.env.ANGELONE_API_KEY;
        }
        if (!this.clientCode && process.env.ANGELONE_CLIENT_CODE) {
            this.clientCode = process.env.ANGELONE_CLIENT_CODE;
        }
        this.password = process.env.ANGELONE_PASSWORD;
        this.totpSecret = process.env.ANGELONE_TOTP_KEY;
    }
    base32Decode(base32) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        const cleaned = (base32 || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
        let bits = '';
        for (let i = 0; i < cleaned.length; i++) {
            const val = alphabet.indexOf(cleaned.charAt(i));
            if (val === -1)
                continue;
            bits += val.toString(2).padStart(5, '0');
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substring(i, i + 8), 2));
        }
        return Buffer.from(bytes);
    }
    generateTOTP(secretKey, stepSec = 30, digits = 6) {
        try {
            const keyBuffer = this.base32Decode(secretKey);
            const epoch = Math.floor(Date.now() / 1000);
            const timeStep = Math.floor(epoch / stepSec);
            const timeBuffer = Buffer.alloc(8);
            timeBuffer.writeBigInt64BE(BigInt(timeStep));
            const hmac = crypto.createHmac('sha1', keyBuffer).update(timeBuffer).digest();
            const offset = hmac[hmac.length - 1] & 0x0f;
            const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % Math.pow(10, digits);
            return code.toString().padStart(digits, '0');
        }
        catch {
            return '';
        }
    }
    async ensureSession() {
        if (this.jwtToken)
            return;
        if (!this.apiKey || !this.clientCode || !this.password || !this.totpSecret) {
            return; // Will use public fallback
        }
        try {
            const totp = this.generateTOTP(this.totpSecret);
            const res = await axios.post(`${ANGELONE_BASE_URL}/rest/auth/angelbroking/user/v1/loginByPassword`, {
                clientcode: this.clientCode,
                password: this.password,
                totp,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-UserType': 'USER',
                    'X-SourceID': 'WEB',
                    'X-ClientLocalIP': '127.0.0.1',
                    'X-ClientPublicIP': '106.193.147.98',
                    'X-MACAddress': 'fe80::216e:6507:4b90:3719',
                    'X-PrivateKey': this.apiKey,
                },
                timeout: 10000,
            });
            if (res.data?.status && res.data?.data) {
                this.jwtToken = res.data.data.jwtToken;
                this.refreshToken = res.data.data.refreshToken;
                this.feedToken = res.data.data.feedToken;
            }
        }
        catch (err) {
            console.warn(`[AngelOneAdapter] Session init warning:`, err.message);
        }
    }
    async fetchScripMaster() {
        if (this.scripMasterCache && Date.now() - this.scripMasterLastFetch < 12 * 3600 * 1000) {
            return this.scripMasterCache;
        }
        try {
            const { data } = await axios.get(SCRIP_MASTER_URL, { timeout: 25000 });
            if (Array.isArray(data)) {
                this.scripMasterCache = data;
                this.scripMasterLastFetch = Date.now();
                return data;
            }
        }
        catch {
            // ignore
        }
        return this.scripMasterCache || [];
    }
    async getMarkets() {
        const scrips = await this.fetchScripMaster();
        if (scrips.length > 0) {
            return scrips
                .filter((s) => s.exch_seg === 'NSE' && s.instrumenttype === '')
                .slice(0, 100)
                .map((s) => ({
                symbol: s.symbol.replace('-EQ', ''),
                base: s.symbol.replace('-EQ', ''),
                baseAsset: s.symbol.replace('-EQ', ''),
                quote: 'INR',
                quoteAsset: 'INR',
                token: s.token,
                active: true,
            }));
        }
        const defaultSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'BHARTIARTL', 'ITC', 'LT'];
        return defaultSymbols.map((s) => ({
            symbol: s,
            base: s,
            baseAsset: s,
            quote: 'INR',
            quoteAsset: 'INR',
            active: true,
        }));
    }
    async getOrderBook(symbol, limit = 20) {
        const clean = symbol.replace('-EQ', '').toUpperCase();
        const ticker = await this.getTicker(clean);
        const p = ticker.last || 100;
        const spread = p * 0.0005;
        return {
            symbol: clean,
            exchange: this.exchangeName,
            bids: [
                { price: p - spread, amount: 100 },
                { price: p - spread * 2, amount: 200 },
            ],
            asks: [
                { price: p + spread, amount: 100 },
                { price: p + spread * 2, amount: 200 },
            ],
            timestamp: Date.now(),
        };
    }
    async getTicker(symbol) {
        const clean = symbol.replace('-EQ', '').replace('.NS', '').toUpperCase();
        try {
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${clean}.NS?interval=1d&range=1d`;
            const { data } = await axios.get(yahooUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 6000,
            });
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta && meta.regularMarketPrice) {
                const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
                const change = meta.regularMarketPrice - prev;
                const pct = (change / prev) * 100;
                return {
                    symbol: clean,
                    exchange: this.exchangeName,
                    bid: meta.regularMarketPrice,
                    ask: meta.regularMarketPrice,
                    last: meta.regularMarketPrice,
                    volume: meta.regularMarketVolume || 0,
                    change,
                    changePercent: pct,
                    high: meta.regularMarketDayHigh || meta.regularMarketPrice,
                    low: meta.regularMarketDayLow || meta.regularMarketPrice,
                    timestamp: Date.now(),
                };
            }
        }
        catch {
            // Fallback
        }
        return {
            symbol: clean,
            exchange: this.exchangeName,
            bid: 0,
            ask: 0,
            last: 0,
            high: 0,
            low: 0,
            volume: 0,
            timestamp: Date.now(),
        };
    }
    async getTickers(symbols) {
        const list = symbols || ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'];
        const results = [];
        for (const sym of list) {
            const t = await this.getTicker(sym);
            if (t.last > 0)
                results.push(t);
        }
        return results;
    }
    async getBalance() {
        await this.ensureSession();
        if (this.jwtToken && this.apiKey) {
            try {
                const { data } = await axios.get(`${ANGELONE_BASE_URL}/rest/secure/angelbroking/user/v1/getRMS`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-UserType': 'USER',
                        'X-SourceID': 'WEB',
                        'X-PrivateKey': this.apiKey,
                        'Authorization': `Bearer ${this.jwtToken}`,
                    },
                    timeout: 8000,
                });
                const rms = data?.data || {};
                const available = parseFloat(rms.availablecash || rms.net || 0);
                const utilized = parseFloat(rms.utilisedmargin || 0);
                return [
                    {
                        asset: 'INR',
                        free: available,
                        locked: utilized,
                        total: available + utilized,
                    },
                ];
            }
            catch {
                // ignore
            }
        }
        return [{ asset: 'INR', free: 100000, locked: 0, total: 100000 }];
    }
    async resolveSymbolToken(symbol, exchange = 'NSE') {
        const clean = symbol.replace('-EQ', '').replace('.NS', '').replace('.BO', '').toUpperCase();
        const scrips = await this.fetchScripMaster();
        const exUpper = exchange.toUpperCase();
        let match = scrips.find((s) => s.exch_seg === exUpper &&
            (s.symbol === `${clean}-EQ` || s.symbol === clean || s.name?.toUpperCase() === clean));
        if (!match) {
            match = scrips.find((s) => s.exch_seg === exUpper &&
                (s.symbol.startsWith(clean) || s.name?.toUpperCase().includes(clean)));
        }
        if (match) {
            return { token: match.token, tradingsymbol: match.symbol };
        }
        return { token: '0', tradingsymbol: `${clean}-EQ` };
    }
    async placeOrder(params) {
        await this.ensureSession();
        const clean = params.symbol.replace('-EQ', '').toUpperCase();
        const resolved = await this.resolveSymbolToken(clean, 'NSE');
        if (this.jwtToken && this.apiKey) {
            const isMarket = params.type?.toLowerCase() === 'market';
            const body = {
                variety: 'NORMAL',
                tradingsymbol: resolved.tradingsymbol,
                symboltoken: resolved.token,
                transactiontype: params.side.toUpperCase(),
                exchange: 'NSE',
                ordertype: isMarket ? 'MARKET' : 'LIMIT',
                producttype: 'DELIVERY',
                duration: 'DAY',
                price: isMarket ? '0' : (params.price || 0).toString(),
                quantity: params.quantity.toString(),
            };
            const res = await axios.post(`${ANGELONE_BASE_URL}/rest/secure/angelbroking/order/v1/placeOrder`, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-UserType': 'USER',
                    'X-SourceID': 'WEB',
                    'X-PrivateKey': this.apiKey,
                    'Authorization': `Bearer ${this.jwtToken}`,
                },
                timeout: 10000,
            });
            if (res.data?.status && res.data?.data) {
                return {
                    orderId: res.data.data.orderid,
                    symbol: params.symbol,
                    side: params.side,
                    type: params.type,
                    price: params.price || 0,
                    quantity: params.quantity,
                    filledQuantity: params.quantity,
                    status: 'filled',
                    timestamp: Date.now(),
                };
            }
            throw new AdapterError(this.exchangeName, res.data?.message || 'Order placement failed');
        }
        // Simulated fill
        return {
            orderId: `ANGEL_${Date.now()}`,
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            price: params.price || 0,
            quantity: params.quantity,
            filledQuantity: params.quantity,
            status: 'filled',
            timestamp: Date.now(),
        };
    }
    async cancelOrder(orderId, _symbol) {
        await this.ensureSession();
        if (this.jwtToken && this.apiKey) {
            await axios.post(`${ANGELONE_BASE_URL}/rest/secure/angelbroking/order/v1/cancelOrder`, { variety: 'NORMAL', orderid: orderId }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-UserType': 'USER',
                    'X-SourceID': 'WEB',
                    'X-PrivateKey': this.apiKey,
                    'Authorization': `Bearer ${this.jwtToken}`,
                },
                timeout: 8000,
            });
        }
    }
    async getOpenOrders(_symbol) {
        return [];
    }
    async getTradeHistory(_symbol, _limit = 50) {
        return [];
    }
    async getDepositAddress(asset, _network) {
        return { asset, address: 'ANGEL_ONE_EQUITY_ACCOUNT', network: 'INR', exchange: this.exchangeName };
    }
    async withdraw(_params) {
        throw new AdapterError(this.exchangeName, 'Withdrawals via SmartAPI not supported', 'UNSUPPORTED');
    }
    async getWithdrawalFee(_asset, _network) {
        return 0;
    }
    subscribeTicker(symbol, callback) {
        const interval = setInterval(async () => {
            try {
                const ticker = await this.getTicker(symbol);
                callback(ticker);
            }
            catch { }
        }, 3000);
        this.pollingIntervals.push(interval);
        return {
            unsubscribe: () => clearInterval(interval),
        };
    }
    subscribeOrderBook(symbol, callback) {
        const interval = setInterval(async () => {
            try {
                const ob = await this.getOrderBook(symbol);
                callback(ob);
            }
            catch { }
        }, 3000);
        this.pollingIntervals.push(interval);
        return {
            unsubscribe: () => clearInterval(interval),
        };
    }
    async close() {
        this.pollingIntervals.forEach((i) => clearInterval(i));
        this.pollingIntervals = [];
    }
}
