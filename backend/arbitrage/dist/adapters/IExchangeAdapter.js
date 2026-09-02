export class BaseAdapter {
    normalizeSymbol(symbol) {
        return symbol.replace('/', '').toUpperCase();
    }
    toUnifiedSymbol(symbol) {
        const match = symbol.match(/^([A-Z]+)(USDT|BUSD|BTC|ETH|USD)$/);
        if (match) {
            return `${match[1]}/${match[2]}`;
        }
        return symbol;
    }
}
