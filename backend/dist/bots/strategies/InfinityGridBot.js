/**
 * InfinityGridBot Strategy - Grid bot with no upper limit
 * For assets you're long-term bullish on
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
export class InfinityGridBot extends BaseBotStrategy {
    name = 'Infinity Grid Bot';
    type = 'INFINITY_GRID';
    gridLevels = [];
    highestGridIndex = 0;
    gridProfit = 0;
    gridProfitCount = 0;
    lastPrice = 0;
    asset = '';
    isStopLossActive = false;
    lastStopLossLog = 0;
    validate(params) {
        const p = params;
        const errors = [];
        const lowerPrice = toNum(p.lowerPrice);
        const gridSpacingPercent = toNum(p.gridSpacingPercent);
        const totalInvestment = toNum(p.totalInvestment);
        const stopLoss = toNum(p.stopLoss);
        if (!lowerPrice || lowerPrice <= 0)
            errors.push('Lower price must be positive');
        if (!gridSpacingPercent || gridSpacingPercent <= 0 || gridSpacingPercent > 10) {
            errors.push('Grid spacing must be between 0 and 10%');
        }
        if (!totalInvestment || totalInvestment <= 0)
            errors.push('Total investment must be positive');
        if (stopLoss && stopLoss >= lowerPrice)
            errors.push('Stop loss must be below lower price');
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
    }
    async onInitialize(initialState) {
        const p = this.params;
        if (initialState?.customState) {
            this.restoreState(initialState.customState);
            return;
        }
        // Generate initial grid levels from lower price upward
        this.gridLevels = [];
        const lowerPrice = toNum(p.lowerPrice);
        const gridSpacingPercent = toNum(p.gridSpacingPercent);
        let price = lowerPrice;
        let index = 0;
        // Create 50 initial grid levels (more will be added dynamically)
        for (let i = 0; i < 50; i++) {
            this.gridLevels.push({
                price,
                index,
                type: 'buy',
                filled: false,
            });
            price *= (1 + gridSpacingPercent / 100);
            index++;
        }
        this.highestGridIndex = index - 1;
        console.log(`[InfinityGrid] Initialized with 50 levels starting from ${lowerPrice}`);
    }
    async evaluate(tick, state) {
        const p = this.params;
        const actions = [];
        const now = Date.now();
        if (!this.asset) {
            const { base } = parseSymbol(tick.symbol);
            this.asset = base;
        }
        const currentPrice = tick.price;
        this.lastPrice = currentPrice;
        const stopLoss = toNum(p.stopLoss);
        const lowerPrice = toNum(p.lowerPrice);
        // Check stop loss
        if (stopLoss && currentPrice <= stopLoss) {
            if (!this.isStopLossActive) {
                this.isStopLossActive = true;
                console.log(`[InfinityGrid] ⚠️ Stop loss triggered at $${currentPrice.toFixed(6)} (stop: $${stopLoss.toFixed(6)}). Liquidating open orders & holdings...`);
                for (const grid of this.gridLevels) {
                    grid.filled = false;
                    grid.orderId = undefined;
                    grid.type = 'buy';
                }
                return this.createExitActions(state, 'STOP_LOSS');
            }
            else {
                if (now - this.lastStopLossLog > 30000) {
                    this.lastStopLossLog = now;
                    console.log(`[InfinityGrid] [STOP LOSS ACTIVE] Current price $${currentPrice.toFixed(6)} <= Stop $${stopLoss.toFixed(6)}. Waiting for recovery...`);
                }
                return [{ action: 'hold' }];
            }
        }
        // Price recovery above stop loss
        if (this.isStopLossActive && currentPrice > stopLoss) {
            this.isStopLossActive = false;
            console.log(`[InfinityGrid] 🚀 Price recovered to $${currentPrice.toFixed(6)} (above stop loss $${stopLoss.toFixed(6)}). Resuming infinity grid cycle!`);
            for (const grid of this.gridLevels) {
                grid.filled = false;
                grid.orderId = undefined;
                grid.type = grid.price < currentPrice ? 'buy' : 'sell';
            }
        }
        // Below lower price - nothing to do
        if (currentPrice < lowerPrice) {
            return [{ action: 'hold' }];
        }
        // Extend grid upward if needed
        await this.extendGridIfNeeded(currentPrice, p);
        // Process grid levels for BUY and SELL orders
        const holding = state.holdings.find(h => (h.asset || '').toUpperCase() === (this.asset || '').toUpperCase());
        const totalHoldingQty = holding?.quantity || 0;
        const lockedHoldingQty = state.openOrders
            .filter(o => o.side === 'SELL')
            .reduce((sum, o) => sum + (o.quantity - (o.filledQuantity || 0)), 0);
        let availableHoldingQty = Math.max(0, totalHoldingQty - lockedHoldingQty);
        const levelsToFill = 10;
        const totalInvestment = toNum(p.totalInvestment);
        const investmentPerGrid = totalInvestment / levelsToFill;
        // Synchronize grid order IDs with live open orders
        for (const grid of this.gridLevels) {
            const openOrder = state.openOrders.find(o => Math.abs(Number(o.price || 0) - grid.price) < grid.price * (toNum(p.gridSpacingPercent) / 100) * 0.45);
            grid.orderId = openOrder ? openOrder.id : undefined;
            if (openOrder) {
                grid.type = openOrder.side.toLowerCase() === 'sell' ? 'sell' : 'buy';
                grid.filled = false;
            }
        }
        // A. SELL & AUTO-SELL LOGIC
        for (const grid of this.gridLevels) {
            if (grid.price <= lowerPrice)
                continue;
            // Case 1: Market price reached or surpassed sell target level (currentPrice >= grid.price)
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
                    console.log(`[InfinityGrid] 🎯 Auto-Sell Triggered at Grid #${grid.index} (Price $${currentPrice.toFixed(6)} >= Target $${grid.price.toFixed(6)}). Selling ${sellQty.toFixed(4)} ${this.asset}...`);
                }
            }
            // Case 2: Grid level is above current price (grid.price > currentPrice)
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
                    console.log(`[InfinityGrid] Placing limit SELL target at Grid #${grid.index}: ${sellQty.toFixed(4)} @ $${grid.price.toFixed(6)}`);
                }
            }
        }
        // B. BUY & DIP BUY LOGIC
        for (const grid of this.gridLevels) {
            if (grid.price < currentPrice && !grid.orderId) {
                if (state.availableBalance >= investmentPerGrid) {
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
                        console.log(`[InfinityGrid] Placing limit BUY on dip at Grid #${grid.index}: ${buyQty.toFixed(4)} @ $${grid.price.toFixed(6)}`);
                    }
                }
            }
        }
        return actions.length > 0 ? actions : [{ action: 'hold' }];
    }
    findGridIndex(price) {
        const p = this.params;
        const lowerPrice = toNum(p.lowerPrice);
        const gridSpacingPercent = toNum(p.gridSpacingPercent);
        return Math.floor(Math.log(price / lowerPrice) / Math.log(1 + gridSpacingPercent / 100));
    }
    async extendGridIfNeeded(currentPrice, p) {
        const currentIndex = this.findGridIndex(currentPrice);
        const lowerPrice = toNum(p.lowerPrice);
        const gridSpacingPercent = toNum(p.gridSpacingPercent);
        while (currentIndex >= this.highestGridIndex - 5) {
            this.highestGridIndex++;
            const newPrice = lowerPrice * Math.pow(1 + gridSpacingPercent / 100, this.highestGridIndex);
            this.gridLevels.push({
                price: newPrice,
                index: this.highestGridIndex,
                type: 'sell',
                filled: false,
            });
        }
    }
    createExitActions(state, reason = 'STOP_LOSS') {
        const actions = [{ action: 'cancel_all', metadata: { isExit: true, exitReason: reason } }];
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
        return actions;
    }
    calculateQuantity(price, totalInvestment, state) {
        const investmentPerGrid = totalInvestment / 10;
        if (state.availableBalance < investmentPerGrid)
            return 0;
        return investmentPerGrid / price;
    }
    calculateSellQuantity(holdingQuantity) {
        return holdingQuantity / 10;
    }
    onOrderFilled(orderId, filledPrice, filledQuantity) {
        const p = this.params;
        const gridSpacingPercent = toNum(p?.gridSpacingPercent) || 0.5;
        let grid = this.gridLevels.find(g => g.orderId === orderId);
        if (!grid && filledPrice > 0) {
            grid = this.gridLevels.find(g => Math.abs(g.price - filledPrice) < g.price * (gridSpacingPercent / 100) * 0.45);
        }
        if (grid) {
            grid.filled = true;
            if (grid.type === 'buy') {
                console.log(`[InfinityGrid] BUY filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} x ${filledQuantity.toFixed(4)}`);
            }
            else if (grid.type === 'sell') {
                const profit = filledQuantity * filledPrice * (gridSpacingPercent / 100);
                this.gridProfit += profit;
                this.gridProfitCount++;
                console.log(`[InfinityGrid] SELL filled at Grid #${grid.index}: $${filledPrice.toFixed(6)} | Profit: +$${profit.toFixed(4)}`);
            }
        }
    }
    onOrderPlaced(orderId, gridLevel, price, side) {
        const p = this.params;
        const gridSpacingPercent = toNum(p?.gridSpacingPercent) || 0.5;
        const grid = gridLevel !== undefined && this.gridLevels[gridLevel]
            ? this.gridLevels[gridLevel]
            : this.gridLevels.find(g => price && Math.abs(g.price - price) < g.price * (gridSpacingPercent / 100) * 0.45);
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
    getMetrics() {
        const p = this.params;
        if (!p) {
            return { gridCount: 0, gridSpacingPercent: 0, gridProfit: 0, gridProfitCount: 0, currentPrice: 0, lowerPrice: 0, highestGridIndex: 0 };
        }
        return {
            gridCount: this.gridLevels.length,
            gridSpacingPercent: toNum(p.gridSpacingPercent),
            gridProfit: this.gridProfit,
            gridProfitCount: this.gridProfitCount,
            currentPrice: this.lastPrice,
            lowerPrice: toNum(p.lowerPrice),
            highestGridIndex: this.highestGridIndex,
        };
    }
    restoreState(customState) {
        super.restoreState(customState);
        this.gridLevels = customState.gridLevels || [];
        this.highestGridIndex = customState.highestGridIndex || 0;
        this.gridProfit = customState.gridProfit || 0;
        this.gridProfitCount = customState.gridProfitCount || 0;
        this.isStopLossActive = customState.isStopLossActive || false;
    }
    getCustomState() {
        return {
            gridLevels: this.gridLevels,
            highestGridIndex: this.highestGridIndex,
            gridProfit: this.gridProfit,
            gridProfitCount: this.gridProfitCount,
            isStopLossActive: this.isStopLossActive,
        };
    }
}
