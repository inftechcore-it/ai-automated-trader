import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/apiResponse.js';
import predictiveService from '../services/predictiveService.js';
import visionService from '../services/visionService.js';
import scriptVaultService from '../services/scriptVaultService.js';

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
router.post('/launch-super-zee', async (req, res) => {
  try {
    const {
      symbol = 'SOL/USDT',
      exchange = 'Binance',
      mode = 'PAPER',
      investedAmount = 50,
      name,
      method = 'HYBRID_ENSEMBLE',
      kellyAllocPercent,
      lowerPrice,
      upperPrice,
      stopLoss,
      takeProfit1,
      takeProfit2
    } = req.body;

    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine is not initialized');
    }

    const userId = String(req.user?.id || req.body.userId || 'default-user');

    // Fetch fresh quantitative calibration
    const analytics = await predictiveService.getQuantAnalytics(symbol, '15m', exchange, method);
    const directive = analytics.agentDirective;
    const ev = analytics.expectedValue;

    const chosenKelly = Number(kellyAllocPercent) || ev.kellyAllocationPercent || 35;
    const botName = name || `Super Zee ${symbol} (${method.replace('_', ' ')})`;

    const params = {
      lowerPrice: Number(lowerPrice) || directive.dynamicLower,
      upperPrice: Number(upperPrice) || directive.dynamicUpper,
      currentPrice: analytics.currentPrice,
      stepSpace: directive.dynamicSpacing,
      emergencyFloorPrice: Number(stopLoss) || directive.emergencyFloorPrice,
      takeProfitCeilingPrice: Number(takeProfit2 || takeProfit1) || directive.takeProfitCeilingPrice,
      trailingStopLoss: Number(stopLoss) || directive.emergencyFloorPrice,
      activeRegime: analytics.regime,
      methodology: method,
      kellyAllocPercent: chosenKelly,
      quantScore: analytics.quantScore,
      initialDirective: directive,
      actionCooldownMs: 20000,
      baseInvestment: Number(investedAmount),
      isPredictiveControlled: true,
      lastDirectiveTime: new Date().toISOString()
    };

    // Auto-migrate BotConfig strategyType
    try {
      const { query } = await import('../config/db.js');
      await query("ALTER TABLE `BotConfig` MODIFY COLUMN `strategyType` VARCHAR(64) NOT NULL").catch(() => {
        return query("ALTER TABLE `BotConfig` MODIFY COLUMN `strategyType` ENUM('GRID', 'INFINITY_GRID', 'DCA', 'SMART_TRADE', 'TRAILING', 'MARTINGALE', 'REBALANCING', 'ARBITRAGE', 'DYNAMIC_GRID', 'PRECISION_GRID', 'JARVIS', 'SUPER_ZEE') NOT NULL").catch(() => {});
      });
    } catch {}

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

/**
 * POST /api/predictive/vision-analyze
 * Pillar 3 & 4: Analyzes chart snap -> generates Pine Script v5 & Python -> runs backtest -> auto-saves to Script Vault
 */
router.post('/vision-analyze', async (req, res) => {
  try {
    const {
      image = '',
      mimeType = 'image/png',
      symbol = 'SOL/USDT',
      timeframe = '15m',
      exchange = 'Binance',
      methodology = 'HYBRID_ENSEMBLE',
      promptNote = '',
      userId = req.user?.id || 'default-user'
    } = req.body;

    const result = await visionService.analyzeChartSnapshot({
      imageBase64: image,
      mimeType,
      symbol,
      timeframe,
      exchange,
      methodology,
      promptNote,
      userId: String(userId)
    });

    return ok(res, result);
  } catch (error) {
    console.error('[predictiveRoutes] Vision analyze error:', error);
    return fail(res, 500, error.message || 'Vision analysis failed');
  }
});

/**
 * GET /api/predictive/scripts
 * Pillar 4: Fetches saved strategy scripts from user's vault
 */
router.get('/scripts', async (req, res) => {
  try {
    const {
      search = '',
      symbol = '',
      minWinRate = 0,
      methodology = '',
      limit = 50,
      offset = 0
    } = req.query;

    const userId = String(req.user?.id || 'default-user');

    const result = await scriptVaultService.listScripts({
      userId,
      search,
      symbol,
      minWinRate: Number(minWinRate) || 0,
      methodology,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0
    });

    return ok(res, result);
  } catch (error) {
    console.error('[predictiveRoutes] List scripts error:', error);
    return fail(res, 500, error.message);
  }
});

/**
 * GET /api/predictive/scripts/:id
 * Pillar 4: Fetches single saved strategy script by ID
 */
router.get('/scripts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id || 'default-user');

    const script = await scriptVaultService.getScriptById(id, userId);
    if (!script) {
      return fail(res, 404, 'Strategy script not found');
    }

    return ok(res, script);
  } catch (error) {
    console.error('[predictiveRoutes] Get script error:', error);
    return fail(res, 500, error.message);
  }
});

