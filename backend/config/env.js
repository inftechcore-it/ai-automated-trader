import dotenv from 'dotenv';

dotenv.config();

const defaultClientOrigins = 'http://localhost:5173,http://127.0.0.1:5173';

export const env = {
  port: Number(process.env.PORT || 5000),
  clientOrigins: [process.env.CLIENT_ORIGINS, process.env.CLIENT_ORIGIN, defaultClientOrigins]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: {
    host: process.env.DB_HOST || '98.130.107.169',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'erpuser',
    password: process.env.DB_PASSWORD || 'erpdb',
    database: process.env.DB_NAME || 'trading_system'
  },
  jwtSecret: process.env.JWT_SECRET || 'dev_only_change_me',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev_only_change_me_please_make_this_long',
  exchanges: {
    binanceBaseUrl: process.env.BINANCE_BASE_URL || 'https://api.binance.com',
    krakenBaseUrl: process.env.KRAKEN_BASE_URL || 'https://api.kraken.com',
    alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
    twelveDataApiKey: process.env.TWELVE_DATA_API_KEY || ''
  },
  upstox: {
    apiKey: process.env.UPSTOX_API_KEY || '',
    apiSecret: process.env.UPSTOX_API_SECRET || '',
    redirectUri: process.env.UPSTOX_REDIRECT_URI || 'http://localhost:5000/api/upstox/callback'
  }
};
