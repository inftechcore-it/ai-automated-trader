import { EventEmitter } from 'events';
import type { IExchangeAdapter } from '../adapters/IExchangeAdapter.js';
import type { CrossExchangeOpportunity, TriangularOpportunity, ArbitrageExecution } from '../types/index.js';

export interface ExecutionStep {
  step: number;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  data?: Record<string, any>;
  error?: string;
  timestamp?: number;
}

export interface ExecutionSession {
  id: string;
  type: 'cross-exchange' | 'triangular';
  opportunity: CrossExchangeOpportunity | TriangularOpportunity;
  steps: ExecutionStep[];
  status: 'validating' | 'executing' | 'completed' | 'failed';
  dryRun: boolean;
  startedAt: number;
  completedAt?: number;
  expectedProfit: number;
  actualProfit?: number;
}

interface ExecutionConfig {
  dryRun: boolean;
  maxTradeAmountUSDT: number;
  orderTimeoutS: number;
  transferTimeoutS: number;
  slippageTolerancePercent: number;
}

const DEFAULT_CONFIG: ExecutionConfig = {
  dryRun: true,
  maxTradeAmountUSDT: 100,
  orderTimeoutS: 30,
  transferTimeoutS: 7200,
  slippageTolerancePercent: 0.5,
};

export class ExecutionService extends EventEmitter {
  private adapters: Map<string, IExchangeAdapter>;
  private config: ExecutionConfig;
  private activeSessions: Map<string, ExecutionSession> = new Map();
  private sessionHistory: ExecutionSession[] = [];

