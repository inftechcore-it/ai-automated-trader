import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type {
  CrossExchangeOpportunity,
  ArbitrageExecution,
  ExecutionLeg,
  DepositAddress,
  WithdrawalResult,
  OrderResult,
} from '../types/index.js';

interface ExecutionConfig {
  maxTradeAmountUSDT: number;
  slippageTolerancePercent: number;
  withdrawalTimeoutMs: number;
  confirmationPollingMs: number;
  dryRun: boolean;
}

interface TriangularOpportunity {
  id: string;
  exchange: string;
  cycle: {
    assets: string[];
    symbols: string[];
  };
  legs: Array<{
    symbol: string;
    direction: 'buy' | 'sell';
    price: number;
    amountIn: number;
    amountOut: number;
  }>;
  grossProfitPercent: number;
  netProfitPercent: number;
  profitable: boolean;
  timestamp: number;
}

export class ExecutionEngine extends EventEmitter {
  private adapters: Map<string, IExchangeAdapter>;
  private config: ExecutionConfig;
  private activeExecutions: Map<string, ArbitrageExecution> = new Map();
  private executionHistory: ArbitrageExecution[] = [];
  private depositAddressCache: Map<string, DepositAddress> = new Map();

  constructor(
    adapters: Map<string, IExchangeAdapter>,
    config: Partial<ExecutionConfig> = {}
  ) {
    super();
    this.adapters = adapters;

    this.config = {
      maxTradeAmountUSDT: config.maxTradeAmountUSDT || 100,
      slippageTolerancePercent: config.slippageTolerancePercent || 0.5,
      withdrawalTimeoutMs: config.withdrawalTimeoutMs || 30 * 60 * 1000,
      confirmationPollingMs: config.confirmationPollingMs || 10000,
      dryRun: config.dryRun ?? true,
    };
  }

