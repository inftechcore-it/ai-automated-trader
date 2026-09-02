import { PrismaClient } from '@prisma/client';
import { BinanceAdapter } from './BinanceAdapter.js';
import { BybitAdapter } from './BybitAdapter.js';
import { KrakenAdapter } from './KrakenAdapter.js';
import { PionexAdapter } from './PionexAdapter.js';
import { AngelOneAdapter } from './AngelOneAdapter.js';
import { JupiterAdapter } from './JupiterAdapter.js';
import { ConfigurationError } from '../utils/errors.js';
const ADAPTER_REGISTRY = {
    binance: BinanceAdapter,
    bybit: BybitAdapter,
    kraken: KrakenAdapter,
    pionex: PionexAdapter,
    angelone: AngelOneAdapter,
    jupiter: JupiterAdapter,
};
class AdapterFactory {
    prisma;
    adapters = new Map();
    initPromises = new Map();
    constructor() {
        this.prisma = new PrismaClient();
    }
    async getAdapter(exchangeName) {
        const normalizedName = exchangeName.toLowerCase();
        const existing = this.adapters.get(normalizedName);
        if (existing) {
            return existing;
        }
        const pending = this.initPromises.get(normalizedName);
        if (pending) {
            return pending;
        }
        const initPromise = this.createAdapter(normalizedName);
        this.initPromises.set(normalizedName, initPromise);
        try {
            const adapter = await initPromise;
            this.adapters.set(normalizedName, adapter);
            return adapter;
        }
        finally {
            this.initPromises.delete(normalizedName);
        }
    }
    async createAdapter(exchangeName) {
        const AdapterClass = ADAPTER_REGISTRY[exchangeName];
        if (!AdapterClass) {
            throw new ConfigurationError(`Unsupported exchange: ${exchangeName}. Supported: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`);
        }
        const config = await this.loadExchangeConfig(exchangeName);
        const adapter = new AdapterClass();
        await adapter.initialize(config);
        return adapter;
    }
    async loadExchangeConfig(exchangeName) {
        const exchange = await this.prisma.exchange.findFirst({
            where: {
                name: exchangeName,
                isActive: true,
            },
        });
        const useTestnet = process.env.USE_TESTNET !== 'false';
        if (exchange) {
            return {
                id: exchange.id,
                name: exchange.name,
                type: exchange.type.toLowerCase(),
                apiKey: exchange.apiKeyEncrypted || undefined,
                apiSecret: exchange.apiSecretEncrypted || undefined,
                testnet: exchange.testnet,
                isActive: exchange.isActive,
            };
        }
        const envApiKey = process.env[`${exchangeName.toUpperCase()}_API_KEY`];
        const envApiSecret = process.env[`${exchangeName.toUpperCase()}_API_SECRET`];
        if (!envApiKey || !envApiSecret) {
            console.warn(`[AdapterFactory] No credentials found for ${exchangeName}. Using public API only.`);
        }
        return {
            id: `env_${exchangeName}`,
            name: exchangeName,
            type: 'spot',
            apiKey: envApiKey,
            apiSecret: envApiSecret,
            testnet: useTestnet,
            isActive: true,
        };
    }
    async closeAdapter(exchangeName) {
        const normalizedName = exchangeName.toLowerCase();
        const adapter = this.adapters.get(normalizedName);
        if (adapter) {
            await adapter.close();
            this.adapters.delete(normalizedName);
        }
    }
    async closeAll() {
        const closePromises = [];
        for (const [name, adapter] of this.adapters) {
            closePromises.push(adapter.close().then(() => {
                this.adapters.delete(name);
            }));
        }
        await Promise.allSettled(closePromises);
        await this.prisma.$disconnect();
    }
    getSupportedExchanges() {
        return Object.keys(ADAPTER_REGISTRY);
    }
    isSupported(exchangeName) {
        return exchangeName.toLowerCase() in ADAPTER_REGISTRY;
    }
    isInitialized(exchangeName) {
        return this.adapters.has(exchangeName.toLowerCase());
    }
}
export const adapterFactory = new AdapterFactory();
export async function getAdapter(exchangeName) {
    return adapterFactory.getAdapter(exchangeName);
}
export async function closeAdapter(exchangeName) {
    return adapterFactory.closeAdapter(exchangeName);
}
export async function closeAllAdapters() {
    return adapterFactory.closeAll();
}
export function getSupportedExchanges() {
    return adapterFactory.getSupportedExchanges();
}
export function isExchangeSupported(exchangeName) {
    return adapterFactory.isSupported(exchangeName);
}
export async function getAdapters(exchangeNames) {
    const adapters = new Map();
    await Promise.all(exchangeNames.map(async (name) => {
        try {
            const adapter = await adapterFactory.getAdapter(name);
            adapters.set(name.toLowerCase(), adapter);
        }
        catch (error) {
            console.warn(`[AdapterFactory] Failed to initialize ${name}:`, error);
        }
    }));
    return adapters;
}
