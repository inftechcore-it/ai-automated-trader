/**
 * BotEngine - Master orchestrator for all trading bots
 * Manages bot lifecycle, enforces limits, handles persistence
 */
import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { BotInstance } from './BotInstance.js';
import { BotScheduler, getBotScheduler } from './BotScheduler.js';
import type { IBotStrategy } from './IBotStrategy.js';
import type {
  BotConfig,
  BotStatus,
  BotStrategyType,
  BotMode,
  BotParams,
  TradeRecord,
  PriceTick,
} from './types.js';

// Strategy imports
import { GridBot } from './strategies/GridBot.js';
import { DCABot } from './strategies/DCABot.js';
import { SmartTradeBot } from './strategies/SmartTradeBot.js';
import { TrailingBot } from './strategies/TrailingBot.js';
import { InfinityGridBot } from './strategies/InfinityGridBot.js';
import { MartingaleBot } from './strategies/MartingaleBot.js';
import { RebalancingBot } from './strategies/RebalancingBot.js';
import { DynamicGridBot } from './strategies/DynamicGridBot.js';

interface BotEngineConfig {
  maxBotsPerUser: number;
  maxTotalBots: number;
  snapshotIntervalMs: number;
}

interface CreateBotParams {
  userId: string;
  name: string;
  strategyType: BotStrategyType;
  exchangeName: string;
  symbol: string;
  mode: BotMode;
  params: BotParams;
  investedAmount: number;
}

const DEFAULT_CONFIG: BotEngineConfig = {
  maxBotsPerUser: 10,
  maxTotalBots: 20,
  snapshotIntervalMs: 60 * 60 * 1000, // 1 hour
};

export class BotEngine extends EventEmitter {
  private prisma: PrismaClient;
  private config: BotEngineConfig;
  private bots: Map<string, BotInstance> = new Map();
  private scheduler: BotScheduler;
  private isInitialized = false;
  private executionEngine: any;
  private socketIo: any;

  constructor(config: Partial<BotEngineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.prisma = new PrismaClient();
    this.scheduler = getBotScheduler();
  }

  async initialize(socketIo?: any): Promise<void> {
    if (this.isInitialized) return;

    console.log('[BotEngine] Initializing...');

    this.socketIo = socketIo;

    // Initialize execution engine
    this.executionEngine = await this.createExecutionEngine();

    // Start scheduler
    await this.scheduler.start();

    // Load and resume active bots
    await this.loadActiveBots();

    this.isInitialized = true;
    console.log(`[BotEngine] Initialized with ${this.bots.size} active bots`);
    this.emit('initialized');
  }

  async shutdown(): Promise<void> {
    console.log('[BotEngine] Shutting down...');

    // Stop all bots
    for (const bot of this.bots.values()) {
      try {
        await bot.stop('Engine shutdown');
      } catch {}
    }

    await this.scheduler.stop();
    await this.prisma.$disconnect();

    this.isInitialized = false;
    console.log('[BotEngine] Shutdown complete');
  }

