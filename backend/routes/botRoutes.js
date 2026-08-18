/**
 * Bot Engine API Routes
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/apiResponse.js';
import { getConnectedExchanges, getSupportedExchanges } from '../services/exchangeService.js';

const router = Router();

let botEngine = null;
let isInitializing = false;

async function getBotEngine() {
  if (botEngine) return botEngine;
  if (isInitializing) {
    // Wait a bit for initialization to complete
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (botEngine) return botEngine;
    }
    return null;
  }

  isInitializing = true;

  try {
    console.log('[BotRoutes] Initializing Bot Engine...');
    const { initializeBotEngine } = await import('../dist/bots/index.js');
    botEngine = await initializeBotEngine();
    console.log('[BotRoutes] Bot Engine initialized successfully');
    isInitializing = false;
    return botEngine;
  } catch (error) {
    console.error('[BotRoutes] Failed to initialize Bot Engine:', error.message);
    console.error('[BotRoutes] Stack:', error.stack);
    isInitializing = false;
    return null;
  }
}

// Initialize engine on first route access
export function setBotSocket(io) {
  getBotEngine().then(engine => {
    if (engine && io) {
      engine.on('bot:trade', (data) => io.emit('bot:trade', data));
      engine.on('bot:status', (data) => io.emit('bot:status', data));
      engine.on('bot:error', (data) => io.emit('bot:error', data));
      engine.on('bot:log', (data) => io.emit('bot:log', data));
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// EXCHANGES FOR BOT TRADING
// ═══════════════════════════════════════════════════════════════

// Get exchanges available for bot trading (auto-connected from env + user-connected)
router.get('/exchanges', requireAuth, async (req, res) => {
  try {
    const connected = getConnectedExchanges();
    const supported = getSupportedExchanges();

    return ok(res, {
      connected,
      supported,
      // Merge for easy frontend use
      exchanges: connected.map(ex => ({
        ...ex,
        label: ex.name,
        tradingEnabled: true
      }))
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// ═══════════════════════════════════════════════════════════════
// BOT CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════

// Create new bot
router.post('/create', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine not available');
    }

    const { name, strategyType, exchangeName, symbol, mode, params, investedAmount } = req.body;
    const userId = String(req.user?.id || 'default-user');

    const config = await engine.createBot({
      userId,
      name,
      strategyType,
      exchangeName,
      symbol,
      mode: mode || 'PAPER',
      params,
      investedAmount: Number(investedAmount),
    });

    return ok(res, { bot: config, message: 'Bot created successfully' });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

// Get all user's bots
router.get('/', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      console.log('[BotRoutes] Engine not ready, querying database directly');
      // Fallback: query database directly using Prisma
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const userId = String(req.user?.id || 'default-user');
        const bots = await prisma.botConfig.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' }
        });
        await prisma.$disconnect();
        console.log(`[BotRoutes] Found ${bots.length} bots from database`);
        return ok(res, { bots, engineReady: false });
      } catch (dbError) {
        console.error('[BotRoutes] Database query failed:', dbError.message);
        return ok(res, { bots: [], engineReady: false, error: 'Database not ready' });
      }
    }

    const userId = String(req.user?.id || 'default-user');
    const bots = await engine.getUserBots(userId);
    console.log(`[BotRoutes] Returning ${bots.length} bots from engine`);

    return ok(res, { bots, engineReady: true });
  } catch (error) {
    console.error('[BotRoutes] GET /bots error:', error.message);
    return ok(res, { bots: [], error: error.message });
  }
});

// Get single bot details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();

    // First try to get from engine (for running/paused bots)
    if (engine) {
      const stats = engine.getBotStats(req.params.id);
      if (stats) {
        return ok(res, { bot: stats });
      }
    }

    // Fallback: query database directly for stopped/created bots
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const userId = String(req.user?.id || 'default-user');

    const dbBot = await prisma.botConfig.findFirst({
      where: { id: req.params.id, userId }
    });
    await prisma.$disconnect();

    if (!dbBot) {
      return fail(res, 404, 'Bot not found');
    }

    // Format to match engine stats format
    return ok(res, {
      bot: {
        id: dbBot.id,
        name: dbBot.name,
        status: dbBot.status,
        strategyType: dbBot.strategyType,
        exchange: dbBot.exchangeName,
        exchangeName: dbBot.exchangeName,
        symbol: dbBot.symbol,
        mode: dbBot.mode,
        invested: Number(dbBot.investedAmount),
        investedAmount: Number(dbBot.investedAmount),
        currentValue: Number(dbBot.currentValue),
        totalProfit: Number(dbBot.totalProfit),
        totalTrades: dbBot.totalTrades,
        params: dbBot.params,
        createdAt: dbBot.createdAt,
        startedAt: dbBot.startedAt,
        stoppedAt: dbBot.stoppedAt,
      }
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Get bot orders
router.get('/:id/orders', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return ok(res, { orders: [] });
    }

    const limit = parseInt(req.query.limit) || 50;
    const orders = await engine.getBotOrders(req.params.id, limit);

    return ok(res, { orders });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Get bot logs
router.get('/:id/logs', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    const limit = parseInt(req.query.limit) || 100;

    if (engine) {
      const logs = await engine.getBotLogs(req.params.id, limit);
      return ok(res, { logs: logs.reverse() }); // oldest first for display
    }

    // Fallback to direct DB query
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const logs = await prisma.botLog.findMany({
      where: { botId: req.params.id },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    await prisma.$disconnect();

    return ok(res, { logs });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Get bot equity curve (snapshots)
router.get('/:id/equity-curve', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return ok(res, { snapshots: [] });
    }

    const limit = parseInt(req.query.limit) || 168; // Default 1 week
    const snapshots = await engine.getBotSnapshots(req.params.id, limit);

    return ok(res, { snapshots });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Update bot params (only when paused)
router.put('/:id/params', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine not available');
    }

    const { params } = req.body;
    const config = await engine.updateBotParams(req.params.id, params);

    return ok(res, { bot: config, message: 'Parameters updated' });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

// Delete bot
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine not available');
    }

    await engine.deleteBot(req.params.id);

    return ok(res, { message: 'Bot deleted' });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

// ═══════════════════════════════════════════════════════════════
// BOT CONTROL OPERATIONS
// ═══════════════════════════════════════════════════════════════

// Start bot
router.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine not available');
    }

    await engine.startBot(req.params.id);
    const stats = engine.getBotStats(req.params.id);

    return ok(res, { bot: stats, message: 'Bot started' });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

// Stop bot
router.post('/:id/stop', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine not available');
    }

    const { reason } = req.body;
    await engine.stopBot(req.params.id, reason);

    return ok(res, { message: 'Bot stopped' });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

// Pause bot
router.post('/:id/pause', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine not available');
    }

    await engine.pauseBot(req.params.id);
    const stats = engine.getBotStats(req.params.id);

    return ok(res, { bot: stats, message: 'Bot paused' });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

// Resume bot
router.post('/:id/resume', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine not available');
    }

    await engine.resumeBot(req.params.id);
    const stats = engine.getBotStats(req.params.id);

    return ok(res, { bot: stats, message: 'Bot resumed' });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

// Sync orders with exchange
router.post('/:id/sync', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine not available');
    }

    const bot = engine.getBot(req.params.id);
    if (!bot) {
      return fail(res, 404, 'Bot not found or not running');
    }

    await bot.syncOrdersWithExchange();
    const stats = engine.getBotStats(req.params.id);

    return ok(res, { bot: stats, message: 'Orders synced with exchange' });
  } catch (error) {
    return fail(res, 400, error.message);
  }
});

// ═══════════════════════════════════════════════════════════════
// ENGINE STATUS
// ═══════════════════════════════════════════════════════════════

// Get engine stats
router.get('/engine/stats', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return ok(res, { initialized: false });
    }

    return ok(res, {
      initialized: true,
      stats: engine.getStats(),
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// ═══════════════════════════════════════════════════════════════
// AI PARAMETER SUGGESTION
// ═══════════════════════════════════════════════════════════════

router.post('/ai-suggest', requireAuth, async (req, res) => {
  try {
    const { strategyType, symbol, exchange } = req.body;

    if (!strategyType || !symbol || !exchange) {
      return fail(res, 400, 'strategyType, symbol, and exchange are required');
    }

    // Fetch market data for analysis
    const { getAdapter } = await import('../arbitrage/dist/adapters/index.js');
    const adapter = await getAdapter(exchange);

    // Get recent OHLCV data
    const klines = await adapter.getKlines(symbol, '1h', 720); // 30 days

    if (!klines || klines.length < 100) {
      return fail(res, 400, 'Insufficient market data for analysis');
    }

    // Calculate analytics
    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);

    const currentPrice = closes[closes.length - 1];
    const minPrice = Math.min(...lows);
    const maxPrice = Math.max(...highs);
    const avgPrice = closes.reduce((a, b) => a + b, 0) / closes.length;

    // Calculate volatility
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100;

    // Determine trend
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const trend = currentPrice > sma20 && sma20 > sma50 ? 'bullish' :
                  currentPrice < sma20 && sma20 < sma50 ? 'bearish' : 'sideways';

    // Generate strategy-specific suggestions
    let suggestedParams = {};
    let reasoning = '';

    switch (strategyType) {
      case 'GRID':
        const gridRange = maxPrice - minPrice;
        const gridLower = currentPrice - gridRange * 0.3;
        const gridUpper = currentPrice + gridRange * 0.3;
        const gridCount = volatility > 3 ? 20 : volatility > 1.5 ? 15 : 10;

        suggestedParams = {
          lowerPrice: Number(gridLower.toFixed(6)),
          upperPrice: Number(gridUpper.toFixed(6)),
          gridCount,
          totalInvestment: 100,
        };
        reasoning = `Based on 30-day range ($${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}) and ${volatility.toFixed(1)}% volatility, suggesting ${gridCount} grids covering ±30% of the range around current price.`;
        break;

      case 'DCA':
        const dcaInterval = trend === 'bearish' ? 'every_4h' : 'daily';
        suggestedParams = {
          amountPerBuy: 10,
          interval: dcaInterval,
          totalBudget: 500,
          takeProfitPercent: trend === 'bullish' ? 15 : 25,
          stopLossPercent: 20,
        };
        reasoning = `${trend} trend detected. Suggesting ${dcaInterval} buys with ${trend === 'bullish' ? 'lower' : 'higher'} take profit target.`;
        break;

      case 'SMART_TRADE':
        suggestedParams = {
          side: trend === 'bearish' ? 'short' : 'long',
          entryType: 'market',
          quantity: 50,
          takeProfitPercent: volatility > 2 ? 5 : 3,
          stopLossPercent: volatility > 2 ? 3 : 2,
          trailingTakeProfit: volatility > 3 ? 2 : undefined,
        };
        reasoning = `${trend} trend with ${volatility.toFixed(1)}% volatility. Suggesting ${trend === 'bearish' ? 'short' : 'long'} entry with ${volatility > 3 ? 'trailing' : 'fixed'} exit.`;
        break;

      case 'INFINITY_GRID':
        suggestedParams = {
          lowerPrice: Number((currentPrice * 0.7).toFixed(6)),
          gridSpacingPercent: volatility > 2 ? 2 : 1,
          totalInvestment: 200,
        };
        reasoning = `Setting lower bound 30% below current price with ${volatility > 2 ? '2%' : '1%'} grid spacing based on volatility.`;
        break;

      case 'MARTINGALE':
        suggestedParams = {
          initialBuyAmount: 10,
          priceDropPercent: Math.max(3, volatility),
          takeProfitPercent: 3,
          maxSafetyOrders: 5,
          multiplier: 1.5,
          maxTotalInvestment: 200,
        };
        reasoning = `⚠️ HIGH RISK: Setting ${volatility.toFixed(0)}% drop trigger based on volatility. Max exposure capped at $200.`;
        break;

      default:
        return fail(res, 400, 'AI suggestions not available for this strategy type');
    }

    return ok(res, {
      strategyType,
      symbol,
      exchange,
      suggestedParams,
      reasoning,
      confidence: volatility < 5 ? 0.8 : 0.6,
      marketAnalysis: {
        trend,
        volatility: volatility.toFixed(2) + '%',
        volatilityLevel: volatility > 5 ? 'high' : volatility > 2 ? 'medium' : 'low',
        support: Number(minPrice.toFixed(6)),
        resistance: Number(maxPrice.toFixed(6)),
        currentPrice: Number(currentPrice.toFixed(6)),
      },
    });
  } catch (error) {
    console.error('[BotRoutes] AI suggest error:', error);
    return fail(res, 500, error.message);
  }
});

// ═══════════════════════════════════════════════════════════════
// STRATEGY INFO
// ═══════════════════════════════════════════════════════════════

router.get('/strategies', requireAuth, async (req, res) => {
  const strategies = [
    {
      type: 'GRID',
      name: 'Grid Trading Bot',
      description: 'Buy low sell high within a price range. Best for sideways markets.',
      risk: 'medium',
      requiredParams: ['lowerPrice', 'upperPrice', 'gridCount', 'totalInvestment'],
      optionalParams: ['stopLoss', 'takeProfit'],
    },
    {
      type: 'INFINITY_GRID',
      name: 'Infinity Grid Bot',
      description: 'Grid bot with no upper limit. For long-term bullish assets.',
      risk: 'medium',
      requiredParams: ['lowerPrice', 'gridSpacingPercent', 'totalInvestment'],
      optionalParams: ['stopLoss'],
    },
    {
      type: 'DCA',
      name: 'DCA Bot',
      description: 'Dollar cost averaging - buy fixed amounts at regular intervals.',
      risk: 'low',
      requiredParams: ['amountPerBuy', 'interval', 'totalBudget'],
      optionalParams: ['takeProfitPercent', 'stopLossPercent'],
    },
    {
      type: 'SMART_TRADE',
      name: 'Smart Trade Bot',
      description: 'Single trade with automated TP/SL/Trailing exits.',
      risk: 'medium',
      requiredParams: ['side', 'entryType', 'quantity'],
      optionalParams: ['entryPrice', 'takeProfit', 'takeProfitPercent', 'stopLoss', 'stopLossPercent', 'trailingTakeProfit'],
    },
    {
      type: 'TRAILING',
      name: 'Trailing Bot',
      description: 'Ride a trend and exit when it reverses.',
      risk: 'medium',
      requiredParams: ['side', 'triggerPrice', 'trailingPercent', 'quantity'],
    },
    {
      type: 'MARTINGALE',
      name: 'Martingale Bot',
      description: 'Double down after losses. HIGH RISK strategy.',
      risk: 'high',
      requiredParams: ['initialBuyAmount', 'priceDropPercent', 'takeProfitPercent', 'maxSafetyOrders', 'multiplier', 'maxTotalInvestment'],
      warning: 'Position size increases exponentially after losses. Risk of significant loss in sustained downtrends.',
    },
    {
      type: 'REBALANCING',
      name: 'Rebalancing Bot',
      description: 'Maintain fixed portfolio ratios across multiple assets.',
      risk: 'low',
      requiredParams: ['allocations', 'totalInvestment', 'rebalanceThreshold', 'rebalanceInterval'],
    },
  ];

  return ok(res, { strategies });
});

// ═══════════════════════════════════════════════════════════════
// COMMUNITY BOTS - Share & Copy Bot Configurations
// ═══════════════════════════════════════════════════════════════

// Helper to get Prisma client
async function getPrisma() {
  const { PrismaClient } = await import('@prisma/client');
  return new PrismaClient();
}

// Get community bots (public shared configurations)
router.get('/community', requireAuth, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const { strategy, symbol, sort = 'popular', limit = 20, offset = 0 } = req.query;

    const where = { isPublic: true };
    if (strategy) where.strategyType = strategy;
    if (symbol) where.symbol = { contains: symbol };

    const orderBy = sort === 'new' ? { createdAt: 'desc' } :
                    sort === 'rating' ? { rating: 'desc' } :
                    sort === 'profit' ? { totalProfit: 'desc' } :
                    { copyCount: 'desc' }; // default: popular

    const [bots, total] = await Promise.all([
      prisma.sharedBotConfig.findMany({
        where,
        orderBy,
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.sharedBotConfig.count({ where }),
    ]);

    await prisma.$disconnect();

    return ok(res, {
      bots: bots.map(b => ({
        ...b,
        params: typeof b.params === 'string' ? JSON.parse(b.params) : b.params,
        tags: b.tags ? (typeof b.tags === 'string' ? JSON.parse(b.tags) : b.tags) : [],
      })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('[BotRoutes] Community list error:', error);
    return fail(res, 500, error.message);
  }
});

// Get single community bot details
router.get('/community/:id', requireAuth, async (req, res) => {
  try {
    const prisma = await getPrisma();

    const bot = await prisma.sharedBotConfig.findUnique({
      where: { id: req.params.id },
      include: {
        ratings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    await prisma.$disconnect();

    if (!bot) {
      return fail(res, 404, 'Shared bot not found');
    }

    return ok(res, {
      bot: {
        ...bot,
        params: typeof bot.params === 'string' ? JSON.parse(bot.params) : bot.params,
        tags: bot.tags ? (typeof bot.tags === 'string' ? JSON.parse(bot.tags) : bot.tags) : [],
      },
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Share a bot to community
router.post('/:id/share', requireAuth, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const userId = String(req.user?.id || 'default-user');
    const { name, description, tags } = req.body;

    // Get the original bot
    const originalBot = await prisma.botConfig.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!originalBot) {
      await prisma.$disconnect();
      return fail(res, 404, 'Bot not found or not owned by you');
    }

    // Create shared config (strip sensitive data)
    const sharedBot = await prisma.sharedBotConfig.create({
      data: {
        originalBotId: originalBot.id,
        authorId: userId,
        authorName: req.user?.email?.split('@')[0] || 'Anonymous',
        name: name || originalBot.name,
        description,
        strategyType: originalBot.strategyType,
        symbol: originalBot.symbol,
        params: originalBot.params,
        tags: tags || [],
        totalProfit: originalBot.totalProfit,
        winRate: originalBot.totalTrades > 0 ?
          (await prisma.botOrder.count({
            where: { botConfigId: originalBot.id, status: 'FILLED', profit: { gt: 0 } }
          })) / originalBot.totalTrades * 100 : 0,
      },
    });

    await prisma.$disconnect();

    return ok(res, {
      sharedBot,
      message: 'Bot shared to community successfully',
    });
  } catch (error) {
    console.error('[BotRoutes] Share error:', error);
    return fail(res, 500, error.message);
  }
});

// Copy a community bot
router.post('/copy/:sharedId', requireAuth, async (req, res) => {
  try {
    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine not available');
    }

    const prisma = await getPrisma();
    const userId = String(req.user?.id || 'default-user');
    const { exchangeName, mode = 'PAPER', investedAmount } = req.body;

    // Get shared bot config
    const sharedBot = await prisma.sharedBotConfig.findUnique({
      where: { id: req.params.sharedId },
    });

    if (!sharedBot) {
      await prisma.$disconnect();
      return fail(res, 404, 'Shared bot not found');
    }

    // Increment copy count
    await prisma.sharedBotConfig.update({
      where: { id: req.params.sharedId },
      data: { copyCount: { increment: 1 } },
    });

    await prisma.$disconnect();

    // Parse params
    const params = typeof sharedBot.params === 'string'
      ? JSON.parse(sharedBot.params)
      : sharedBot.params;

    // Create new bot with copied config
    const newBot = await engine.createBot({
      userId,
      name: `${sharedBot.name} (copy)`,
      strategyType: sharedBot.strategyType,
      exchangeName: exchangeName || 'Demo',
      symbol: sharedBot.symbol,
      mode,
      params,
      investedAmount: Number(investedAmount) || params.totalInvestment || 100,
    });

    return ok(res, {
      bot: newBot,
      message: 'Bot copied successfully',
      copiedFrom: {
        id: sharedBot.id,
        name: sharedBot.name,
        author: sharedBot.authorName,
      },
    });
  } catch (error) {
    console.error('[BotRoutes] Copy error:', error);
    return fail(res, 500, error.message);
  }
});

// Rate a community bot
router.post('/community/:id/rate', requireAuth, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const userId = String(req.user?.id || 'default-user');
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      await prisma.$disconnect();
      return fail(res, 400, 'Rating must be between 1 and 5');
    }

    // Upsert rating
    await prisma.sharedBotRating.upsert({
      where: {
        sharedBotId_userId: {
          sharedBotId: req.params.id,
          userId,
        },
      },
      create: {
        sharedBotId: req.params.id,
        userId,
        rating: parseInt(rating),
        comment,
      },
      update: {
        rating: parseInt(rating),
        comment,
      },
    });

    // Recalculate average rating
    const stats = await prisma.sharedBotRating.aggregate({
      where: { sharedBotId: req.params.id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.sharedBotConfig.update({
      where: { id: req.params.id },
      data: {
        rating: stats._avg.rating || 0,
        ratingCount: stats._count.rating || 0,
      },
    });

    await prisma.$disconnect();

    return ok(res, {
      message: 'Rating submitted',
      newAverage: stats._avg.rating,
      totalRatings: stats._count.rating,
    });
  } catch (error) {
    console.error('[BotRoutes] Rate error:', error);
    return fail(res, 500, error.message);
  }
});

// Unshare a bot (author only)
router.delete('/community/:id', requireAuth, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const userId = String(req.user?.id || 'default-user');

    const sharedBot = await prisma.sharedBotConfig.findFirst({
      where: { id: req.params.id, authorId: userId },
    });

    if (!sharedBot) {
      await prisma.$disconnect();
      return fail(res, 404, 'Shared bot not found or not owned by you');
    }

    await prisma.sharedBotConfig.delete({
      where: { id: req.params.id },
    });

    await prisma.$disconnect();

    return ok(res, { message: 'Bot removed from community' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

export default router;
