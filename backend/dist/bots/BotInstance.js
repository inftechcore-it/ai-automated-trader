/**
 * BotInstance - Single bot runtime with state machine
 * States: CREATED → RUNNING ↔ PAUSED → STOPPED
 */
import { EventEmitter } from 'events';
import { parseSymbol } from './utils.js';
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
    lastGuardrailCheck = 0;
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
                        userId: this.config.userId,
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
    /**
     * Take All IN / Panic Sell: Immediately cancels all open orders and places a Market SELL order
     * to liquidate 100% of accumulated coin holdings to cash/quote currency in one click.
     */
    async panicSell(reason = 'Take All IN / Panic Sell triggered') {
        this.log(`🚨 [TAKE ALL IN] Immediate panic sell triggered: ${reason}`, 'warn');
        // 1. Cancel all open orders
        for (const order of this.state.openOrders) {
            try {
                await this.executionEngine.cancelOrder({
                    userId: this.config.userId,
                    exchange: this.config.exchangeName,
                    orderId: order.exchangeOrderId || order.id,
                    symbol: order.symbol,
                });
            }
            catch (e) {
                console.warn(`[Bot ${this.config.name}] Failed to cancel order ${order.id}:`, e.message);
            }
        }
        this.state.openOrders = [];
        // 2. Liquidate all holdings for this bot
        let totalSoldQty = 0;
        let totalReceived = 0;
        const { base, quote } = parseSymbol(this.config.symbol);
        // Get current market price for execution
        let currentPrice = this.lastPrice || 0;
        if (currentPrice <= 0) {
            try {
                const adapter = await this.getAdapter();
                const ticker = await adapter.getTicker(this.config.symbol);
                currentPrice = ticker.last || ticker.close || 0;
            }
            catch {
                currentPrice = 1;
            }
        }
        for (const holding of this.state.holdings) {
            if (holding.quantity > 0) {
                const sellQty = holding.quantity;
                try {
                    const orderResult = await this.executionEngine.placeOrder({
                        userId: this.config.userId,
                        exchange: this.config.exchangeName,
                        symbol: this.config.symbol,
                        side: 'SELL',
                        type: 'MARKET',
                        quantity: sellQty,
                        price: currentPrice,
                        dryRun: this.config.mode === 'PAPER',
                    });
                    const fillPrice = orderResult.filledPrice || currentPrice;
                    const revenue = sellQty * fillPrice;
                    totalSoldQty += sellQty;
                    totalReceived += revenue;
                    this.log(`🚨 [TAKE ALL IN] Liquidated ${sellQty.toFixed(4)} ${holding.asset} @ $${fillPrice.toFixed(6)} (+${revenue.toFixed(2)} ${quote})`);
                    // Record trade
                    const trade = {
                        id: `trade_panic_${Date.now()}`,
                        symbol: this.config.symbol,
                        side: 'SELL',
                        quantity: sellQty,
                        price: fillPrice,
                        fee: revenue * 0.001,
                        profit: revenue - (sellQty * (holding.avgEntryPrice || fillPrice)),
                        executedAt: new Date(),
                    };
                    this.state.tradeHistory.push(trade);
                    this.deps.onTrade(this.id, trade);
                }
                catch (sellErr) {
                    this.log(`[Bot ${this.config.name}] Panic sell order failed: ${sellErr.message}`, 'error');
                }
            }
        }
        // Reset holdings
        this.state.holdings = [];
        this.state.totalHoldingsValue = 0;
        this.state.availableBalance += totalReceived;
        this.state.currentEquity = this.state.availableBalance;
        // Stop bot after liquidation
        await this.stop(`Take All IN: Liquidated ${totalSoldQty.toFixed(4)} ${base} for $${totalReceived.toFixed(2)}`);
        return {
            success: true,
            soldQuantity: totalSoldQty,
            receivedAmount: totalReceived,
            symbol: this.config.symbol,
        };
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
            // Pre-trade RAG Guardrail Check every 45 seconds
            if (now - this.lastGuardrailCheck >= 45000) {
                this.lastGuardrailCheck = now;
                this.evaluateRAGGuardrails().catch(err => {
                    console.warn(`[Bot ${this.config.name}] RAG guardrail check non-blocking warning:`, err.message);
                });
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
            if (this.config.mode === 'LIVE') {
                balances = await this.getUserLiveBalances();
            }
            else if (typeof adapter.getBalances === 'function') {
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
            if (this.config.mode === 'LIVE') {
                balances = await this.getUserLiveBalances();
                if (balances.length === 0) {
                    this.log(`[LIVE] Could not fetch balances for ${this.config.exchangeName}. Ensure API keys are configured in Settings.`, 'warn');
                    this.isPausedForBalance = true;
                    return;
                }
            }
            else {
                if (typeof adapter.getBalances === 'function') {
                    balances = await adapter.getBalances();
                }
                else if (typeof adapter.getBalance === 'function') {
                    balances = await adapter.getBalance();
                }
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
            if (previouslyPaused && freeAmount > 5) {
                this.isPausedForBalance = false;
                this.log(`[LIVE] Balance replenished: $${freeAmount.toFixed(2)} ${quoteAsset}. Resuming bot!`);
            }
        }
        catch (err) {
            console.warn(`[Bot ${this.config.name}] Error syncing live balance:`, err.message);
        }
    }
    async checkDexLimitOrders(tick) {
        if (this.status !== 'RUNNING') {
            return;
        }
        this.lastPrice = tick.price;
        // Check open limit orders against current market price for trigger execution
        const isPaper = this.config.mode === 'PAPER';
        const prefix = isPaper ? '[PAPER]' : '[LIVE]';
        if (this.state.openOrders.length > 0) {
            const triggeredOrders = this.state.openOrders.filter(order => {
                if (!order.price)
                    return false;
                // Limit BUY triggers when market price <= limit buy price
                if (order.side === 'BUY')
                    return tick.price <= order.price;
                // Limit SELL triggers when market price >= limit sell price
                if (order.side === 'SELL')
                    return tick.price >= order.price;
                return false;
            });
            for (const order of triggeredOrders) {
                // Skip buy orders if bot is paused due to insufficient wallet balance
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
                            userId: this.config.userId,
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
        // Auto-truncate quantity to exchange market precision (e.g. 0 decimals for XLM/DOGE, 1 for XRP on CoinDCX)
        const exName = (this.config.exchangeName || '').toLowerCase();
        if (exName === 'coindcx') {
            const parts = (this.config.symbol || '').split('/');
            const baseAsset = (parts[0] || '').toUpperCase();
            const coindcxPrecisions = {
                // 0 decimal precision (Whole number integer orders only)
                XLM: 0, DOGE: 0, SHIB: 0, PEPE: 0, BONK: 0, FLOKI: 0, ALGO: 0, HBAR: 0,
                SAND: 0, CHZ: 0, MANA: 0, CKB: 0, NOT: 0, USDC: 0, HOT: 0, VTHO: 0,
                GRT: 0, MEME: 0, GALA: 0, HIVE: 0, REQ: 0, POWR: 0, USTC: 0, IQ: 0,
                DEGEN: 0, HMSTR: 0, PHA: 0, ETN: 0, GEOD: 0, NIBI: 0, BAT: 0, KMNO: 0,
                REKT: 0, PUMP: 0, XR: 0, VINU: 0, VENOM: 0, RSS3: 0, BLAST: 0, SIS: 0,
                EDU: 0, USDS: 0, TOWNS: 0, XUSD: 0, ESP: 0, USDE: 0, LINEA: 0, PLUME: 0,
                SPK: 0, SKY: 0, ZAMA: 0, CHIP: 0, HOME: 0, AVAIL: 0, IOST: 0, MOG: 0,
                TFUEL: 0, FOGO: 0, CORE: 0, SUN: 0, XAN: 0, PEIPEI: 0, UB: 0, RIF: 0,
                PENGU: 0, DEFI: 0, TOSHI: 0, NIGHT: 0, FLT: 0, IOTA: 0, CERE: 0, MGO: 0,
                SENT: 0, ALKIMI: 0, IOTX: 0, SC: 0, ELIZAOS: 0, RAIN: 0, DBR: 0, US: 0,
                SUPER: 0, CRTS: 0, CFX: 0, BEAMX: 0, VAI: 0, VINE: 0, SUPRA: 0, ZBCN: 0,
                ZORA: 0, TURBO: 0, MANTRA: 0, VR: 0, OTK: 0, SNEK: 0, ATA: 0, LWP: 0,
                BEL: 0, GWEI: 0, LAT: 0, XEM: 0, HUMA: 0, AKE: 0, Q: 0, CAT: 0,
                TAG: 0, PZP: 0, USD1: 0, GHST: 0, ALT: 0, SOLV: 0, MAPO: 0, BOME: 0,
                EQTY: 0, AMP: 0, CSPR: 0, SLP: 0, OGN: 0, IDEX: 0, MEW: 0, SAHARA: 0,
                ZRX: 0, MBL: 0, FIO: 0, RWA: 0, TWT: 0, WAXP: 0, ARTFI: 0, ACH: 0,
                BRISE: 0, SKL: 0, PYBOBO: 0, PIPEDOG: 0, XRD: 0, WENSOL: 0, QUICK: 0,
                MAV: 0, ZPAY: 0, ORBS: 0, "1000CHEEMS": 0, VSN: 0, XPIN: 0, KONET: 0,
                RLUSD: 0, STABLE: 0, CHR: 0, SPELL: 0, QKC: 0, TEL: 0, CTSI: 0, DOGS: 0,
                "2Z": 0, TX: 0, XPRT: 0, BIGTIME: 0, SOPH: 0, HOOK: 0, TUSD: 0, ONT: 0,
                DUSK: 0, XEC: 0, ARK: 0, BRETT: 0, G: 0, BABY: 0, H: 0, BONE: 0,
                DEP: 0, DOGELONMARS: 0, FDUSD: 0, SKR: 0, U: 0, ION: 0, DEEP: 0,
                AIGENSYN: 0, ID: 0, CWEB: 0, UOS: 0, QI: 0, AWE: 0, GUN: 0, ROBO: 0,
                BNKR: 0, "1MBABYDOGE": 0, EMT: 0, LCX: 0, ADX: 0, BTTC: 0,
                // 1 decimal precision
                XRP: 1, ADA: 1, TRX: 1, POL: 1, MATIC: 1, NEAR: 1, SUI: 1, SEI: 1,
                WLD: 1, ARB: 1, FET: 1, CRV: 1, JASMY: 1, ETHFI: 1, ONDO: 1, ANKR: 1,
                DODO: 1, XAI: 1, XTZ: 1, AGLD: 1, ANIME: 1, PARTI: 1, USUAL: 1, STX: 1,
                ASTR: 1, PUSH: 1, TST: 1, TKO: 1, BLUR: 1, MOVE: 1, RUNE: 1, WAL: 1,
                WOD: 1, SQD: 1, CYS: 1, DIA: 1, RAD: 1, TUT: 1, XPL: 1, WOO: 1,
                ALI: 1, JTO: 1, MON: 1, NYM: 1, MAGIC: 1, CTK: 1, AVA: 1, SNX: 1,
                QTUM: 1, STG: 1, ARPA: 1, YGG: 1, PYTH: 1, LA: 1, AZTEC: 1, WLFI: 1,
                ERA: 1, LAB: 1, TREE: 1, OPG: 1, EURI: 1, UMA: 1, EGL1: 1, STBL: 1,
                MASK: 1, GIGA: 1, AUDIO: 1, ACE: 1, GPS: 1, C98: 1, JELLYJELLY: 1,
                C: 1, COW: 1, CETUS: 1, AVNT: 1, FRAX: 1, HOLO: 1, MTL: 1, RARE: 1,
                SYRUP: 1, FIDA: 1, SIGN: 1, AT: 1, SXT: 1, RESOLV: 1, VELVET: 1, STO: 1,
                KGEN: 1, ICNT: 1, HEMI: 1, O: 1, CELR: 1, SIREN: 1, RLC: 1, KAVA: 1,
                CXT: 1, THE: 1, S: 1, RED: 1, WCT: 1, KAIO: 1, KERNEL: 1, HAEDAL: 1,
                NXPC: 1, BR: 1, PORTAL: 1, IRYS: 1, VIRTUAL: 1, PNUT: 1, PEAQ: 1,
                BIRB: 1, BANK: 1, SAPIEN: 1, ZEST: 1, RE: 1, IN: 1, MMT: 1, TRADE: 1,
                ACT: 1, NIL: 1, NAKA: 1, NPC: 1, DGB: 1, AIN: 1, PEOPLE: 1, A: 1,
                CGPT: 1, DYM: 1, THETA: 1, HYPER: 1, JUP: 1, NOM: 1, MANTA: 1, BAS: 1,
                TROLL: 1, ACX: 1, BB: 1, DRIFT: 1, RSR: 1, OG: 1, COOKIE: 1, TNSR: 1,
                PUNDIX: 1, BLESS: 1, DGAI: 1, RAY: 1, ACU: 1, MLN: 1, MARSCOIN: 1,
                T: 1, GMT: 1, GLM: 1, USELESS: 1, CROSS: 1, MEGA: 1, VELODROME: 1,
                BREV: 1, MUBARAK: 1, SUSHI: 1, FORT: 1, HTX: 1, MINA: 1, HIPPO: 1,
                VET: 1, KAITO: 1, PONKE: 1, ARKM: 1, GOAT: 1, AIXBT: 1, BIO: 1, ACM: 1,
                GRIFFAIN: 1, ZEREBRO: 1, ATH: 1, KNC: 1, BLUE: 1, REZ: 1, BAND: 1,
                MET: 1, SOON: 1, LMWR: 1, NEWT: 1, ESPORTS: 1, ENJ: 1, RVN: 1, LSK: 1,
                "1INCH": 1, GLMR: 1, PENDLE: 1, OVR: 1, W: 1, KAIA: 1, REACT: 1,
                HEI: 1, EPIC: 1, ICX: 1, MOCA: 1, CC: 1, AIO: 1, UAI: 1, OPEN: 1,
                KITE: 1, FF: 1, HPP: 1, ONE: 1, SYN: 1, BOSON: 1, BMT: 1, SHELL: 1,
                RACA: 1, PRL: 1, ALLO: 1, CATI: 1, SAGA: 1, WMTX: 1, SCR: 1,
                SUNDOG: 1, ZIL: 1, JST: 1,
                // 2 decimal precision
                SOL: 2, LINK: 2, AVAX: 2, UNI: 2, ATOM: 2, DOT: 2, LPT: 2, BICO: 2,
                PROM: 2, WIF: 2, FIL: 2, ENS: 2, PSG: 2, LUMIA: 2, VANA: 2, POPCAT: 2,
                KSM: 2, COTI: 2, MLK: 2, IO: 2, ICP: 2, CBK: 2, USDG: 2, EWT: 2,
                MIRA: 2, CLANKER: 2, CARV: 2, SAFE: 2, LIKE: 2, API3: 2, APT: 2,
                XNO: 2, SUT: 2, ZK: 2, GENIUS: 2, MERL: 2, XVS: 2, HSK: 2, APE: 2,
                FTT: 2, LIGHT: 2, JUV: 2, LUNC: 2, ORDI: 2, ZENT: 2, DEXE: 2, BNT: 2,
                ASR: 2, PORTO: 2, SANTOS: 2, VVV: 2, FB: 2, SPX: 2, MBX: 2, INIT: 2,
                UDS: 2, EDGE: 2, NES: 2, DATA: 2, EGLD: 2, STRK: 2, LISTA: 2, OP: 2,
                STEEM: 2, GRAM: 2, FORM: 2, ZRO: 2, SOMI: 2, LAZIO: 2, EUL: 2, AXL: 2,
                "0G": 2, SWAP: 2, GRASS: 2, AR: 2, ME: 2, FIS: 2, ORCA: 2, LF: 2,
                NMR: 2, USDT: 2, ACA: 2, MDT: 2, NEXO: 2, TIA: 2, PRO: 2, FARTCOIN: 2,
                CAKE: 2, ENSO: 2, PONS: 2, CASHCAT: 2, FLOCK: 2, AUCTION: 2, FLUX: 2,
                BARD: 2, B2: 2, GNS: 2, XDC: 2, ALICE: 2, LUNA: 2, CHILLGUY: 2, BAN: 2,
                MELANIA: 2, HYPE: 2, ETC: 2, AERO: 2, LAYER: 2, RONIN: 2, SWCH: 2,
                DYDX: 2, EIGEN: 2, ZEN: 2, PIEVERSE: 2, AXS: 2, REN: 2, JOE: 2, ATM: 2,
                FLOW: 2, CITY: 2, ASTER: 2, LIT: 2, MORPHO: 2, RPL: 2, CYBER: 2,
                AEVO: 2, ENA: 2, ALPINE: 2, ARC: 2, PRCL: 2, ONG: 2, OSMO: 2,
                // 3 decimal precision
                BNB: 3, LTC: 3, AAVE: 3, BSV: 3, QNT: 3, BANANA: 3, XMR: 3, CVX: 3,
                METIS: 3, GIGGLE: 3, ILV: 3, DASH: 3, COMP: 3, TRUMP: 3, GMX: 3,
                BERA: 3, MOVR: 3, GMMT: 3, TRB: 3, XYO: 3, SSV: 3,
                // 4 decimal precision
                ETH: 4, BCH: 4, TAO: 4, USDD: 4, PYUSD: 4, PAXG: 4, TRAC: 4, GNO: 4,
                ETHW: 4, WAVES: 4,
                // 5+ decimal precision
                BTC: 5, WBTC: 5, YFI: 5, ZEC: 5, NEO: 6
            };
            const precision = coindcxPrecisions[baseAsset] !== undefined ? coindcxPrecisions[baseAsset] : 1;
            if (precision === 0) {
                quantity = Math.floor(quantity);
            }
            else {
                const factor = Math.pow(10, precision);
                quantity = Math.floor(quantity * factor) / factor;
            }
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
                    const balances = await this.getUserLiveBalances();
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
                userId: this.config.userId,
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
                if (typeof this.strategy.onOrderPlaced === 'function') {
                    this.strategy.onOrderPlaced(order.id, action.gridLevel, price, side);
                }
            }
        }
        catch (error) {
            const rawDetail = error.response?.data?.msg || error.response?.data?.message || error.response?.data?.error || error.message || '';
            const errMsg = typeof rawDetail === 'object' ? JSON.stringify(rawDetail) : String(rawDetail);
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
                // Query RAG broker error diagnostic asynchronously for auto-remediation
                (async () => {
                    try {
                        const { ragService } = await import('../../services/ragService.js');
                        const diag = await ragService.diagnoseError({
                            broker_or_adapter: this.config.exchangeName,
                            error_code: errMsg,
                            raw_message: errMsg,
                        });
                        if (diag && diag.found) {
                            this.log(`[RAG DIAGNOSTIC] ${diag.error_name} (${diag.recovery_action}): ${diag.resolution_steps}`, 'warn');
                            if (diag.recovery_action === 'REAUTHENTICATE') {
                                this.log(`[RAG AUTO-REMEDY] Triggering automated session refresh for ${this.config.exchangeName}...`, 'info');
                            }
                        }
                    }
                    catch { }
                })();
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
                userId: this.config.userId,
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
                // Asynchronously log trade memory into RAG Knowledge Base for continuous learning
                this.logTradeMemoryToRag({
                    symbol: order.symbol,
                    strategyType: this.config.strategyType,
                    side: 'SELL',
                    entryPrice: holding.avgEntryPrice,
                    exitPrice: filledPrice,
                    pnl: profit,
                    pnlPercent: holding.avgEntryPrice > 0 ? ((filledPrice - holding.avgEntryPrice) / holding.avgEntryPrice) * 100 : 0,
                    stageStatus: this.state.customState?.stageStatus,
                    marketRegime: this.state.customState?.marketRegime,
                    notes: `SELL fill at level ${order.gridLevel !== undefined ? order.gridLevel : 'market'} with $${profit.toFixed(4)} profit`
                });
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
        // Notify strategy with order side
        this.strategy.onOrderFilled(order.id, filledPrice, filledQuantity, order.side);
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
    async getUserLiveBalances() {
        try {
            const { getUserBrokerCredentials } = await import('../../services/exchangeService.js');
            const creds = await getUserBrokerCredentials(this.config.userId, this.config.exchangeName);
            if (!creds) {
                return [];
            }
            const exLower = (this.config.exchangeName || '').toLowerCase();
            if (exLower === 'binance') {
                const binance = await import('../../services/adapters/binanceAdapter.js');
                return await binance.getBalances(creds.apiKey, creds.apiSecret);
            }
            else if (exLower === 'bybit') {
                const bybit = await import('../../services/adapters/bybitAdapter.js');
                return await bybit.getBalances(creds.apiKey, creds.apiSecret, !!creds.paperMode);
            }
            else if (exLower === 'coindcx') {
                const coindcx = await import('../../services/adapters/coindcxAdapter.js');
                return await coindcx.getBalances(creds.apiKey, creds.apiSecret);
            }
            else if (exLower === 'pionex') {
                const pionex = await import('../../services/adapters/pionexAdapter.js');
                return await pionex.getBalances(creds.apiKey, creds.apiSecret);
            }
            else if (exLower === 'kraken') {
                const kraken = await import('../../services/adapters/krakenAdapter.js');
                return await kraken.getBalances(creds.apiKey, creds.apiSecret);
            }
            else if (exLower === 'jupiter') {
                const jupiter = await import('../../services/adapters/jupiterAdapter.js');
                return await jupiter.getBalances(creds.privateKey || creds.apiSecret, creds.rpcUrl);
            }
            else if (exLower === 'angelone') {
                const angelone = await import('../../services/adapters/angeloneAdapter.js');
                const rms = await angelone.getRMS(creds);
                return [{ asset: 'INR', free: rms.availableCash || rms.net || 0, total: rms.net || 0 }];
            }
            else if (exLower === 'upstox') {
                const upstox = await import('../../services/adapters/upstoxAdapter.js');
                const funds = await upstox.getFunds(creds.apiSecret || creds.apiKey);
                return [{ asset: 'INR', free: funds.available_margin || 0, total: (funds.available_margin || 0) + (funds.used_margin || 0) }];
            }
            else if (['alpaca', 'nasdaq', 'nyse'].includes(exLower)) {
                const alpaca = await import('../../services/adapters/alpacaAdapter.js');
                return await alpaca.getBalances(creds);
            }
            return [];
        }
        catch (err) {
            console.warn(`[Bot ${this.config.name}] getUserLiveBalances error:`, err.message);
            return [];
        }
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
    /**
     * Pre-trade RAG Guardrail Evaluation Hook
     * Checks breaking market news, macro calendar, and RMS rules before executing order cycles.
     */
    async evaluateRAGGuardrails() {
        try {
            const { ragService } = await import('../../services/ragService.js');
            const market = (this.config.exchangeName === 'AngelOne' || this.config.exchangeName === 'Upstox')
                ? 'INDIA'
                : (this.config.exchangeName === 'Alpaca')
                    ? 'US'
                    : (this.config.exchangeName === 'Jupiter')
                        ? 'DEX'
                        : 'CRYPTO';
            const result = await ragService.checkGuardrails({
                symbol: this.config.symbol,
                exchange: this.config.exchangeName,
                strategy_type: this.config.strategyType,
                market,
            });
            if (result && result.suggested_action === 'PAUSE_BOT' && !result.safe_to_trade) {
                this.log(`[RAG GUARDRAIL] Market volatility risk detected (${result.warning_reason || 'RMS Breached'}). Triggering Circuit Breaker PAUSE.`, 'warn');
                await this.pause();
                this.deps.onError(this.id, `RAG Risk Circuit Breaker: ${result.warning_reason || 'High market volatility'}`, 'warning');
            }
            else if (result && result.suggested_action === 'WIDEN_GRID') {
                if (typeof this.strategy.widenGrid === 'function') {
                    this.strategy.widenGrid(1.5);
                    this.log(`[RAG GUARDRAIL] Elevated volatility detected. Dynamically expanding grid spacing by 1.5x.`, 'info');
                }
            }
        }
        catch (err) {
            // Non-blocking fallback
        }
    }
    /**
     * Apply dynamic AI auto-calibrated parameters to the strategy
     */
    applyAdaptiveParameters(params) {
        if (typeof this.strategy.applyAdaptiveParameters === 'function') {
            this.strategy.applyAdaptiveParameters(params);
            if (typeof this.strategy.getCustomState === 'function') {
                this.state.customState = this.strategy.getCustomState();
            }
        }
    }
    /**
     * Asynchronously log trade memory into RAG Knowledge Base
     */
    async logTradeMemoryToRag(tradeData) {
        try {
            const { ragService } = await import('../../services/ragService.js');
            await ragService.logTradeMemory({
                symbol: tradeData.symbol,
                strategy_type: tradeData.strategyType,
                side: tradeData.side,
                entry_price: tradeData.entryPrice,
                exit_price: tradeData.exitPrice,
                pnl: tradeData.pnl,
                pnl_percent: tradeData.pnlPercent,
                stage_status: tradeData.stageStatus,
                market_regime: tradeData.marketRegime,
                notes: tradeData.notes,
            });
        }
        catch (err) {
            // Non-blocking fallback
        }
    }
}