  private async loadActiveBots(): Promise<void> {
    try {
      const activeBots = await this.prisma.botConfig.findMany({
        where: { status: { in: ['RUNNING', 'PAUSED'] } },
      });

      console.log(`[BotEngine] Found ${activeBots.length} active bots to resume`);

      for (const dbBot of activeBots) {
        try {
          const config = this.dbToConfig(dbBot);
          const strategy = this.createStrategy(config.strategyType);

          const instance = new BotInstance({
            strategy,
            config,
            executionEngine: this.executionEngine,
            onStateChange: (botId, status, data) => this.handleStateChange(botId, status, data),
            onTrade: (botId, trade) => this.handleTrade(botId, trade),
            onError: (botId, error, severity) => this.handleError(botId, error, severity),
            onLog: (botId, message, level) => this.emitLog(botId, message, level),
          });

          this.bots.set(config.id, instance);

          // Subscribe to price feed
          await this.scheduler.subscribe(
            config.id,
            config.exchangeName,
            config.symbol,
            (tick) => instance.processTick(tick)
          );

          // Resume if was running
          if (config.status === 'RUNNING') {
            await instance.start();
          }

          console.log(`[BotEngine] Resumed bot: ${config.name}`);
        } catch (error: any) {
          console.error(`[BotEngine] Failed to resume bot ${dbBot.id}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error('[BotEngine] Failed to load active bots:', error.message);
    }
  }

  async createBot(params: CreateBotParams): Promise<BotConfig> {
    // Validate limits
    const userBotCount = await this.prisma.botConfig.count({
      where: { userId: params.userId, status: { notIn: ['STOPPED'] } },
    });

    if (userBotCount >= this.config.maxBotsPerUser) {
      throw new Error(`Maximum ${this.config.maxBotsPerUser} active bots per user`);
    }

    if (this.bots.size >= this.config.maxTotalBots) {
      throw new Error(`System limit of ${this.config.maxTotalBots} total bots reached`);
    }

    // Create strategy and validate params
    const strategy = this.createStrategy(params.strategyType);
    const validation = strategy.validate(params.params);

    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors?.join(', ')}`);
    }

    // DYNAMIC_GRID in AUTO mode doesn't need a symbol - it discovers coins automatically
    // Use a reference symbol for price feed subscription (the bot will manage multiple coins internally)
    let symbol = params.symbol;
    if (params.strategyType === 'DYNAMIC_GRID') {
      const dynamicParams = params.params as { coinSelectionMode?: string };
      if (!symbol || dynamicParams?.coinSelectionMode === 'AUTO') {
        symbol = 'BTC/USDT'; // Reference symbol for market heartbeat
        console.log(`[BotEngine] DYNAMIC_GRID auto-discovery mode - using ${symbol} as reference`);
      }
    }

    // Create in database
    const dbBot = await this.prisma.botConfig.create({
      data: {
        userId: params.userId,
        name: params.name,
        strategyType: params.strategyType,
        exchangeName: params.exchangeName,
        symbol: symbol,
        mode: params.mode,
        status: 'CREATED',
        params: params.params as any,
        investedAmount: params.investedAmount,
        currentValue: params.investedAmount,
        totalProfit: 0,
        totalTrades: 0,
      },
    });

    const config = this.dbToConfig(dbBot);
    console.log(`[BotEngine] Created bot: ${config.name} (${config.id})`);

    this.emit('bot:created', { botId: config.id, config });
    return config;
  }

  async startBot(botId: string): Promise<void> {
    let instance = this.bots.get(botId);

    if (!instance) {
      // Load from database
      const dbBot = await this.prisma.botConfig.findUnique({ where: { id: botId } });
      if (!dbBot) {
        throw new Error('Bot not found');
      }

      const config = this.dbToConfig(dbBot);
      const strategy = this.createStrategy(config.strategyType);

      instance = new BotInstance({
        strategy,
        config,
        executionEngine: this.executionEngine,
        onStateChange: (id, status, data) => this.handleStateChange(id, status, data),
        onTrade: (id, trade) => this.handleTrade(id, trade),
        onError: (id, error, severity) => this.handleError(id, error, severity),
        onLog: (id, message, level) => this.emitLog(id, message, level),
      });

      this.bots.set(botId, instance);

      // Subscribe to price feed
      await this.scheduler.subscribe(
        botId,
        config.exchangeName,
        config.symbol,
        (tick) => instance!.processTick(tick)
      );
    }

    await instance.start();
  }

  async stopBot(botId: string, reason = 'User requested'): Promise<void> {
    const instance = this.bots.get(botId);
    if (!instance) {
      throw new Error('Bot not found or not running');
    }

    await instance.stop(reason);
    this.scheduler.unsubscribeAll(botId);
    this.bots.delete(botId);
  }

  async pauseBot(botId: string): Promise<void> {
    const instance = this.bots.get(botId);
    if (!instance) {
      throw new Error('Bot not found or not running');
    }

    await instance.pause();
  }

  async resumeBot(botId: string): Promise<void> {
    const instance = this.bots.get(botId);
    if (!instance) {
      throw new Error('Bot not found');
    }

    await instance.resume();
  }

  async deleteBot(botId: string): Promise<void> {
    // Stop if running
    if (this.bots.has(botId)) {
      await this.stopBot(botId, 'Deleted');
    }

    // Delete from database
    await this.prisma.botConfig.delete({ where: { id: botId } });

    console.log(`[BotEngine] Deleted bot: ${botId}`);
    this.emit('bot:deleted', { botId });
  }

  async updateBotParams(botId: string, params: BotParams): Promise<BotConfig> {
    const instance = this.bots.get(botId);

    if (instance && instance.currentStatus === 'RUNNING') {
      throw new Error('Cannot update params while bot is running. Pause first.');
    }

    // Validate new params
    const dbBot = await this.prisma.botConfig.findUnique({ where: { id: botId } });
    if (!dbBot) {
      throw new Error('Bot not found');
    }

    const strategy = this.createStrategy(dbBot.strategyType as BotStrategyType);
    const validation = strategy.validate(params);

    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors?.join(', ')}`);
    }

    const updated = await this.prisma.botConfig.update({
      where: { id: botId },
      data: { params: params as any },
    });

    return this.dbToConfig(updated);
  }

  getBot(botId: string): BotInstance | undefined {
    return this.bots.get(botId);
  }

  getBotStats(botId: string): any {
    const instance = this.bots.get(botId);
    if (!instance) {
      return null;
    }
    return instance.getStats();
  }

  async getUserBots(userId: string): Promise<any[]> {
    const dbBots = await this.prisma.botConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return dbBots.map(db => {
      const instance = this.bots.get(db.id);
      return instance ? instance.getStats() : this.dbToConfig(db);
    });
  }

  async getBotOrders(botId: string, limit = 50): Promise<any[]> {
    return this.prisma.botOrder.findMany({
      where: { botConfigId: botId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getBotSnapshots(botId: string, limit = 168): Promise<any[]> {
    return this.prisma.botSnapshot.findMany({
      where: { botConfigId: botId },
      orderBy: { snapshotAt: 'desc' },
      take: limit,
    });
  }

  getAllBots(): Map<string, BotInstance> {
    return this.bots;
  }

  getStats() {
    const botValues = Array.from(this.bots.values());
    const running = botValues.filter(b => b.currentStatus === 'RUNNING').length;
    const paused = botValues.filter(b => b.currentStatus === 'PAUSED').length;

    return {
      totalBots: this.bots.size,
      runningBots: running,
      pausedBots: paused,
      maxBots: this.config.maxTotalBots,
      scheduler: this.scheduler.getStats(),
    };
  }

  private createStrategy(type: BotStrategyType): IBotStrategy {
    switch (type) {
      case 'GRID':
        return new GridBot();
      case 'INFINITY_GRID':
        return new InfinityGridBot();
      case 'DCA':
        return new DCABot();
      case 'SMART_TRADE':
        return new SmartTradeBot();
      case 'TRAILING':
        return new TrailingBot();
      case 'MARTINGALE':
        return new MartingaleBot();
      case 'REBALANCING':
        return new RebalancingBot();
      case 'DYNAMIC_GRID':
        return new DynamicGridBot();
      case 'ARBITRAGE':
        throw new Error('Arbitrage bot uses existing scanner - not implemented as strategy');
      default:
        throw new Error(`Unknown strategy type: ${type}`);
    }
  }

  private async handleStateChange(botId: string, status: BotStatus, data?: any): Promise<void> {
    try {
      await this.prisma.botConfig.update({
        where: { id: botId },
        data: {
          status,
          startedAt: status === 'RUNNING' ? new Date() : undefined,
          stoppedAt: status === 'STOPPED' ? new Date() : undefined,
        },
      });

      this.emitSocket('bot:status', { botId, status, ...data });
      this.emit('bot:status', { botId, status, ...data });
    } catch (error) {
      console.error('[BotEngine] Failed to update status:', error);
    }
  }

  private async handleTrade(botId: string, trade: TradeRecord): Promise<void> {
    try {
      const instance = this.bots.get(botId);
      if (!instance) return;

      // Save order to database
      await this.prisma.botOrder.create({
        data: {
          botConfigId: botId,
          exchangeOrderId: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          type: 'MARKET',
          quantity: trade.quantity,
          price: trade.price,
          filledQuantity: trade.quantity,
          filledPrice: trade.price,
          status: 'FILLED',
          fee: trade.fee,
          profit: trade.profit,
          filledAt: trade.executedAt,
        },
      });

      // Update bot stats
      const stats = instance.getStats();
      await this.prisma.botConfig.update({
        where: { id: botId },
        data: {
          currentValue: stats.currentValue,
          totalProfit: stats.totalProfit,
          totalTrades: stats.totalTrades,
        },
      });

      this.emitSocket('bot:trade', {
        botId,
        side: trade.side,
        price: trade.price,
        quantity: trade.quantity,
        profit: trade.profit,
      });

      this.emit('bot:trade', { botId, trade });
    } catch (error) {
      console.error('[BotEngine] Failed to save trade:', error);
    }
  }

  private handleError(botId: string, error: string, severity: 'warning' | 'error' | 'critical'): void {
    console.error(`[BotEngine] Bot ${botId} ${severity}:`, error);

    this.emitSocket('bot:error', { botId, error, severity });
    this.emit('bot:error', { botId, error, severity });

    if (severity === 'critical') {
      // Stop bot on critical error
      this.stopBot(botId, `Critical error: ${error}`).catch(() => {});
    }
  }

  private emitSocket(event: string, data: any): void {
    if (this.socketIo) {
      this.socketIo.emit(event, data);
    }
  }

  emitLog(botId: string, message: string, level: 'info' | 'warn' | 'error' = 'info', metadata?: any): void {
    const logEntry = {
      botId,
      message,
      level,
      metadata,
      timestamp: new Date().toISOString(),
    };
    this.emitSocket('bot:log', logEntry);
    this.emit('bot:log', logEntry);

    // Persist to database (fire and forget)
    this.prisma.botLog.create({
      data: {
        botId,
        message,
        level,
        metadata: metadata || undefined,
      }
    }).catch(err => console.error('[BotEngine] Failed to save log:', err.message));
  }

  async getBotLogs(botId: string, limit: number = 100): Promise<any[]> {
    return this.prisma.botLog.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async createExecutionEngine(): Promise<any> {
    return {
      placeOrder: async (params: any) => {
        if (params.dryRun) {
          // Paper trading - simulate fill
          return {
            orderId: `paper_${Date.now()}`,
            status: 'FILLED',
            filledPrice: params.price || params.type === 'MARKET' ? await this.getMarketPrice(params.exchange, params.symbol) : params.price,
            filledQuantity: params.quantity,
          };
        }

        // Live trading - use real adapter
        const { getAdapter } = await import('../../arbitrage/dist/adapters/index.js');
        const adapter = await getAdapter(params.exchange);

        console.log(`[BotEngine] Placing LIVE order: ${params.side} ${params.quantity} ${params.symbol} @ ${params.price || 'market'}`);

        try {
          const order = await (adapter as any).placeOrder({
            symbol: params.symbol,
            side: params.side.toLowerCase(),
            type: params.type.toLowerCase(),
            quantity: params.quantity,
            price: params.price,
          });
          console.log(`[BotEngine] Order result:`, order);

          // Normalize status to uppercase for consistency
          const normalizedStatus = (order.status || 'open').toUpperCase();
          const isFilled = normalizedStatus === 'FILLED' || normalizedStatus === 'CLOSED';

          return {
            orderId: order.orderId || order.id,
            status: isFilled ? 'FILLED' : normalizedStatus,
            filledPrice: order.avgFillPrice || order.average || order.price || params.price,
            filledQuantity: isFilled ? params.quantity : (order.filledQuantity || order.filled || 0),
          };
        } catch (error: any) {
          console.error(`[BotEngine] LIVE order failed:`, error.message);
          throw error;
        }
      },

      cancelOrder: async (params: any) => {
        if (params.orderId.startsWith('paper_')) {
          return { success: true };
        }

        const { getAdapter } = await import('../../arbitrage/dist/adapters/index.js');
        const adapter = await getAdapter(params.exchange);

        await adapter.cancelOrder(params.orderId, params.symbol);
        return { success: true };
      },
    };
  }

  private async getMarketPrice(exchange: string, symbol: string): Promise<number> {
    const cached = this.scheduler.getLastPrice(exchange, symbol);
    if (cached) {
      return cached.price;
    }

    const { getAdapter } = await import('../../arbitrage/dist/adapters/index.js');
    const adapter = await getAdapter(exchange);
    const ticker = await adapter.getTicker(symbol);
    return ticker.last || ticker.close || 0;
  }

  private dbToConfig(db: any): BotConfig {
    return {
      id: db.id,
      userId: db.userId,
      name: db.name,
      strategyType: db.strategyType as BotStrategyType,
      exchangeName: db.exchangeName,
      symbol: db.symbol,
      mode: db.mode as BotMode,
      status: db.status as BotStatus,
      params: db.params as BotParams,
      investedAmount: Number(db.investedAmount),
      currentValue: Number(db.currentValue),
      totalProfit: Number(db.totalProfit),
      totalTrades: db.totalTrades,
      createdAt: db.createdAt,
      startedAt: db.startedAt,
      stoppedAt: db.stoppedAt,
    };
  }
}

// Singleton
let engineInstance: BotEngine | null = null;

export function getBotEngine(): BotEngine {
  if (!engineInstance) {
    engineInstance = new BotEngine();
  }
  return engineInstance;
}

export async function initializeBotEngine(socketIo?: any): Promise<BotEngine> {
  const engine = getBotEngine();
  await engine.initialize(socketIo);
  return engine;
}
