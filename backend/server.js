import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import exchangeRoutes from './routes/exchangeRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import upstoxRoutes from './routes/upstoxRoutes.js';
import angeloneRoutes from './routes/angeloneRoutes.js';
import jupiterRoutes from './routes/jupiterRoutes.js';
import pionexRoutes from './routes/pionexRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import tradingRoutes from './routes/tradingRoutes.js';
import brokerRoutes from './routes/brokerRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import arbitrageRoutes, { setArbitrageSocket } from './routes/arbitrageRoutes.js';
import predictionRoutes from './routes/predictionRoutes.js';
import botRoutes, { setBotSocket } from './routes/botRoutes.js';
import { registerMarketSocket } from './sockets/marketSocket.js';
import { searchSymbols } from './services/exchangeService.js';
import { preloadInstruments } from './services/adapters/upstoxAdapter.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.clientOrigins, credentials: true }
});

app.use(cors({ origin: env.clientOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Trading System API',
    status: 'running',
    health: '/health',
    apiBase: '/api'
  });
});

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upstox', upstoxRoutes);
app.use('/api/angelone', angeloneRoutes);
app.use('/api/jupiter', jupiterRoutes);
app.use('/api/pionex', pionexRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/arbitrage', arbitrageRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/bots', botRoutes);
app.use(notFound);
app.use(errorHandler);

registerMarketSocket(io);
setArbitrageSocket(io);
setBotSocket(io);

server.listen(env.port, () => {
  logger.info(`API listening on http://localhost:${env.port}`);

  // Preload instruments caches for fast search
  searchSymbols('BTC', 'Binance').catch(() => {});

  // Preload Upstox instruments (NSE/BSE) - runs in background
  preloadInstruments().catch(err => {
    logger.warn('Failed to preload Upstox instruments:', err.message);
  });
});
