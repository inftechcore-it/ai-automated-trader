/**
 * JarvisBot Strategy - Autonomous Dynamic Trailing Window Grid Bot with Precision 4th-Decimal Corridor
 *
 * Solves the traditional grid limitation where a bot halts/stalls when market price
 * breaks out above the upper bound ("out of grid") or misses fills due to sub-cent fluctuations.
 *
 * 1. Precision 4th-Decimal Point Matching (Corridor ±0.0009):
 *    Enables instant market-on-touch execution when price reaches 1-9 of the 4th decimal point
 *    (e.g., target 1.48200 triggers between 1.48110 and 1.48290), eliminating stranded/missed fills.
 *
 * 2. Autonomous Upper Breakout (Auto-Upgrade):
 *    When price surges and reaches or exceeds the upper bound, JARVIS dynamically shifts its
 *    entire trading window upwards by exact integer multiples of gridSpacing:
 *      currentUpperPrice += stepsUp * gridSpacing
 *      currentLowerPrice += stepsUp * gridSpacing
 *    Immediately generates fresh dip-buy levels right beneath the new market peak!
 *
 * 3. Autonomous Pullback Recalibration (Auto-Downgrade):
 *    When price pulls back below the elevated upper zone (>= 2 step spaces below upper),
 *    JARVIS smoothly steps down its active range back towards the initial baseline:
 *      currentUpperPrice = Math.max(initialUpperPrice, currentUpperPrice - stepsDown * gridSpacing)
 *      currentLowerPrice = Math.max(initialLowerPrice, currentLowerPrice - stepsDown * gridSpacing)
 *    Ensuring the active grid envelope stays perfectly centered around live market price
 *    with 100% uniform step spacing at all times!
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
export class JarvisBot extends BaseBotStrategy {
    name = 'JARVIS Bot';
    type = 'JARVIS';
    gridLevels = [];
    gridSpacing = 0;
    currentLowerPrice = 0;
    currentUpperPrice = 0;
    initialLowerPrice = 0;
    initialUpperPrice = 0;
    upperPriceIncrementsCount = 0;
    priceTolerance = 0;
    gridProfit = 0;
    gridProfitCount = 0;
    lastPrice = 0;
    asset = '';
    quote = '';
    // Error & Status handling
    lastError = '';
    insufficientBalance = false;
    lastBalanceCheck = 0;
    lastStatusLog = 0;
    isStopLossActive = false;
    lastStopLossLog = 0;
    lastIncrementLog = 0;
    validate(params) {
        const p = params;
        const errors = [];
        const lowerPrice = toNum(p.lowerPrice);
        const upperPrice = toNum(p.upperPrice);
        const gridCount = toNum(p.gridCount);
        const totalInvestment = toNum(p.totalInvestment);
        const stopLoss = toNum(p.stopLoss);
        const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;
        const priceTolerance = toNum(p.priceTolerance);
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
        if (maxBuysPerLevel < 1 || maxBuysPerLevel > 10)
            errors.push('Max buys per level must be between 1 and 10');
        if (priceTolerance && priceTolerance < 0)
            errors.push('Price tolerance cannot be negative');
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
    }
    async onInitialize(initialState) {
        const p = this.params;
        const lowerPrice = toNum(p.lowerPrice);
        const upperPrice = toNum(p.upperPrice);
        const gridCount = toNum(p.gridCount);
        this.initialLowerPrice = lowerPrice;
        this.initialUpperPrice = upperPrice;
        this.currentLowerPrice = lowerPrice;
        this.currentUpperPrice = upperPrice;
        this.upperPriceIncrementsCount = 0;
        // Grid spacing (Step Space)
        if (p.incrementStepSpace && toNum(p.incrementStepSpace) > 0) {
            this.gridSpacing = toNum(p.incrementStepSpace);
        }
        else {
            this.gridSpacing = (upperPrice - lowerPrice) / gridCount;
        }
        // 4th Decimal Point Precision Tolerance Corridor (allows buying between 1-9 in 4th point after decimal, e.g. ±0.0009)
        if (p.priceTolerance && toNum(p.priceTolerance) > 0) {
            this.priceTolerance = toNum(p.priceTolerance);
        }
        else if (p.toleranceDigits && toNum(p.toleranceDigits) > 0) {
            const digits = toNum(p.toleranceDigits);
            this.priceTolerance = Number((Math.pow(10, -digits) * 9).toFixed(digits + 2));
        }
        else {
            // Default: 4th decimal point precision (0.00090 matching 1-9 in the 4th decimal place)
            this.priceTolerance = 0.0009;
        }
        // Build initial uniform grid levels
        this.rebuildGridLevels((lowerPrice + upperPrice) / 2);
        this.log(`📈 JARVIS Bot initialized with ${gridCount} grids | Step Space: $${this.gridSpacing.toFixed(6)} | Range: [$${lowerPrice.toFixed(6)} - $${upperPrice.toFixed(6)}]`);
        this.log(`🎯 Precision 4th-Decimal Corridor: ENABLED (Corridor: ±$${this.priceTolerance.toFixed(6)} matching 1-9 in 4th decimal place)`);
        this.log(`⚡ Autonomous Trailing Window: ENABLED (Auto-Surge Upgrade + Auto-Pullback Downgrade)`);
        if (initialState?.customState) {
            this.gridProfit = toNum(initialState.customState.gridProfit);
            this.gridProfitCount = toNum(initialState.customState.gridProfitCount);
            this.initialLowerPrice = toNum(initialState.customState.initialLowerPrice) || this.initialLowerPrice;
            this.initialUpperPrice = toNum(initialState.customState.initialUpperPrice) || this.initialUpperPrice;
            this.currentLowerPrice = toNum(initialState.customState.currentLowerPrice) || this.currentLowerPrice;
            this.currentUpperPrice = toNum(initialState.customState.currentUpperPrice) || this.currentUpperPrice;
            this.upperPriceIncrementsCount = toNum(initialState.customState.upperPriceIncrementsCount) || 0;
            this.lastError = initialState.customState.lastError || '';
            this.insufficientBalance = initialState.customState.insufficientBalance || false;
            this.isStopLossActive = initialState.customState.isStopLossActive || false;
            if (Array.isArray(initialState.customState.gridLevels) && initialState.customState.gridLevels.length > 0) {
                this.gridLevels = initialState.customState.gridLevels.map((savedGrid) => ({
                    price: toNum(savedGrid.price),
                    index: savedGrid.index,
                    type: savedGrid.type || 'buy',
                    orderId: savedGrid.orderId,
                    filled: savedGrid.filled || false,
                    buyCount: savedGrid.buyCount || 0,
                    lastActionTimestamp: savedGrid.lastActionTimestamp,
                }));
            }
        }
    }
    /**
     * Rebuilds exact, uniform grid levels across the active [currentLowerPrice, currentUpperPrice] window
     */
    rebuildGridLevels(currentPrice) {
        const p = this.params;
        const gridCount = toNum(p?.gridCount) || (this.gridLevels.length > 1 ? this.gridLevels.length - 1 : 10);
        const newLevels = [];
        for (let i = 0; i <= gridCount; i++) {
            const levelPrice = Number((this.currentLowerPrice + i * this.gridSpacing).toFixed(6));
            // Find existing level close to this price to preserve fill & order state
            const existing = this.gridLevels.find(g => Math.abs(g.price - levelPrice) <= this.gridSpacing * 0.35);
            newLevels.push({
                price: levelPrice,
                index: i,
                type: existing ? existing.type : (levelPrice <= currentPrice ? 'buy' : 'sell'),
                orderId: existing?.orderId,
                filled: existing ? existing.filled : false,
                buyCount: existing ? existing.buyCount : 0,
                lastActionTimestamp: existing?.lastActionTimestamp,
            });
        }
        this.gridLevels = newLevels;
        // Persist live state
        if (this.customState) {
            this.customState.currentUpperPrice = this.currentUpperPrice;
            this.customState.currentLowerPrice = this.currentLowerPrice;
            this.customState.initialLowerPrice = this.initialLowerPrice;
            this.customState.initialUpperPrice = this.initialUpperPrice;
            this.customState.upperPriceIncrementsCount = this.upperPriceIncrementsCount;
            this.customState.gridLevels = this.gridLevels;
            this.customState.priceTolerance = this.priceTolerance;
        }
    }
    handleError(error) {
        this.lastError = error;
        this.log(`ERROR: ${error}`, 'error');
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
        const stopLoss = toNum(p.stopLoss);
        const maxBuysPerLevel = toNum(p.maxBuysPerLevel) || 1;
        const autoIncrementEnabled = p.autoIncrementEnabled !== false; // Default true
        const baseGridCount = toNum(p.gridCount) || 10;
        const investmentPerGrid = toNum(p.totalInvestment) / baseGridCount;
        const now = Date.now();
        const currentPrice = tick.price;
        this.lastPrice = currentPrice;
        if (!this.asset) {
            const { base, quote } = parseSymbol(tick.symbol);
            this.asset = base;
            this.quote = quote;
        }
        // Periodic status heartbeat
        if (now - this.lastStatusLog > 30000) {
            this.lastStatusLog = now;
            const balanceStatus = this.insufficientBalance ? ' [INSUFFICIENT BALANCE]' : '';
            const stopStatus = this.isStopLossActive ? ' [STOP LOSS ACTIVE]' : '';
            this.log(`Tick: $${currentPrice.toFixed(6)} | Active Range: [$${this.currentLowerPrice.toFixed(4)} - $${this.currentUpperPrice.toFixed(4)}] | Shifts: ${this.upperPriceIncrementsCount} | 4th-Dec Corridor: ±$${this.priceTolerance.toFixed(5)} | Profit Cycles: ${this.gridProfitCount}${balanceStatus}${stopStatus}`);
        }
        // ═══════════════════════════════════════════════════════════════
        // 1. STOP LOSS PROTECTION (LOWER SIDE)
        // ═══════════════════════════════════════════════════════════════
        if (stopLoss && currentPrice <= stopLoss) {
            if (!this.isStopLossActive) {
                this.isStopLossActive = true;
                this.log(`⚠️ STOP LOSS triggered at $${currentPrice.toFixed(6)} (Stop level: $${stopLoss.toFixed(6)}). Liquidating all positions to cash...`, 'warn');
                for (const grid of this.gridLevels) {
                    grid.filled = false;
                    grid.orderId = undefined;
                    grid.buyCount = 0;
                    grid.type = 'buy';
                }
                return this.createExitActions(state, 'STOP_LOSS');
            }
            else {
                if (now - this.lastStopLossLog > 30000) {
                    this.lastStopLossLog = now;
                    this.log(`[STOP LOSS ACTIVE] Price $${currentPrice.toFixed(6)} <= Stop $${stopLoss.toFixed(6)}. Waiting for recovery...`);
                }
                return [{ action: 'hold' }];
            }
        }
        // Recover from stop loss if price rebounds
        if (this.isStopLossActive && currentPrice > stopLoss) {
            this.isStopLossActive = false;
            this.log(`🚀 Price recovered to $${currentPrice.toFixed(6)} (above stop loss $${stopLoss.toFixed(6)}). Resuming JARVIS trading!`);
            this.rebuildGridLevels(currentPrice);
        }
        // ═══════════════════════════════════════════════════════════════
        // 2. AUTONOMOUS UPPER BREAKOUT UPGRADE (BULLISH SURGE)
        // ═══════════════════════════════════════════════════════════════
        if (autoIncrementEnabled && currentPrice >= (this.currentUpperPrice - this.priceTolerance * 0.25)) {
            const excess = Math.max(0, currentPrice - this.currentUpperPrice);
            const stepsUp = Math.max(1, Math.floor(excess / this.gridSpacing) + 1);
            const oldUpper = this.currentUpperPrice;
            const oldLower = this.currentLowerPrice;
            this.currentUpperPrice = Number((this.currentUpperPrice + stepsUp * this.gridSpacing).toFixed(6));
            this.currentLowerPrice = Number((this.currentLowerPrice + stepsUp * this.gridSpacing).toFixed(6));
            this.upperPriceIncrementsCount += stepsUp;
            // Re-align grid envelope with exact uniform step spacing
            this.rebuildGridLevels(currentPrice);
            this.log(`🚀 [JARVIS Auto-Upgrade] Upper boundary surged! Price $${currentPrice.toFixed(6)} >= Upper $${oldUpper.toFixed(6)}. Shifted range up by +${stepsUp} step(s) (+$${(stepsUp * this.gridSpacing).toFixed(6)}). New Range: [$${this.currentLowerPrice.toFixed(6)} - $${this.currentUpperPrice.toFixed(6)}] (Total Shifts: ${this.upperPriceIncrementsCount}). Active dip buy levels generated beneath peak!`);
        }
        // ═══════════════════════════════════════════════════════════════
        // 3. AUTONOMOUS PULLBACK DOWNGRADE (BEARISH MEAN-REVERSION)
        // ═══════════════════════════════════════════════════════════════
        if (autoIncrementEnabled && this.upperPriceIncrementsCount > 0) {
            // If current price drops >= 2 steps below elevated upper price, step down
            const dropBelowUpper = this.currentUpperPrice - this.gridSpacing - currentPrice;
            if (dropBelowUpper >= this.gridSpacing) {
                const stepsDown = Math.min(Math.floor(dropBelowUpper / this.gridSpacing), this.upperPriceIncrementsCount);
                if (stepsDown >= 1) {
                    const oldUpper = this.currentUpperPrice;
                    const oldLower = this.currentLowerPrice;
                    this.currentUpperPrice = Number(Math.max(this.initialUpperPrice, this.currentUpperPrice - stepsDown * this.gridSpacing).toFixed(6));
                    this.currentLowerPrice = Number(Math.max(this.initialLowerPrice, this.currentLowerPrice - stepsDown * this.gridSpacing).toFixed(6));
                    this.upperPriceIncrementsCount = Math.max(0, this.upperPriceIncrementsCount - stepsDown);
                    // Re-align grid envelope
                    this.rebuildGridLevels(currentPrice);
                    this.log(`⚡ [JARVIS Auto-Downgrade] Price pulled back to $${currentPrice.toFixed(6)} (below $${(oldUpper - 2 * this.gridSpacing).toFixed(6)}). Shifted range down by -${stepsDown} step(s) (-$${(stepsDown * this.gridSpacing).toFixed(6)}). New Range: [$${this.currentLowerPrice.toFixed(6)} - $${this.currentUpperPrice.toFixed(6)}] (Remaining Shifts: ${this.upperPriceIncrementsCount}). Recalibrated grid levels to active market zone!`);
                }
            }
        }
        // ═══════════════════════════════════════════════════════════════
        // 4. PROCESS ACTIVE GRID TRADING (BUYS & SELLS WITH 4TH-DECIMAL PRECISION)
        // ═══════════════════════════════════════════════════════════════
        const holding = state.holdings.find(h => (h.asset || '').toUpperCase() === (this.asset || '').toUpperCase());
        const totalHoldingQty = holding?.quantity || 0;
        const lockedHoldingQty = state.openOrders
            .filter(o => o.side === 'SELL')
            .reduce((sum, o) => sum + (o.quantity - (o.filledQuantity || 0)), 0);
        let availableHoldingQty = Math.max(0, totalHoldingQty - lockedHoldingQty);
        // Sync live order IDs with current state
        for (const grid of this.gridLevels) {
            const openOrder = state.openOrders.find(o => Math.abs(Number(o.price || 0) - grid.price) < this.gridSpacing * 0.45);
            grid.orderId = openOrder ? openOrder.id : undefined;
            if (openOrder) {
                grid.type = openOrder.side.toLowerCase() === 'sell' ? 'sell' : 'buy';
                grid.filled = false;
            }
        }
        // A. SELL EXECUTION (Grid 1 to top level with Precision Corridor)
        for (let i = 1; i < this.gridLevels.length; i++) {
            const grid = this.gridLevels[i];
            if (!grid)
                continue;
            const isTargetTouched = currentPrice >= (grid.price - this.priceTolerance);
            if (isTargetTouched && availableHoldingQty > 0 && !grid.orderId) {
                if (grid.lastActionTimestamp && now - grid.lastActionTimestamp < 4000) {
                    continue;
                }
                const sellQty = Math.min(availableHoldingQty, (investmentPerGrid * 1.05) / currentPrice);
                if (sellQty > 0) {
                    actions.push({
                        action: 'sell',
                        quantity: sellQty,
                        price: currentPrice,
                        orderType: 'MARKET',
                        gridLevel: grid.index,
                        metadata: { jarvisGridLevel: grid.index, targetPrice: grid.price }
                    });
                    availableHoldingQty -= sellQty;
                    grid.lastActionTimestamp = now;
                    this.log(`⚡ [JARVIS Precision] Profit Sell Triggered at Grid #${grid.index}! Target $${grid.price.toFixed(5)} reached (Current: $${currentPrice.toFixed(5)}, Corridor: ±$${this.priceTolerance.toFixed(5)}). Selling ${sellQty.toFixed(4)} ${this.asset}...`);
                    // Reset lower buy grid level for dip re-entry
                    const lowerBuyGrid = this.gridLevels[grid.index - 1];
                    if (lowerBuyGrid) {
                        lowerBuyGrid.buyCount = 0;
                        lowerBuyGrid.filled = false;
                    }
                }
            }
        }
        // B. BUY DIP EXECUTION (Grid 0 to top level - 1 with 4th Decimal Precision Corridor)
        for (let i = 0; i < this.gridLevels.length - 1; i++) {
            const grid = this.gridLevels[i];
            if (!grid)
                continue;
            // 4th Decimal Corridor Match: Triggers if price is within ±0.0009 (1-9 in 4th point after decimal)
            const isInBuyZone = Math.abs(currentPrice - grid.price) <= this.priceTolerance ||
                (currentPrice <= (grid.price + this.priceTolerance) && currentPrice >= (grid.price - this.gridSpacing * 0.5));
            if (isInBuyZone && !grid.orderId && grid.buyCount < maxBuysPerLevel) {
                if (grid.lastActionTimestamp && now - grid.lastActionTimestamp < 5000) {
                    continue;
                }
                if (!this.insufficientBalance && state.availableBalance >= investmentPerGrid) {
                    const buyQty = (investmentPerGrid * 1.02) / currentPrice;
                    if (buyQty * currentPrice >= 0.50) {
                        actions.push({
                            action: 'buy',
                            quantity: buyQty,
                            price: currentPrice,
                            orderType: 'MARKET',
                            gridLevel: grid.index,
                            metadata: { jarvisGridLevel: grid.index, targetPrice: grid.price }
                        });
                        grid.type = 'buy';
                        grid.lastActionTimestamp = now;
                        this.log(`⚡ [JARVIS Precision] Dip Buy Triggered at Grid #${grid.index}! Target $${grid.price.toFixed(5)} touched (Current: $${currentPrice.toFixed(5)}, Corridor: ±$${this.priceTolerance.toFixed(5)} [1-9 4th decimal]). Buying ${buyQty.toFixed(4)} ${this.asset}...`);
                    }
                }
            }
        }
        if (actions.length > 0) {
            this.log(`[JARVIS] Executing ${actions.length} action(s): ${actions.map(a => `${a.action.toUpperCase()} ${a.quantity?.toFixed(4)} @ $${a.price?.toFixed(6) || 'market'}`).join(', ')}`);
        }
        return actions.length > 0 ? actions : [{ action: 'hold' }];
    }
    createExitActions(state, reason = 'STOP_LOSS') {
        const actions = [];
        actions.push({ action: 'cancel_all', metadata: { isExit: true, exitReason: reason } });
        for (const holding of state.holdings) {
            if (holding.quantity > 0) {
                actions.push({
                    action: 'sell',
                    quantity: holding.quantity,
                    orderType: 'MARKET',
                    metadata: { isExit: true, exitReason: reason },
                });
            }
        }
        this.log(`[JARVIS Exit] Liquidating all holdings due to ${reason}`);
        return actions;
    }
    onOrderFilled(orderId, filledPrice, filledQuantity) {
        let grid = this.gridLevels.find(g => g.orderId === orderId);
        if (!grid && filledPrice > 0) {
            grid = this.gridLevels.find(g => Math.abs(g.price - filledPrice) <= (this.gridSpacing * 0.45 + this.priceTolerance));
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
        this.customState.currentUpperPrice = this.currentUpperPrice;
        this.customState.currentLowerPrice = this.currentLowerPrice;
        this.customState.initialLowerPrice = this.initialLowerPrice;
        this.customState.initialUpperPrice = this.initialUpperPrice;
        this.customState.upperPriceIncrementsCount = this.upperPriceIncrementsCount;
        this.customState.priceTolerance = this.priceTolerance;
        this.customState.lastError = this.lastError;
        this.customState.isStopLossActive = this.isStopLossActive;
    }
    onOrderCancelled(orderId) {
        const grid = this.gridLevels.find(g => g.orderId === orderId);
        if (grid) {
            grid.orderId = undefined;
        }
    }
    onOrderError(error) {
        this.lastError = error;
        this.log(`Order error: ${error}`, 'error');
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
                lowerPrice: 0,
                upperPrice: 0,
                initialUpperPrice: 0,
                initialLowerPrice: 0,
                upperPriceIncrementsCount: 0,
                priceTolerance: 0,
                gridProfit: 0,
                gridProfitCount: 0,
                currentPrice: 0,
                insufficientBalance: this.insufficientBalance ? 1 : 0,
            };
        }
        return {
            gridCount: this.gridLevels.length > 0 ? this.gridLevels.length - 1 : toNum(p.gridCount),
            gridSpacing: this.gridSpacing,
            lowerPrice: this.currentLowerPrice || toNum(p.lowerPrice),
            upperPrice: this.currentUpperPrice || toNum(p.upperPrice),
            initialUpperPrice: this.initialUpperPrice || toNum(p.upperPrice),
            initialLowerPrice: this.initialLowerPrice || toNum(p.lowerPrice),
            upperPriceIncrementsCount: this.upperPriceIncrementsCount,
            priceTolerance: this.priceTolerance,
            gridProfit: this.gridProfit,
            gridProfitCount: this.gridProfitCount,
            currentPrice: this.lastPrice,
            maxBuysPerLevel: toNum(p.maxBuysPerLevel) || 1,
            insufficientBalance: this.insufficientBalance ? 1 : 0,
        };
    }
    restoreState(customState) {
        super.restoreState(customState);
        this.gridProfit = toNum(customState.gridProfit);
        this.gridProfitCount = toNum(customState.gridProfitCount);
        this.initialLowerPrice = toNum(customState.initialLowerPrice) || this.initialLowerPrice;
        this.initialUpperPrice = toNum(customState.initialUpperPrice) || this.initialUpperPrice;
        this.currentLowerPrice = toNum(customState.currentLowerPrice) || this.currentLowerPrice;
        this.currentUpperPrice = toNum(customState.currentUpperPrice) || this.currentUpperPrice;
        this.upperPriceIncrementsCount = toNum(customState.upperPriceIncrementsCount) || this.upperPriceIncrementsCount;
        this.priceTolerance = toNum(customState.priceTolerance) || this.priceTolerance;
        this.lastError = customState.lastError || '';
        this.insufficientBalance = customState.insufficientBalance || false;
        this.isStopLossActive = customState.isStopLossActive || false;
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
            currentLowerPrice: this.currentLowerPrice,
            currentUpperPrice: this.currentUpperPrice,
            initialLowerPrice: this.initialLowerPrice,
            initialUpperPrice: this.initialUpperPrice,
            upperPriceIncrementsCount: this.upperPriceIncrementsCount,
            priceTolerance: this.priceTolerance,
            lastError: this.lastError,
            insufficientBalance: this.insufficientBalance,
            isStopLossActive: this.isStopLossActive,
        };
    }
}
