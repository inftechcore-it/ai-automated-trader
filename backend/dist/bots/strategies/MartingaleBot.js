/**
 * MartingaleBot Strategy - Double down after losses
 * HIGH RISK: Position size increases after losses
 */
import { BaseBotStrategy } from '../IBotStrategy.js';
import { toNum, parseSymbol } from '../utils.js';
export class MartingaleBot extends BaseBotStrategy {
    name = 'Martingale Bot';
    type = 'MARTINGALE';
    safetyOrderCount = 0;
    lastBuyPrice = 0;
    lastBuyAmount = 0;
    avgEntryPrice = 0;
    totalQuantity = 0;
    totalSpent = 0;
    asset = '';
    hasInitialBuy = false;
    isStopLossActive = false;
    lastStopLossPrice = 0;
    lastStopLossLog = 0;
    validate(params) {
        const p = params;
        const errors = [];
        const initialBuyAmount = toNum(p.initialBuyAmount);
        const priceDropPercent = toNum(p.priceDropPercent);
        const takeProfitPercent = toNum(p.takeProfitPercent);
        const maxSafetyOrders = toNum(p.maxSafetyOrders);
        const multiplier = toNum(p.multiplier);
        const maxTotalInvestment = toNum(p.maxTotalInvestment);
        const stopLossPercent = toNum(p.stopLossPercent);
        if (!initialBuyAmount || initialBuyAmount <= 0)
            errors.push('Initial buy amount must be positive');
        if (!priceDropPercent || priceDropPercent <= 0 || priceDropPercent > 50) {
            errors.push('Price drop percent must be between 0 and 50');
        }
        if (!takeProfitPercent || takeProfitPercent <= 0)
            errors.push('Take profit percent must be positive');
        if (p.stopLossPercent !== undefined && stopLossPercent <= 0)
            errors.push('Stop loss percent must be positive');
        if (!maxSafetyOrders || maxSafetyOrders < 1 || maxSafetyOrders > 20) {
            errors.push('Max safety orders must be between 1 and 20');
        }
        if (!multiplier || multiplier < 1 || multiplier > 5) {
            errors.push('Multiplier must be between 1 and 5');
        }
        if (!maxTotalInvestment || maxTotalInvestment <= 0) {
            errors.push('Max total investment must be positive');
        }
        // Calculate max possible investment
        let maxNeeded = initialBuyAmount;
        let amount = initialBuyAmount;
        for (let i = 0; i < maxSafetyOrders; i++) {
            amount *= multiplier;
            maxNeeded += amount;
        }
        if (maxNeeded > maxTotalInvestment) {
            errors.push(`With these settings, max investment could reach $${maxNeeded.toFixed(2)}. Increase max or reduce orders.`);
        }
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
    }
    async onInitialize(initialState) {
        if (initialState?.customState) {
            this.restoreState(initialState.customState);
            return;
        }
        const p = this.params;
        console.log(`[Martingale] Initialized: $${p.initialBuyAmount} initial, ${p.multiplier}x multiplier, max ${p.maxSafetyOrders} safety orders`);
        console.log(`[Martingale] ⚠️ WARNING: High risk strategy - position size increases after losses`);
    }
    async evaluate(tick, state) {
        const p = this.params;
        const now = Date.now();
        if (!this.asset) {
            const { base } = parseSymbol(tick.symbol);
            this.asset = base;
        }
        const currentPrice = tick.price;
        const initialBuyAmount = toNum(p.initialBuyAmount);
        const takeProfitPercent = toNum(p.takeProfitPercent);
        const stopLossPercent = toNum(p.stopLossPercent);
        const priceDropPercent = toNum(p.priceDropPercent);
        const maxSafetyOrders = toNum(p.maxSafetyOrders);
        const multiplier = toNum(p.multiplier);
        const maxTotalInvestment = toNum(p.maxTotalInvestment);
        // 1. Check stop loss
        if (stopLossPercent && this.avgEntryPrice > 0) {
            const stopPrice = this.avgEntryPrice * (1 - stopLossPercent / 100);
            if (currentPrice <= stopPrice) {
                if (!this.isStopLossActive) {
                    this.isStopLossActive = true;
                    this.lastStopLossPrice = stopPrice;
                    console.log(`[Martingale] ⚠️ Stop loss triggered at $${currentPrice.toFixed(6)} (stop: $${stopPrice.toFixed(6)}). Liquidating holdings...`);
                    return this.createSellAllAction(state, 'STOP_LOSS');
                }
                else {
                    if (now - this.lastStopLossLog > 30000) {
                        this.lastStopLossLog = now;
                        console.log(`[Martingale] [STOP LOSS ACTIVE] Price $${currentPrice.toFixed(6)} <= Stop $${stopPrice.toFixed(6)}. Waiting for recovery...`);
                    }
                    return [{ action: 'hold' }];
                }
            }
        }
        // Recover from stop loss
        if (this.isStopLossActive && this.lastStopLossPrice > 0 && currentPrice > this.lastStopLossPrice) {
            this.isStopLossActive = false;
            console.log(`[Martingale] 🚀 Price recovered to $${currentPrice.toFixed(6)} (above stop loss $${this.lastStopLossPrice.toFixed(6)}). Resuming Martingale cycle!`);
            this.safetyOrderCount = 0;
            this.hasInitialBuy = false;
            this.lastBuyPrice = 0;
            this.lastBuyAmount = 0;
            this.avgEntryPrice = 0;
            this.totalQuantity = 0;
            this.totalSpent = 0;
        }
        // Initial buy
        if (!this.isStopLossActive && !this.hasInitialBuy) {
            if (state.availableBalance >= initialBuyAmount) {
                console.log(`[Martingale] Initial buy: $${initialBuyAmount} @ ${currentPrice}`);
                return [{
                        action: 'buy',
                        quantity: initialBuyAmount / currentPrice,
                        orderType: 'MARKET',
                        metadata: { orderType: 'initial' },
                    }];
            }
            return [{ action: 'hold' }];
        }
        // Check take profit
        if (this.avgEntryPrice > 0) {
            const targetPrice = this.avgEntryPrice * (1 + takeProfitPercent / 100);
            if (currentPrice >= targetPrice) {
                console.log(`[Martingale] Take profit at ${currentPrice} (target: ${targetPrice.toFixed(2)})`);
                return this.createSellAllAction(state, 'TAKE_PROFIT');
            }
        }
        // Check for safety order trigger
        if (!this.isStopLossActive && this.lastBuyPrice > 0 && this.safetyOrderCount < maxSafetyOrders) {
            const triggerPrice = this.lastBuyPrice * (1 - priceDropPercent / 100);
            if (currentPrice <= triggerPrice) {
                // Calculate next buy amount
                const nextBuyAmount = this.lastBuyAmount * multiplier;
                // Check caps
                if (this.totalSpent + nextBuyAmount > maxTotalInvestment) {
                    console.log(`[Martingale] Max investment cap reached`);
                    return [{ action: 'hold' }];
                }
                if (state.availableBalance >= nextBuyAmount) {
                    console.log(`[Martingale] Safety order #${this.safetyOrderCount + 1}: $${nextBuyAmount.toFixed(2)} @ ${currentPrice}`);
                    return [{
                            action: 'buy',
                            quantity: nextBuyAmount / currentPrice,
                            orderType: 'MARKET',
                            metadata: { orderType: 'safety', orderNumber: this.safetyOrderCount + 1 },
                        }];
                }
            }
        }
        return [{ action: 'hold' }];
    }
    createSellAllAction(state, reason = 'TAKE_PROFIT') {
        const holding = state.holdings.find(h => h.asset === this.asset);
        // Reset for next cycle
        this.safetyOrderCount = 0;
        this.hasInitialBuy = false;
        this.lastBuyPrice = 0;
        this.lastBuyAmount = 0;
        this.avgEntryPrice = 0;
        this.totalQuantity = 0;
        this.totalSpent = 0;
        if (!holding || holding.quantity <= 0) {
            return [{
                    action: 'sell',
                    quantity: 0,
                    orderType: 'MARKET',
                    metadata: { isExit: true, exitReason: reason, sweepAll: true },
                }];
        }
        return [{
                action: 'sell',
                quantity: holding.quantity,
                orderType: 'MARKET',
                metadata: { isExit: true, exitReason: reason },
            }];
    }
    onOrderFilled(orderId, filledPrice, filledQuantity) {
        const cost = filledPrice * filledQuantity;
        const p = this.params;
        if (!this.hasInitialBuy) {
            // Initial buy filled
            this.hasInitialBuy = true;
            this.lastBuyPrice = filledPrice;
            this.lastBuyAmount = toNum(p.initialBuyAmount);
        }
        else {
            // Safety order filled
            this.safetyOrderCount++;
            this.lastBuyPrice = filledPrice;
            this.lastBuyAmount = cost;
        }
        // Update average entry
        const newTotalQuantity = this.totalQuantity + filledQuantity;
        this.avgEntryPrice = (this.avgEntryPrice * this.totalQuantity + cost) / newTotalQuantity;
        this.totalQuantity = newTotalQuantity;
        this.totalSpent += cost;
        console.log(`[Martingale] Avg entry updated to ${this.avgEntryPrice.toFixed(4)}, total invested: $${this.totalSpent.toFixed(2)}`);
    }
    getMetrics() {
        const p = this.params;
        if (!p) {
            return { safetyOrderCount: 0, maxSafetyOrders: 0, avgEntryPrice: 0, totalQuantity: 0, totalSpent: 0, lastBuyPrice: 0, remainingBudget: 0 };
        }
        return {
            safetyOrderCount: this.safetyOrderCount,
            maxSafetyOrders: toNum(p.maxSafetyOrders),
            avgEntryPrice: this.avgEntryPrice,
            totalQuantity: this.totalQuantity,
            totalSpent: this.totalSpent,
            lastBuyPrice: this.lastBuyPrice,
            remainingBudget: toNum(p.maxTotalInvestment) - this.totalSpent,
        };
    }
    restoreState(customState) {
        super.restoreState(customState);
        this.safetyOrderCount = customState.safetyOrderCount || 0;
        this.lastBuyPrice = customState.lastBuyPrice || 0;
        this.lastBuyAmount = customState.lastBuyAmount || 0;
        this.avgEntryPrice = customState.avgEntryPrice || 0;
        this.totalQuantity = customState.totalQuantity || 0;
        this.totalSpent = customState.totalSpent || 0;
        this.hasInitialBuy = customState.hasInitialBuy || false;
        this.isStopLossActive = customState.isStopLossActive || false;
        this.lastStopLossPrice = customState.lastStopLossPrice || 0;
    }
    getCustomState() {
        return {
            safetyOrderCount: this.safetyOrderCount,
            lastBuyPrice: this.lastBuyPrice,
            lastBuyAmount: this.lastBuyAmount,
            avgEntryPrice: this.avgEntryPrice,
            totalQuantity: this.totalQuantity,
            totalSpent: this.totalSpent,
            hasInitialBuy: this.hasInitialBuy,
            isStopLossActive: this.isStopLossActive,
            lastStopLossPrice: this.lastStopLossPrice,
        };
    }
}
