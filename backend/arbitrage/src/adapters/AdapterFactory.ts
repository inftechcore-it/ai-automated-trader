import { PrismaClient } from '@prisma/client';
import type { IExchangeAdapter } from './IExchangeAdapter.js';
import { BinanceAdapter } from './BinanceAdapter.js';
import { BybitAdapter } from './BybitAdapter.js';
import { KrakenAdapter } from './KrakenAdapter.js';
import { PionexAdapter } from './PionexAdapter.js';
import { ConfigurationError, AdapterError } from '../utils/errors.js';
import type { ExchangeConfig } from '../types/index.js';

type AdapterConstructor = new () => IExchangeAdapter;

const ADAPTER_REGISTRY: Record<string, AdapterConstructor> = {
  binance: BinanceAdapter,
  bybit: BybitAdapter,
  kraken: KrakenAdapter,
  pionex: PionexAdapter,
};

class AdapterFactory {
  private prisma: PrismaClient;
  private adapters: Map<string, IExchangeAdapter> = new Map();
  private initPromises: Map<string, Promise<IExchangeAdapter>> = new Map();

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getAdapter(exchangeName: string): Promise<IExchangeAdapter> {
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
    } finally {
      this.initPromises.delete(normalizedName);
    }
  }

  private async createAdapter(exchangeName: string): Promise<IExchangeAdapter> {
    const AdapterClass = ADAPTER_REGISTRY[exchangeName];
    if (!AdapterClass) {
      throw new ConfigurationError(
        `Unsupported exchange: ${exchangeName}. Supported: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`
      );
    }

    const config = await this.loadExchangeConfig(exchangeName);
    const adapter = new AdapterClass();
    await adapter.initialize(config);

    return adapter;
  }

  private async loadExchangeConfig(exchangeName: string): Promise<ExchangeConfig> {
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
        type: exchange.type.toLowerCase() as 'spot' | 'futures',
        apiKey: exchange.apiKeyEncrypted || undefined,
        apiSecret: exchange.apiSecretEncrypted || undefined,
        testnet: exchange.testnet,
        isActive: exchange.isActive,
      };
    }

    const envApiKey = process.env[`${exchangeName.toUpperCase()}_API_KEY`];
    const envApiSecret = process.env[`${exchangeName.toUpperCase()}_API_SECRET`];

    if (!envApiKey || !envApiSecret) {
      console.warn(
        `[AdapterFactory] No credentials found for ${exchangeName}. Using public API only.`
      );
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

  async closeAdapter(exchangeName: string): Promise<void> {
    const normalizedName = exchangeName.toLowerCase();
    const adapter = this.adapters.get(normalizedName);

    if (adapter) {
      await adapter.close();
      this.adapters.delete(normalizedName);
    }
  }

  async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [name, adapter] of this.adapters) {
      closePromises.push(
        adapter.close().then(() => {
          this.adapters.delete(name);
        })
      );
    }

    await Promise.allSettled(closePromises);
    await this.prisma.$disconnect();
  }

  getSupportedExchanges(): string[] {
    return Object.keys(ADAPTER_REGISTRY);
  }

  isSupported(exchangeName: string): boolean {
    return exchangeName.toLowerCase() in ADAPTER_REGISTRY;
  }

  isInitialized(exchangeName: string): boolean {
    return this.adapters.has(exchangeName.toLowerCase());
  }
}

export const adapterFactory = new AdapterFactory();

export async function getAdapter(exchangeName: string): Promise<IExchangeAdapter> {
  return adapterFactory.getAdapter(exchangeName);
}

export async function closeAdapter(exchangeName: string): Promise<void> {
  return adapterFactory.closeAdapter(exchangeName);
}

export async function closeAllAdapters(): Promise<void> {
  return adapterFactory.closeAll();
}

export function getSupportedExchanges(): string[] {
  return adapterFactory.getSupportedExchanges();
}

export function isExchangeSupported(exchangeName: string): boolean {
  return adapterFactory.isSupported(exchangeName);
}

export async function getAdapters(exchangeNames: string[]): Promise<Map<string, IExchangeAdapter>> {
  const adapters = new Map<string, IExchangeAdapter>();

  await Promise.all(
    exchangeNames.map(async (name) => {
      try {
        const adapter = await adapterFactory.getAdapter(name);
        adapters.set(name.toLowerCase(), adapter);
      } catch (error) {
        console.warn(`[AdapterFactory] Failed to initialize ${name}:`, error);
      }
    })
  );

  return adapters;
}
