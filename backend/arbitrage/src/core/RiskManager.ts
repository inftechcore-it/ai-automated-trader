/**
 * Risk Manager - Controls exposure, prevents excessive losses
 */
import { EventEmitter } from 'events';
import type { CrossExchangeOpportunity, ArbitrageExecution } from '../types/index.js';

interface RiskConfig {
  maxDailyLossUSDT: number;
  maxPositionSizeUSDT: number;
  maxOpenPositions: number;
  maxExposurePerAsset: number;  // Percentage
  maxExposurePerExchange: number;  // Percentage
  cooldownAfterLossMs: number;
  minProfitToExecute: number;
  maxConsecutiveLosses: number;
  requireHighConfidence: boolean;
}

interface RiskState {
  dailyPnL: number;
  dailyTrades: number;
  dailyWins: number;
  dailyLosses: number;
  consecutiveLosses: number;
  openPositions: Map<string, number>;
  exposureByAsset: Map<string, number>;
  exposureByExchange: Map<string, number>;
  lastLossTimestamp: number;
  isLocked: boolean;
  lockReason: string;
}

interface RiskCheck {
  allowed: boolean;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  adjustedAmount?: number;
}

const DEFAULT_CONFIG: RiskConfig = {
  maxDailyLossUSDT: 50,
  maxPositionSizeUSDT: 200,
  maxOpenPositions: 3,
  maxExposurePerAsset: 30,
  maxExposurePerExchange: 50,
  cooldownAfterLossMs: 60000,  // 1 minute cooldown after loss
  minProfitToExecute: 0.1,  // Minimum 0.1% profit
  maxConsecutiveLosses: 3,
  requireHighConfidence: true,
};

export class RiskManager extends EventEmitter {
  private config: RiskConfig;
  private state: RiskState;
  private totalCapitalUSDT: number = 0;

