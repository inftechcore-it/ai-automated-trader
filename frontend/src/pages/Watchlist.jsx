import { useEffect, useState } from 'react';
import { Search, Star, Trash2 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { api } from '../api.js';
import { quotes } from '../data/demo.js';

const spark = Array.from({ length: 12 }, (_, index) => ({ value: 100 + Math.sin(index) * 8 + index }));

export default function Watchlist() {
  const [items, setItems] = useState([]);
  const [symbol, setSymbol] = useState('');
  const [exchangeName, setExchangeName] = useState('Binance');

  async function load() {
    try {
      const response = await api.get('/api/watchlist');
      setItems(response.data.items);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function addItem(event) {
    event.preventDefault();
    if (!symbol.trim()) return;
    await api.post('/api/watchlist', { symbol: symbol.trim().toUpperCase(), exchangeName });
    setSymbol('');
    load();
  }

  async function deleteItem(id) {
    await api.delete(`/api/watchlist/${id}`);
    load();
  }

  const cards = items.length
    ? items.map((item) => ({
        id: item.id,
        symbol: item.symbol,
        exchange: item.exchange_name,
        price: quotes.find((quote) => quote.symbol === item.symbol)?.price || 100,
        change: quotes.find((quote) => quote.symbol === item.symbol)?.change || 0
      }))
    : quotes;

  return (
    <div className="page-stack">
      <form className="panel search-row" onSubmit={addItem}>
        <Search size={18} />
        <input placeholder="Search symbol to add" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
        <select value={exchangeName} onChange={(event) => setExchangeName(event.target.value)}>
          <option>Binance</option>
          <option>NASDAQ</option>
          <option>NSE</option>
        </select>
        <button><Star size={16} /> Add</button>
      </form>
      <div className="grid four">
        {cards.map((quote) => (
          <section className="card watch-card" key={quote.symbol}>
            <div className="panel-head">
              <strong>{quote.symbol}</strong>
              <span>{quote.exchange}</span>
              {quote.id && <button className="icon-button" title="Remove" onClick={() => deleteItem(quote.id)}><Trash2 size={15} /></button>}
            </div>
            <div className="card-value">${quote.price.toLocaleString()}</div>
            <div className={quote.change >= 0 ? 'gain' : 'loss'}>{quote.change.toFixed(2)}%</div>
            <ResponsiveContainer width="100%" height={70}>
              <LineChart data={spark}><Line dataKey="value" stroke={quote.change >= 0 ? '#00ff88' : '#ff4757'} strokeWidth={2} dot={false} /></LineChart>
            </ResponsiveContainer>
          </section>
        ))}
      </div>
    </div>
  );
}
