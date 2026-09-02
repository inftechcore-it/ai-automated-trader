import { EventEmitter } from 'events';
const STALE_THRESHOLD_MS = 15000;
const REFRESH_INTERVAL_MS = 2000;
export class PriceCache extends EventEmitter {
    cache = new Map();
    adapter = null;
    symbols = [];
    refreshInterval = null;
    isRefreshing = false;
    constructor() {
        super();
    }
    async subscribeAll(adapter, symbols) {
        this.adapter = adapter;
        this.symbols = symbols;
        console.log(`[PriceCache] Setting up polling for ${symbols.length} symbols...`);
        await this.refreshAllPrices();
        this.startPolling();
        console.log(`[PriceCache] Polling started, ${this.cache.size} symbols cached`);
    }
    startPolling() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.refreshInterval = setInterval(async () => {
            if (!this.isRefreshing) {
                await this.refreshAllPrices();
            }
        }, REFRESH_INTERVAL_MS);
    }
    updatePrice(symbol, ticker) {
        const entry = {
            bid: ticker.bid || ticker.last * 0.999,
            ask: ticker.ask || ticker.last * 1.001,
            last: ticker.last,
            timestamp: Date.now(),
        };
        this.cache.set(symbol, entry);
        this.emit('update', symbol, entry);
    }
    getPrice(symbol) {
        return this.cache.get(symbol) || null;
    }
    getBidAsk(symbol) {
        const entry = this.cache.get(symbol);
        if (!entry)
            return null;
        return { bid: entry.bid, ask: entry.ask };
    }
    getAllPrices() {
        return new Map(this.cache);
    }
    getSymbolCount() {
        return this.cache.size;
    }
    isStale(symbol) {
        const entry = this.cache.get(symbol);
        if (!entry)
            return true;
        return Date.now() - entry.timestamp > STALE_THRESHOLD_MS;
    }
    getStaleSymbols() {
        const stale = [];
        const now = Date.now();
        for (const [symbol, entry] of this.cache) {
            if (now - entry.timestamp > STALE_THRESHOLD_MS) {
                stale.push(symbol);
            }
        }
        return stale;
    }
    async refreshPrice(symbol) {
        if (!this.adapter)
            return null;
        try {
            const ticker = await this.adapter.getTicker(symbol);
            this.updatePrice(symbol, ticker);
            return this.cache.get(symbol) || null;
        }
        catch (error) {
            return null;
        }
    }
    async refreshAllPrices() {
        if (!this.adapter || this.symbols.length === 0)
            return;
        this.isRefreshing = true;
        const batchSize = 5;
        for (let i = 0; i < this.symbols.length; i += batchSize) {
            const batch = this.symbols.slice(i, i + batchSize);
            await Promise.allSettled(batch.map((symbol) => this.refreshPrice(symbol)));
        }
        this.isRefreshing = false;
    }
    async unsubscribeAll() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    clear() {
        this.cache.clear();
    }
    async close() {
        await this.unsubscribeAll();
        this.clear();
        this.removeAllListeners();
    }
}
export function createPriceCache() {
    return new PriceCache();
}
