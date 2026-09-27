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
 * GET /api/predictive/analytics
 * Returns live multi-dev Gaussian VWAP bands, CVD delta, Squeeze status, EV matrix, and Agent Directives.
 */
router.get('/analytics', async (req, res) => {
  try {
    const { symbol = 'SOL/USDT', timeframe = '15m', exchange = 'Binance' } = req.query;
    const analytics = await predictiveService.getQuantAnalytics(symbol, timeframe, exchange);
    return ok(res, analytics);
  } catch (error) {
    console.error('[predictiveRoutes] Analytics error:', error);
    return fail(res, 500, error.message);
  }
});

/**
 * POST /api/predictive/simulate
 * Runs 1-Click Fast Monte Carlo replay simulation for a selected token and capital amount.
 */
router.post('/simulate', async (req, res) => {
  try {
    const { symbol = 'SOL/USDT', timeframe = '15m', exchange = 'Binance', investment = 50, numSimulations = 1000, horizon = 48 } = req.body;
    const analytics = await predictiveService.getQuantAnalytics(symbol, timeframe, exchange);
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
      name
    } = req.body;

    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine is not initialized');
    }

    const userId = String(req.user?.id || 'default-user');

    // 1. Fetch fresh quantitative baseline calibration
    const analytics = await predictiveService.getQuantAnalytics(symbol, '15m', exchange);
    const directive = analytics.agentDirective;

    const botName = name || `Super Zee ${symbol} (${mode})`;

    const params = {
      lowerPrice: directive.dynamicLower,
      upperPrice: directive.dynamicUpper,
      stepSpace: directive.dynamicSpacing,
      emergencyFloorPrice: directive.emergencyFloorPrice,
      takeProfitCeilingPrice: directive.takeProfitCeilingPrice,
      trailingStopLoss: directive.emergencyFloorPrice,
      activeRegime: analytics.regime,
      initialDirective: directive,
      actionCooldownMs: 20000, // 20-second hysteresis cooldown
      baseInvestment: Number(investedAmount),
      isPredictiveControlled: true,
      lastDirectiveTime: new Date().toISOString()
    };

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
        directive
      },
      message: `🚀 Super Zee Bot (${symbol}) launched successfully with AI Predictive Control!`
    });
  } catch (error) {
    console.error('[predictiveRoutes] Launch Super Zee error:', error);
    return fail(res, 400, error.message);
  }
});

export default router;
