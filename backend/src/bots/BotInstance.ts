/**
 * BotInstance - Single bot runtime with state machine
 * States: CREATED → RUNNING ↔ PAUSED → STOPPED
 */
import { EventEmitter } from 'events';
import type { IBotStrategy } from './IBotStrategy.js';
import type {
  BotConfig,
  BotState,
  BotAction,
  PriceTick,
  BotStatus,
  BotHolding,
  OpenOrder,
  TradeRecord,
  OrderSide,
  OrderType,
} from './types.js';

interface ExecutionEngine {
  placeOrder(params: {
    exchange: string;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    dryRun: boolean;
  }): Promise<{ orderId: string; status: string; filledPrice?: number; filledQuantity?: number }>;

  cancelOrder(params: {
    exchange: string;
    orderId: string;
    symbol: string;
  }): Promise<{ success: boolean }>;
}

interface BotInstanceDeps {
  strategy: IBotStrategy;
  config: BotConfig;
  executionEngine: ExecutionEngine;
  onStateChange: (botId: string, status: BotStatus, data?: any) => void;
  onTrade: (botId: string, trade: TradeRecord) => void;
  onError: (botId: string, error: string, severity: 'warning' | 'error' | 'critical') => void;
  onLog?: (botId: string, message: string, level: 'info' | 'warn' | 'error') => void;
}

export class BotInstance extends EventEmitter {
  private strategy: IBotStrategy;
  private config: BotConfig;
  private executionEngine: ExecutionEngine;
  private status: BotStatus = 'CREATED';
  private state: BotState;
  private lastTickTime = 0;
  private tickCount = 0;
  private snapshotInterval: NodeJS.Timeout | null = null;

  constructor(private deps: BotInstanceDeps) {
    super();
    this.strategy = deps.strategy;
    this.config = deps.config;
    this.executionEngine = deps.executionEngine;
    // Always start as CREATED - start() will transition to RUNNING
    this.status = 'CREATED';

    this.state = {
      holdings: [],
      totalHoldingsValue: 0,
      availableBalance: Number(deps.config.investedAmount),
      totalInvested: Number(deps.config.investedAmount),
      currentEquity: Number(deps.config.investedAmount),
      realizedPnl: 0,
      unrealizedPnl: 0,
      openOrders: [],
      tradeHistory: [],
      customState: {},
    };
  }

  get id(): string {
    return this.config.id;
  }

  get currentStatus(): BotStatus {
    return this.status;
  }

  get currentConfig(): BotConfig {
    return { ...this.config, status: this.status };
  }

  get currentState(): BotState {
    return { ...this.state };
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = `[Bot ${this.config.name}]`;
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
    this.deps.onLog?.(this.id, message, level);
  }