/**
 * DELETE /api/predictive/scripts/:id
 * Pillar 4: Deletes a saved strategy script from vault
 */
router.delete('/scripts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id || 'default-user');

    const result = await scriptVaultService.deleteScript(id, userId);
    return ok(res, result);
  } catch (error) {
    console.error('[predictiveRoutes] Delete script error:', error);
    return fail(res, 500, error.message);
  }
});

/**
 * POST /api/predictive/run-saved-script
 * Pillar 4: 1-Click launcher to immediately execute / deploy a saved strategy script with Super Zee Bot
 */
router.post('/run-saved-script', async (req, res) => {
  try {
    const {
      scriptId,
      investedAmount = 50,
      mode = 'PAPER',
      exchange: overrideExchange
    } = req.body;

    const userId = String(req.user?.id || 'default-user');

    if (!scriptId) {
      return fail(res, 400, 'scriptId is required');
    }

    const script = await scriptVaultService.getScriptById(scriptId, userId);
    if (!script) {
      return fail(res, 404, 'Saved strategy script not found in vault');
    }

    const engine = await getBotEngine();
    if (!engine) {
      return fail(res, 500, 'Bot Engine is not initialized');
    }

    const targetExchange = overrideExchange || script.exchange || 'Binance';
    const targetSymbol = script.symbol || 'SOL/USDT';
    const tParams = script.tradingParameters || {};
    const method = script.methodology || 'HYBRID_ENSEMBLE';

    // Fetch fresh live quant calibration
    const analytics = await predictiveService.getQuantAnalytics(targetSymbol, script.timeframe || '15m', targetExchange, method);
    const directive = analytics.agentDirective;

    const lowerPrice = Number(tParams.entryPrice) || directive.dynamicLower;
    const upperPrice = Number(tParams.takeProfit2 || tParams.takeProfit1) || directive.dynamicUpper;
    const stopLoss = Number(tParams.stopLoss || tParams.emergencyFloor) || directive.emergencyFloorPrice;
    const kelly = Number(tParams.kellyAllocPercent) || 35;

    const botParams = {
      lowerPrice,
      upperPrice,
      currentPrice: analytics.currentPrice,
      stepSpace: directive.dynamicSpacing,
      emergencyFloorPrice: stopLoss,
      takeProfitCeilingPrice: upperPrice,
      trailingStopLoss: stopLoss,
      activeRegime: analytics.regime,
      methodology: method,
      kellyAllocPercent: kelly,
      quantScore: analytics.quantScore,
      initialDirective: directive,
      actionCooldownMs: 20000,
      baseInvestment: Number(investedAmount),
      isPredictiveControlled: true,
      deployedFromScriptId: script.id,
      lastDirectiveTime: new Date().toISOString()
    };

    // Auto-migrate BotConfig strategyType
    try {
      const { query } = await import('../config/db.js');
      await query("ALTER TABLE `BotConfig` MODIFY COLUMN `strategyType` VARCHAR(64) NOT NULL").catch(() => {
        return query("ALTER TABLE `BotConfig` MODIFY COLUMN `strategyType` ENUM('GRID', 'INFINITY_GRID', 'DCA', 'SMART_TRADE', 'TRAILING', 'MARTINGALE', 'REBALANCING', 'ARBITRAGE', 'DYNAMIC_GRID', 'PRECISION_GRID', 'JARVIS', 'SUPER_ZEE') NOT NULL").catch(() => {});
      });
    } catch {}

    const botName = `Super Zee [Vault] ${targetSymbol} (${script.name.substring(0, 24)})`;

    const bot = await engine.createBot({
      userId,
      name: botName,
      strategyType: 'SUPER_ZEE',
      exchangeName: targetExchange,
      symbol: targetSymbol,
      mode: mode || 'PAPER',
      params: botParams,
      investedAmount: Number(investedAmount)
    });

    await engine.startBot(bot.id);
    const stats = engine.getBotStats(bot.id) || bot;

    return ok(res, {
      bot: stats,
      script: {
        id: script.id,
        name: script.name,
        symbol: script.symbol
      },
      message: `🚀 Deployed "${script.name}" directly to Super Zee Bot (${targetSymbol})!`
    });
  } catch (error) {
    console.error('[predictiveRoutes] Run saved script error:', error);
    return fail(res, 400, error.message);
  }
});

export default router;
