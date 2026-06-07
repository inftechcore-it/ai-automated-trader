import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Badge from '../components/Badge.jsx';
import { orders as demoOrders } from '../data/demo.js';

export default function Orders() {
  const [filter, setFilter] = useState('all');
  const [apiOrders, setApiOrders] = useState([]);
  useEffect(() => {
    api.get('/api/orders')
      .then((response) => setApiOrders(response.data.orders))
      .catch(() => setApiOrders([]));
  }, []);

  const orders = apiOrders.length
    ? apiOrders.map((order) => ({
        time: new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        symbol: order.symbol,
        exchange: order.exchange_name,
        side: order.side,
        type: order.order_type,
        qty: Number(order.quantity),
        price: Number(order.price || 0),
        status: order.status,
        mode: order.mode
      }))
    : demoOrders;
  const filtered = filter === 'all' ? orders : orders.filter((order) => order.status === filter);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Order History</h2>
        <div className="segmented small">
          {['all', 'pending', 'filled', 'cancelled'].map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}
        </div>
      </div>
      <table>
        <thead><tr><th>Time</th><th>Symbol</th><th>Exchange</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th><th>Mode</th></tr></thead>
        <tbody>
          {filtered.map((order) => <tr key={`${order.time}-${order.symbol}`}><td>{order.time}</td><td>{order.symbol}</td><td>{order.exchange}</td><td className={order.side === 'buy' ? 'gain' : 'loss'}>{order.side}</td><td>{order.type}</td><td>{order.qty}</td><td>${order.price}</td><td><Badge tone={order.status === 'filled' ? 'green' : 'yellow'}>{order.status}</Badge></td><td><Badge>{order.mode}</Badge></td></tr>)}
        </tbody>
      </table>
    </section>
  );
}
