import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BinanceAdapter } from '../src/adapters/BinanceAdapter.js';
import { BybitAdapter } from '../src/adapters/BybitAdapter.js';
import { adapterFactory, getSupportedExchanges, isExchangeSupported } from '../src/adapters/AdapterFactory.js';
import type { ExchangeConfig, Ticker } from '../src/types/index.js';

vi.mock('ccxt', () => {
  const mockTicker = {
    symbol: 'BTC/USDT',
    bid: 42000,
    bidVolume: 1.5,
    ask: 42010,
    askVolume: 2.0,
    last: 42005,
    high: 43000,
    low: 41000,
    open: 41500,
    close: 42005,
    change: 505,
    percentage: 1.22,
    baseVolume: 10000,
    quoteVolume: 420000000,
    timestamp: Date.now(),
  };

  const mockOrderBook = {
    bids: [[42000, 1.5], [41990, 2.0], [41980, 1.0]],
    asks: [[42010, 1.0], [42020, 2.0], [42030, 1.5]],
    timestamp: Date.now(),
    nonce: 12345,
  };

  const mockBalance = {
    total: { BTC: 1.5, USDT: 50000 },
    free: { BTC: 1.0, USDT: 45000 },
    used: { BTC: 0.5, USDT: 5000 },
  };

  class MockExchange {
    setSandboxMode = vi.fn();
    loadMarkets = vi.fn().mockResolvedValue({});
    fetchTicker = vi.fn().mockResolvedValue(mockTicker);
    fetchOrderBook = vi.fn().mockResolvedValue(mockOrderBook);
    fetchBalance = vi.fn().mockResolvedValue(mockBalance);
    createOrder = vi.fn().mockResolvedValue({
      id: 'order123',
      clientOrderId: 'client123',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'limit',
      status: 'open',
      amount: 0.1,
      filled: 0,
      price: 42000,
      timestamp: Date.now(),
    });
    cancelOrder = vi.fn().mockResolvedValue({ id: 'order123' });
    fetchOpenOrders = vi.fn().mockResolvedValue([]);
    fetchMyTrades = vi.fn().mockResolvedValue([]);
    close = vi.fn().mockResolvedValue(undefined);
  }

  return {
    default: {
      binance: MockExchange,
      bybit: MockExchange,
    },
    binance: MockExchange,
    bybit: MockExchange,
  };
});

