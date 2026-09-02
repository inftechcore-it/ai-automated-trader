export declare class AdapterError extends Error {
    readonly exchange: string;
    readonly code: string;
    readonly originalError?: Error;
    readonly isRetryable: boolean;
    constructor(exchange: string, message: string, code?: string, originalError?: Error, isRetryable?: boolean);
    static fromCCXTError(exchange: string, error: unknown): AdapterError;
}
export declare class ConfigurationError extends Error {
    constructor(message: string);
}
export declare class EncryptionError extends Error {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map