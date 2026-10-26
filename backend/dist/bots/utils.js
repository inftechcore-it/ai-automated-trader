/**
 * Bot utility functions
 */
/**
 * Safely convert any value to a number
 * Returns 0 for NaN, null, undefined, or non-numeric strings
 */
export const toNum = (v) => {
    if (v === null || v === undefined)
        return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};
/**
 * Safely parse a trading symbol into base and quote assets
 */
export const parseSymbol = (symbol) => {
    if (!symbol)
        return { base: '', quote: '' };
    const clean = symbol.trim().toUpperCase().replace(/[-_]/g, '/');
    if (clean.includes('/')) {
        const parts = clean.split('/');
        return {
            base: (parts[0] || '').toUpperCase(),
            quote: (parts[1] || '').toUpperCase(),
        };
    }
    const knownQuotes = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'USD', 'EUR', 'INR', 'SOL', 'BTC', 'ETH'];
    for (const q of knownQuotes) {
        if (clean.endsWith(q) && clean.length > q.length) {
            return {
                base: clean.slice(0, -q.length),
                quote: q,
            };
        }
    }
    return {
        base: clean,
        quote: '',
    };
};
/**
 * Format price with appropriate decimal places
 */
export const formatPrice = (price, decimals = 6) => {
    return price.toFixed(decimals);
};
/**
 * Calculate percentage change
 */
export const percentChange = (current, previous) => {
    if (previous === 0)
        return 0;
    return ((current - previous) / previous) * 100;
};
/**
 * Universal Fee Rate Registry for all supported exchanges
 * Returns taker/maker fee rate (e.g. 0.0010 for 0.10%)
 */
export const getExchangeFeeRate = (exchange, symbol) => {
    if (!exchange)
        return 0.0010;
    const ex = exchange.toLowerCase();
    switch (ex) {
        case 'pionex':
            return 0.0005; // 0.05% maker/taker spot
        case 'coindcx':
            return 0.0020; // 0.20% spot taker
        case 'jupiter':
            return 0.0015; // ~0.15% (pool swap fee + solana priority compute)
        case 'kraken':
            return 0.0020; // ~0.20% taker
        case 'bybit':
            return 0.0010; // 0.10%
        case 'binance':
            return 0.0010; // 0.10% standard spot
        case 'angelone':
        case 'upstox':
        case 'nse':
        case 'bse':
            return 0.0010; // Brokerage (₹20/0.03%) + STT & statutory taxes (~0.10%)
        case 'alpaca':
        case 'nasdaq':
        case 'nyse':
            return 0.0005; // US regulatory turnover + SEC (~0.05%)
        default:
            return 0.0010; // 0.10% default
    }
};
/**
 * Dynamic Minimum Breakeven Price Calculation
 * P_breakeven = ((P_avgEntry * Q_sell) + Sum(F_buy) + MinNetBuffer) / (Q_sell * (1 - r_exchange))
 */
export const calculateFeeBreakevenPrice = (avgEntryPrice, quantity, accumulatedBuyFees = 0, feeRate = 0.0010, minNetBuffer = 0) => {
    const q = Number(quantity || 0);
    const pEntry = Number(avgEntryPrice || 0);
    const buyFees = Number(accumulatedBuyFees || 0);
    const rate = Number(feeRate || 0.0010);
    const buffer = Number(minNetBuffer || 0);
    if (q <= 0 || (1 - rate) <= 0) {
        return pEntry;
    }
    const breakeven = ((pEntry * q) + buyFees + buffer) / (q * (1 - rate));
    return Number.isFinite(breakeven) && breakeven > 0 ? breakeven : pEntry;
};
/**
 * Universal Fee-Aware Net Profit Check
 */
export const calculateNetProfit = (params) => {
    const pSell = Number(params.sellPrice || 0);
    const pEntry = Number(params.avgEntryPrice || 0);
    const q = Number(params.quantity || 0);
    const buyFees = Number(params.accumulatedBuyFees || 0);
    const rate = Number(params.feeRate || 0.0010);
    const minBuffer = Number(params.minBuffer || 0);
    const grossProfit = (pSell - pEntry) * q;
    const upcomingSellFee = (pSell * q) * rate;
    const totalCycleFees = buyFees + upcomingSellFee;
    const netProfit = grossProfit - totalCycleFees;
    const breakevenPrice = calculateFeeBreakevenPrice(pEntry, q, buyFees, rate, minBuffer);
    return {
        grossProfit,
        upcomingSellFee,
        totalCycleFees,
        netProfit,
        breakevenPrice,
        isProfitable: netProfit > minBuffer,
    };
};
