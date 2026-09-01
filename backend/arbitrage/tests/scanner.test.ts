import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouteGraph, Cycle, GraphEdge } from '../src/scanner/RouteGraph.js';
import { ArbitrageCalculator } from '../src/scanner/ArbitrageCalculator.js';
import { PriceCache } from '../src/scanner/PriceCache.js';

describe('RouteGraph', () => {
  describe('findTriangularCycles', () => {
    it('should find triangular cycles from a simple graph', () => {
      const graph = new RouteGraph(10);

      (graph as any).graph = {
        assets: new Set(['USDT', 'BTC', 'ETH']),
        edges: new Map([
          ['USDT', [
            { symbol: 'BTC/USDT', from: 'USDT', to: 'BTC', direction: 'buy' },
            { symbol: 'ETH/USDT', from: 'USDT', to: 'ETH', direction: 'buy' },
          ]],
          ['BTC', [
            { symbol: 'BTC/USDT', from: 'BTC', to: 'USDT', direction: 'sell' },
            { symbol: 'ETH/BTC', from: 'BTC', to: 'ETH', direction: 'buy' },
          ]],
          ['ETH', [
            { symbol: 'ETH/USDT', from: 'ETH', to: 'USDT', direction: 'sell' },
            { symbol: 'ETH/BTC', from: 'ETH', to: 'BTC', direction: 'sell' },
          ]],
        ]),
        pairs: [],
      };

      const cycles = graph.findTriangularCycles('USDT');

      expect(cycles.length).toBe(1);
      expect(cycles[0].assets).toContain('USDT');
      expect(cycles[0].assets).toContain('BTC');
      expect(cycles[0].assets).toContain('ETH');
      expect(cycles[0].legs.length).toBe(3);
    });

    it('should find multiple cycles from a larger graph', () => {
      const graph = new RouteGraph(10);

      (graph as any).graph = {
        assets: new Set(['USDT', 'BTC', 'ETH', 'BNB']),
        edges: new Map([
          ['USDT', [
            { symbol: 'BTC/USDT', from: 'USDT', to: 'BTC', direction: 'buy' },
            { symbol: 'ETH/USDT', from: 'USDT', to: 'ETH', direction: 'buy' },
            { symbol: 'BNB/USDT', from: 'USDT', to: 'BNB', direction: 'buy' },
          ]],
          ['BTC', [
            { symbol: 'BTC/USDT', from: 'BTC', to: 'USDT', direction: 'sell' },
            { symbol: 'ETH/BTC', from: 'BTC', to: 'ETH', direction: 'buy' },
            { symbol: 'BNB/BTC', from: 'BTC', to: 'BNB', direction: 'buy' },
          ]],
          ['ETH', [
            { symbol: 'ETH/USDT', from: 'ETH', to: 'USDT', direction: 'sell' },
            { symbol: 'ETH/BTC', from: 'ETH', to: 'BTC', direction: 'sell' },
            { symbol: 'BNB/ETH', from: 'ETH', to: 'BNB', direction: 'buy' },
          ]],
          ['BNB', [
            { symbol: 'BNB/USDT', from: 'BNB', to: 'USDT', direction: 'sell' },
            { symbol: 'BNB/BTC', from: 'BNB', to: 'BTC', direction: 'sell' },
            { symbol: 'BNB/ETH', from: 'BNB', to: 'ETH', direction: 'sell' },
          ]],
        ]),
        pairs: [],
      };

      const cycles = graph.findTriangularCycles('USDT');

      expect(cycles.length).toBeGreaterThan(1);
      cycles.forEach(cycle => {
        expect(cycle.assets[0]).toBe('USDT');
        expect(cycle.legs.length).toBe(3);
      });
    });

    it('should not find cycles that do not return to base', () => {
      const graph = new RouteGraph(10);

      (graph as any).graph = {
        assets: new Set(['USDT', 'BTC', 'ETH']),
        edges: new Map([
          ['USDT', [
            { symbol: 'BTC/USDT', from: 'USDT', to: 'BTC', direction: 'buy' },
          ]],
          ['BTC', [
            { symbol: 'ETH/BTC', from: 'BTC', to: 'ETH', direction: 'buy' },
          ]],
          ['ETH', [
          ]],
        ]),
        pairs: [],
      };

      const cycles = graph.findTriangularCycles('USDT');
      expect(cycles.length).toBe(0);
    });

    it('should throw error if graph not built', () => {
      const graph = new RouteGraph(10);
      expect(() => graph.findTriangularCycles('USDT')).toThrow('Graph not built');
    });
  });
});

