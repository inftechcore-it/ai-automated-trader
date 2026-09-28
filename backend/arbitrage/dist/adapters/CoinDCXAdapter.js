import crypto from 'crypto';
import axios from 'axios';
import { BaseAdapter } from './IExchangeAdapter.js';
import { AdapterError } from '../utils/errors.js';
import { decrypt, isEncrypted } from '../utils/encryption.js';
const COINDCX_BASE_URL = 'https://api.coindcx.com';
const COINDCX_PUBLIC_URL = 'https://public.coindcx.com';
const COINDCX_DEFAULT_PRECISIONS = {
    // 0 decimal precision (Whole number integer orders only)
    XLM: 0, DOGE: 0, SHIB: 0, PEPE: 0, BONK: 0, FLOKI: 0, ALGO: 0, HBAR: 0,
    SAND: 0, CHZ: 0, MANA: 0, CKB: 0, NOT: 0, USDC: 0, HOT: 0, VTHO: 0,
    GRT: 0, MEME: 0, GALA: 0, HIVE: 0, REQ: 0, POWR: 0, USTC: 0, IQ: 0,
    DEGEN: 0, HMSTR: 0, PHA: 0, ETN: 0, GEOD: 0, NIBI: 0, BAT: 0, KMNO: 0,
    REKT: 0, PUMP: 0, XR: 0, VINU: 0, VENOM: 0, RSS3: 0, BLAST: 0, SIS: 0,
    EDU: 0, USDS: 0, TOWNS: 0, XUSD: 0, ESP: 0, USDE: 0, LINEA: 0, PLUME: 0,
    SPK: 0, SKY: 0, ZAMA: 0, CHIP: 0, HOME: 0, AVAIL: 0, IOST: 0, MOG: 0,
    TFUEL: 0, FOGO: 0, CORE: 0, SUN: 0, XAN: 0, PEIPEI: 0, UB: 0, RIF: 0,
    PENGU: 0, DEFI: 0, TOSHI: 0, NIGHT: 0, FLT: 0, IOTA: 0, CERE: 0, MGO: 0,
    SENT: 0, ALKIMI: 0, IOTX: 0, SC: 0, ELIZAOS: 0, RAIN: 0, DBR: 0, US: 0,
    SUPER: 0, CRTS: 0, CFX: 0, BEAMX: 0, VAI: 0, VINE: 0, SUPRA: 0, ZBCN: 0,
    ZORA: 0, TURBO: 0, MANTRA: 0, VR: 0, OTK: 0, SNEK: 0, ATA: 0, LWP: 0,
    BEL: 0, GWEI: 0, LAT: 0, XEM: 0, HUMA: 0, AKE: 0, Q: 0, CAT: 0,
    TAG: 0, PZP: 0, USD1: 0, GHST: 0, ALT: 0, SOLV: 0, MAPO: 0, BOME: 0,
    EQTY: 0, AMP: 0, CSPR: 0, SLP: 0, OGN: 0, IDEX: 0, MEW: 0, SAHARA: 0,
    ZRX: 0, MBL: 0, FIO: 0, RWA: 0, TWT: 0, WAXP: 0, ARTFI: 0, ACH: 0,
    BRISE: 0, SKL: 0, PYBOBO: 0, PIPEDOG: 0, XRD: 0, WENSOL: 0, QUICK: 0,
    MAV: 0, ZPAY: 0, ORBS: 0, "1000CHEEMS": 0, VSN: 0, XPIN: 0, KONET: 0,
    RLUSD: 0, STABLE: 0, CHR: 0, SPELL: 0, QKC: 0, TEL: 0, CTSI: 0, DOGS: 0,
    "2Z": 0, TX: 0, XPRT: 0, BIGTIME: 0, SOPH: 0, HOOK: 0, TUSD: 0, ONT: 0,
    DUSK: 0, XEC: 0, ARK: 0, BRETT: 0, G: 0, BABY: 0, H: 0, BONE: 0,
    DEP: 0, DOGELONMARS: 0, FDUSD: 0, SKR: 0, U: 0, ION: 0, DEEP: 0,
    AIGENSYN: 0, ID: 0, CWEB: 0, UOS: 0, QI: 0, AWE: 0, GUN: 0, ROBO: 0,
    BNKR: 0, "1MBABYDOGE": 0, EMT: 0, LCX: 0, ADX: 0, BTTC: 0,
    // 1 decimal precision
    XRP: 1, ADA: 1, TRX: 1, POL: 1, MATIC: 1, NEAR: 1, SUI: 1, SEI: 1,
    WLD: 1, ARB: 1, FET: 1, CRV: 1, JASMY: 1, ETHFI: 1, ONDO: 1, ANKR: 1,
    DODO: 1, XAI: 1, XTZ: 1, AGLD: 1, ANIME: 1, PARTI: 1, USUAL: 1, STX: 1,
    ASTR: 1, PUSH: 1, TST: 1, TKO: 1, BLUR: 1, MOVE: 1, RUNE: 1, WAL: 1,
    WOD: 1, SQD: 1, CYS: 1, DIA: 1, RAD: 1, TUT: 1, XPL: 1, WOO: 1,
    ALI: 1, JTO: 1, MON: 1, NYM: 1, MAGIC: 1, CTK: 1, AVA: 1, SNX: 1,
    QTUM: 1, STG: 1, ARPA: 1, YGG: 1, PYTH: 1, LA: 1, AZTEC: 1, WLFI: 1,
    ERA: 1, LAB: 1, TREE: 1, OPG: 1, EURI: 1, UMA: 1, EGL1: 1, STBL: 1,
    MASK: 1, GIGA: 1, AUDIO: 1, ACE: 1, GPS: 1, C98: 1, JELLYJELLY: 1,
    C: 1, COW: 1, CETUS: 1, AVNT: 1, FRAX: 1, HOLO: 1, MTL: 1, RARE: 1,
    SYRUP: 1, FIDA: 1, SIGN: 1, AT: 1, SXT: 1, RESOLV: 1, VELVET: 1, STO: 1,
    KGEN: 1, ICNT: 1, HEMI: 1, O: 1, CELR: 1, SIREN: 1, RLC: 1, KAVA: 1,
    CXT: 1, THE: 1, S: 1, RED: 1, WCT: 1, KAIO: 1, KERNEL: 1, HAEDAL: 1,
    NXPC: 1, BR: 1, PORTAL: 1, IRYS: 1, VIRTUAL: 1, PNUT: 1, PEAQ: 1,
    BIRB: 1, BANK: 1, SAPIEN: 1, ZEST: 1, RE: 1, IN: 1, MMT: 1, TRADE: 1,
    ACT: 1, NIL: 1, NAKA: 1, NPC: 1, DGB: 1, AIN: 1, PEOPLE: 1, A: 1,
    CGPT: 1, DYM: 1, THETA: 1, HYPER: 1, JUP: 1, NOM: 1, MANTA: 1, BAS: 1,
    TROLL: 1, ACX: 1, BB: 1, DRIFT: 1, RSR: 1, OG: 1, COOKIE: 1, TNSR: 1,
    PUNDIX: 1, BLESS: 1, DGAI: 1, RAY: 1, ACU: 1, MLN: 1, MARSCOIN: 1,
    T: 1, GMT: 1, GLM: 1, USELESS: 1, CROSS: 1, MEGA: 1, VELODROME: 1,
    BREV: 1, MUBARAK: 1, SUSHI: 1, FORT: 1, HTX: 1, MINA: 1, HIPPO: 1,
    VET: 1, KAITO: 1, PONKE: 1, ARKM: 1, GOAT: 1, AIXBT: 1, BIO: 1, ACM: 1,
    GRIFFAIN: 1, ZEREBRO: 1, ATH: 1, KNC: 1, BLUE: 1, REZ: 1, BAND: 1,
    MET: 1, SOON: 1, LMWR: 1, NEWT: 1, ESPORTS: 1, ENJ: 1, RVN: 1, LSK: 1,
    "1INCH": 1, GLMR: 1, PENDLE: 1, OVR: 1, W: 1, KAIA: 1, REACT: 1,
    HEI: 1, EPIC: 1, ICX: 1, MOCA: 1, CC: 1, AIO: 1, UAI: 1, OPEN: 1,
    KITE: 1, FF: 1, HPP: 1, ONE: 1, SYN: 1, BOSON: 1, BMT: 1, SHELL: 1,
    RACA: 1, PRL: 1, ALLO: 1, CATI: 1, SAGA: 1, WMTX: 1, SCR: 1,
    SUNDOG: 1, ZIL: 1, JST: 1,
    // 2 decimal precision
    SOL: 2, LINK: 2, AVAX: 2, UNI: 2, ATOM: 2, DOT: 2, LPT: 2, BICO: 2,
    PROM: 2, WIF: 2, FIL: 2, ENS: 2, PSG: 2, LUMIA: 2, VANA: 2, POPCAT: 2,
    KSM: 2, COTI: 2, MLK: 2, IO: 2, ICP: 2, CBK: 2, USDG: 2, EWT: 2,
    MIRA: 2, CLANKER: 2, CARV: 2, SAFE: 2, LIKE: 2, API3: 2, APT: 2,
    XNO: 2, SUT: 2, ZK: 2, GENIUS: 2, MERL: 2, XVS: 2, HSK: 2, APE: 2,
    FTT: 2, LIGHT: 2, JUV: 2, LUNC: 2, ORDI: 2, ZENT: 2, DEXE: 2, BNT: 2,
    ASR: 2, PORTO: 2, SANTOS: 2, VVV: 2, FB: 2, SPX: 2, MBX: 2, INIT: 2,
    UDS: 2, EDGE: 2, NES: 2, DATA: 2, EGLD: 2, STRK: 2, LISTA: 2, OP: 2,
    STEEM: 2, GRAM: 2, FORM: 2, ZRO: 2, SOMI: 2, LAZIO: 2, EUL: 2, AXL: 2,
    "0G": 2, SWAP: 2, GRASS: 2, AR: 2, ME: 2, FIS: 2, ORCA: 2, LF: 2,
    NMR: 2, USDT: 2, ACA: 2, MDT: 2, NEXO: 2, TIA: 2, PRO: 2, FARTCOIN: 2,
    CAKE: 2, ENSO: 2, PONS: 2, CASHCAT: 2, FLOCK: 2, AUCTION: 2, FLUX: 2,
    BARD: 2, B2: 2, GNS: 2, XDC: 2, ALICE: 2, LUNA: 2, CHILLGUY: 2, BAN: 2,
    MELANIA: 2, HYPE: 2, ETC: 2, AERO: 2, LAYER: 2, RONIN: 2, SWCH: 2,
    DYDX: 2, EIGEN: 2, ZEN: 2, PIEVERSE: 2, AXS: 2, REN: 2, JOE: 2, ATM: 2,
    FLOW: 2, CITY: 2, ASTER: 2, LIT: 2, MORPHO: 2, RPL: 2, CYBER: 2,
    AEVO: 2, ENA: 2, ALPINE: 2, ARC: 2, PRCL: 2, ONG: 2, OSMO: 2,
    // 3 decimal precision
    BNB: 3, LTC: 3, AAVE: 3, BSV: 3, QNT: 3, BANANA: 3, XMR: 3, CVX: 3,
    METIS: 3, GIGGLE: 3, ILV: 3, DASH: 3, COMP: 3, TRUMP: 3, GMX: 3,
    BERA: 3, MOVR: 3, GMMT: 3, TRB: 3, XYO: 3, SSV: 3,
    // 4 decimal precision
    ETH: 4, BCH: 4, TAO: 4, USDD: 4, PYUSD: 4, PAXG: 4, TRAC: 4, GNO: 4,
    ETHW: 4, WAVES: 4,
    // 5+ decimal precision
    BTC: 5, WBTC: 5, YFI: 5, ZEC: 5, NEO: 6
};
export class CoinDCXAdapter extends BaseAdapter {
    exchangeName = 'CoinDCX';
    _isTestnet = false;
    apiKey;
    apiSecret;
    intervals = new Set();
    precisionCache = new Map();
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
    createSignature(body) {
        if (!this.apiSecret)
            throw new AdapterError(this.exchangeName, 'API secret not configured', 'AUTH_ERROR');
        const payload = JSON.stringify(body);
        return crypto.createHmac('sha256', this.apiSecret).update(payload).digest('hex');
    }
    normalizeSymbol(symbol) {
        const clean = symbol.replace(/[-_]/g, '/').toUpperCase();
        const parts = clean.split('/');
        if (parts.length === 2) {
            const [base, quote] = parts;
            if (quote === 'USDT')
                return `B-${base}_USDT`;
            if (quote === 'INR')
                return `I-${base}_INR`;
            if (quote === 'USDC')
                return `B-${base}_USDC`;
            return `B-${base}_${quote}`;
        }
        return symbol;
    }
    toMarketSymbol(symbol) {
        return symbol.replace(/^[BI]-/, '').replace(/[/_]/g, '').toUpperCase();
    }
    toUnifiedSymbol(symbol) {
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
    async request(method, path, body = {}, isPublic = false) {
        const baseUrl = isPublic ? COINDCX_PUBLIC_URL : COINDCX_BASE_URL;
        const timestamp = Date.now();
        const payload = { ...body, timestamp };
        const headers = {
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
        }
        catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Request failed';
            throw new AdapterError(this.exchangeName, errorMsg, error.response?.status?.toString() || 'NETWORK_ERROR');
        }
    }
    async getOrderBook(symbol, limit = 20) {
        const pair = this.normalizeSymbol(symbol);
        try {
            const data = await this.request('GET', '/market_data/orderbook', { pair }, true);
            const bids = [];
            const asks = [];
            if (data.bids && typeof data.bids === 'object' && !Array.isArray(data.bids)) {
                Object.entries(data.bids).forEach(([p, q]) => bids.push({ price: parseFloat(p), amount: parseFloat(q) }));
                bids.sort((a, b) => b.price - a.price);
            }
            else if (Array.isArray(data.bids)) {
                data.bids.forEach((b) => bids.push({ price: parseFloat(b[0] || b.price), amount: parseFloat(b[1] || b.quantity) }));
            }
            if (data.asks && typeof data.asks === 'object' && !Array.isArray(data.asks)) {
                Object.entries(data.asks).forEach(([p, q]) => asks.push({ price: parseFloat(p), amount: parseFloat(q) }));
                asks.sort((a, b) => a.price - b.price);
            }
            else if (Array.isArray(data.asks)) {
                data.asks.forEach((a) => asks.push({ price: parseFloat(a[0] || a.price), amount: parseFloat(a[1] || a.quantity) }));
            }
            return {
                symbol: this.toUnifiedSymbol(symbol),
                exchange: this.exchangeName,
                timestamp: Date.now(),
                bids: bids.slice(0, limit),
                asks: asks.slice(0, limit),
            };
        }
        catch (error) {
            throw new AdapterError(this.exchangeName, `Failed to get orderbook: ${error.message}`);
        }
    }
    async getTicker(symbol) {
        const market = this.toMarketSymbol(symbol);
        try {
            const tickers = await this.request('GET', '/exchange/ticker', {}, false);
            const ticker = Array.isArray(tickers) ? tickers.find((t) => t.market === market) : null;
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
        }
        catch (error) {
            throw new AdapterError(this.exchangeName, `Failed to get ticker: ${error.message}`);
        }
    }
    async getTickers(symbols) {
        try {
            const data = await this.request('GET', '/exchange/ticker', {}, false);
            if (!Array.isArray(data))
                return [];
            const targetMarkets = symbols ? new Set(symbols.map(s => this.toMarketSymbol(s))) : null;
            return data
                .filter((t) => !targetMarkets || targetMarkets.has(t.market))
                .map((t) => {
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
        }
        catch (error) {
            throw new AdapterError(this.exchangeName, `Failed to get tickers: ${error.message}`);
        }
    }
    async getBalance() {
        if (!this.apiKey || !this.apiSecret) {
            throw new AdapterError(this.exchangeName, 'API credentials not configured', 'AUTH_ERROR');
        }
        try {
            const data = await this.request('POST', '/exchange/v1/users/balances', {});
            if (!Array.isArray(data))
                return [];
            return data
                .filter((b) => parseFloat(b.balance || 0) > 0 || parseFloat(b.locked_balance || 0) > 0)
                .map((b) => ({
                asset: b.currency?.toUpperCase(),
                free: parseFloat(b.balance || 0),
                locked: parseFloat(b.locked_balance || 0),
                total: parseFloat(b.balance || 0) + parseFloat(b.locked_balance || 0),
            }));
        }
        catch (error) {
            throw new AdapterError(this.exchangeName, `Failed to get balance: ${error.message}`);
        }
    }
    formatQuantity(symbol, quantity) {
        if (!quantity || isNaN(quantity))
            return 0;
        const clean = symbol.replace(/[-_]/g, '/').toUpperCase();
        const parts = clean.split('/');
        const baseAsset = (parts[0] || '').replace(/^[BI]-/, '') || clean;
        const precision = COINDCX_DEFAULT_PRECISIONS[baseAsset] !== undefined ? COINDCX_DEFAULT_PRECISIONS[baseAsset] : 1;
        if (precision === 0) {
            return Math.floor(quantity);
        }
        const factor = Math.pow(10, precision);
        const floored = Math.floor(quantity * factor) / factor;
        return Number(floored.toFixed(precision));
    }
    formatPrice(price) {
        if (price === undefined || price === null || isNaN(price))
            return undefined;
        const factor = Math.pow(10, 4);
        const rounded = Math.round(price * factor) / factor;
        return Number(rounded.toFixed(4));
    }
    async placeOrder(params) {
        if (!this.apiKey || !this.apiSecret) {
            throw new AdapterError(this.exchangeName, 'API credentials not configured', 'AUTH_ERROR');
        }
        const market = this.toMarketSymbol(params.symbol);
        const side = params.side.toLowerCase();
        let orderType = 'market_order';
        if (params.type === 'limit')
            orderType = 'limit_order';
        else if (params.type === 'stop_limit')
            orderType = 'stop_limit';
        const formattedQuantity = this.formatQuantity(params.symbol, params.quantity);
        if (formattedQuantity <= 0) {
            throw new AdapterError(this.exchangeName, `Formatted quantity is 0 for ${params.symbol} (raw: ${params.quantity})`);
        }
        const formattedPrice = params.price ? this.formatPrice(params.price) : undefined;
        const body = {
            side,
            order_type: orderType,
            market,
            total_quantity: formattedQuantity,
        };
        if (formattedPrice && orderType === 'limit_order') {
            body.price_per_unit = formattedPrice;
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
                quantity: formattedQuantity,
                price: formattedPrice || params.price,
                status: this.mapStatus(order.status),
                filledQuantity: parseFloat(order.filled_quantity || 0),
                avgFillPrice: parseFloat(order.avg_price || params.price || 0),
                timestamp: Date.now(),
            };
        }
        catch (error) {
            throw new AdapterError(this.exchangeName, `Failed to place order: ${error.message}`);
        }
    }
    async cancelOrder(orderId, symbol) {
        if (!this.apiKey || !this.apiSecret) {
            throw new AdapterError(this.exchangeName, 'API credentials not configured', 'AUTH_ERROR');
        }
        try {
            await this.request('POST', '/exchange/v1/orders/cancel', { id: orderId });
        }
        catch (error) {
            throw new AdapterError(this.exchangeName, `Failed to cancel order: ${error.message}`);
        }
    }
    async getOpenOrders(symbol) {
        if (!this.apiKey || !this.apiSecret) {
            throw new AdapterError(this.exchangeName, 'API credentials not configured', 'AUTH_ERROR');
        }
        const body = {};
        if (symbol) {
            body.market = this.toMarketSymbol(symbol);
        }
        try {
            const data = await this.request('POST', '/exchange/v1/orders/active_orders', body);
            const orders = Array.isArray(data) ? data : (data.orders || []);
            return orders.map((o) => ({
                orderId: String(o.id),
                clientOrderId: o.client_order_id,
                symbol: this.toUnifiedSymbol(o.market),
                side: (o.side || 'buy').toLowerCase(),
                type: (o.order_type || 'limit').replace('_order', '').toLowerCase(),
                status: this.mapStatus(o.status),
                price: parseFloat(o.price_per_unit || 0),
                quantity: parseFloat(o.total_quantity || 0),
                filledQuantity: parseFloat(o.filled_quantity || 0),
                avgFillPrice: parseFloat(o.avg_price || 0),
                createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
                updatedAt: o.updated_at ? new Date(o.updated_at).getTime() : Date.now(),
            }));
        }
        catch (error) {
            throw new AdapterError(this.exchangeName, `Failed to get open orders: ${error.message}`);
        }
    }
    async getTradeHistory(symbol, limit = 50) {
        const pair = this.normalizeSymbol(symbol);
        try {
            const data = await this.request('GET', '/market_data/trade_history', { pair, limit }, true);
            if (!Array.isArray(data))
                return [];
            return data.map((t, idx) => ({
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
        }
        catch (error) {
            throw new AdapterError(this.exchangeName, `Failed to get trade history: ${error.message}`);
        }
    }
    async getDepositAddress(asset, network) {
        return {
            asset: asset.toUpperCase(),
            address: '',
            network: network || '',
            exchange: this.exchangeName,
        };
    }
    async withdraw(params) {
        throw new AdapterError(this.exchangeName, 'Withdrawals via API not enabled for CoinDCX', 'UNSUPPORTED');
    }
    async getWithdrawalFee(asset, network) {
        return 0;
    }
    subscribeTicker(symbol, callback) {
        const interval = setInterval(async () => {
            try {
                const ticker = await this.getTicker(symbol);
                callback(ticker);
            }
            catch (err) {
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
    subscribeOrderBook(symbol, callback) {
        const interval = setInterval(async () => {
            try {
                const ob = await this.getOrderBook(symbol);
                callback(ob);
            }
            catch (err) {
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
    async close() {
        for (const interval of this.intervals) {
            clearInterval(interval);
        }
        this.intervals.clear();
    }
    mapStatus(status) {
        if (!status)
            return 'open';
        const s = status.toLowerCase();
        if (s === 'filled')
            return 'filled';
        if (s === 'partially_filled' || s === 'partially filled')
            return 'partially_filled';
        if (s === 'cancelled' || s === 'canceled' || s === 'expired')
            return 'cancelled';
        if (s === 'rejected')
            return 'rejected';
        return 'open';
    }
}
