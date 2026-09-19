/**
 * JARVIS Autonomous Auto-Tuner & Continuous Learning Overseer
 * Periodically extracts live chart features, queries RAG trade memory + Gemini,
 * and seamlessly adapts running JARVIS bots without resetting stage progress.
 */
import { ragService } from './ragService.js';
import { logger } from '../utils/logger.js';

class JarvisAutoTuner {
  constructor() {
    this.intervalHandle = null;
    this.isTuning = false;
    this.tuneIntervalMs = 5 * 60 * 1000; // 5 minutes
  }

  start(botEngine) {
    if (this.intervalHandle) return;
    this.botEngine = botEngine;
    logger.info('[JARVIS Auto-Tuner] Autonomous AI Brain Overseer started (5m cycle)');

    this.intervalHandle = setInterval(() => {
      this.tuneAllRunningBots().catch(err => {
        logger.warn(`[JARVIS Auto-Tuner] Background tuning error: ${err.message}`);
      });
    }, this.tuneIntervalMs);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('[JARVIS Auto-Tuner] Autonomous Overseer stopped');
    }
  }

  /**
   * Calculate live technical indicators from OHLCV candles
   */
  calculateIndicators(candles, currentPrice) {
    if (!Array.isArray(candles) || candles.length < 5) {
      return {
        atr: currentPrice * 0.02,
        rsi: 50,
        support: currentPrice * 0.97,
        resistance: currentPrice * 1.03,
        bb_upper: currentPrice * 1.04,
        bb_lower: currentPrice * 0.96,
        volatility: 2.5,
      };
    }

    const closes = candles.map(c => Number(c.close || c[4]));
    const highs = candles.map(c => Number(c.high || c[2]));
    const lows = candles.map(c => Number(c.low || c[3]));

    // 1. ATR (14)
    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    const period = Math.min(14, trueRanges.length);
    const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;

    // 2. RSI (14)
    let gains = 0, losses = 0;
    for (let i = 1; i <= period && i < closes.length; i++) {
      const diff = closes[closes.length - i] - closes[closes.length - i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // 3. Bollinger Bands (20, 2)
    const bbPeriod = Math.min(20, closes.length);
    const slice = closes.slice(-bbPeriod);
    const mean = slice.reduce((a, b) => a + b, 0) / bbPeriod;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / bbPeriod;
    const stdDev = Math.sqrt(variance);

    // 4. Swing Support & Resistance (recent lowest low & highest high)
    const recentLows = lows.slice(-20);
    const recentHighs = highs.slice(-20);
    const support = Math.min(...recentLows);
    const resistance = Math.max(...recentHighs);

    const volatility = ((Math.max(...recentHighs) - Math.min(...recentLows)) / mean) * 100;

    return {
      atr: Number(atr.toFixed(6)),
      rsi: Number(rsi.toFixed(2)),
      support: Number(support.toFixed(6)),
      resistance: Number(resistance.toFixed(6)),
      bb_upper: Number((mean + 2 * stdDev).toFixed(6)),
      bb_lower: Number((mean - 2 * stdDev).toFixed(6)),
      volatility: Number(volatility.toFixed(2)),
    };
  }

  /**
   * Run calibration for a specific JARVIS bot instance
   */
  async calibrateBot(botId) {
    if (!this.botEngine) return null;
    const bot = this.botEngine.getBot(botId);
    if (!bot || bot.config.strategyType !== 'JARVIS') {
      return null;
    }

    const currentPrice = bot.state?.currentPrice || bot.lastPrice || 0;
    if (currentPrice <= 0) {
      return null;
    }

    const symbol = bot.config.symbol;
    const currentParams = bot.config.params || {};
    const customState = bot.strategy?.getCustomState ? bot.strategy.getCustomState() : (bot.state?.customState || {});
    const stageStatus = customState.stageStatus || 'INITIAL';

    // 1. Fetch recent klines from exchange
    let candles = [];
    try {
      if (bot.adapter && typeof bot.adapter.getKlines === 'function') {
        candles = await bot.adapter.getKlines(symbol, '5m', 50);
      }
    } catch (kErr) {
      logger.debug(`[JARVIS Auto-Tuner] Klines fetch fallback for ${symbol}: ${kErr.message}`);
    }

    // 2. Extract technical indicators
    const indicators = this.calculateIndicators(candles, currentPrice);

    // 3. Query RAG + Gemini Calibration Engine
    const calibration = await ragService.calibrateJarvis({
      symbol,
      currentPrice,
      indicators,
      currentParams,
      stageStatus,
    });

    if (!calibration || !calibration.recommendations) {
      return null;
    }

    const rec = calibration.recommendations;
    const payload = {
      lowerPrice: rec.dynamicLowerPrice,
      upperPrice: rec.dynamicUpperPrice,
      gridSpacing: rec.dynamicGridSpacing,
      stopLoss: rec.dynamicStopLoss,
      priceTolerance: rec.priceTolerance,
      marketRegime: calibration.marketRegime,
      confidenceScore: calibration.confidenceScore,
      reasoning: calibration.reasoning,
    };

    // 4. Apply adaptation to running bot strategy
    if (typeof bot.strategy?.applyAdaptiveParameters === 'function') {
      bot.strategy.applyAdaptiveParameters(payload);
    }

    bot.log(`🧠 [JARVIS AI Brain] Autonomous Auto-Tuning Applied | Regime: ${calibration.marketRegime} | Bounds: [$${payload.lowerPrice.toFixed(4)} - $${payload.upperPrice.toFixed(4)}] | Spacing: $${payload.gridSpacing.toFixed(4)} | Reason: ${calibration.reasoning}`, 'info');

    return {
      success: true,
      botId,
      symbol,
      calibration: payload,
    };
  }

  /**
   * Tune all currently running JARVIS bots
   */
  async tuneAllRunningBots() {
    if (this.isTuning || !this.botEngine) return;
    this.isTuning = true;

    try {
      const bots = this.botEngine.getAllBots();
      const activeJarvisBots = bots.filter(b => b.config.strategyType === 'JARVIS' && b.status === 'RUNNING');

      for (const bot of activeJarvisBots) {
        try {
          await this.calibrateBot(bot.config.id);
        } catch (botErr) {
          logger.warn(`[JARVIS Auto-Tuner] Bot ${bot.config.id} tuning skipped: ${botErr.message}`);
        }
      }
    } finally {
      this.isTuning = false;
    }
  }
}

export const jarvisAutoTuner = new JarvisAutoTuner();
export default jarvisAutoTuner;