  async start(): Promise<void> {
    if (this.status === 'RUNNING') {
      throw new Error('Bot is already running');
    }

    if (this.status === 'ERROR') {
      throw new Error('Cannot restart a bot in error state. Create a new one.');
    }

    // Allow restarting stopped bots - reset state for fresh start
    if (this.status === 'STOPPED') {
      console.log(`[Bot ${this.config.name}] Restarting stopped bot with fresh state`);
      this.state = {
        holdings: [],
        totalHoldingsValue: 0,
        availableBalance: Number(this.config.investedAmount),
        totalInvested: Number(this.config.investedAmount),
        currentEquity: Number(this.config.investedAmount),
        realizedPnl: 0,
        unrealizedPnl: 0,
        openOrders: [],
        tradeHistory: [],
        customState: {},
      };
    }

    try {
      const adapter = await this.getAdapter();

      // For LIVE mode, sync existing orders from exchange before starting
      if (this.config.mode === 'LIVE') {
        await this.loadExistingOrders(adapter);
      }

      // Set log callback so strategy logs go to UI
      if ('setLogCallback' in this.strategy && typeof this.strategy.setLogCallback === 'function') {
        this.strategy.setLogCallback((msg, level) => this.log(msg, level));
      }

      await this.strategy.initialize(this.config.params, adapter, this.state);

      this.status = 'RUNNING';
      this.config.startedAt = new Date();
      this.deps.onStateChange(this.id, 'RUNNING');

      this.startSnapshotTimer();
      this.emit('started', { botId: this.id });

      console.log(`[Bot ${this.config.name}] Started`);
    } catch (error: any) {
      this.status = 'ERROR';
      this.deps.onError(this.id, error.message, 'critical');
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (this.status !== 'RUNNING') {
      throw new Error('Can only pause a running bot');
    }

    this.status = 'PAUSED';
    this.deps.onStateChange(this.id, 'PAUSED');
    this.emit('paused', { botId: this.id });

    console.log(`[Bot ${this.config.name}] Paused`);
  }

  async resume(): Promise<void> {
    if (this.status !== 'PAUSED') {
      throw new Error('Can only resume a paused bot');
    }

    this.status = 'RUNNING';
    this.deps.onStateChange(this.id, 'RUNNING');
    this.emit('resumed', { botId: this.id });

    console.log(`[Bot ${this.config.name}] Resumed`);
  }

  async stop(reason = 'User requested'): Promise<void> {
    if (this.status === 'STOPPED') {
      return;
    }

    this.stopSnapshotTimer();

    try {
      // Cancel all open orders
      for (const order of this.state.openOrders) {
        try {
          await this.executionEngine.cancelOrder({
            exchange: this.config.exchangeName,
            orderId: order.exchangeOrderId || order.id,
            symbol: order.symbol,
          });
        } catch (e) {
          console.warn(`[Bot ${this.config.name}] Failed to cancel order ${order.id}`);
        }
      }

      await this.strategy.cleanup();
    } catch (error: any) {
      console.error(`[Bot ${this.config.name}] Cleanup error:`, error.message);
    }

    this.status = 'STOPPED';
    this.config.stoppedAt = new Date();
    this.deps.onStateChange(this.id, 'STOPPED', { reason });
    this.emit('stopped', { botId: this.id, reason });

    console.log(`[Bot ${this.config.name}] Stopped: ${reason}`);
  }

  async processTick(tick: PriceTick): Promise<void> {
    if (this.status !== 'RUNNING') {
      return;
    }

    this.tickCount++;
    this.lastTickTime = Date.now();

    try {
      // Sync orders with exchange every 20 ticks (~60 seconds at 3s polling)
      if (this.tickCount % 20 === 0 && this.state.openOrders.length > 0) {
        await this.syncOrdersWithExchange();
      }

      // Update holdings with current price
      this.updateHoldingsPrice(tick);

      // Get actions from strategy
      const actions = await this.strategy.evaluate(tick, this.state);

      // Execute actions
      for (const action of actions) {
        await this.executeAction(action, tick);
      }

      // Update equity
      this.updateEquity();

    } catch (error: any) {
      console.error(`[Bot ${this.config.name}] Tick error:`, error.message);
      this.deps.onError(this.id, error.message, 'warning');
    }
  }

  async syncOrdersWithExchange(): Promise<void> {
    if (this.config.mode === 'PAPER') return; // Skip for paper trading

    try {
      const adapter = await this.getAdapter();
      const exchangeOrders = await adapter.getOpenOrders(this.config.symbol);
      const exchangeOrderIds = new Set(exchangeOrders.map((o: any) => o.orderId));

      // Find orders that were cancelled/filled externally
      const removedOrders: string[] = [];
      for (const order of this.state.openOrders) {
        if (!exchangeOrderIds.has(order.exchangeOrderId || order.id)) {
          removedOrders.push(order.id);
          console.log(`[Bot ${this.config.name}] Order ${order.id} no longer on exchange (cancelled/filled externally)`);
        }
      }

      // Remove orders that are no longer on exchange
      if (removedOrders.length > 0) {
        this.state.openOrders = this.state.openOrders.filter(o => !removedOrders.includes(o.id));
      }

      // Check for filled orders and process them
      for (const exOrder of exchangeOrders) {
        const localOrder = this.state.openOrders.find(o =>
          (o.exchangeOrderId || o.id) === exOrder.orderId
        );
        if (localOrder && exOrder.filledQuantity > localOrder.filledQuantity) {
          // Order has been partially or fully filled
          const newFill = exOrder.filledQuantity - localOrder.filledQuantity;
          if (newFill > 0) {
            console.log(`[Bot ${this.config.name}] Order ${localOrder.id} filled ${newFill} @ ${exOrder.avgFillPrice}`);
            localOrder.filledQuantity = exOrder.filledQuantity;

            if (exOrder.status === 'filled' || exOrder.filledQuantity >= localOrder.quantity) {
              const fillPrice = exOrder.avgFillPrice || localOrder.price || 0;
              if (fillPrice > 0) {
                await this.processOrderFill(localOrder, fillPrice, localOrder.quantity);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.warn(`[Bot ${this.config.name}] Order sync failed:`, error.message);
    }
  }

  private async loadExistingOrders(adapter: any): Promise<void> {
    try {
      console.log(`[Bot ${this.config.name}] Loading existing orders from exchange...`);
      const exchangeOrders = await adapter.getOpenOrders(this.config.symbol);

      if (exchangeOrders.length > 0) {
        console.log(`[Bot ${this.config.name}] Found ${exchangeOrders.length} existing orders on exchange`);

        for (const exOrder of exchangeOrders) {
          const openOrder: OpenOrder = {
            id: exOrder.orderId,
            exchangeOrderId: exOrder.orderId,
            symbol: exOrder.symbol,
            side: exOrder.side.toUpperCase() as 'BUY' | 'SELL',
            type: exOrder.type?.toUpperCase() || 'LIMIT',
            quantity: exOrder.quantity,
            price: exOrder.price,
            filledQuantity: exOrder.filledQuantity || 0,
            status: exOrder.status,
            createdAt: new Date(exOrder.createdAt || Date.now()),
          };
          this.state.openOrders.push(openOrder);
          console.log(`[Bot ${this.config.name}] Loaded order: ${exOrder.side} ${exOrder.quantity} @ $${exOrder.price}`);
        }

        // Calculate locked balance for existing buy orders
        const lockedBalance = this.state.openOrders
          .filter(o => o.side === 'BUY' && o.price)
          .reduce((sum, o) => sum + (o.quantity - o.filledQuantity) * (o.price ?? 0), 0);

        this.state.availableBalance -= lockedBalance;
        console.log(`[Bot ${this.config.name}] Locked balance for orders: $${lockedBalance.toFixed(2)}`);
      } else {
        console.log(`[Bot ${this.config.name}] No existing orders on exchange`);
      }

      // Also load existing holdings
      const balances = await adapter.getBalance();
      const asset = this.config.symbol.split('/')[0];
      const assetBalance = balances.find((b: any) => b.asset === asset);

      if (assetBalance && assetBalance.total > 0) {
        const ticker = await adapter.getTicker(this.config.symbol);
        const holding = {
          asset,
          quantity: assetBalance.total,
          avgEntryPrice: ticker.last, // Approximate - we don't know actual entry
          currentPrice: ticker.last,
          value: assetBalance.total * ticker.last,
          unrealizedPnl: 0,
        };
        this.state.holdings.push(holding);
        console.log(`[Bot ${this.config.name}] Loaded holding: ${assetBalance.total} ${asset}`);
      }
    } catch (error: any) {
      console.warn(`[Bot ${this.config.name}] Failed to load existing orders:`, error.message);
    }
  }

  private async executeAction(action: BotAction, tick: PriceTick): Promise<void> {
    if (action.action === 'hold') {
      return;
    }

    if (action.action === 'cancel' && action.orderId) {
      await this.cancelOrder(action.orderId);
      return;
    }

    if (action.action === 'cancel_all') {
      for (const order of [...this.state.openOrders]) {
        await this.cancelOrder(order.id);
      }
      return;
    }

    if ((action.action === 'buy' || action.action === 'sell') && action.quantity) {
      await this.placeOrder(action, tick);
    }
  }

  private async placeOrder(action: BotAction, tick: PriceTick): Promise<void> {
    const side = action.action as OrderSide;
    const type = action.orderType || 'MARKET';
    const price = action.price || (type === 'MARKET' ? tick.price : undefined);

    // Validate quantity
    if (!action.quantity || action.quantity <= 0) {
      console.warn(`[Bot ${this.config.name}] Invalid quantity: ${action.quantity}`);
      return;
    }

    // Handle case where quantity is USD value (for market orders with investAmount flag)
    let quantity = action.quantity;
    if (action.metadata?.investAmount && type === 'MARKET') {
      // Convert USD value to coin quantity using current price
      quantity = action.quantity / tick.price;
      this.log(`Converting $${action.quantity.toFixed(2)} to ${quantity.toFixed(6)} coins @ $${tick.price}`);
    }

    // Check minimum notional value (Binance DOGE/USDT minimum is $1, add buffer for safety)
    const MIN_NOTIONAL = 1.05;
    const orderValue = quantity * (price || tick.price);
    if (orderValue < MIN_NOTIONAL) {
      this.log(`Order value $${orderValue.toFixed(2)} below minimum $${MIN_NOTIONAL}. Skipping.`, 'warn');
      return;
    }

    this.log(`Placing ${side} order: ${quantity.toFixed(4)} @ $${price?.toFixed(5) || 'market'} (value: $${orderValue.toFixed(2)})`);
    this.log(`Available balance: $${this.state.availableBalance.toFixed(2)}`);

    // Check if we have enough balance for buy
    if (side === 'BUY') {
      const cost = quantity * (price || tick.price);
      this.log(`Order cost: $${cost.toFixed(2)}`);
      if (cost > this.state.availableBalance) {
        this.log(`Insufficient balance for buy order`, 'warn');
        return;
      }
    }

    // Check if we have enough holdings for sell
    if (side === 'SELL') {
      const parts = this.config.symbol?.split('/') || [];
      const asset = parts[0] || '';
      const holding = this.state.holdings.find(h => h.asset === asset);
      if (!holding || holding.quantity < quantity) {
        this.log(`Insufficient holdings for sell order`, 'warn');
        return;
      }
    }

    try {
      const result = await this.executionEngine.placeOrder({
        exchange: this.config.exchangeName,
        symbol: this.config.symbol,
        side: side.toUpperCase() as OrderSide,
        type,
        quantity,
        price,
        dryRun: this.config.mode === 'PAPER',
      });

      const order: OpenOrder = {
        id: result.orderId,
        exchangeOrderId: result.orderId,
        symbol: this.config.symbol,
        side: side.toUpperCase() as OrderSide,
        type,
        quantity,
        price,
        filledQuantity: result.filledQuantity || 0,
        status: result.status,
        gridLevel: action.gridLevel,
        createdAt: new Date(),
      };

      // For market orders or immediate fills
      // Normalize status check (handle both 'FILLED' and 'filled')
      const isFilled = result.status?.toUpperCase() === 'FILLED' ||
                       result.status?.toUpperCase() === 'CLOSED' ||
                       (result.filledQuantity && result.filledQuantity >= quantity * 0.99);

      if (isFilled) {
        const fillPrice = result.filledPrice || price || tick.price;
        this.log(`Order FILLED: ${quantity.toFixed(4)} @ $${fillPrice.toFixed(5)}`);
        await this.processOrderFill(order, fillPrice, result.filledQuantity || quantity);
      } else {
        this.log(`Order OPEN: waiting for fill (status: ${result.status})`);
        this.state.openOrders.push(order);
        if (side === 'BUY') {
          this.state.availableBalance -= quantity * (price || tick.price);
        }
      }

      this.log(`Order placed: ${side} ${quantity.toFixed(4)} @ ${price?.toFixed(5) || 'market'}`);

    } catch (error: any) {
      this.log(`Order failed: ${error.message}`, 'error');
      this.deps.onError(this.id, `Order failed: ${error.message}`, 'error');

      // Notify strategy of error (for error handling/stopping)
      if ('onOrderError' in this.strategy && typeof this.strategy.onOrderError === 'function') {
        this.strategy.onOrderError(error.message);
      }
    }
  }

  private async cancelOrder(orderId: string): Promise<void> {
    const orderIndex = this.state.openOrders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = this.state.openOrders[orderIndex];

    try {
      await this.executionEngine.cancelOrder({
        exchange: this.config.exchangeName,
        orderId: order.exchangeOrderId || orderId,
        symbol: order.symbol,
      });

      this.state.openOrders.splice(orderIndex, 1);

      // Return locked balance for buy orders
      if (order.side === 'BUY' && order.price) {
        this.state.availableBalance += (order.quantity - order.filledQuantity) * order.price;
      }

      this.strategy.onOrderCancelled(orderId);

    } catch (error: any) {
      console.error(`[Bot ${this.config.name}] Cancel failed:`, error.message);
    }
  }

  private async processOrderFill(order: OpenOrder, filledPrice: number, filledQuantity: number): Promise<void> {
    const asset = this.config.symbol.split('/')[0];

    if (order.side === 'BUY') {
      // Add to holdings
      let holding = this.state.holdings.find(h => h.asset === asset);
      if (holding) {
        const totalQty = holding.quantity + filledQuantity;
        holding.avgEntryPrice = (holding.avgEntryPrice * holding.quantity + filledPrice * filledQuantity) / totalQty;
        holding.quantity = totalQty;
      } else {
        holding = {
          asset,
          quantity: filledQuantity,
          avgEntryPrice: filledPrice,
          currentPrice: filledPrice,
          value: filledQuantity * filledPrice,
          unrealizedPnl: 0,
        };
        this.state.holdings.push(holding);
      }

      this.state.availableBalance -= filledQuantity * filledPrice;

    } else if (order.side === 'SELL') {
      // Remove from holdings
      const holding = this.state.holdings.find(h => h.asset === asset);
      if (holding) {
        const profit = (filledPrice - holding.avgEntryPrice) * filledQuantity;
        this.state.realizedPnl += profit;

        holding.quantity -= filledQuantity;
        if (holding.quantity <= 0) {
          this.state.holdings = this.state.holdings.filter(h => h.asset !== asset);
        }

        this.state.availableBalance += filledQuantity * filledPrice;

        // Record trade
        const trade: TradeRecord = {
          id: `trade_${Date.now()}`,
          symbol: order.symbol,
          side: 'SELL',
          quantity: filledQuantity,
          price: filledPrice,
          fee: filledQuantity * filledPrice * 0.001,
          profit,
          executedAt: new Date(),
        };
        this.state.tradeHistory.push(trade);
        this.deps.onTrade(this.id, trade);

        // Emit grid fill event if applicable
        if (order.gridLevel !== undefined) {
          this.emit('grid_fill', {
            botId: this.id,
            gridLevel: order.gridLevel,
            side: 'SELL',
            profit,
          });
        }
      }
    }

    // Remove from open orders
    this.state.openOrders = this.state.openOrders.filter(o => o.id !== order.id);

    // Notify strategy
    this.strategy.onOrderFilled(order.id, filledPrice, filledQuantity);

    this.config.totalTrades++;
    this.updateEquity();
  }

  private updateHoldingsPrice(tick: PriceTick): void {
    const asset = tick.symbol.split('/')[0];
    const holding = this.state.holdings.find(h => h.asset === asset);
    if (holding) {
      holding.currentPrice = tick.price;
      holding.value = holding.quantity * tick.price;
      holding.unrealizedPnl = (tick.price - holding.avgEntryPrice) * holding.quantity;
    }
  }

  private updateEquity(): void {
    this.state.totalHoldingsValue = this.state.holdings.reduce((sum, h) => sum + h.value, 0);
    this.state.unrealizedPnl = this.state.holdings.reduce((sum, h) => sum + h.unrealizedPnl, 0);
    this.state.currentEquity = this.state.availableBalance + this.state.totalHoldingsValue;

    this.config.currentValue = this.state.currentEquity;
    this.config.totalProfit = this.state.realizedPnl + this.state.unrealizedPnl;
  }

  private startSnapshotTimer(): void {
    // Take snapshot every hour
    this.snapshotInterval = setInterval(() => {
      this.takeSnapshot();
    }, 60 * 60 * 1000);
  }

  private stopSnapshotTimer(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  private takeSnapshot(): void {
    this.emit('snapshot', {
      botId: this.id,
      equity: this.state.currentEquity,
      profit: this.config.totalProfit,
      tradeCount: this.config.totalTrades,
      holdings: this.state.holdings,
    });
  }

  private async getAdapter(): Promise<any> {
    const { getAdapter } = await import('../../arbitrage/dist/adapters/index.js');
    return getAdapter(this.config.exchangeName);
  }

  getStats() {
    const stats: any = {
      id: this.id,
      name: this.config.name,
      status: this.status,
      strategyType: this.config.strategyType,
      exchange: this.config.exchangeName,
      symbol: this.config.symbol,
      mode: this.config.mode,
      invested: this.config.investedAmount,
      currentValue: this.state.currentEquity,
      totalProfit: this.config.totalProfit,
      totalTrades: this.config.totalTrades,
      unrealizedPnl: this.state.unrealizedPnl,
      realizedPnl: this.state.realizedPnl,
      holdings: this.state.holdings,
      openOrders: this.state.openOrders,
      openOrdersCount: this.state.openOrders.length,
      tickCount: this.tickCount,
      strategyStatus: this.strategy.getStatus(),
    };

    // Include grid data for DynamicGrid bots
    if (this.config.strategyType === 'DYNAMIC_GRID') {
      const customState = this.strategy.getCustomState();
      if (customState?.coinGrids) {
        stats.gridData = {
          activeCoins: Object.keys(customState.coinGrids).length,
          totalBuys: customState.totalBuysAcrossAllCoins || 0,
          totalSells: customState.totalSellsAcrossAllCoins || 0,
          realizedProfit: customState.totalRealizedProfit || 0,
          coinGrids: Object.entries(customState.coinGrids).map(([symbol, grid]: [string, any]) => ({
            symbol,
            currentPrice: grid.currentPrice,
            lowerPrice: grid.lowerPrice,
            upperPrice: grid.upperPrice,
            gridLevels: grid.gridLevels,
            buyCount: grid.buyCount,
            sellCount: grid.sellCount,
            holdings: grid.holdings,
            avgBuyPrice: grid.avgBuyPrice,
            profit: grid.profit,
          })),
        };
      }
    }

    return stats;
  }
}