  async executeCrossExchangeArbitrage(
    opportunity: CrossExchangeOpportunity,
    amount: number
  ): Promise<ArbitrageExecution> {
    const executionId = `exec_cross_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const execution: ArbitrageExecution = {
      id: executionId,
      type: 'cross-exchange',
      opportunityId: opportunity.id,
      legs: [],
      status: 'pending',
      initialAmount: amount,
      startedAt: Date.now(),
    };

    this.activeExecutions.set(executionId, execution);
    this.emit('execution:started', execution);

    try {
      const buyAdapter = this.adapters.get(opportunity.buyExchange.toLowerCase());
      const sellAdapter = this.adapters.get(opportunity.sellExchange.toLowerCase());

      if (!buyAdapter || !sellAdapter) {
        throw new Error(`Adapter not found for ${opportunity.buyExchange} or ${opportunity.sellExchange}`);
      }

      execution.status = 'in_progress';

      const buyLeg: ExecutionLeg = {
        exchange: opportunity.buyExchange,
        action: 'buy',
        asset: opportunity.asset,
        symbol: `${opportunity.asset}/USDT`,
        amount: amount / opportunity.buyPrice,
        price: opportunity.buyPrice,
        status: 'pending',
      };
      execution.legs.push(buyLeg);

      if (!this.config.dryRun) {
        const buyOrder = await this.executeBuy(
          buyAdapter,
          `${opportunity.asset}/USDT`,
          amount / opportunity.buyPrice,
          opportunity.buyPrice
        );

        buyLeg.orderId = buyOrder.orderId;
        buyLeg.price = buyOrder.avgFillPrice || opportunity.buyPrice;
        buyLeg.amount = buyOrder.filledQuantity;
        buyLeg.fee = 0;
        buyLeg.status = 'completed';
        buyLeg.timestamp = Date.now();
      } else {
        buyLeg.status = 'completed';
        buyLeg.timestamp = Date.now();
        console.log(`[Execution] DRY RUN: Would buy ${buyLeg.amount} ${opportunity.asset} at ${buyLeg.price}`);
      }

      this.emit('execution:leg_completed', { execution, leg: buyLeg });

      const depositAddress = await this.getDepositAddress(
        sellAdapter,
        opportunity.sellExchange,
        opportunity.asset
      );

      const withdrawLeg: ExecutionLeg = {
        exchange: opportunity.buyExchange,
        action: 'withdraw',
        asset: opportunity.asset,
        amount: buyLeg.amount,
        status: 'pending',
      };
      execution.legs.push(withdrawLeg);

      if (!this.config.dryRun) {
        const withdrawal = await this.executeWithdrawal(
          buyAdapter,
          opportunity.asset,
          buyLeg.amount,
          depositAddress.address,
          depositAddress.tag
        );

        withdrawLeg.withdrawalId = withdrawal.withdrawalId;
        withdrawLeg.fee = withdrawal.fee;
        withdrawLeg.status = 'executing';
        withdrawLeg.timestamp = Date.now();

        await this.waitForDeposit(sellAdapter, opportunity.asset, buyLeg.amount - withdrawal.fee);

        withdrawLeg.status = 'completed';
      } else {
        withdrawLeg.fee = opportunity.fees?.withdrawalFee || 0;
        withdrawLeg.status = 'completed';
        withdrawLeg.timestamp = Date.now();
        console.log(`[Execution] DRY RUN: Would withdraw ${withdrawLeg.amount} ${opportunity.asset} to ${depositAddress.address}`);
      }

      this.emit('execution:leg_completed', { execution, leg: withdrawLeg });

      const amountAfterWithdrawal = buyLeg.amount - (withdrawLeg.fee || 0);

      const sellLeg: ExecutionLeg = {
        exchange: opportunity.sellExchange,
        action: 'sell',
        asset: opportunity.asset,
        symbol: `${opportunity.asset}/USDT`,
        amount: amountAfterWithdrawal,
        price: opportunity.sellPrice,
        status: 'pending',
      };
      execution.legs.push(sellLeg);

      if (!this.config.dryRun) {
        const sellOrder = await this.executeSell(
          sellAdapter,
          `${opportunity.asset}/USDT`,
          amountAfterWithdrawal,
          opportunity.sellPrice
        );

        sellLeg.orderId = sellOrder.orderId;
        sellLeg.price = sellOrder.avgFillPrice || opportunity.sellPrice;
        sellLeg.amount = sellOrder.filledQuantity;
        sellLeg.fee = 0;
        sellLeg.status = 'completed';
        sellLeg.timestamp = Date.now();
      } else {
        sellLeg.status = 'completed';
        sellLeg.timestamp = Date.now();
        console.log(`[Execution] DRY RUN: Would sell ${sellLeg.amount} ${opportunity.asset} at ${sellLeg.price}`);
      }

      this.emit('execution:leg_completed', { execution, leg: sellLeg });

      const finalAmount = (sellLeg.amount || amountAfterWithdrawal) * (sellLeg.price || opportunity.sellPrice);
      const grossProfit = finalAmount - amount;
      const totalFees = (buyLeg.fee || 0) + (withdrawLeg.fee || 0) + (sellLeg.fee || 0);
      const netProfit = grossProfit - totalFees;

      execution.finalAmount = finalAmount;
      execution.grossProfit = grossProfit;
      execution.netProfit = netProfit;
      execution.totalFees = totalFees;
      execution.status = 'completed';
      execution.completedAt = Date.now();

      this.emit('execution:completed', execution);

    } catch (error: any) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = Date.now();

      this.emit('execution:failed', { execution, error });
    }

    this.activeExecutions.delete(executionId);
    this.executionHistory.unshift(execution);

    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(0, 100);
    }

    return execution;
  }

  async executeTriangularArbitrage(
    opportunity: TriangularOpportunity,
    initialAmount: number
  ): Promise<ArbitrageExecution> {
    const executionId = `exec_tri_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const execution: ArbitrageExecution = {
      id: executionId,
      type: 'triangular',
      opportunityId: opportunity.id,
      legs: [],
      status: 'pending',
      initialAmount,
      startedAt: Date.now(),
    };

    this.activeExecutions.set(executionId, execution);
    this.emit('execution:started', execution);

    try {
      const adapter = this.adapters.get(opportunity.exchange.toLowerCase());
      if (!adapter) {
        throw new Error(`Adapter not found for ${opportunity.exchange}`);
      }

      execution.status = 'in_progress';

      let currentAmount = initialAmount;

      for (const leg of opportunity.legs) {
        const executionLeg: ExecutionLeg = {
          exchange: opportunity.exchange,
          action: leg.direction,
          asset: leg.symbol.split('/')[0],
          symbol: leg.symbol,
          amount: leg.direction === 'buy' ? currentAmount / leg.price : currentAmount,
          price: leg.price,
          status: 'pending',
        };
        execution.legs.push(executionLeg);

        if (!this.config.dryRun) {
          let orderResult: OrderResult;

          if (leg.direction === 'buy') {
            orderResult = await this.executeBuy(adapter, leg.symbol, executionLeg.amount, leg.price);
          } else {
            orderResult = await this.executeSell(adapter, leg.symbol, executionLeg.amount, leg.price);
          }

          executionLeg.orderId = orderResult.orderId;
          executionLeg.price = orderResult.avgFillPrice || leg.price;
          executionLeg.amount = orderResult.filledQuantity;
          executionLeg.status = 'completed';
          executionLeg.timestamp = Date.now();

          currentAmount = leg.amountOut;
        } else {
          executionLeg.status = 'completed';
          executionLeg.timestamp = Date.now();
          currentAmount = leg.amountOut;
          console.log(`[Execution] DRY RUN: Would ${leg.direction} ${executionLeg.amount} on ${leg.symbol} at ${leg.price}`);
        }

        this.emit('execution:leg_completed', { execution, leg: executionLeg });
      }

      const finalAmount = currentAmount;
      const grossProfit = finalAmount - initialAmount;
      const totalFees = execution.legs.reduce((sum, leg) => sum + (leg.fee || 0), 0);
      const netProfit = grossProfit - totalFees;

      execution.finalAmount = finalAmount;
      execution.grossProfit = grossProfit;
      execution.netProfit = netProfit;
      execution.totalFees = totalFees;
      execution.status = 'completed';
      execution.completedAt = Date.now();

      this.emit('execution:completed', execution);

    } catch (error: any) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = Date.now();

      this.emit('execution:failed', { execution, error });
    }

