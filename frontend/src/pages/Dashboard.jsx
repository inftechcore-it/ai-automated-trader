import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Plus, Rocket } from 'lucide-react';
import { api } from '../api.js';
import Card from '../components/Card.jsx';
import PriceTicker from '../components/PriceTicker.jsx';
import { holdings } from '../data/demo.js';

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/portfolio'),
      api.get('/api/orders'),
      api.get('/api/sessions'),
      api.get('/api/watchlist')
    ]).then(([portfolioResult, ordersResult, sessionsResult, watchlistResult]) => {
      if (portfolioResult.status === 'fulfilled') setPortfolio(portfolioResult.value.data.holdings);
      if (ordersResult.status === 'fulfilled') setOrders(ordersResult.value.data.orders);
      if (sessionsResult.status === 'fulfilled') setSessions(sessionsResult.value.data.sessions);
      if (watchlistResult.status === 'fulfilled') setWatchlist(watchlistResult.value.data.items);
    });
  }, []);

  const fallbackTotal = holdings.reduce((sum, item) => sum + item.qty * item.price, 0);
  const total = portfolio.length
    ? portfolio.reduce((sum, item) => sum + Number(item.quantity) * Number(item.current_price), 0)
    : fallbackTotal;
  const pnl = useMemo(() => {
    if (!portfolio.length) return 428.9;
    return portfolio.reduce((sum, item) => sum + Number(item.pnl || 0), 0);
  }, [portfolio]);

  return (
    <div className="page-stack">
      <PriceTicker />
      <div className="grid four">
        <Card title="Total Portfolio Value" value={`$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} meta="Paper + live holdings" tone="blue" />
        <Card title="Today's P&L" value={`${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`} meta={`${orders.length || 3} recent orders`} tone={pnl >= 0 ? 'green' : 'neutral'} />
        <Card title="Active Sessions" value={String(sessions.filter((session) => session.status === 'active').length || 2)} meta="Paper and live sessions" />
        <Card title="Watchlist" value={String(watchlist.length || 4)} meta="Symbols tracked" />
      </div>
      <div className="action-row">
        <Link className="button" to="/trading"><Rocket size={17} /> Start Trading</Link>
        <Link className="button secondary" to="/exchanges"><Plus size={17} /> Add Exchange</Link>
        <Link className="button ghost" to="/ai-analysis"><Bot size={17} /> AI Analysis</Link>
      </div>
    </div>
  );
}
