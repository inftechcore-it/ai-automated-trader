export class AdapterError extends Error {
  public readonly exchange: string;
  public readonly code: string;
  public readonly originalError?: Error;
  public readonly isRetryable: boolean;

  constructor(
    exchange: string,
    message: string,
    code: string = 'ADAPTER_ERROR',
    originalError?: Error,
    isRetryable: boolean = false
  ) {
    super(`[${exchange}] ${message}`);
    this.name = 'AdapterError';
    this.exchange = exchange;
    this.code = code;
    this.originalError = originalError;
    this.isRetryable = isRetryable;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AdapterError);
    }
  }

  static fromCCXTError(exchange: string, error: unknown): AdapterError {
    if (error instanceof Error) {
      const errorName = error.name || '';
      const message = error.message || 'Unknown error';

      const retryableErrors = [
        'NetworkError',
        'RequestTimeout',
        'ExchangeNotAvailable',
        'RateLimitExceeded',
      ];

      const isRetryable = retryableErrors.some(
        (e) => errorName.includes(e) || message.includes(e)
      );

      let code = 'CCXT_ERROR';
      if (errorName.includes('AuthenticationError')) code = 'AUTH_ERROR';
      else if (errorName.includes('InsufficientFunds')) code = 'INSUFFICIENT_FUNDS';
      else if (errorName.includes('InvalidOrder')) code = 'INVALID_ORDER';
      else if (errorName.includes('OrderNotFound')) code = 'ORDER_NOT_FOUND';
      else if (errorName.includes('RateLimitExceeded')) code = 'RATE_LIMIT';
      else if (errorName.includes('NetworkError')) code = 'NETWORK_ERROR';
      else if (errorName.includes('ExchangeError')) code = 'EXCHANGE_ERROR';

      return new AdapterError(exchange, message, code, error, isRetryable);
    }

    return new AdapterError(
      exchange,
      String(error),
      'UNKNOWN_ERROR',
      undefined,
      false
    );
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}