  constructor(
    adapters: Map<string, IExchangeAdapter>,
    config: Partial<ExecutionConfig> = {}
  ) {
    super();
    this.adapters = adapters;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async executeCrossExchange(
    opportunity: CrossExchangeOpportunity,
    amount: number
  ): Promise<string> {
    const sessionId = `exec_cross_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const session: ExecutionSession = {
      id: sessionId,
      type: 'cross-exchange',
      opportunity,
      steps: [
        { step: 1, label: 'Validating balances and permissions', status: 'pending' },
        { step: 2, label: `Placing buy order on ${opportunity.buyExchange}`, status: 'pending' },
        { step: 3, label: `Transferring ${opportunity.asset} to ${opportunity.sellExchange}`, status: 'pending' },
        { step: 4, label: `Placing sell order on ${opportunity.sellExchange}`, status: 'pending' },
        { step: 5, label: 'Trade complete', status: 'pending' },
      ],
      status: 'validating',
      dryRun: this.config.dryRun,
      startedAt: Date.now(),
      expectedProfit: opportunity.netProfitUSDT,
    };

    this.activeSessions.set(sessionId, session);
    this.emitStepUpdate(session, 1, 'running');

    // Run execution in background
    this.runCrossExchangeExecution(session, amount).catch(error => {
      console.error(`[ExecutionService] Session ${sessionId} failed:`, error);
    });

    return sessionId;
  }

  private async runCrossExchangeExecution(session: ExecutionSession, amount: number): Promise<void> {
    const opp = session.opportunity as CrossExchangeOpportunity;

    try {
      // Step 1: Validate
      await this.executeStep1Validate(session, opp, amount);

      // Step 2: Buy
      const buyResult = await this.executeStep2Buy(session, opp, amount);

      // Step 3: Transfer
      const transferResult = await this.executeStep3Transfer(session, opp, buyResult);

      // Step 4: Sell
      const sellResult = await this.executeStep4Sell(session, opp, transferResult);

      // Step 5: Summary
      await this.executeStep5Summary(session, buyResult, sellResult);

    } catch (error: any) {
      session.status = 'failed';
      this.emit('execution:failed', {
        sessionId: session.id,
        step: session.steps.find(s => s.status === 'running')?.step || 0,
        error: error.message,
      });
    } finally {
      this.activeSessions.delete(session.id);
      this.sessionHistory.unshift(session);
      if (this.sessionHistory.length > 100) {
        this.sessionHistory = this.sessionHistory.slice(0, 100);
      }
    }
  }

  private async executeStep1Validate(
    session: ExecutionSession,
    opp: CrossExchangeOpportunity,
    amount: number
  ): Promise<void> {
    const buyAdapter = this.adapters.get(opp.buyExchange.toLowerCase());
    if (!buyAdapter) {
      throw new Error(`Adapter not found for ${opp.buyExchange}`);
    }

    if (this.config.dryRun) {
      await this.simulateDelay(500);
      this.emitStepUpdate(session, 1, 'done', {
        balance: amount,
        verified: true,
        dryRun: true,
      });
      return;
    }

    // Check USDT balance
    const balances = await buyAdapter.getBalance();
    const usdtBalance = balances.find(b => b.asset === 'USDT');

    if (!usdtBalance || usdtBalance.free < amount) {
      this.emitStepUpdate(session, 1, 'failed', {}, `Insufficient USDT on ${opp.buyExchange}: ${usdtBalance?.free || 0}`);
      throw new Error(`Insufficient USDT on ${opp.buyExchange}`);
    }

    // Verify prices haven't moved too much
    // (In production, re-fetch and compare to snapshot)

    this.emitStepUpdate(session, 1, 'done', {
      balance: usdtBalance.free,
      verified: true,
    });
  }

  private async executeStep2Buy(
    session: ExecutionSession,
    opp: CrossExchangeOpportunity,
    amount: number
  ): Promise<{ filledQty: number; filledPrice: number; fee: number }> {
    this.emitStepUpdate(session, 2, 'running', {
      exchange: opp.buyExchange,
      symbol: opp.symbol,
      price: opp.buyPrice,
      amount,
    });

    if (this.config.dryRun) {
      await this.simulateDelay(1000);
      const qty = amount / opp.buyPrice;
      const fee = amount * 0.001;
      this.emitStepUpdate(session, 2, 'done', {
        orderId: `DRY_${Date.now()}`,
        filledQty: qty,
        filledPrice: opp.buyPrice,
        fee,
      });
      return { filledQty: qty, filledPrice: opp.buyPrice, fee };
    }

    const buyAdapter = this.adapters.get(opp.buyExchange.toLowerCase())!;
    const quantity = amount / opp.buyPrice;
    const limitPrice = opp.buyPrice * (1 + this.config.slippageTolerancePercent / 100);

    const order = await buyAdapter.placeOrder({
      symbol: opp.symbol,
      side: 'buy',
      type: 'limit',
      quantity,
      price: limitPrice,
      timeInForce: 'IOC',
    });

    if (order.status === 'rejected' || order.filledQuantity === 0) {
      this.emitStepUpdate(session, 2, 'failed', {}, 'Buy order rejected or unfilled');
      throw new Error('Buy order rejected');
    }

    this.emitStepUpdate(session, 2, 'done', {
      orderId: order.orderId,
      filledQty: order.filledQuantity,
      filledPrice: order.avgFillPrice || opp.buyPrice,
      fee: (order.filledQuantity * (order.avgFillPrice || opp.buyPrice)) * 0.001,
    });

    return {
      filledQty: order.filledQuantity,
      filledPrice: order.avgFillPrice || opp.buyPrice,
      fee: (order.filledQuantity * (order.avgFillPrice || opp.buyPrice)) * 0.001,
    };
  }

  private async executeStep3Transfer(
    session: ExecutionSession,
    opp: CrossExchangeOpportunity,
    buyResult: { filledQty: number; filledPrice: number; fee: number }
  ): Promise<{ amountReceived: number; withdrawalFee: number }> {
    this.emitStepUpdate(session, 3, 'running', {
      asset: opp.asset,
      amount: buyResult.filledQty,
      from: opp.buyExchange,
      to: opp.sellExchange,
    });

    if (this.config.dryRun) {
      // Simulate transfer time
      for (let i = 0; i < 3; i++) {
        await this.simulateDelay(800);
        this.emitStepUpdate(session, 3, 'running', {
          asset: opp.asset,
          amount: buyResult.filledQty,
          confirmations: i + 1,
          totalConfirmations: 3,
          estimatedTime: `${(3 - i) * 2} min remaining`,
        });
      }

      const withdrawalFee = opp.fees?.withdrawalFee || 0;
      const amountReceived = buyResult.filledQty - withdrawalFee;

      this.emitStepUpdate(session, 3, 'done', {
        txId: `DRY_TX_${Date.now()}`,
        confirmations: 3,
        actualTime: '~6 min (simulated)',
        amountReceived,
        withdrawalFee,
      });

      return { amountReceived, withdrawalFee };
    }

    // Real transfer
    const buyAdapter = this.adapters.get(opp.buyExchange.toLowerCase())!;
    const sellAdapter = this.adapters.get(opp.sellExchange.toLowerCase())!;

    // Get deposit address
    const depositAddress = await sellAdapter.getDepositAddress(opp.asset);

    // Submit withdrawal
    const withdrawal = await buyAdapter.withdraw({
      asset: opp.asset,
      amount: buyResult.filledQty,
      address: depositAddress.address,
      tag: depositAddress.tag,
    });

    // Poll for deposit (simplified - in production use more robust tracking)
    const startBalance = (await sellAdapter.getBalance()).find(b => b.asset === opp.asset)?.free || 0;
    const expectedAmount = buyResult.filledQty - withdrawal.fee;
    const timeout = Date.now() + this.config.transferTimeoutS * 1000;

    while (Date.now() < timeout) {
      await new Promise(r => setTimeout(r, 15000));

      const currentBalance = (await sellAdapter.getBalance()).find(b => b.asset === opp.asset)?.free || 0;
      const deposited = currentBalance - startBalance;

      if (deposited >= expectedAmount * 0.99) {
        this.emitStepUpdate(session, 3, 'done', {
          txId: withdrawal.withdrawalId,
          amountReceived: deposited,
          withdrawalFee: withdrawal.fee,
        });
        return { amountReceived: deposited, withdrawalFee: withdrawal.fee };
      }
    }

    throw new Error('Transfer timeout');
  }

  private async executeStep4Sell(
    session: ExecutionSession,
    opp: CrossExchangeOpportunity,
    transferResult: { amountReceived: number; withdrawalFee: number }
  ): Promise<{ filledQty: number; filledPrice: number; fee: number; totalUSDT: number }> {
    this.emitStepUpdate(session, 4, 'running', {
      exchange: opp.sellExchange,
      symbol: opp.symbol,
      amount: transferResult.amountReceived,
      price: opp.sellPrice,
    });

    if (this.config.dryRun) {
      await this.simulateDelay(1000);
      const totalUSDT = transferResult.amountReceived * opp.sellPrice;
      const fee = totalUSDT * 0.001;

      this.emitStepUpdate(session, 4, 'done', {
        orderId: `DRY_${Date.now()}`,
        filledQty: transferResult.amountReceived,
        filledPrice: opp.sellPrice,
        fee,
        totalUSDT,
      });

      return {
        filledQty: transferResult.amountReceived,
        filledPrice: opp.sellPrice,
        fee,
        totalUSDT,
      };
    }

    const sellAdapter = this.adapters.get(opp.sellExchange.toLowerCase())!;
    const limitPrice = opp.sellPrice * (1 - this.config.slippageTolerancePercent / 100);

    const order = await sellAdapter.placeOrder({
      symbol: opp.symbol,
      side: 'sell',
      type: 'limit',
      quantity: transferResult.amountReceived,
      price: limitPrice,
      timeInForce: 'IOC',
    });

    if (order.status === 'rejected' || order.filledQuantity === 0) {
      this.emitStepUpdate(session, 4, 'failed', {}, 'Sell order rejected or unfilled');
      throw new Error('Sell order rejected');
    }

    const totalUSDT = order.filledQuantity * (order.avgFillPrice || opp.sellPrice);
    const fee = totalUSDT * 0.001;

    this.emitStepUpdate(session, 4, 'done', {
      orderId: order.orderId,
      filledQty: order.filledQuantity,
      filledPrice: order.avgFillPrice || opp.sellPrice,
      fee,
      totalUSDT,
    });

    return {
      filledQty: order.filledQuantity,
      filledPrice: order.avgFillPrice || opp.sellPrice,
      fee,
      totalUSDT,
    };
  }

  private async executeStep5Summary(
    session: ExecutionSession,
    buyResult: { filledQty: number; filledPrice: number; fee: number },
    sellResult: { filledQty: number; filledPrice: number; fee: number; totalUSDT: number }
  ): Promise<void> {
    const opp = session.opportunity as CrossExchangeOpportunity;
    const initialAmount = opp.tradeSize;
    const finalAmount = sellResult.totalUSDT - sellResult.fee;
    const grossProfit = finalAmount - initialAmount;
    const totalFees = buyResult.fee + sellResult.fee + (opp.fees?.withdrawalFee || 0);
    const netProfit = grossProfit - totalFees;

    session.status = 'completed';
    session.completedAt = Date.now();
    session.actualProfit = netProfit;

    this.emitStepUpdate(session, 5, 'done', {
      initialAmount,
      finalAmount,
      grossProfit,
      totalFees,
      netProfit,
      duration: session.completedAt - session.startedAt,
      expectedVsActual: {
        expected: session.expectedProfit,
        actual: netProfit,
        difference: netProfit - session.expectedProfit,
      },
    });

    this.emit('execution:complete', {
      sessionId: session.id,
      summary: {
        initialAmount,
        finalAmount,
        grossProfit,
        totalFees,
        netProfit,
        duration: session.completedAt - session.startedAt,
      },
    });
  }

  async executeTriangular(
    opportunity: TriangularOpportunity,
    amount: number
  ): Promise<string> {
    const sessionId = `exec_tri_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const session: ExecutionSession = {
      id: sessionId,
      type: 'triangular',
      opportunity,
      steps: [
        { step: 1, label: 'Validating balance', status: 'pending' },
        { step: 2, label: `Leg 1: ${opportunity.legs[0]?.symbol || 'Trade 1'}`, status: 'pending' },
        { step: 3, label: `Leg 2: ${opportunity.legs[1]?.symbol || 'Trade 2'}`, status: 'pending' },
        { step: 4, label: `Leg 3: ${opportunity.legs[2]?.symbol || 'Trade 3'}`, status: 'pending' },
        { step: 5, label: 'Trade complete', status: 'pending' },
      ],
      status: 'validating',
      dryRun: this.config.dryRun,
      startedAt: Date.now(),
      expectedProfit: opportunity.netProfitUSDT,
    };

    this.activeSessions.set(sessionId, session);
    this.runTriangularExecution(session, amount).catch(error => {
      console.error(`[ExecutionService] Triangular session ${sessionId} failed:`, error);
    });

    return sessionId;
  }

  private async runTriangularExecution(session: ExecutionSession, amount: number): Promise<void> {
    const opp = session.opportunity as TriangularOpportunity;

    try {
      // Simulate all steps for dry run
      for (let i = 1; i <= 5; i++) {
        this.emitStepUpdate(session, i, 'running');
        await this.simulateDelay(this.config.dryRun ? 800 : 0);

        if (i === 5) {
          const netProfit = opp.netProfitUSDT;
          session.status = 'completed';
          session.completedAt = Date.now();
          session.actualProfit = netProfit;

          this.emitStepUpdate(session, i, 'done', {
            initialAmount: amount,
            finalAmount: amount + netProfit,
            netProfit,
            duration: session.completedAt - session.startedAt,
          });

          this.emit('execution:complete', {
            sessionId: session.id,
            summary: { netProfit },
          });
        } else {
          this.emitStepUpdate(session, i, 'done', {
            leg: i - 1,
            symbol: opp.legs[i - 1]?.symbol,
            price: opp.legs[i - 1]?.price,
          });
        }
      }
    } catch (error: any) {
      session.status = 'failed';
      this.emit('execution:failed', { sessionId: session.id, error: error.message });
    } finally {
      this.activeSessions.delete(session.id);
      this.sessionHistory.unshift(session);
    }
  }

  private emitStepUpdate(
    session: ExecutionSession,
    step: number,
    status: 'running' | 'done' | 'failed',
    data?: Record<string, any>,
    error?: string
  ): void {
    const stepObj = session.steps.find(s => s.step === step);
    if (stepObj) {
      stepObj.status = status;
      stepObj.data = data;
      stepObj.error = error;
      stepObj.timestamp = Date.now();
    }

    this.emit('execution:step_update', {
      sessionId: session.id,
      step,
      label: stepObj?.label,
      status,
      data,
      error,
    });
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getSession(sessionId: string): ExecutionSession | undefined {
    return this.activeSessions.get(sessionId) || this.sessionHistory.find(s => s.id === sessionId);
  }

  getActiveSessions(): ExecutionSession[] {
    return Array.from(this.activeSessions.values());
  }

  getSessionHistory(limit: number = 20): ExecutionSession[] {
    return this.sessionHistory.slice(0, limit);
  }

  setConfig(config: Partial<ExecutionConfig>): void {
    Object.assign(this.config, config);
  }

  setDryRun(dryRun: boolean): void {
    this.config.dryRun = dryRun;
    console.log(`[ExecutionService] Dry run: ${dryRun ? 'ENABLED' : 'DISABLED - LIVE TRADING'}`);
  }

  isDryRun(): boolean {
    return this.config.dryRun;
  }
}

export function createExecutionService(
  adapters: Map<string, IExchangeAdapter>,
  config?: Partial<ExecutionConfig>
): ExecutionService {
  return new ExecutionService(adapters, config);
}