vi.mock('../src/utils/encryption.js', () => ({
  encrypt: vi.fn((val: string) => `encrypted_${val}`),
  decrypt: vi.fn((val: string) => val.replace('encrypted_', '')),
  isEncrypted: vi.fn(() => true),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    exchange: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('BinanceAdapter', () => {
  let adapter: BinanceAdapter;
  const testConfig: ExchangeConfig = {
    id: 'test-binance',
    name: 'binance',
    type: 'spot',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    testnet: true,
    isActive: true,
  };

  beforeEach(async () => {
    adapter = new BinanceAdapter();
    await adapter.initialize(testConfig);
  });

  afterEach(async () => {
    await adapter.close();
  });

  it('should have correct exchange name', () => {
    expect(adapter.exchangeName).toBe('Binance');
  });

  it('should be in testnet mode', () => {
    expect(adapter.isTestnet).toBe(true);
  });

  it('should fetch ticker with correct types', async () => {
    const ticker = await adapter.getTicker('BTC/USDT');

    expect(ticker).toBeDefined();
    expect(ticker.symbol).toBe('BTC/USDT');
    expect(ticker.exchange).toBe('Binance');
    expect(typeof ticker.bid).toBe('number');
    expect(typeof ticker.ask).toBe('number');
    expect(typeof ticker.last).toBe('number');
    expect(typeof ticker.high).toBe('number');
    expect(typeof ticker.low).toBe('number');
    expect(typeof ticker.volume).toBe('number');
    expect(typeof ticker.timestamp).toBe('number');
  });

  it('should fetch order book with correct structure', async () => {
    const orderBook = await adapter.getOrderBook('BTC/USDT', 20);

    expect(orderBook).toBeDefined();
    expect(orderBook.symbol).toBe('BTC/USDT');
    expect(orderBook.exchange).toBe('Binance');
    expect(Array.isArray(orderBook.bids)).toBe(true);
    expect(Array.isArray(orderBook.asks)).toBe(true);
    expect(orderBook.bids[0]).toHaveProperty('price');
    expect(orderBook.bids[0]).toHaveProperty('amount');
  });

  it('should fetch balance with correct types', async () => {
    const balances = await adapter.getBalance();

    expect(Array.isArray(balances)).toBe(true);
    expect(balances.length).toBeGreaterThan(0);
    expect(balances[0]).toHaveProperty('asset');
    expect(balances[0]).toHaveProperty('free');
    expect(balances[0]).toHaveProperty('locked');
    expect(balances[0]).toHaveProperty('total');
  });

  it('should place order and return result', async () => {
    const result = await adapter.placeOrder({
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'limit',
      quantity: 0.1,
      price: 42000,
    });

    expect(result).toBeDefined();
    expect(result.orderId).toBe('order123');
    expect(result.symbol).toBe('BTC/USDT');
    expect(result.side).toBe('buy');
  });
});

describe('BybitAdapter', () => {
  let adapter: BybitAdapter;
  const testConfig: ExchangeConfig = {
    id: 'test-bybit',
    name: 'bybit',
    type: 'spot',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    testnet: true,
    isActive: true,
  };

  beforeEach(async () => {
    adapter = new BybitAdapter();
    await adapter.initialize(testConfig);
  });

  afterEach(async () => {
    await adapter.close();
  });

  it('should have correct exchange name', () => {
    expect(adapter.exchangeName).toBe('Bybit');
  });

  it('should be in testnet mode', () => {
    expect(adapter.isTestnet).toBe(true);
  });

  it('should fetch ticker with correct types', async () => {
    const ticker = await adapter.getTicker('BTC/USDT');

    expect(ticker).toBeDefined();
    expect(ticker.symbol).toBe('BTC/USDT');
    expect(ticker.exchange).toBe('Bybit');
    expect(typeof ticker.bid).toBe('number');
    expect(typeof ticker.ask).toBe('number');
    expect(typeof ticker.last).toBe('number');
  });

  it('should fetch order book with correct structure', async () => {
    const orderBook = await adapter.getOrderBook('ETH/USDT', 20);

    expect(orderBook).toBeDefined();
    expect(orderBook.symbol).toBe('ETH/USDT');
    expect(orderBook.exchange).toBe('Bybit');
    expect(Array.isArray(orderBook.bids)).toBe(true);
    expect(Array.isArray(orderBook.asks)).toBe(true);
  });
});

describe('AdapterFactory', () => {
  beforeEach(() => {
    vi.stubEnv('USE_TESTNET', 'true');
    vi.stubEnv('BINANCE_API_KEY', 'test-binance-key');
    vi.stubEnv('BINANCE_API_SECRET', 'test-binance-secret');
    vi.stubEnv('BYBIT_API_KEY', 'test-bybit-key');
    vi.stubEnv('BYBIT_API_SECRET', 'test-bybit-secret');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
  });

  it('should return supported exchanges', () => {
    const exchanges = getSupportedExchanges();

    expect(exchanges).toContain('binance');
    expect(exchanges).toContain('bybit');
  });

  it('should correctly check if exchange is supported', () => {
    expect(isExchangeSupported('binance')).toBe(true);
    expect(isExchangeSupported('bybit')).toBe(true);
    expect(isExchangeSupported('unknown')).toBe(false);
  });

  it('should return Binance adapter for binance', async () => {
    const adapter = await adapterFactory.getAdapter('binance');

    expect(adapter).toBeDefined();
    expect(adapter.exchangeName).toBe('Binance');

    await adapterFactory.closeAdapter('binance');
  });

  it('should return Bybit adapter for bybit', async () => {
    const adapter = await adapterFactory.getAdapter('bybit');

    expect(adapter).toBeDefined();
    expect(adapter.exchangeName).toBe('Bybit');

    await adapterFactory.closeAdapter('bybit');
  });

  it('should return same instance for repeated calls', async () => {
    const adapter1 = await adapterFactory.getAdapter('binance');
    const adapter2 = await adapterFactory.getAdapter('binance');

    expect(adapter1).toBe(adapter2);

    await adapterFactory.closeAdapter('binance');
  });

  it('should throw for unsupported exchange', async () => {
    await expect(adapterFactory.getAdapter('unsupported')).rejects.toThrow(
      'Unsupported exchange'
    );
  });
});
