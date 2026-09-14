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
        // Find current grid position
        const currentGridIndex = this.findGridIndex(currentPrice);
        // Process grid levels
        for (const grid of this.gridLevels) {
            if (grid.orderId && !grid.filled)
                continue;
            if (grid.index < currentGridIndex) {
                // Grid is below current price
                if (grid.type === 'sell' && grid.filled) {
                    // Place new buy order
                    const quantity = this.calculateQuantity(grid.price, p.totalInvestment, state);
                    if (quantity > 0) {
                        actions.push({
                            action: 'buy',
                            quantity,
                            price: grid.price,
                            orderType: 'LIMIT',
                            gridLevel: grid.index,
                        });
                        grid.type = 'buy';
                        grid.filled = false;
                    }
                }
            }
            else if (grid.index > currentGridIndex) {
                // Grid is above current price
                if (grid.type === 'buy' && grid.filled) {
                    // Place new sell order
                    const holding = state.holdings.find(h => h.asset === this.asset);
                    const quantity = this.calculateSellQuantity(holding?.quantity || 0);
                    if (quantity > 0) {
                        actions.push({
                            action: 'sell',
                            quantity,
                            price: grid.price,
                            orderType: 'LIMIT',
                            gridLevel: grid.index,
                        });
                        grid.type = 'sell';
                        grid.filled = false;
                    }
                }
            }
        }
        // Initial / Recovery setup - place buy orders if no open orders
        if (state.openOrders.length === 0) {
            const initialActions = this.createInitialOrders(currentPrice, currentGridIndex, state, p);
            actions.push(...initialActions);
        }
        return actions.length > 0 ? actions : [{ action: 'hold' }];
    }
    findGridIndex(price) {
        const p = this.params;
        const lowerPrice = toNum(p.lowerPrice);
        const gridSpacingPercent = toNum(p.gridSpacingPercent);
        // Calculate index based on percentage spacing
        return Math.floor(Math.log(price / lowerPrice) / Math.log(1 + gridSpacingPercent / 100));
    }
    async extendGridIfNeeded(currentPrice, p) {
        const currentIndex = this.findGridIndex(currentPrice);
        const lowerPrice = toNum(p.lowerPrice);
        const gridSpacingPercent = toNum(p.gridSpacingPercent);
        // Extend if within 5 levels of highest
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
    createInitialOrders(currentPrice, currentGridIndex, state, p) {
        const actions = [];
        const levelsToFill = 10;
        const totalInvestment = toNum(p.totalInvestment);
        const investmentPerGrid = totalInvestment / levelsToFill;
        // Place buy orders below current price
        let count = 0;
        for (const grid of this.gridLevels) {
            if (grid.index < currentGridIndex && count < levelsToFill) {
                const quantity = investmentPerGrid / grid.price;
                actions.push({
                    action: 'buy',
                    quantity,
                    price: grid.price,
                    orderType: 'LIMIT',
                    gridLevel: grid.index,
                });
                grid.type = 'buy';
                count++;
            }
        }
        console.log(`[InfinityGrid] Placed ${actions.length} initial buy orders`);
        return actions;
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
        const grid = this.gridLevels.find(g => g.orderId === orderId);
        if (!grid)
            return;
        grid.filled = true;
        if (grid.type === 'sell') {
            const p = this.params;
            const gridSpacingPercent = toNum(p.gridSpacingPercent);
            const profit = filledQuantity * filledPrice * (gridSpacingPercent / 100);
            this.gridProfit += profit;
            this.gridProfitCount++;
            console.log(`[InfinityGrid] Grid ${grid.index} profit: ${profit.toFixed(4)}`);
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
