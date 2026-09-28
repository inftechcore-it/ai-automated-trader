import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/apiResponse.js';
import predictiveService from '../services/predictiveService.js';

const router = Router();

let botEngine = null;

async function getBotEngine() {
  if (botEngine) return botEngine;
  try {
    const engineModule = await import('../dist/bots/index.js');
    botEngine = engineModule.botEngine || engineModule.getBotEngine();
    return botEngine;
  } catch (err) {
    try {
      const { BotEngine } = await import('../dist/bots/BotEngine.js');
      botEngine = new BotEngine();
      await botEngine.initialize();
      return botEngine;
    } catch (innerErr) {
      console.warn('[predictiveRoutes] BotEngine import failed:', innerErr.message);
      return null;
    }
  }
}

/**
 * GET /api/predictive/top-opportunities
 * Multi-Coin Quant Screener: Scans 20-30 tokens and returns top 2, 5, or 10 ranked setups
 */
router.get('/top-opportunities', async (req, res) => {
  try {
    const {
      exchange = 'Binance',
      timeframe = '15m',
      count = 5,
      method = 'HYBRID_ENSEMBLE'
    } = req.query;

    const screenerResults = await predictiveService.scanTopOpportunities(
      exchange,
      timeframe,
      Number(count) || 5,
      method
    );

    return ok(res, screenerResults);
  } catch (error) {
    console.error('[predictiveRoutes] Top opportunities screener error:', error);
    return fail(res, 500, error.message);
  }
});

/**
 * GET /api/predictive/analytics
 * Returns live multi-dev Gaussian VWAP bands, CVD delta, Squeeze status, EV matrix, and Agent Directives.
 */
router.get('/analytics', async (req, res) => {
  try {
    const {
      symbol = 'SOL/USDT',
      timeframe = '15m',
      exchange = 'Binance',
      method = 'HYBRID_ENSEMBLE'
    } = req.query;

    const analytics = await predictiveService.getQuantAnalytics(symbol, timeframe, exchange, method);
    return ok(res, { data: analytics, analytics, ...analytics });
  } catch (error) {
    console.error('[predictiveRoutes] Analytics error:', error);
    return fail(res, 500, error.message);
  }
});

/**
 * POST /api/predictive/simulate
 * Runs 1-Click Fast Monte Carlo replay simulation for a selected token, capital amount, and methodology.
 */
router.post('/simulate', async (req, res) => {
  try {
    const {
      symbol = 'SOL/USDT',
      timeframe = '15m',
      exchange = 'Binance',
      investment = 50,
      numSimulations = 1000,
      horizon = 48,
      method = 'HYBRID_ENSEMBLE'
    } = req.body;

    const analytics = await predictiveService.getQuantAnalytics(symbol, timeframe, exchange, method);
    const simulation = predictiveService.simulateMonteCarlo(
      analytics.series.candles,
      Number(investment) || 50,
      Number(numSimulations) || 1000,
      Number(horizon) || 48
    );

    return ok(res, {
      symbol,
      timeframe,
      exchange,
      method,
      investment: Number(investment),
      simulation
    });
  } catch (error) {
    console.error('[predictiveRoutes] Simulation error:', error);
    return fail(res, 500, error.message);
  }
});

/**
 * POST /api/predictive/launch-super-zee
 * Instant 1-Click launcher for autonomous Super Zee Bot with active predictive brain link.
 */
router.post('/launch-super-zee', requireAuth, async (req, res) => {
  try {
    const {
      symbol = 'SOL/USDT',
      exchange = 'Binance',
      mode = 'PAPER',
      investedAmount = 50,
      name,
      method = 'HYBRID_ENSEMBLE',
      kellyAllocPercent
    } = req.body;

    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine is not initialized');
    }

    const userId = String(req.user?.id || 'default-user');

    // 1. Fetch fresh quantitative baseline calibration for chosen methodology
    const analytics = await predictiveService.getQuantAnalytics(symbol, '15m', exchange, method);
    const directive = analytics.agentDirective;
    const ev = analytics.expectedValue;

    const chosenKelly = Number(kellyAllocPercent) || ev.kellyAllocationPercent || 35;
    const botName = name || `Super Zee ${symbol} (${method.replace('_', ' ')})`;

    const params = {
      lowerPrice: directive.dynamicLower,
      upperPrice: directive.dynamicUpper,
      currentPrice: analytics.currentPrice,
      stepSpace: directive.dynamicSpacing,
      emergencyFloorPrice: directive.emergencyFloorPrice,
      takeProfitCeilingPrice: directive.takeProfitCeilingPrice,
      trailingStopLoss: directive.emergencyFloorPrice,
      activeRegime: analytics.regime,
      methodology: method,
      kellyAllocPercent: chosenKelly,
      quantScore: analytics.quantScore,
      initialDirective: directive,
      actionCooldownMs: 20000, // 20-second hysteresis cooldown
      baseInvestment: Number(investedAmount),
      isPredictiveControlled: true,
      lastDirectiveTime: new Date().toISOString()
    };

    // Proactively verify & migrate database column for strategyType
    try {
      const { query } = await import('../config/db.js');
      await query("ALTER TABLE `BotConfig` MODIFY COLUMN `strategyType` VARCHAR(64) NOT NULL").catch(() => {
        return query("ALTER TABLE `BotConfig` MODIFY COLUMN `strategyType` ENUM('GRID', 'INFINITY_GRID', 'DCA', 'SMART_TRADE', 'TRAILING', 'MARTINGALE', 'REBALANCING', 'ARBITRAGE', 'DYNAMIC_GRID', 'PRECISION_GRID', 'JARVIS', 'SUPER_ZEE') NOT NULL").catch(() => {});
      });
    } catch {}

    // 2. Create the Super Zee Bot instance
    const bot = await engine.createBot({
      userId,
      name: botName,
      strategyType: 'SUPER_ZEE',
      exchangeName: exchange,
      symbol,
      mode: mode || 'PAPER',
      params,
      investedAmount: Number(investedAmount)
    });

    // 3. Immediately start the bot
    await engine.startBot(bot.id);
    const stats = engine.getBotStats(bot.id) || bot;

    return ok(res, {
      bot: stats,
      analytics: {
        regime: analytics.regime,
        vwap: analytics.vwap,
        directive,
        methodology: method,
        quantScore: analytics.quantScore
      },
      message: `🚀 Super Zee Bot (${symbol}) launched successfully with ${method.replace('_', ' ')} Quant Engine!`
    });
  } catch (error) {
    console.error('[predictiveRoutes] Launch Super Zee error:', error);
    return fail(res, 400, error.message);
  }
});

export default router;
