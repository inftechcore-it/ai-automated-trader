export class BaseBotStrategy {
    params = null;
    adapter = null;
    isInitialized = false;
    lastAction = null;
    lastActionTime = null;
    customState = {};
    logCallback = null;
    /** Set external log callback for UI streaming */
    setLogCallback(cb) {
        this.logCallback = cb;
    }
    /** Log to console and optionally to UI */
    log(message, level = 'info') {
        const prefix = `[${this.name}]`;
        if (level === 'error') {
            console.error(`${prefix} ${message}`);
        }
        else if (level === 'warn') {
            console.warn(`${prefix} ${message}`);
        }
        else {
            console.log(`${prefix} ${message}`);
        }
        if (this.logCallback) {
            this.logCallback(message, level);
        }
    }
    async initialize(params, adapter, initialState) {
        this.params = params;
        this.adapter = adapter;
        this.isInitialized = true;
        await this.onInitialize(initialState);
    }
    getStatus() {
        return {
            isHealthy: this.isInitialized,
            message: this.isInitialized ? 'Running' : 'Not initialized',
            metrics: this.getMetrics(),
            lastAction: this.lastAction ?? undefined,
            lastActionTime: this.lastActionTime ?? undefined,
        };
    }
    getCustomState() {
        return { ...this.customState };
    }
    restoreState(customState) {
        this.customState = { ...customState };
    }
    async cleanup() {
        this.isInitialized = false;
        this.params = null;
        this.adapter = null;
    }
    onOrderFilled(orderId, filledPrice, filledQuantity) {
        // Override in subclasses
    }
    onOrderCancelled(orderId) {
        // Override in subclasses
    }
    onOrderPlaced(orderId, gridLevel, price, side) {
        // Override in subclasses
    }
    recordAction(action) {
        this.lastAction = action;
        this.lastActionTime = new Date();
    }
    validateNumber(value, name, min, max) {
        if (typeof value !== 'number' || isNaN(value)) {
            return `${name} must be a valid number`;
        }
        if (min !== undefined && value < min) {
            return `${name} must be at least ${min}`;
        }
        if (max !== undefined && value > max) {
            return `${name} must be at most ${max}`;
        }
        return null;
    }
}