  constructor(config: Partial<RiskConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  private createInitialState(): RiskState {
    return {
      dailyPnL: 0,
      dailyTrades: 0,
      dailyWins: 0,
      dailyLosses: 0,
      consecutiveLosses: 0,
      openPositions: new Map(),
      exposureByAsset: new Map(),
      exposureByExchange: new Map(),
      lastLossTimestamp: 0,
      isLocked: false,
      lockReason: '',
    };
  }

  setTotalCapital(capitalUSDT: number): void {
    this.totalCapitalUSDT = capitalUSDT;
    console.log(`[RiskManager] Total capital set to $${capitalUSDT.toFixed(2)}`);
  }

  /**
   * Check if an opportunity passes risk checks
   */
  checkOpportunity(
    opportunity: CrossExchangeOpportunity,
    requestedAmount: number
  ): RiskCheck {
    // 1. Check if trading is locked
    if (this.state.isLocked) {
      return {
        allowed: false,
        reason: `Trading locked: ${this.state.lockReason}`,
        riskLevel: 'critical',
      };
    }

    // 2. Check cooldown after loss
    if (this.state.lastLossTimestamp > 0) {
      const timeSinceLoss = Date.now() - this.state.lastLossTimestamp;
      if (timeSinceLoss < this.config.cooldownAfterLossMs) {
        const remainingMs = this.config.cooldownAfterLossMs - timeSinceLoss;
        return {
          allowed: false,
          reason: `Cooldown active. ${Math.ceil(remainingMs / 1000)}s remaining`,
          riskLevel: 'medium',
        };
      }
    }

    // 3. Check consecutive losses
    if (this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      return {
        allowed: false,
        reason: `${this.state.consecutiveLosses} consecutive losses. Manual review required.`,
        riskLevel: 'critical',
      };
    }

    // 4. Check daily loss limit
    if (this.state.dailyPnL <= -this.config.maxDailyLossUSDT) {
      this.lockTrading(`Daily loss limit reached: $${Math.abs(this.state.dailyPnL).toFixed(2)}`);
      return {
        allowed: false,
        reason: `Daily loss limit reached ($${this.config.maxDailyLossUSDT})`,
        riskLevel: 'critical',
      };
    }

    // 5. Check open positions
    if (this.state.openPositions.size >= this.config.maxOpenPositions) {
      return {
        allowed: false,
        reason: `Max open positions reached (${this.config.maxOpenPositions})`,
        riskLevel: 'high',
      };
    }

    // 6. Check position size
    let adjustedAmount = requestedAmount;
    if (requestedAmount > this.config.maxPositionSizeUSDT) {
      adjustedAmount = this.config.maxPositionSizeUSDT;
    }

    // 7. Check minimum profit
    if (opportunity.netProfitPercent < this.config.minProfitToExecute) {
      return {
        allowed: false,
        reason: `Profit ${opportunity.netProfitPercent.toFixed(3)}% below minimum ${this.config.minProfitToExecute}%`,
        riskLevel: 'low',
      };
    }

    // 8. Check asset exposure
    if (this.totalCapitalUSDT > 0) {
      const currentAssetExposure = this.state.exposureByAsset.get(opportunity.asset) || 0;
      const newExposure = currentAssetExposure + adjustedAmount;
      const exposurePercent = (newExposure / this.totalCapitalUSDT) * 100;

      if (exposurePercent > this.config.maxExposurePerAsset) {
        adjustedAmount = Math.max(0, (this.config.maxExposurePerAsset / 100 * this.totalCapitalUSDT) - currentAssetExposure);
        if (adjustedAmount < 50) {
          return {
            allowed: false,
            reason: `${opportunity.asset} exposure would exceed ${this.config.maxExposurePerAsset}%`,
            riskLevel: 'high',
          };
        }
      }
    }

    // 9. Check exchange exposure
    if (this.totalCapitalUSDT > 0) {
      const buyExposure = this.state.exposureByExchange.get(opportunity.buyExchange) || 0;
      const sellExposure = this.state.exposureByExchange.get(opportunity.sellExchange) || 0;
      const maxExposure = Math.max(buyExposure, sellExposure) + adjustedAmount;
      const exposurePercent = (maxExposure / this.totalCapitalUSDT) * 100;

      if (exposurePercent > this.config.maxExposurePerExchange) {
        return {
          allowed: false,
          reason: `Exchange exposure would exceed ${this.config.maxExposurePerExchange}%`,
          riskLevel: 'high',
        };
      }
    }

    // 10. Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (this.state.consecutiveLosses >= 2) riskLevel = 'medium';
    if (this.state.dailyPnL < -this.config.maxDailyLossUSDT * 0.5) riskLevel = 'medium';
    if (opportunity.netProfitPercent < 0.2) riskLevel = 'medium';

    return {
      allowed: true,
      reason: 'All risk checks passed',
      riskLevel,
      adjustedAmount,
    };
  }

  /**
   * Record a position opening
   */
  openPosition(executionId: string, asset: string, exchanges: string[], amountUSDT: number): void {
    this.state.openPositions.set(executionId, amountUSDT);

    const currentAssetExposure = this.state.exposureByAsset.get(asset) || 0;
    this.state.exposureByAsset.set(asset, currentAssetExposure + amountUSDT);

    for (const exchange of exchanges) {
      const current = this.state.exposureByExchange.get(exchange) || 0;
      this.state.exposureByExchange.set(exchange, current + amountUSDT / exchanges.length);
    }

    this.emit('position:opened', { executionId, asset, amountUSDT });
  }

  /**
   * Record a position closing
   */
  closePosition(executionId: string, asset: string, exchanges: string[], amountUSDT: number, pnl: number): void {
    this.state.openPositions.delete(executionId);
    this.state.dailyTrades++;
    this.state.dailyPnL += pnl;

    // Update asset exposure
    const currentAssetExposure = this.state.exposureByAsset.get(asset) || 0;
    this.state.exposureByAsset.set(asset, Math.max(0, currentAssetExposure - amountUSDT));

    // Update exchange exposure
    for (const exchange of exchanges) {
      const current = this.state.exposureByExchange.get(exchange) || 0;
      this.state.exposureByExchange.set(exchange, Math.max(0, current - amountUSDT / exchanges.length));
    }

    // Track wins/losses
    if (pnl > 0) {
      this.state.dailyWins++;
      this.state.consecutiveLosses = 0;
    } else if (pnl < 0) {
      this.state.dailyLosses++;
      this.state.consecutiveLosses++;
      this.state.lastLossTimestamp = Date.now();

      // Check if we need to lock
      if (this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        this.lockTrading(`${this.state.consecutiveLosses} consecutive losses`);
      }
    }

    this.emit('position:closed', { executionId, asset, pnl });
    this.emit('stats:updated', this.getStats());
  }

  /**
   * Lock trading
   */
  lockTrading(reason: string): void {
    this.state.isLocked = true;
    this.state.lockReason = reason;
    console.warn(`[RiskManager] TRADING LOCKED: ${reason}`);
    this.emit('trading:locked', { reason });
  }

  /**
   * Unlock trading
   */
  unlockTrading(): void {
    this.state.isLocked = false;
    this.state.lockReason = '';
    this.state.consecutiveLosses = 0;
    console.log('[RiskManager] Trading unlocked');
    this.emit('trading:unlocked');
  }

  /**
   * Reset daily stats (call at start of new trading day)
   */
  resetDaily(): void {
    this.state.dailyPnL = 0;
    this.state.dailyTrades = 0;
    this.state.dailyWins = 0;
    this.state.dailyLosses = 0;
    this.state.consecutiveLosses = 0;
    this.state.lastLossTimestamp = 0;

    if (this.state.isLocked && this.state.lockReason.includes('Daily loss')) {
      this.unlockTrading();
    }

    console.log('[RiskManager] Daily stats reset');
    this.emit('daily:reset');
  }

  getStats(): {
    dailyPnL: number;
    dailyTrades: number;
    winRate: number;
    consecutiveLosses: number;
    openPositions: number;
    isLocked: boolean;
    lockReason: string;
  } {
    const winRate = this.state.dailyTrades > 0
      ? (this.state.dailyWins / this.state.dailyTrades) * 100
      : 0;

    return {
      dailyPnL: this.state.dailyPnL,
      dailyTrades: this.state.dailyTrades,
      winRate,
      consecutiveLosses: this.state.consecutiveLosses,
      openPositions: this.state.openPositions.size,
      isLocked: this.state.isLocked,
      lockReason: this.state.lockReason,
    };
  }

  getConfig(): RiskConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<RiskConfig>): void {
    Object.assign(this.config, config);
    this.emit('config:updated', this.config);
  }
}

export function createRiskManager(config?: Partial<RiskConfig>): RiskManager {
  return new RiskManager(config);
}
