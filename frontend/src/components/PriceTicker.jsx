import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { quotes as demoQuotes } from '../data/demo.js';

export default function PriceTicker() {
  const [quotes, setQuotes] = useState(demoQuotes);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', { autoConnect: true });
    demoQuotes.forEach((quote) => socket.emit('subscribe', quote));
    socket.on('priceUpdate', (update) => {
      setQuotes((current) => current.map((quote) => quote.symbol === update.symbol ? { ...quote, ...update } : quote));
    });
    return () => socket.close();
  }, []);

  return (
    <div className="ticker">
      {quotes.map((quote) => (
        <div className="ticker-item" key={quote.symbol}>
          <span>{quote.symbol}</span>
          <strong>${Number(quote.price).toLocaleString()}</strong>
          <em className={quote.changePercent >= 0 || quote.change >= 0 ? 'gain' : 'loss'}>
            {(quote.changePercent ?? quote.change).toFixed(2)}%
          </em>
        </div>
      ))}
    </div>
  );
}
