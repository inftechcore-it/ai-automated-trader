import { useEffect, useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Badge from '../components/Badge.jsx';

const supported = [
  ['Crypto', ['Binance', 'Kraken', 'Coinbase']],
  ['Stock', ['NASDAQ', 'NYSE', 'NSE', 'BSE']]
];

export default function Exchanges() {
  const [connected, setConnected] = useState([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ exchangeName: 'Binance', exchangeType: 'crypto', apiKey: '', apiSecret: '' });

  async function load() {
    try {
      const response = await api.get('/api/exchanges/connected');
      setConnected(response.data.exchanges);
    } catch {
      setConnected([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function connect(event) {
    event.preventDefault();
    setMessage('');
    try {
      await api.post('/api/exchanges/connect', form);
      setForm({ ...form, apiKey: '', apiSecret: '' });
      setMessage('Exchange connected');
      load();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function remove(id) {
    setMessage('');
    try {
      await api.delete(`/api/exchanges/${id}`);
      setMessage('Exchange disconnected');
      load();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Supported Exchanges</h2>
        {supported.map(([type, names]) => (
          <div className="exchange-group" key={type}>
            <h3>{type}</h3>
            <div className="exchange-list">
              {names.map((name) => <div className="exchange-card" key={name}><strong>{name}</strong><span>{type} adapter</span></div>)}
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Connect Exchange</h2>
        <form className="form compact" onSubmit={connect}>
          <select value={form.exchangeName} onChange={(event) => setForm({ ...form, exchangeName: event.target.value })}>
            {supported.flatMap(([, names]) => names).map((name) => <option key={name}>{name}</option>)}
          </select>
          <select value={form.exchangeType} onChange={(event) => setForm({ ...form, exchangeType: event.target.value })}>
            <option value="crypto">Crypto</option>
            <option value="stock">Stock</option>
          </select>
          <input placeholder="API key" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} />
          <input placeholder="API secret" value={form.apiSecret} onChange={(event) => setForm({ ...form, apiSecret: event.target.value })} />
          <button><KeyRound size={16} /> Connect</button>
          {message && <div className="form-note">{message}</div>}
        </form>
        <h2>Connected</h2>
        <div className="list">
          {connected.map((item) => (
            <div className="list-row" key={item.id}>
              <span>{item.exchangeName}</span>
              <Badge tone={item.isActive ? 'green' : 'neutral'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
              <button className="icon-button" title="Delete" onClick={() => remove(item.id)}><Trash2 size={16} /></button>
            </div>
          ))}
          {!connected.length && <div className="empty">No exchange connections yet.</div>}
        </div>
      </section>
    </div>
  );
}