describe('ArbitrageCalculator', () => {
  let calculator: ArbitrageCalculator;
  let mockPriceCache: PriceCache;

  beforeEach(() => {
    calculator = new ArbitrageCalculator({
      feeRate: 0.001,
      minProfitThresholdPercent: 0.1,
      startAmount: 1,
    });

    mockPriceCache = new PriceCache();
  });

  const createMockCycle = (): Cycle => ({
    assets: ['USDT', 'BTC', 'ETH'],
    legs: [
      { symbol: 'BTC/USDT', from: 'USDT', to: 'BTC', direction: 'buy' },
      { symbol: 'ETH/BTC', from: 'BTC', to: 'ETH', direction: 'buy' },
      { symbol: 'ETH/USDT', from: 'ETH', to: 'USDT', direction: 'sell' },
    ] as [GraphEdge, GraphEdge, GraphEdge],
    symbols: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT'] as [string, string, string],
  });

  it('should calculate profitable arbitrage correctly', () => {
    (mockPriceCache as any).cache = new Map([
      ['BTC/USDT', { bid: 67000, ask: 67010, last: 67005, timestamp: Date.now() }],
      ['ETH/BTC', { bid: 0.0515, ask: 0.0516, last: 0.0515, timestamp: Date.now() }],
      ['ETH/USDT', { bid: 3470, ask: 3471, last: 3470, timestamp: Date.now() }],
    ]);

    const cycle = createMockCycle();
    const result = calculator.calculateTriangularProfit(cycle, mockPriceCache, 0.001);

    expect(result).not.toBeNull();
    expect(result!.legs.length).toBe(3);
    expect(typeof result!.grossProfitPercent).toBe('number');
    expect(typeof result!.netProfitPercent).toBe('number');
    expect(result!.netProfitPercent).toBeLessThan(result!.grossProfitPercent);
  });

  it('should subtract fees correctly at each leg', () => {
    (mockPriceCache as any).cache = new Map([
      ['BTC/USDT', { bid: 67000, ask: 67000, last: 67000, timestamp: Date.now() }],
      ['ETH/BTC', { bid: 0.05, ask: 0.05, last: 0.05, timestamp: Date.now() }],
      ['ETH/USDT', { bid: 3350, ask: 3350, last: 3350, timestamp: Date.now() }],
    ]);

    const cycle = createMockCycle();

    const resultWithFees = calculator.calculateTriangularProfit(cycle, mockPriceCache, 0.001);
    const resultNoFees = calculator.calculateTriangularProfit(cycle, mockPriceCache, 0);

    expect(resultWithFees).not.toBeNull();
    expect(resultNoFees).not.toBeNull();
    expect(resultNoFees!.finalAmount).toBeGreaterThan(resultWithFees!.finalAmount);
    expect(resultNoFees!.grossProfitPercent).toBeCloseTo(resultNoFees!.netProfitPercent, 4);
  });

  it('should return null if price data is missing', () => {
    (mockPriceCache as any).cache = new Map([
      ['BTC/USDT', { bid: 67000, ask: 67010, last: 67005, timestamp: Date.now() }],
    ]);

    const cycle = createMockCycle();
    const result = calculator.calculateTriangularProfit(cycle, mockPriceCache);

    expect(result).toBeNull();
  });

  it('should mark unprofitable trades correctly', () => {
    (mockPriceCache as any).cache = new Map([
      ['BTC/USDT', { bid: 67000, ask: 67100, last: 67050, timestamp: Date.now() }],
      ['ETH/BTC', { bid: 0.0510, ask: 0.0520, last: 0.0515, timestamp: Date.now() }],
      ['ETH/USDT', { bid: 3400, ask: 3410, last: 3405, timestamp: Date.now() }],
    ]);

    const cycle = createMockCycle();
    const result = calculator.calculateTriangularProfit(cycle, mockPriceCache, 0.001);

    expect(result).not.toBeNull();
    expect(result!.profitable).toBe(false);
    expect(result!.netProfitPercent).toBeLessThan(0.1);
  });

  it('should handle zero fee rate', () => {
    (mockPriceCache as any).cache = new Map([
      ['BTC/USDT', { bid: 67000, ask: 67000, last: 67000, timestamp: Date.now() }],
      ['ETH/BTC', { bid: 0.05, ask: 0.05, last: 0.05, timestamp: Date.now() }],
      ['ETH/USDT', { bid: 3350, ask: 3350, last: 3350, timestamp: Date.now() }],
    ]);

    const cycle = createMockCycle();
    const result = calculator.calculateTriangularProfit(cycle, mockPriceCache, 0);

    expect(result).not.toBeNull();
    result!.legs.forEach(leg => {
      expect(leg.fee).toBe(0);
    });
  });

  it('should calculate correct direction for buy/sell', () => {
    (mockPriceCache as any).cache = new Map([
      ['BTC/USDT', { bid: 67000, ask: 67100, last: 67050, timestamp: Date.now() }],
      ['ETH/BTC', { bid: 0.05, ask: 0.051, last: 0.0505, timestamp: Date.now() }],
      ['ETH/USDT', { bid: 3400, ask: 3410, last: 3405, timestamp: Date.now() }],
    ]);

    const cycle = createMockCycle();
    const result = calculator.calculateTriangularProfit(cycle, mockPriceCache, 0);

    expect(result).not.toBeNull();
    expect(result!.legs[0].price).toBe(67100);
    expect(result!.legs[1].price).toBe(0.051);
    expect(result!.legs[2].price).toBe(3400);
  });
});

