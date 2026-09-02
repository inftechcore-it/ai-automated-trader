export function getExecutablePrice(orderBook, side, quantityUSDT) {
    const levels = side === 'buy' ? orderBook.asks : orderBook.bids;
    if (!levels || levels.length === 0) {
        return {
            avgPrice: 0,
            worstPrice: 0,
            slippagePercent: 0,
            filled: false,
            filledQuantity: 0,
            totalCost: 0,
        };
    }
    let remainingUSDT = quantityUSDT;
    let totalQuantity = 0;
    let totalCost = 0;
    let worstPrice = 0;
    const bestPrice = levels[0].price;
    for (const level of levels) {
        if (remainingUSDT <= 0)
            break;
        const levelValueUSDT = side === 'buy'
            ? level.amount * level.price
            : level.amount * level.price;
        if (levelValueUSDT >= remainingUSDT) {
            const quantityNeeded = side === 'buy'
                ? remainingUSDT / level.price
                : remainingUSDT / level.price;
            totalQuantity += quantityNeeded;
            totalCost += remainingUSDT;
            worstPrice = level.price;
            remainingUSDT = 0;
        }
        else {
            totalQuantity += level.amount;
            totalCost += levelValueUSDT;
            worstPrice = level.price;
            remainingUSDT -= levelValueUSDT;
        }
    }
    const filled = remainingUSDT <= 0;
    const avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    const slippagePercent = bestPrice > 0
        ? Math.abs((avgPrice - bestPrice) / bestPrice) * 100
        : 0;
    return {
        avgPrice,
        worstPrice,
        slippagePercent,
        filled,
        filledQuantity: totalQuantity,
        totalCost: totalCost,
    };
}
export function getOrderBookAge(orderBook) {
    return Date.now() - orderBook.timestamp;
}
export function isOrderBookFresh(orderBook, maxAgeMs = 3000) {
    return getOrderBookAge(orderBook) < maxAgeMs;
}
export function getPriceAgeStatus(ageMs) {
    if (ageMs < 3000)
        return 'live';
    if (ageMs < 10000)
        return 'delayed';
    return 'stale';
}
