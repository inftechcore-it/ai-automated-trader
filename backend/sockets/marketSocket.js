import { getQuote } from '../services/marketService.js';
import { logger } from '../utils/logger.js';

const subscriptions = new Map();

function keyOf({ symbol, exchange }) {
  return `${exchange || 'Binance'}:${symbol}`;
}

export function registerMarketSocket(io) {
  io.on('connection', (socket) => {
    socket.on('subscribe', (payload) => {
      if (!payload?.symbol) return;
      const key = keyOf(payload);
      socket.join(key);
      subscriptions.set(key, payload);
    });

    socket.on('unsubscribe', (payload) => {
      if (!payload?.symbol) return;
      socket.leave(keyOf(payload));
    });
  });

  setInterval(async () => {
    await Promise.all(
      [...subscriptions.entries()].map(async ([room, payload]) => {
        try {
          const quote = await getQuote(payload.symbol, payload.exchange);
          io.to(room).emit('priceUpdate', quote);
        } catch (error) {
          logger.warn('Price stream update failed', payload, error.message);
        }
      })
    );
  }, 5000);
}
