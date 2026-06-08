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
import { registerMarketSocket } from './sockets/marketSocket.js';

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
app.use(notFound);
app.use(errorHandler);

registerMarketSocket(io);

server.listen(env.port, () => {
  logger.info(`API listening on http://localhost:${env.port}`);
});
