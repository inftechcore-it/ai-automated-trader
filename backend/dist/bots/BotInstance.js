/**
 * BotInstance - Single bot runtime with state machine
 * States: CREATED → RUNNING ↔ PAUSED → STOPPED
 */
import { EventEmitter } from 'events';
export class BotInstance extends EventEmitter {
    deps;
    strategy;
    config;
    executionEngine;
    status = 'CREATED';
    state;
    lastTickTime = 0;
    lastPrice = 0;
    tickCount = 0;
    isPausedForBalance = false;
    lastLiveBalanceCheck = 0;
    lastInsufficientBalanceLog = 0;
    snapshotInterval = null;
    constructor(deps) {
        super();
        this.deps = deps;
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
    get id() {
        return this.config.id;
    }
    get currentStatus() {
        return this.status;
    }
    get currentConfig() {
        return { ...this.config, status: this.status };
    }
    get currentState() {
        return { ...this.state };
    }
    log(message, level = 'info') {
        const prefix = `[Bot ${this.config.name}]`;
        if (level === 'error') {
            console.error(`${prefix} ${message}`);
        }
        else if (level === 'warn') {
            console.warn(`${prefix} ${message}`);
        }
        else {
            console.log(`${prefix} ${message}`);
        }
        this.deps.onLog?.(this.id, message, level);
    }
    async start() {
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
            // For LIVE mode, sync existing orders and real wallet balance from exchange before starting
            if (this.config.mode === 'LIVE') {
                await this.loadExistingOrders(adapter);
                await this.syncLiveBalance(adapter);
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
        }
        catch (error) {
            this.status = 'ERROR';
            this.deps.onError(this.id, error.message, 'critical');
            throw error;
        }
    }
    async pause() {
        if (this.status !== 'RUNNING') {
            throw new Error('Can only pause a running bot');
        }
        this.status = 'PAUSED';
        this.deps.onStateChange(this.id, 'PAUSED');
        this.emit('paused', { botId: this.id });
        console.log(`[Bot ${this.config.name}] Paused`);
    }
    async resume() {
        if (this.status !== 'PAUSED') {
            throw new Error('Can only resume a paused bot');
        }
        this.status = 'RUNNING';
        this.deps.onStateChange(this.id, 'RUNNING');
        this.emit('resumed', { botId: this.id });
        console.log(`[Bot ${this.config.name}] Resumed`);
    }
    async stop(reason = 'User requested') {
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
                }
                catch (e) {
                    console.warn(`[Bot ${this.config.name}] Failed to cancel order ${order.id}`);
                }
            }
            await this.strategy.cleanup();
        }
        catch (error) {
            console.error(`[Bot ${this.config.name}] Cleanup error:`, error.message);
        }
        this.status = 'STOPPED';
        this.config.stoppedAt = new Date();
        this.deps.onStateChange(this.id, 'STOPPED', { reason });
        this.emit('stopped', { botId: this.id, reason });
        console.log(`[Bot ${this.config.name}] Stopped: ${reason}`);
    }
    async processTick(tick) {
        if (this.status !== 'RUNNING') {
            return;
        }
        this.tickCount++;
        this.lastTickTime = Date.now();
        this.lastPrice = tick.price;
        const now = Date.now();
        try {
            // In LIVE mode, periodically sync live wallet balance every 15 seconds
            if (this.config.mode === 'LIVE' && now - this.lastLiveBalanceCheck >= 15000) {
                this.lastLiveBalanceCheck = now;
                try {
                    const adapter = await this.getAdapter();
                    await this.syncLiveBalance(adapter);
                }
                catch {
                    // ignore transient balance sync error
                }
            }
            // Sync orders with exchange every 20 ticks (~60 seconds at 3s polling)
            if (this.tickCount % 20 === 0 && this.state.openOrders.length > 0) {
                await this.syncOrdersWithExchange();
            }
            // Update holdings with current price
            this.updateHoldingsPrice(tick);
            // Check DEX / emulated limit orders for price triggers
            await this.checkDexLimitOrders(tick);
            // If paused due to insufficient balance, log a clean throttled heartbeat (once per 60s)
            if (this.isPausedForBalance && this.config.mode === 'LIVE') {
                if (now - this.lastInsufficientBalanceLog >= 60000) {
                    this.lastInsufficientBalanceLog = now;
                    this.log(`[LIVE] Order placement paused: Insufficient balance ($${this.state.availableBalance.toFixed(2)} available). Waiting for new balance deposit...`, 'warn');
                }
            }
            // Get actions from strategy
            const actions = await this.strategy.evaluate(tick, this.state);
            let exitTriggered = false;
            let exitReason = '';
            // Execute actions with a small throttle between them to avoid API rate limits (e.g. 429 Too many requests)
            for (const action of actions) {
                if (action.metadata?.isExit || action.metadata?.exitReason) {
                    exitTriggered = true;
                    exitReason = action.metadata.exitReason || 'Exit Strategy Triggered';
                }
                // If paused for balance, block BUY actions completely to prevent continuously hitting exchange APIs
                const isBuy = action.action === 'buy';
                if (this.isPausedForBalance && isBuy) {
                    continue;
                }
                await this.executeAction(action, tick);
                await new Promise(r => setTimeout(r, 250));
            }
            // Update equity
            this.updateEquity();
            // If an exit condition (Stop Loss / Take Profit) was triggered, holdings were liquidated, keep bot active to resume when price recovers
            if (exitTriggered) {
                this.log(`[Bot ${this.config.name}] Protection liquidation executed for ${exitReason}. Bot remains active and will resume when price recovers.`);
            }
        }
        catch (error) {
            console.error(`[Bot ${this.config.name}] Tick error:`, error.message);
            this.deps.onError(this.id, error.message, 'warning');
        }
    }
    async syncOrdersWithExchange() {
        if (this.config.mode === 'PAPER')
            return; // Skip for paper trading
        try {
            const adapter = await this.getAdapter();
            const exchangeOrders = await adapter.getOpenOrders(this.config.symbol);
            const exchangeOrderIds = new Set(exchangeOrders.map((o) => o.orderId));
            // Find orders that were cancelled/filled externally
            const removedOrders = [];
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
                const localOrder = this.state.openOrders.find(o => (o.exchangeOrderId || o.id) === exOrder.orderId);
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
        }
        catch (error) {
            console.warn(`[Bot ${this.config.name}] Order sync failed:`, error.message);
        }
    }
    async loadExistingOrders(adapter) {
        try {
            console.log(`[Bot ${this.config.name}] Loading existing orders from exchange...`);
            const exchangeOrders = await adapter.getOpenOrders(this.config.symbol);
            if (exchangeOrders.length > 0) {
                console.log(`[Bot ${this.config.name}] Found ${exchangeOrders.length} existing orders on exchange`);
                for (const exOrder of exchangeOrders) {
                    const openOrder = {
                        id: exOrder.orderId,
                        exchangeOrderId: exOrder.orderId,
                        symbol: exOrder.symbol,
                        side: exOrder.side.toUpperCase(),
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
            }
            else {
                console.log(`[Bot ${this.config.name}] No existing orders on exchange`);
            }
            // Also load existing holdings
            let balances = [];
            if (typeof adapter.getBalances === 'function') {
                balances = await adapter.getBalances();
            }
            else if (typeof adapter.getBalance === 'function') {
                balances = await adapter.getBalance();
            }
            const asset = (this.config.symbol.split('/')[0] || '').toUpperCase();
            const assetBalance = Array.isArray(balances)
                ? balances.find((b) => (b.asset || '').toUpperCase() === asset)
                : null;
            if (assetBalance && Number(assetBalance.total ?? assetBalance.free ?? 0) > 0) {
                const totalQty = Number(assetBalance.total ?? assetBalance.free ?? 0);
                const ticker = await adapter.getTicker(this.config.symbol);
                const price = ticker.last || ticker.close || 0;
                const holding = {
                    asset,
                    quantity: totalQty,
                    avgEntryPrice: price,
                    currentPrice: price,
                    value: totalQty * price,
                    unrealizedPnl: 0,
                };
                const existingIdx = this.state.holdings.findIndex(h => (h.asset || '').toUpperCase() === asset);
                if (existingIdx >= 0) {
                    this.state.holdings[existingIdx] = holding;
                }
                else {
                    this.state.holdings.push(holding);
                }
                console.log(`[Bot ${this.config.name}] Loaded holding: ${totalQty} ${asset}`);
            }
        }
        catch (error) {
            console.warn(`[Bot ${this.config.name}] Failed to load existing orders:`, error.message);
        }
    }
    async syncLiveBalance(adapter) {
        try {
            let balances = [];
            if (typeof adapter.getBalances === 'function') {
                balances = await adapter.getBalances();
            }
            else if (typeof adapter.getBalance === 'function') {
                balances = await adapter.getBalance();
            }
            if (!Array.isArray(balances))
                return;
            const symbolParts = (this.config.symbol || '').split('/');
            const baseAsset = (symbolParts[0] || 'SOL').toUpperCase();
            const quoteAsset = (symbolParts[1] || 'USDC').toUpperCase();
            const quoteBalObj = balances.find((b) => (b.asset || '').toUpperCase() === quoteAsset);
            const baseBalObj = balances.find((b) => (b.asset || '').toUpperCase() === baseAsset);
            const freeAmount = quoteBalObj ? Number(quoteBalObj.free ?? quoteBalObj.total ?? 0) : 0;
            const baseFree = baseBalObj ? Number(baseBalObj.free ?? baseBalObj.total ?? 0) : 0;
            const previouslyPaused = this.isPausedForBalance;
            const maxConfigured = Number(this.config.investedAmount) || 0;
            // In LIVE mode, available quote balance is capped by actual free wallet balance
            this.state.availableBalance = maxConfigured > 0 ? Math.min(maxConfigured, freeAmount) : freeAmount;
            // Also synchronize base coin holdings in state
            let holding = this.state.holdings.find(h => (h.asset || '').toUpperCase() === baseAsset);
            const currentPrice = this.lastPrice || (this.state.holdings[0]?.currentPrice || 0);
            if (baseFree > 0) {
                if (holding) {
                    holding.quantity = baseFree;
                    if (currentPrice > 0) {
                        holding.value = baseFree * currentPrice;
                    }
                }
                else {
                    this.state.holdings.push({
                        asset: baseAsset,
                        quantity: baseFree,
                        avgEntryPrice: currentPrice,
                        currentPrice: currentPrice,
                        value: baseFree * currentPrice,
                        unrealizedPnl: 0,
                    });
                }
            }
            else if (holding) {
                holding.quantity = 0;
                holding.value = 0;
            }
            if (freeAmount < 0.50) {
                if (!this.isPausedForBalance) {
                    this.isPausedForBalance = true;
                    this.log(`[LIVE] Wallet quote balance is $${freeAmount.toFixed(4)} ${quoteAsset}. Pausing order placement until balance is deposited.`, 'warn');
                }
            }
            else if (previouslyPaused && freeAmount >= 1.0) {
                this.isPausedForBalance = false;
                this.log(`[LIVE] Live balance restored: ${freeAmount.toFixed(4)} ${quoteAsset}. Resuming orders.`);
            }
        }
        catch (error) {
            console.warn(`[Bot ${this.config.name}] Failed to sync live balance:`, error.message);
        }
    }
    async checkDexLimitOrders(tick) {
        const isPaper = this.config.mode === 'PAPER';
        const prefix = isPaper ? '[PAPER]' : '[LIVE]';
        for (const order of [...this.state.openOrders]) {
            if (!order.price || order.status !== 'OPEN')
                continue;
            let triggered = false;
            if (order.side === 'BUY' && tick.price <= order.price) {
                triggered = true;
            }
            else if (order.side === 'SELL' && tick.price >= order.price) {
                triggered = true;
            }
            if (triggered) {
                if (!isPaper && order.side === 'BUY' && this.isPausedForBalance) {
                    continue; // Skip triggering buy when balance is insufficient
                }
                this.log(`${prefix} Triggering limit order ${order.id}: ${order.side} ${order.quantity} @ $${order.price.toFixed(5)} (market: $${tick.price.toFixed(5)})`);
                try {
                    if (isPaper) {
                        this.log(`${prefix} Order FILLED: ${order.quantity.toFixed(4)} @ $${tick.price.toFixed(5)}`);
                        await this.processOrderFill(order, tick.price, order.quantity);
                    }
                    else {
                        // Live swap execution
                        const result = await this.executionEngine.placeOrder({
                            exchange: this.config.exchangeName,
                            symbol: this.config.symbol,
                            side: order.side,
                            type: 'MARKET',
                            quantity: order.quantity,
                            price: tick.price,
                            dryRun: false,
                        });
                        const fillPrice = result.filledPrice || tick.price;
                        const txInfo = result.explorerUrl ? ` | Explorer: ${result.explorerUrl}` : '';
                        this.log(`[LIVE] Order FILLED: ${order.quantity.toFixed(4)} @ $${fillPrice.toFixed(5)}${txInfo}`);
                        await this.processOrderFill(order, fillPrice, result.filledQuantity || order.quantity);
                    }
                }
                catch (err) {
                    const errMsg = err.message || '';
                    if (errMsg.toLowerCase().includes('insufficient') || errMsg.toLowerCase().includes('balance')) {
                        this.isPausedForBalance = true;
                        this.log(`${prefix} Order trigger failed: insufficient balance. Pausing orders.`, 'warn');
                    }
                    else {
                        this.log(`${prefix} Execution error on price trigger: ${errMsg}`, 'error');
                    }
                }
            }
        }
    }
    async executeAction(action, tick) {
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
    async placeOrder(action, tick) {
        const side = action.action;
        const type = action.orderType || 'MARKET';
        const price = action.price || (type === 'MARKET' ? tick.price : undefined);
        const isPaper = this.config.mode === 'PAPER';
        const prefix = isPaper ? '[PAPER]' : '[LIVE]';
        const isDex = (this.config.exchangeName || '').toLowerCase() === 'jupiter';
        // Validate quantity
        if (!action.quantity || action.quantity <= 0) {
            console.warn(`[Bot ${this.config.name}] Invalid quantity: ${action.quantity}`);
            return;
        }
        // Handle case where quantity is USD value (for market orders with investAmount flag)
        let quantity = action.quantity;
        if (action.metadata?.investAmount && type === 'MARKET') {
            quantity = action.quantity / tick.price;
            this.log(`${prefix} Converting $${action.quantity.toFixed(2)} to ${quantity.toFixed(6)} coins @ $${tick.price}`);
        }
        // Check minimum notional value
        const MIN_NOTIONAL = 0.50;
        const orderValue = quantity * (price || tick.price);
        if (orderValue < MIN_NOTIONAL) {
            this.log(`${prefix} Order value $${orderValue.toFixed(2)} below minimum $${MIN_NOTIONAL}. Skipping.`, 'warn');
            return;
        }
        // Check if we have enough balance for buy
        if (side === 'BUY') {
            const cost = quantity * (price || tick.price);
            if (cost > this.state.availableBalance) {
                this.isPausedForBalance = true;
                const now = Date.now();
                if (now - this.lastInsufficientBalanceLog >= 30000) {
                    this.lastInsufficientBalanceLog = now;
                    this.log(`${prefix} Insufficient balance for buy order (need $${cost.toFixed(2)}, have $${this.state.availableBalance.toFixed(2)}). Pausing API calls until balance is restored.`, 'warn');
                }
                return; // Skip hitting the exchange API
            }
        }
        // Check if we have enough holdings for sell
        if (side === 'SELL') {
            const parts = this.config.symbol?.split('/') || [];
            const asset = (parts[0] || '').toUpperCase();
            let holding = this.state.holdings.find(h => (h.asset || '').toUpperCase() === asset);
            // In LIVE mode, if holding is not in state, zero, or sweepAll is set, verify live wallet directly
            if (!isPaper && (!holding || holding.quantity <= 0 || action.metadata?.sweepAll)) {
                try {
                    const adapter = await this.getAdapter();
                    let balances = [];
                    if (typeof adapter.getBalances === 'function') {
                        balances = await adapter.getBalances();
                    }
                    else if (typeof adapter.getBalance === 'function') {
                        balances = await adapter.getBalance();
                    }
                    if (Array.isArray(balances)) {
                        const baseBalObj = balances.find((b) => (b.asset || '').toUpperCase() === asset);
                        const baseFree = baseBalObj ? Number(baseBalObj.free ?? baseBalObj.total ?? 0) : 0;
                        if (baseFree > 0) {
                            quantity = (quantity > 0 && !action.metadata?.sweepAll) ? Math.min(quantity, baseFree) : baseFree;
                            if (holding) {
                                holding.quantity = baseFree;
                            }
                            else {
                                holding = {
                                    asset,
                                    quantity: baseFree,
                                    avgEntryPrice: tick.price,
                                    currentPrice: tick.price,
                                    value: baseFree * tick.price,
                                    unrealizedPnl: 0,
                                };
                                this.state.holdings.push(holding);
                            }
                        }
                    }
                }
                catch (e) {
                    console.warn(`[Bot ${this.config.name}] Error checking live balance for sell:`, e.message);
                }
            }
            if (!holding || holding.quantity <= 0) {
                this.log(`${prefix} No ${asset} holdings available to sell.`, 'info');
                return;
            }
            if (quantity <= 0 || quantity > holding.quantity) {
                quantity = holding.quantity;
            }
        }
        // Handle DEX Limit Orders (Jupiter):
        // If LIMIT buy order is placed below current market price, register locally as OPEN until price reaches it
        if (isDex && type === 'LIMIT' && price) {
            if (side === 'BUY' && price < tick.price * 0.999) {
                const orderId = `dex_limit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                const order = {
                    id: orderId,
                    exchangeOrderId: orderId,
                    symbol: this.config.symbol,
                    side: 'BUY',
                    type: 'LIMIT',
                    quantity,
                    price,
                    filledQuantity: 0,
                    status: 'OPEN',
                    gridLevel: action.gridLevel,
                    createdAt: new Date(),
                };
                this.state.openOrders.push(order);
                this.state.availableBalance -= quantity * price;
                this.log(`${prefix} Registered Limit BUY order: ${quantity.toFixed(4)} @ $${price.toFixed(5)} (waiting for dip to target price)`);
                return;
            }
            if (side === 'SELL' && price > tick.price * 1.001) {
                const orderId = `dex_limit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                const order = {
                    id: orderId,
                    exchangeOrderId: orderId,
                    symbol: this.config.symbol,
                    side: 'SELL',
                    type: 'LIMIT',
                    quantity,
                    price,
                    filledQuantity: 0,
                    status: 'OPEN',
                    gridLevel: action.gridLevel,
                    createdAt: new Date(),
                };
                this.state.openOrders.push(order);
                this.log(`${prefix} Registered Limit SELL order: ${quantity.toFixed(4)} @ $${price.toFixed(5)} (waiting for target exit price)`);
                return;
            }
        }
        this.log(`${prefix} Placing ${side} order: ${quantity.toFixed(4)} @ $${price?.toFixed(5) || 'market'} (value: $${orderValue.toFixed(2)})`);
        try {
            const result = await this.executionEngine.placeOrder({
                exchange: this.config.exchangeName,
                symbol: this.config.symbol,
                side: side.toUpperCase(),
                type,
                quantity,
                price,
                dryRun: isPaper,
            });
            const order = {
                id: result.orderId,
                exchangeOrderId: result.orderId,
                symbol: this.config.symbol,
                side: side.toUpperCase(),
                type,
                quantity,
                price,
                filledQuantity: result.filledQuantity || 0,
                status: result.status,
                gridLevel: action.gridLevel,
                createdAt: new Date(),
            };
            const isFilled = result.status?.toUpperCase() === 'FILLED' ||
                result.status?.toUpperCase() === 'CLOSED' ||
                (result.filledQuantity && result.filledQuantity >= quantity * 0.99);
            if (isFilled) {
                const fillPrice = result.filledPrice || price || tick.price;
                const txInfo = result.explorerUrl ? ` | Explorer: ${result.explorerUrl}` : '';
                this.log(`${prefix} Order FILLED: ${quantity.toFixed(4)} @ $${fillPrice.toFixed(5)}${txInfo}`);
                await this.processOrderFill(order, fillPrice, result.filledQuantity || quantity);
            }
            else {
                this.log(`${prefix} Order OPEN: waiting for fill (status: ${result.status})`);
                this.state.openOrders.push(order);
                if (side === 'BUY') {
                    this.state.availableBalance -= quantity * (price || tick.price);
                }
            }
        }
        catch (error) {
            const errMsg = error.message || '';
            const isBalanceError = errMsg.toLowerCase().includes('insufficient') ||
                errMsg.toLowerCase().includes('balance') ||
                errMsg.toLowerCase().includes('notional') ||
                errMsg.toLowerCase().includes('funds');
            if (isBalanceError) {
                this.isPausedForBalance = true;
                this.state.availableBalance = 0;
                this.log(`${prefix} Order rejected by exchange due to insufficient balance. Pausing API order execution until new funds arrive.`, 'warn');
            }
            else {
                this.log(`${prefix} Order failed: ${errMsg}`, 'error');
                this.deps.onError(this.id, `Order failed: ${errMsg}`, 'error');
            }
            // Notify strategy of error (for error handling/stopping)
            if ('onOrderError' in this.strategy && typeof this.strategy.onOrderError === 'function') {
                this.strategy.onOrderError(errMsg);
            }
            else if ('handleError' in this.strategy && typeof this.strategy.handleError === 'function') {
                this.strategy.handleError(errMsg);
            }
        }
    }
    async cancelOrder(orderId) {
        const orderIndex = this.state.openOrders.findIndex(o => o.id === orderId);
        if (orderIndex === -1)
            return;
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
        }
        catch (error) {
            console.error(`[Bot ${this.config.name}] Cancel failed:`, error.message);
        }
    }
    async processOrderFill(order, filledPrice, filledQuantity) {
        const asset = this.config.symbol.split('/')[0];
        if (order.side === 'BUY') {
            // Add to holdings
            let holding = this.state.holdings.find(h => h.asset === asset);
            if (holding) {
                const totalQty = holding.quantity + filledQuantity;
                holding.avgEntryPrice = (holding.avgEntryPrice * holding.quantity + filledPrice * filledQuantity) / totalQty;
                holding.quantity = totalQty;
            }
            else {
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
            // Record BUY trade
            const trade = {
                id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                symbol: order.symbol,
                side: 'BUY',
                quantity: filledQuantity,
                price: filledPrice,
                fee: filledQuantity * filledPrice * 0.001,
                profit: 0,
                executedAt: new Date(),
            };
            this.state.tradeHistory.push(trade);
            this.deps.onTrade(this.id, trade);
            // Emit grid fill event if applicable
            if (order.gridLevel !== undefined) {
                this.emit('grid_fill', {
                    botId: this.id,
                    gridLevel: order.gridLevel,
                    side: 'BUY',
                    profit: 0,
                });
            }
        }
        else if (order.side === 'SELL') {
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
                // Record SELL trade
                const trade = {
                    id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
    updateHoldingsPrice(tick) {
        const asset = tick.symbol.split('/')[0];
        const holding = this.state.holdings.find(h => h.asset === asset);
        if (holding) {
            holding.currentPrice = tick.price;
            holding.value = holding.quantity * tick.price;
            holding.unrealizedPnl = (tick.price - holding.avgEntryPrice) * holding.quantity;
        }
    }
    updateEquity() {
        this.state.totalHoldingsValue = this.state.holdings.reduce((sum, h) => sum + h.value, 0);
        this.state.unrealizedPnl = this.state.holdings.reduce((sum, h) => sum + h.unrealizedPnl, 0);
        this.state.currentEquity = this.state.availableBalance + this.state.totalHoldingsValue;
        this.config.currentValue = this.state.currentEquity;
        this.config.totalProfit = this.state.realizedPnl + this.state.unrealizedPnl;
    }
    startSnapshotTimer() {
        // Take snapshot every hour
        this.snapshotInterval = setInterval(() => {
            this.takeSnapshot();
        }, 60 * 60 * 1000);
    }
    stopSnapshotTimer() {
        if (this.snapshotInterval) {
            clearInterval(this.snapshotInterval);
            this.snapshotInterval = null;
        }
    }
    takeSnapshot() {
        this.emit('snapshot', {
            botId: this.id,
            equity: this.state.currentEquity,
            profit: this.config.totalProfit,
            tradeCount: this.config.totalTrades,
            holdings: this.state.holdings,
        });
    }
    async getAdapter() {
        const { getAdapter } = await import('../../arbitrage/dist/adapters/index.js');
        return getAdapter(this.config.exchangeName);
    }
    getStats() {
        const stats = {
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
                    coinGrids: Object.entries(customState.coinGrids).map(([symbol, grid]) => ({
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
    getOpenOrders() {
        return this.state.openOrders;
    }
}
