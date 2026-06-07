import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../api.js';
import Badge from '../components/Badge.jsx';
import Card from '../components/Card.jsx';
import InfoLabel from '../components/InfoLabel.jsx';
import { holdings } from '../data/demo.js';

export default function Portfolio() {
  const [tab, setTab] = useState('paper');
  const [apiHoldings, setApiHoldings] = useState([]);

  useEffect(() => {
    api.get(`/api/portfolio/${tab}`)
      .then((response) => setApiHoldings(response.data.holdings))
      .catch(() => setApiHoldings([]));
  }, [tab]);

  const filtered = apiHoldings.length
    ? apiHoldings.map((item) => ({
        symbol: item.symbol,
        qty: Number(item.quantity),
        avg: Number(item.average_buy_price),
        price: Number(item.current_price),
        mode: item.mode
      }))
    : holdings.filter((item) => item.mode === tab);
  const total = filtered.reduce((sum, item) => sum + item.qty * item.price, 0);

  return (
    <div className="page-stack">
      <div className="segmented fit"><button className={tab === 'paper' ? 'active' : ''} onClick={() => setTab('paper')}>Paper</button><button className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}>Live</button></div>
      <div className="grid two">
        <Card title="Total Value" value={`$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} meta={`${filtered.length} holdings`} tone="blue" />
        <section className="panel chart-small">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={filtered.map((item) => ({ name: item.symbol, value: item.qty * item.price }))} dataKey="value" outerRadius={70}>
                {filtered.map((item, index) => <Cell key={item.symbol} fill={['#00b4d8', '#00ff88', '#ffcc00'][index % 3]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="panel">
        <h2>Holdings</h2>
        <table>
          <thead><tr><th>Symbol</th><th>Quantity</th><th>Avg Buy</th><th>Current</th><th><InfoLabel label="P&L" tip="Profit and loss against average buy price." /></th><th>Mode</th></tr></thead>
          <tbody>
            {filtered.map((item) => {
              const pnl = (item.price - item.avg) * item.qty;
              return <tr key={item.symbol}><td>{item.symbol}</td><td>{item.qty}</td><td>${item.avg}</td><td>${item.price}</td><td className={pnl >= 0 ? 'gain' : 'loss'}>${pnl.toFixed(2)}</td><td><Badge>{item.mode}</Badge></td></tr>;
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