describe('Dedup Logic', () => {
  it('should identify same cycle keys correctly', () => {
    const cycle1Symbols = ['BTC/USDT', 'ETH/BTC', 'ETH/USDT'];
    const cycle2Symbols = ['ETH/USDT', 'BTC/USDT', 'ETH/BTC'];
    const cycle3Symbols = ['SOL/USDT', 'ETH/SOL', 'ETH/USDT'];

    const key1 = cycle1Symbols.sort().join('-');
    const key2 = cycle2Symbols.sort().join('-');
    const key3 = cycle3Symbols.sort().join('-');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('should track recent emissions with timestamps', () => {
    const recentlyEmitted = new Map<string, { timestamp: number; profit: number }>();
    const dedupWindowMs = 5000;

    const cycleKey = 'BTC/USDT-ETH/BTC-ETH/USDT';
    const now = Date.now();

    recentlyEmitted.set(cycleKey, { timestamp: now, profit: 0.5 });

    const entry = recentlyEmitted.get(cycleKey);
    expect(entry).toBeDefined();
    expect(now - entry!.timestamp).toBeLessThan(dedupWindowMs);
  });

  it('should allow re-emission after dedup window expires', () => {
    const recentlyEmitted = new Map<string, { timestamp: number; profit: number }>();
    const dedupWindowMs = 5000;

    const cycleKey = 'BTC/USDT-ETH/BTC-ETH/USDT';
    const oldTime = Date.now() - 6000;

    recentlyEmitted.set(cycleKey, { timestamp: oldTime, profit: 0.5 });

    const entry = recentlyEmitted.get(cycleKey);
    const shouldReEmit = Date.now() - entry!.timestamp > dedupWindowMs;

    expect(shouldReEmit).toBe(true);
  });

  it('should re-emit if profit changed significantly', () => {
    const profitChangeThreshold = 0.05;
    const oldProfit = 0.5;
    const newProfit = 0.6;

    const profitChange = Math.abs(newProfit - oldProfit);
    const shouldReEmit = profitChange >= profitChangeThreshold;

    expect(shouldReEmit).toBe(true);
  });

  it('should not re-emit if profit change is small', () => {
    const profitChangeThreshold = 0.05;
    const oldProfit = 0.5;
    const newProfit = 0.52;

    const profitChange = Math.abs(newProfit - oldProfit);
    const shouldReEmit = profitChange >= profitChangeThreshold;

    expect(shouldReEmit).toBe(false);
  });
});
