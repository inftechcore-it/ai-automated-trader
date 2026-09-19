/**
 * GridBot Strategy - Buy low sell high within a price range
 * Best for sideways/ranging markets
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
export class GridBot extends BaseBotStrategy {
    name = 'Grid Trading Bot';
    type = 'GRID';
    gridLevels = [];
    gridSpacing = 0;
    gridProfit = 0;
    gridProfitCount = 0;
    lastPrice = 0;
    asset = '';
    quote = '';
    // Error handling state
    lastError = '';
    insufficientBalance = false;
    lastBalanceCheck = 0;
    lastStatusLog = 0;
    lastRangeLog = 0;
    isStopLossActive = false;
    isTakeProfitActive = false;
    lastStopLossLog = 0;
    lastTakeProfitLog = 0;
    validate(params) {
        const p = params;
        const errors = [];
        const lowerPrice = toNum(p.lowerPrice);
        const upperPrice = toNum(p.upperPrice);
        const gridCount = toNum(p.gridCount);
        const totalInvestment = toNum(p.totalInvestment);
        const stopLoss = toNum(p.stopLoss);
        const takeProfit = toNum(p.takeProfit);
        const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;
        if (!lowerPrice || lowerPrice <= 0)
            errors.push('Lower price must be positive');
        if (!upperPrice || upperPrice <= 0)
            errors.push('Upper price must be positive');
        if (lowerPrice >= upperPrice)
            errors.push('Lower price must be less than upper price');
        if (!gridCount || gridCount < 2 || gridCount > 200)
            errors.push('Grid count must be between 2 and 200');
        if (!totalInvestment || totalInvestment <= 0)
            errors.push('Total investment must be positive');
        if (stopLoss && stopLoss >= lowerPrice)
            errors.push('Stop loss must be below lower price');
        if (takeProfit && takeProfit <= upperPrice)
            errors.push('Take profit must be above upper price');
        if (maxBuysPerLevel < 1 || maxBuysPerLevel > 10)
            errors.push('Max buys per level must be between 1 and 10');
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
    }
    async onInitialize(initialState) {
        const p = this.params;
        const lowerPrice = toNum(p.lowerPrice);
        const upperPrice = toNum(p.upperPrice);
        const gridCount = toNum(p.gridCount);
        const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;
        this.gridSpacing = (upperPrice - lowerPrice) / gridCount;
        this.gridLevels = [];
        for (let i = 0; i <= gridCount; i++) {
            const price = lowerPrice + i * this.gridSpacing;
            this.gridLevels.push({
                price,
                index: i,
                type: 'buy',
                filled: false,
                buyCount: 0,
            });
        }
        this.log(`Initialized with ${gridCount} grids, spacing: $${this.gridSpacing.toFixed(6)}`);
        this.log(`Max buys per grid level: ${maxBuysPerLevel}`);
        this.log(`Grid range: $${lowerPrice.toFixed(6)} - $${upperPrice.toFixed(6)}`);
        if (initialState?.customState) {
            this.gridProfit = toNum(initialState.customState.gridProfit);
            this.gridProfitCount = toNum(initialState.customState.gridProfitCount);
            this.lastError = initialState.customState.lastError || '';
            this.insufficientBalance = initialState.customState.insufficientBalance || false;
            this.isStopLossActive = initialState.customState.isStopLossActive || false;
            this.isTakeProfitActive = initialState.customState.isTakeProfitActive || false;
            // Restore buy counts per grid
            if (Array.isArray(initialState.customState.gridLevels)) {
                for (const savedGrid of initialState.customState.gridLevels) {
                    const grid = this.gridLevels.find(g => g.index === savedGrid.index);
                    if (grid) {
                        grid.buyCount = savedGrid.buyCount || 0;
                        grid.filled = savedGrid.filled || false;
                        grid.type = savedGrid.type || 'buy';
                    }
                }
            }
        }
    }
    // Handle errors from order execution
    handleError(error) {
        this.lastError = error;
        this.log(`ERROR: ${error}`, 'error');
        // Check if it's a balance-related error
        if (error.toLowerCase().includes('insufficient') ||
            error.toLowerCase().includes('balance') ||
            error.includes('NOTIONAL')) {
            this.insufficientBalance = true;
            this.log(`Insufficient balance - pausing BUY orders. Will retry when balance available.`, 'warn');
        }
    }
    async evaluate(tick, state) {
        if (!this.params) {
            this.log('Strategy not initialized, skipping tick', 'warn');
            return [{ action: 'hold' }];
        }
        const p = this.params;
        const actions = [];
        const lowerPrice = toNum(p.lowerPrice);
        const upperPrice = toNum(p.upperPrice);
        const stopLoss = toNum(p.stopLoss);
        const takeProfit = toNum(p.takeProfit);
        const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;
        const investmentPerGrid = toNum(p.totalInvestment) / toNum(p.gridCount);
        // Check balance status every 30 seconds
        const now = Date.now();
        // Auto-clear insufficient balance flag whenever live available balance >= 5.00 or >= investmentPerGrid
        if (state.availableBalance >= investmentPerGrid || state.availableBalance >= 5.0) {
            if (this.insufficientBalance) {
                this.insufficientBalance = false;
                this.lastError = '';
                this.log(`Balance restored: $${state.availableBalance.toFixed(2)} - resuming BUY orders`);
            }
            else {
                this.insufficientBalance = false;
            }
        }
        else if (this.insufficientBalance && now - this.lastBalanceCheck > 30000) {
            this.lastBalanceCheck = now;
            this.log(`Waiting for balance. Need: $${investmentPerGrid.toFixed(2)}, Have: $${state.availableBalance.toFixed(2)}`, 'warn');
        }
        // Show balance status in tick log (throttled to once every 30 seconds to avoid spam)
        if (now - this.lastStatusLog > 30000) {
            this.lastStatusLog = now;
            const balanceStatus = this.insufficientBalance ? ' [INSUFFICIENT BALANCE]' : '';
            const stopStatus = this.isStopLossActive ? ' [STOP LOSS ACTIVE]' : '';
            this.log(`Tick: $${tick.price.toFixed(6)} | Balance: $${state.availableBalance.toFixed(2)} | Orders: ${state.openOrders.length} | Profits: ${this.gridProfitCount}${balanceStatus}${stopStatus}`);
        }
        if (!this.asset) {
            const { base, quote } = parseSymbol(tick.symbol);
            this.asset = base;
            this.quote = quote;
        }
        const currentPrice = tick.price;
        this.lastPrice = currentPrice;
        // 1. Check stop loss
        if (stopLoss && currentPrice <= stopLoss) {
            if (!this.isStopLossActive) {
                this.isStopLossActive = true;
                this.log(`⚠️ STOP LOSS triggered at $${currentPrice.toFixed(6)} (stop: $${stopLoss.toFixed(6)}). Liquidating all open orders & holdings to cash...`, 'warn');
                // Reset grid level states
                for (const grid of this.gridLevels) {
                    grid.filled = false;
                    grid.orderId = undefined;
                    grid.buyCount = 0;
                    grid.type = 'buy';
                }
                return this.createExitActions(state, 'STOP_LOSS');
            }
            else {
                // While stop loss is active and price stays below stop loss, log throttled status and wait
                if (now - this.lastStopLossLog > 30000) {
                    this.lastStopLossLog = now;
                    this.log(`[STOP LOSS ACTIVE] Price $${currentPrice.toFixed(6)} <= Stop $${stopLoss.toFixed(6)}. Holdings liquidated. Waiting for price to recover...`);
                }
                return [{ action: 'hold' }];
            }
        }
        // When price recovers above stop loss
        if (this.isStopLossActive && currentPrice > stopLoss) {
            this.isStopLossActive = false;
            this.log(`🚀 Price recovered to $${currentPrice.toFixed(6)} (above stop loss $${stopLoss.toFixed(6)}). Resuming normal grid cycle and placing initial BUY orders!`);
            for (const grid of this.gridLevels) {
                grid.filled = false;
                grid.orderId = undefined;
                grid.buyCount = 0;
                grid.type = grid.price < currentPrice ? 'buy' : 'sell';
            }
        }
        // 2. Check take profit
        if (takeProfit && currentPrice >= takeProfit) {
            if (!this.isTakeProfitActive) {
                this.isTakeProfitActive = true;
                this.log(`🎯 TAKE PROFIT triggered at $${currentPrice.toFixed(6)} (target: $${takeProfit.toFixed(6)}). Liquidating holdings to secure profits...`);
                for (const grid of this.gridLevels) {
                    grid.filled = false;
                    grid.orderId = undefined;
                    grid.buyCount = 0;
                    grid.type = 'buy';
                }
                return this.createExitActions(state, 'TAKE_PROFIT');
            }
            else {
                if (now - this.lastTakeProfitLog > 30000) {
                    this.lastTakeProfitLog = now;
                    this.log(`[TAKE PROFIT ACTIVE] Price $${currentPrice.toFixed(6)} >= TP $${takeProfit.toFixed(6)}. Profits secured. Waiting for pullback...`);
                }
                return [{ action: 'hold' }];
            }
        }
        // When price pulls back below take profit
        if (this.isTakeProfitActive && currentPrice < takeProfit) {
            this.isTakeProfitActive = false;
            this.log(`Price pulled back to $${currentPrice.toFixed(6)} (below take profit $${takeProfit.toFixed(6)}). Resuming normal grid cycle.`);
            for (const grid of this.gridLevels) {
                grid.filled = false;
                grid.orderId = undefined;
                grid.buyCount = 0;
                grid.type = grid.price < currentPrice ? 'buy' : 'sell';
            }
        }
        // Check if price is in range
        if (currentPrice < lowerPrice || currentPrice > upperPrice) {
            if (now - this.lastRangeLog > 30000) {
                this.lastRangeLog = now;
                this.log(`Price $${currentPrice.toFixed(6)} outside grid range [$${lowerPrice.toFixed(6)} - $${upperPrice.toFixed(6)}]`);
            }
            return [{ action: 'hold' }];
        }
        // 3. Process grid levels for BUY and SELL orders
        const gridCount = toNum(p.gridCount);
        const holding = state.holdings.find(h => (h.asset || '').toUpperCase() === (this.asset || '').toUpperCase());
        const totalHoldingQty = holding?.quantity || 0;
        const lockedHoldingQty = state.openOrders
            .filter(o => o.side === 'SELL')
            .reduce((sum, o) => sum + (o.quantity - (o.filledQuantity || 0)), 0);
        let availableHoldingQty = Math.max(0, totalHoldingQty - lockedHoldingQty);
        // Synchronize grid order IDs with live open orders
        for (const grid of this.gridLevels) {
            const openOrder = state.openOrders.find(o => Math.abs(Number(o.price || 0) - grid.price) < this.gridSpacing * 0.45);
            grid.orderId = openOrder ? openOrder.id : undefined;
            if (openOrder) {
                grid.type = openOrder.side.toLowerCase() === 'sell' ? 'sell' : 'buy';
                grid.filled = false;
            }
        }
        // A. SELL & AUTO-SELL LOGIC (Grid 1 to gridCount)
        // Check all grid levels above lower price that act as Sell Targets
        for (let i = 1; i <= gridCount; i++) {
            const grid = this.gridLevels[i];
            if (!grid)
                continue;
            // Case 1: Market price reached or surpassed this sell target level (currentPrice >= grid.price)
            // If we have unallocated holdings, trigger immediate AUTO-SELL to lock in profit!
            if (currentPrice >= grid.price && availableHoldingQty > 0 && !grid.orderId) {
                const sellQty = Math.min(availableHoldingQty, (investmentPerGrid * 1.05) / currentPrice);
                if (sellQty > 0) {
                    actions.push({
                        action: 'sell',
                        quantity: sellQty,
                        price: currentPrice,
                        orderType: 'MARKET',
                        gridLevel: grid.index,
                    });
                    availableHoldingQty -= sellQty;
                    this.log(`🎯 Auto-Sell Triggered at Grid #${grid.index} ($${grid.price.toFixed(6)} target reached at $${currentPrice.toFixed(6)}). Selling ${sellQty.toFixed(4)} ${this.asset}...`);
                    // Mark lower buy grid as ready for dip re-entry
                    const lowerBuyGrid = this.gridLevels[grid.index - 1];
                    if (lowerBuyGrid) {
                        lowerBuyGrid.buyCount = 0;
                        lowerBuyGrid.filled = false;
                    }
                }
            }
            // Case 2: Grid level is above current price (grid.price > currentPrice)
            // Place a LIMIT SELL order so exchange will automatically fill it when price reaches it
            else if (grid.price > currentPrice && availableHoldingQty > 0 && !grid.orderId) {
                const sellQty = Math.min(availableHoldingQty, (investmentPerGrid * 1.05) / grid.price);
                if (sellQty * grid.price >= 0.50) {
                    actions.push({
                        action: 'sell',
                        quantity: sellQty,
                        price: grid.price,
                        orderType: 'LIMIT',
                        gridLevel: grid.index,
                    });
                    availableHoldingQty -= sellQty;
                    grid.type = 'sell';
                    this.log(`Placing limit SELL target at Grid #${grid.index}: ${sellQty.toFixed(4)} @ $${grid.price.toFixed(6)}`);
                }
            }
        }
        // B. BUY & DIP BUY LOGIC (Grid 0 to gridCount - 1)
        // Check all grid levels below current price that act as Buy Levels
        for (let i = 0; i < gridCount; i++) {
            const grid = this.gridLevels[i];
            if (!grid)
                continue;
            if (grid.price < currentPrice && !grid.orderId && grid.buyCount < maxBuysPerLevel) {
                if (!this.insufficientBalance && state.availableBalance >= investmentPerGrid) {
                    const buyQty = (investmentPerGrid * 1.02) / grid.price;
                    if (buyQty * grid.price >= 0.50) {
                        actions.push({
                            action: 'buy',
                            quantity: buyQty,
                            price: grid.price,
                            orderType: 'LIMIT',
                            gridLevel: grid.index,
                        });
                        grid.type = 'buy';
                        this.log(`Placing limit BUY on dip at Grid #${grid.index}: ${buyQty.toFixed(4)} @ $${grid.price.toFixed(6)}`);
                    }
                }
            }
        }
        if (actions.length > 0) {
            this.log(`Placing ${actions.length} grid actions: ${actions.map(a => `${a.action.toUpperCase()} ${a.quantity?.toFixed(4)} @ $${a.price?.toFixed(6) || 'market'}`).join(', ')}`);
        }
        return actions.length > 0 ? actions : [{ action: 'hold' }];
    }
    createExitActions(state, reason = 'STOP_LOSS') {
        const actions = [];
        actions.push({ action: 'cancel_all', metadata: { isExit: true, exitReason: reason } });
        let hasHoldings = false;
        for (const holding of state.holdings) {
            if (holding.quantity > 0) {
                hasHoldings = true;
                actions.push({
                    action: 'sell',
                    quantity: holding.quantity,
                    orderType: 'MARKET',
                    metadata: { isExit: true, exitReason: reason },
                });
            }
        }
        if (!hasHoldings) {
            actions.push({
                action: 'sell',
                quantity: 0,
                orderType: 'MARKET',
                metadata: { isExit: true, exitReason: reason, sweepAll: true },
            });
        }
        this.log(`Exiting: Cancelling all orders and selling holdings (${reason})`);
        return actions;
    }
    calculateQuantity(price, state) {
        const p = this.params;
        const totalInvestment = toNum(p.totalInvestment);
        const gridCount = toNum(p.gridCount);
        const investmentPerGrid = totalInvestment / gridCount;
        const quantity = investmentPerGrid / price;
        if (state.availableBalance < investmentPerGrid) {
            this.log(`Insufficient balance for grid buy. Need: $${investmentPerGrid.toFixed(2)}, Have: $${state.availableBalance.toFixed(2)}`, 'warn');
            return 0;
        }
        return quantity;
    }
    calculateSellQuantity(holdingQuantity) {
        const p = this.params;
        const gridCount = toNum(p.gridCount);
        const quantityPerGrid = holdingQuantity / gridCount;
        return Math.min(quantityPerGrid, holdingQuantity);
    }
    onOrderFilled(orderId, filledPrice, filledQuantity) {
        let grid = this.gridLevels.find(g => g.orderId === orderId);
        if (!grid && filledPrice > 0) {
            grid = this.gridLevels.find(g => Math.abs(g.price - filledPrice) < this.gridSpacing * 0.45);
        }
        if (grid) {
            grid.filled = true;
            if (grid.type === 'buy') {
                grid.buyCount++;
                this.log(`BUY filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} x ${filledQuantity.toFixed(4)} (buy #${grid.buyCount}). Next sell target: Grid #${Math.min(grid.index + 1, this.gridLevels.length - 1)}`);
            }
            else if (grid.type === 'sell') {
                const profit = filledQuantity * this.gridSpacing;
                this.gridProfit += profit;
                this.gridProfitCount++;
                this.log(`SELL filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} | Profit: +$${profit.toFixed(4)} | Total cycles: ${this.gridProfitCount}`);
                // Reset lower buy level so it can buy on dip again
                const lowerGrid = this.gridLevels[grid.index - 1];
                if (lowerGrid) {
                    lowerGrid.buyCount = 0;
                    lowerGrid.filled = false;
                }
            }
        }
        else {
            this.log(`Order filled: $${filledPrice.toFixed(6)} x ${filledQuantity.toFixed(4)}`);
        }
        this.customState.gridProfit = this.gridProfit;
        this.customState.gridProfitCount = this.gridProfitCount;
        this.customState.gridLevels = this.gridLevels;
        this.customState.lastError = this.lastError;
        this.customState.isStopLossActive = this.isStopLossActive;
        this.customState.isTakeProfitActive = this.isTakeProfitActive;
    }
    onOrderPlaced(orderId, gridLevel, price, side) {
        const grid = gridLevel !== undefined && this.gridLevels[gridLevel]
            ? this.gridLevels[gridLevel]
            : this.gridLevels.find(g => price && Math.abs(g.price - price) < this.gridSpacing * 0.45);
        if (grid) {
            grid.orderId = orderId;
            grid.type = side?.toLowerCase() === 'sell' ? 'sell' : 'buy';
            grid.filled = false;
        }
    }
    onOrderCancelled(orderId) {
        const grid = this.gridLevels.find(g => g.orderId === orderId);
        if (grid) {
            grid.orderId = undefined;
        }
    }
    // Called when order fails
    onOrderError(error) {
        this.lastError = error;
        this.log(`Order error: ${error}`, 'error');
        // Check for balance-related errors - pause buying but don't stop bot
        if (error.includes('NOTIONAL') ||
            error.toLowerCase().includes('insufficient') ||
            error.includes('MIN_NOTIONAL') ||
            error.toLowerCase().includes('balance')) {
            this.insufficientBalance = true;
            this.log(`Balance issue detected - pausing BUY orders until balance is sufficient`, 'warn');
        }
    }
    getMetrics() {
        const p = this.params;
        if (!p) {
            return {
                gridCount: 0,
                gridSpacing: 0,
                gridProfit: 0,
                gridProfitCount: 0,
                currentPrice: 0,
                lowerPrice: 0,
                upperPrice: 0,
                insufficientBalance: this.insufficientBalance ? 1 : 0,
            };
        }
        return {
            gridCount: toNum(p.gridCount),
            gridSpacing: this.gridSpacing,
            gridProfit: this.gridProfit,
            gridProfitCount: this.gridProfitCount,
            currentPrice: this.lastPrice,
            lowerPrice: toNum(p.lowerPrice),
            upperPrice: toNum(p.upperPrice),
            maxBuysPerLevel: toNum(p.maxBuysPerLevel) || 1,
            insufficientBalance: this.insufficientBalance ? 1 : 0,
        };
    }
    restoreState(customState) {
        super.restoreState(customState);
        this.gridProfit = toNum(customState.gridProfit);
        this.gridProfitCount = toNum(customState.gridProfitCount);
        this.lastError = customState.lastError || '';
        this.insufficientBalance = customState.insufficientBalance || false;
        this.isStopLossActive = customState.isStopLossActive || false;
        this.isTakeProfitActive = customState.isTakeProfitActive || false;
        if (Array.isArray(customState.gridLevels)) {
            this.gridLevels = customState.gridLevels.map((g) => ({
                ...g,
                buyCount: g.buyCount || 0,
            }));
        }
    }
    getCustomState() {
        return {
            gridProfit: this.gridProfit,
            gridProfitCount: this.gridProfitCount,
            gridLevels: this.gridLevels,
            lastError: this.lastError,
            insufficientBalance: this.insufficientBalance,
            isStopLossActive: this.isStopLossActive,
            isTakeProfitActive: this.isTakeProfitActive,
        };
    }
}