    this.activeExecutions.delete(executionId);
    this.executionHistory.unshift(execution);

    return execution;
  }

  private async executeBuy(
    adapter: IExchangeAdapter,
    symbol: string,
    quantity: number,
    expectedPrice: number
  ): Promise<OrderResult> {
    const maxPrice = expectedPrice * (1 + this.config.slippageTolerancePercent / 100);

    const result = await adapter.placeOrder({
      symbol,
      side: 'buy',
      type: 'limit',
      quantity,
      price: maxPrice,
      timeInForce: 'IOC',
    });

    if (result.status === 'rejected' || result.filledQuantity === 0) {
      throw new Error(`Buy order rejected or unfilled: ${symbol}`);
    }

    return result;
  }

  private async executeSell(
    adapter: IExchangeAdapter,
    symbol: string,
    quantity: number,
    expectedPrice: number
  ): Promise<OrderResult> {
    const minPrice = expectedPrice * (1 - this.config.slippageTolerancePercent / 100);

    const result = await adapter.placeOrder({
      symbol,
      side: 'sell',
      type: 'limit',
      quantity,
      price: minPrice,
      timeInForce: 'IOC',
    });

    if (result.status === 'rejected' || result.filledQuantity === 0) {
      throw new Error(`Sell order rejected or unfilled: ${symbol}`);
    }

    return result;
  }

  private async getDepositAddress(
    adapter: IExchangeAdapter,
    exchangeName: string,
    asset: string,
    network?: string
  ): Promise<DepositAddress> {
    const cacheKey = `${exchangeName}_${asset}_${network || 'default'}`;

    if (this.depositAddressCache.has(cacheKey)) {
      return this.depositAddressCache.get(cacheKey)!;
    }

    const address = await adapter.getDepositAddress(asset, network);
    this.depositAddressCache.set(cacheKey, address);

    return address;
  }

  private async executeWithdrawal(
    adapter: IExchangeAdapter,
    asset: string,
    amount: number,
    address: string,
    tag?: string,
    network?: string
  ): Promise<WithdrawalResult> {
    return adapter.withdraw({
      asset,
      amount,
      address,
      tag,
      network,
    });
  }

  private async waitForDeposit(
    adapter: IExchangeAdapter,
    asset: string,
    expectedAmount: number
  ): Promise<void> {
    const startTime = Date.now();
    const initialBalances = await adapter.getBalance();
    const initialBalance = initialBalances.find((b) => b.asset === asset)?.free || 0;

    while (Date.now() - startTime < this.config.withdrawalTimeoutMs) {
      await this.sleep(this.config.confirmationPollingMs);

      const currentBalances = await adapter.getBalance();
      const currentBalance = currentBalances.find((b) => b.asset === asset)?.free || 0;

      const deposited = currentBalance - initialBalance;
      const tolerance = expectedAmount * 0.01;

      if (deposited >= expectedAmount - tolerance) {
        console.log(`[Execution] Deposit confirmed: ${deposited} ${asset}`);
        return;
      }

      console.log(`[Execution] Waiting for deposit... Current: ${deposited}, Expected: ${expectedAmount}`);
    }

    throw new Error(`Deposit timeout: ${asset} not received within ${this.config.withdrawalTimeoutMs}ms`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getActiveExecutions(): ArbitrageExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  getExecutionHistory(limit: number = 20): ArbitrageExecution[] {
    return this.executionHistory.slice(0, limit);
  }

  getExecution(executionId: string): ArbitrageExecution | undefined {
    return this.activeExecutions.get(executionId) ||
      this.executionHistory.find((e) => e.id === executionId);
  }

  setConfig(config: Partial<ExecutionConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): ExecutionConfig {
    return { ...this.config };
  }

  isDryRun(): boolean {
    return this.config.dryRun;
  }

  setDryRun(dryRun: boolean): void {
    this.config.dryRun = dryRun;
    console.log(`[Execution] Dry run mode: ${dryRun ? 'ENABLED' : 'DISABLED - LIVE TRADING'}`);
  }
}

export function createExecutionEngine(
  adapters: Map<string, IExchangeAdapter>,
  config?: Partial<ExecutionConfig>
): ExecutionEngine {
  return new ExecutionEngine(adapters, config);
}
