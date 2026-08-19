/**
 * Simultaneous Executor - Executes buy and sell orders at the same time
 * Eliminates withdrawal delay risk by using pre-positioned capital
 */
import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { CrossExchangeOpportunity, ArbitrageExecution, ExecutionLeg, OrderResult } from '../types/index.js';
import { CapitalManager } from './CapitalManager.js';

interface ExecutorConfig {
  maxSlippagePercent: number;
  orderTimeoutMs: number;
  maxRetries: number;
  minProfitAfterSlippage: number;
  dryRun: boolean;
}

interface ExecutionResult {
  success: boolean;
  execution: ArbitrageExecution;
  buyOrder?: OrderResult;
  sellOrder?: OrderResult;
  actualProfit?: number;
  error?: string;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  maxSlippagePercent: 0.3,
  orderTimeoutMs: 5000,
  maxRetries: 2,
  minProfitAfterSlippage: 0.05,
  dryRun: true,
};

export class SimultaneousExecutor extends EventEmitter {
  private adapters: Map<string, IExchangeAdapter>;
  private capitalManager: CapitalManager;
  private config: ExecutorConfig;
  private activeExecutions: Map<string, ArbitrageExecution> = new Map();
  private executionHistory: ArbitrageExecution[] = [];
  private stats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalProfit: 0,
    totalLoss: 0,
    avgExecutionTimeMs: 0,
  };

  constructor(
    adapters: Map<string, IExchangeAdapter>,
    capitalManager: CapitalManager,
    config: Partial<ExecutorConfig> = {}
  ) {
    super();
    this.adapters = adapters;
    this.capitalManager = capitalManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute cross-exchange arbitrage simultaneously
   * Both buy and sell orders placed at the same time
   */
  async executeSimultaneous(
    opportunity: CrossExchangeOpportunity,
    amountUSDT: number
  ): Promise<ExecutionResult> {
    const executionId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();

    console.log(`[SimExecutor] Starting simultaneous execution ${executionId}`);
    console.log(`[SimExecutor] ${opportunity.route} | Amount: $${amountUSDT}`);

    // Create execution record
    const execution: ArbitrageExecution = {
      id: executionId,
      type: 'cross-exchange',
      opportunityId: opportunity.id,
      legs: [],
      status: 'pending',
      initialAmount: amountUSDT,
      startedAt: startTime,
    };

    this.activeExecutions.set(executionId, execution);
    this.emit('execution:started', execution);

    try {
      // 1. Verify capital availability
      const capitalCheck = this.capitalManager.canExecuteArbitrage(
        opportunity.buyExchange,
        opportunity.sellExchange,
        opportunity.asset,
        amountUSDT
      );

      if (!capitalCheck.canExecute) {
        throw new Error(`Capital check failed: ${capitalCheck.reason}`);
      }

      // 2. Reserve capital
      this.capitalManager.reserveCapital(executionId, amountUSDT);

      // 3. Get adapters
      const buyAdapter = this.adapters.get(opportunity.buyExchange.toLowerCase());
      const sellAdapter = this.adapters.get(opportunity.sellExchange.toLowerCase());

      if (!buyAdapter || !sellAdapter) {
        throw new Error('Exchange adapter not found');
      }

      // 4. Calculate order quantities
      const assetQuantity = amountUSDT / opportunity.buyPrice;
      const symbol = opportunity.symbol || `${opportunity.asset}/USDT`;

      // 5. Prepare legs
      const buyLeg: ExecutionLeg = {
        exchange: opportunity.buyExchange,
        action: 'buy',
        asset: opportunity.asset,
        symbol,
        amount: assetQuantity,
        price: opportunity.buyPrice,
        status: 'pending',
      };

      const sellLeg: ExecutionLeg = {
        exchange: opportunity.sellExchange,
        action: 'sell',
        asset: opportunity.asset,
        symbol,
        amount: assetQuantity,
        price: opportunity.sellPrice,
        status: 'pending',
      };

      execution.legs = [buyLeg, sellLeg];
      execution.status = 'in_progress';

      if (this.config.dryRun) {
        // Dry run - simulate execution
        return this.simulateExecution(execution, opportunity, buyLeg, sellLeg);
      }

      // 6. Execute SIMULTANEOUSLY
      console.log(`[SimExecutor] Placing orders simultaneously...`);

      const [buyResult, sellResult] = await Promise.allSettled([
        this.placeOrderWithRetry(buyAdapter, symbol, 'buy', assetQuantity, opportunity.buyPrice),
        this.placeOrderWithRetry(sellAdapter, symbol, 'sell', assetQuantity, opportunity.sellPrice),
      ]);

      // 7. Process results
      let buyOrder: OrderResult | undefined;
      let sellOrder: OrderResult | undefined;
      let hasError = false;

      if (buyResult.status === 'fulfilled') {
        buyOrder = buyResult.value;
        buyLeg.orderId = buyOrder.orderId;
        buyLeg.price = buyOrder.avgFillPrice || opportunity.buyPrice;
        buyLeg.amount = buyOrder.filledQuantity;
        buyLeg.status = buyOrder.filledQuantity > 0 ? 'completed' : 'failed';
        buyLeg.timestamp = Date.now();
        this.emit('execution:leg_completed', { execution, leg: buyLeg });
      } else {
        buyLeg.status = 'failed';
        hasError = true;
        console.error(`[SimExecutor] Buy order failed:`, buyResult.reason);
      }

      if (sellResult.status === 'fulfilled') {
        sellOrder = sellResult.value;
        sellLeg.orderId = sellOrder.orderId;
        sellLeg.price = sellOrder.avgFillPrice || opportunity.sellPrice;
        sellLeg.amount = sellOrder.filledQuantity;
        sellLeg.status = sellOrder.filledQuantity > 0 ? 'completed' : 'failed';
        sellLeg.timestamp = Date.now();
        this.emit('execution:leg_completed', { execution, leg: sellLeg });
      } else {
        sellLeg.status = 'failed';
        hasError = true;
        console.error(`[SimExecutor] Sell order failed:`, sellResult.reason);
      }

      // 8. Calculate actual profit/loss
      const buyValue = (buyLeg.amount || 0) * (buyLeg.price || opportunity.buyPrice);
      const sellValue = (sellLeg.amount || 0) * (sellLeg.price || opportunity.sellPrice);
      const grossProfit = sellValue - buyValue;

      // Estimate fees (0.1% per trade)
      const totalFees = (buyValue + sellValue) * 0.001;
      const netProfit = grossProfit - totalFees;

      execution.finalAmount = amountUSDT + netProfit;
      execution.grossProfit = grossProfit;
      execution.netProfit = netProfit;
      execution.totalFees = totalFees;
      execution.completedAt = Date.now();

      // 9. Determine final status
      if (hasError) {
        if (buyLeg.status === 'completed' || sellLeg.status === 'completed') {
          execution.status = 'partial';
        } else {
          execution.status = 'failed';
        }
      } else {
        execution.status = 'completed';
      }

      // 10. Update stats
      this.updateStats(execution);

      // 11. Release capital
      this.capitalManager.releaseCapital(executionId);

      // 12. Emit completion
      this.emit(execution.status === 'completed' ? 'execution:completed' : 'execution:failed', execution);

      const executionTimeMs = Date.now() - startTime;
      console.log(`[SimExecutor] Execution ${executionId} ${execution.status} in ${executionTimeMs}ms`);
      console.log(`[SimExecutor] Net profit: $${netProfit.toFixed(4)}`);

      return {
        success: execution.status === 'completed',
        execution,
        buyOrder,
        sellOrder,
        actualProfit: netProfit,
      };

    } catch (error: any) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = Date.now();

      this.capitalManager.releaseCapital(executionId);
      this.emit('execution:failed', execution);

      this.stats.failedExecutions++;

      return {
        success: false,
        execution,
        error: error.message,
      };

    } finally {
      this.activeExecutions.delete(executionId);
      this.executionHistory.unshift(execution);
      if (this.executionHistory.length > 200) {
        this.executionHistory = this.executionHistory.slice(0, 200);
      }
    }
  }

  private async placeOrderWithRetry(
    adapter: IExchangeAdapter,
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    expectedPrice: number
  ): Promise<OrderResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Add slippage tolerance
        const price = side === 'buy'
          ? expectedPrice * (1 + this.config.maxSlippagePercent / 100)
          : expectedPrice * (1 - this.config.maxSlippagePercent / 100);

        const result = await adapter.placeOrder({
          symbol,
          side,
          type: 'limit',
          quantity,
          price,
          timeInForce: 'IOC', // Immediate or Cancel - fills what it can
        });

        if (result.filledQuantity > 0) {
          return result;
        }

        // Try market order if limit didn't fill
        if (attempt === this.config.maxRetries) {
          console.log(`[SimExecutor] Trying market order for ${side} ${symbol}`);
          return adapter.placeOrder({
            symbol,
            side,
            type: 'market',
            quantity,
          });
        }

      } catch (error: any) {
        lastError = error;
        console.warn(`[SimExecutor] Order attempt ${attempt + 1} failed:`, error.message);
        await this.sleep(100 * (attempt + 1));
      }
    }

    throw lastError || new Error('Order failed after retries');
  }

  private simulateExecution(
    execution: ArbitrageExecution,
    opportunity: CrossExchangeOpportunity,
    buyLeg: ExecutionLeg,
    sellLeg: ExecutionLeg
  ): ExecutionResult {
    // Simulate with slight slippage
    const slippage = (Math.random() - 0.5) * 0.002; // ±0.1% random slippage

    const buyPrice = opportunity.buyPrice * (1 + slippage);
    const sellPrice = opportunity.sellPrice * (1 - slippage);

    buyLeg.price = buyPrice;
    buyLeg.status = 'completed';
    buyLeg.timestamp = Date.now();

    sellLeg.price = sellPrice;
    sellLeg.status = 'completed';
    sellLeg.timestamp = Date.now();

    const buyValue = execution.initialAmount;
    const assetAmount = buyValue / buyPrice;
    const sellValue = assetAmount * sellPrice;

    const grossProfit = sellValue - buyValue;
    const fees = (buyValue + sellValue) * 0.001;
    const netProfit = grossProfit - fees;

    execution.finalAmount = buyValue + netProfit;
    execution.grossProfit = grossProfit;
    execution.netProfit = netProfit;
    execution.totalFees = fees;
    execution.status = 'completed';
    execution.completedAt = Date.now();

    this.updateStats(execution);

    console.log(`[SimExecutor] DRY RUN: Simulated ${opportunity.route}`);
    console.log(`[SimExecutor] DRY RUN: Buy $${buyValue.toFixed(2)} at $${buyPrice.toFixed(4)}`);
    console.log(`[SimExecutor] DRY RUN: Sell ${assetAmount.toFixed(6)} at $${sellPrice.toFixed(4)} = $${sellValue.toFixed(2)}`);
    console.log(`[SimExecutor] DRY RUN: Net profit: $${netProfit.toFixed(4)}`);

    this.emit('execution:completed', execution);

    return {
      success: true,
      execution,
      actualProfit: netProfit,
    };
  }

  private updateStats(execution: ArbitrageExecution): void {
    this.stats.totalExecutions++;

    if (execution.status === 'completed') {
      this.stats.successfulExecutions++;
      if (execution.netProfit && execution.netProfit > 0) {
        this.stats.totalProfit += execution.netProfit;
      } else if (execution.netProfit && execution.netProfit < 0) {
        this.stats.totalLoss += Math.abs(execution.netProfit);
      }
    } else {
      this.stats.failedExecutions++;
    }

    // Update average execution time
    const execTime = (execution.completedAt || Date.now()) - execution.startedAt;
    this.stats.avgExecutionTimeMs =
      (this.stats.avgExecutionTimeMs * (this.stats.totalExecutions - 1) + execTime) /
      this.stats.totalExecutions;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getActiveExecutions(): ArbitrageExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  getExecutionHistory(limit: number = 50): ArbitrageExecution[] {
    return this.executionHistory.slice(0, limit);
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  setDryRun(dryRun: boolean): void {
    this.config.dryRun = dryRun;
    console.log(`[SimExecutor] Dry run: ${dryRun ? 'ENABLED' : 'DISABLED - LIVE TRADING'}`);
  }

  isDryRun(): boolean {
    return this.config.dryRun;
  }
}

export function createSimultaneousExecutor(
  adapters: Map<string, IExchangeAdapter>,
  capitalManager: CapitalManager,
  config?: Partial<ExecutorConfig>
): SimultaneousExecutor {
  return new SimultaneousExecutor(adapters, capitalManager, config);
}
