import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Badge from '../components/Badge.jsx';
import InfoLabel from '../components/InfoLabel.jsx';
import { candles } from '../data/demo.js';

export default function Trading() {
  const [mode, setMode] = useState('paper');
  const [side, setSide] = useState('buy');
  const [type, setType] = useState('market');
  const [exchangeName, setExchangeName] = useState('Binance');
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [qty, setQty] = useState('0.01');
  const [price, setPrice] = useState('68250.12');
  const [session, setSession] = useState(null);
  const [connections, setConnections] = useState([]);
  const [chartData, setChartData] = useState(candles);
  const [message, setMessage] = useState('');
  const total = Number(qty || 0) * Number(price || 0);

  useEffect(() => {
    api.get('/api/exchanges/connected')
      .then((response) => setConnections(response.data.exchanges))
      .catch(() => setConnections([]));
  }, []);

  useEffect(() => {
    api.get('/api/market/quote', { params: { symbol, exchange: exchangeName } })
      .then((response) => setPrice(String(Number(response.data.quote.price).toFixed(2))))
      .catch(() => {});
    api.get('/api/market/history', { params: { symbol, exchange: exchangeName, interval: '1h' } })
      .then((response) => {
        setChartData(response.data.candles.map((candle, index) => ({
          time: index,
          price: Number(candle.close)
        })));
      })
      .catch(() => setChartData(candles));
  }, [symbol, exchangeName]);

  async function ensureSession() {
    if (session) return session;
    const matchingConnection = connections.find((connection) => connection.exchangeName === exchangeName);
    const response = await api.post('/api/sessions/start', {
      exchangeId: matchingConnection?.id || null,
      exchangeName,
      symbol,
      mode
    });
    setSession(response.data.session);
    return response.data.session;
  }

  async function placeOrder() {
    setMessage('');
    try {
      const activeSession = await ensureSession();
      await api.post('/api/orders/place', {
        sessionId: activeSession.id,
        symbol,
        exchangeName,
        orderType: type,
        side,
        quantity: Number(qty),
        price: type === 'market' ? null : Number(price),
        mode
      });
      setMessage(`${side.toUpperCase()} order submitted`);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  return (
    <div className="page-stack">
      <section className="panel steps">
        <select value={exchangeName} onChange={(event) => setExchangeName(event.target.value)}>
          <option>Binance</option>
          <option>NASDAQ</option>
          <option>NSE</option>
          {connections.map((connection) => <option key={connection.id}>{connection.exchangeName}</option>)}
        </select>
        <div className="segmented">
          <button className={mode === 'paper' ? 'active' : ''} onClick={() => setMode('paper')}><FlaskConical size={16} /> Paper</button>
          <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}>Live</button>
        </div>
        <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} aria-label="Symbol" />
        <Badge tone={mode === 'paper' ? 'yellow' : 'green'}>{mode === 'paper' ? 'Paper mode' : 'Live mode'}</Badge>
      </section>

      <div className="grid trading-grid">
        <section className="panel chart-panel">
          <div className="panel-head">
            <h2>{symbol}</h2>
            <div className="segmented small">
              {['1m', '5m', '15m', '1h', '1d'].map((item) => <button key={item}>{item}</button>)}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00b4d8" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#00b4d8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2a37" />
              <XAxis dataKey="time" stroke="#738094" />
              <YAxis stroke="#738094" domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip contentStyle={{ background: '#101720', border: '1px solid #243244' }} />
              <Area dataKey="price" stroke="#00b4d8" fill="url(#priceFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="panel order-form">
          <h2>Order Ticket</h2>
          {mode === 'live' && <div className="risk-banner"><AlertTriangle size={16} /> Live orders require confirmation.</div>}
          <div className="segmented">
            <button className={side === 'buy' ? 'active buy' : ''} onClick={() => setSide('buy')}>Buy</button>
            <button className={side === 'sell' ? 'active sell' : ''} onClick={() => setSide('sell')}>Sell</button>
          </div>
          <label><InfoLabel label="Order type" tip="Market orders execute immediately; limit orders wait for your price." /><select value={type} onChange={(event) => setType(event.target.value)}><option value="market">Market</option><option value="limit">Limit</option></select></label>
          <label>Quantity<input value={qty} onChange={(event) => setQty(event.target.value)} /></label>
          <label>Price<input value={price} onChange={(event) => setPrice(event.target.value)} disabled={type === 'market'} /></label>
          <div className="total-line"><span>Estimated total</span><strong>${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
          <button className={side === 'buy' ? 'buy-action' : 'sell-action'} onClick={placeOrder}>{side === 'buy' ? 'Place Buy' : 'Place Sell'}</button>
          {message && <div className="form-note">{message}</div>}
        </section>
      </div>

      <div className="grid two">
        <section className="panel"><h2>Order Book</h2><div className="depth-row gain">Bid 68,240.10 x 1.8</div><div className="depth-row loss">Ask 68,252.60 x 1.1</div></section>
        <section className="panel"><h2>Recent Trades</h2><div className="depth-row">68,250.12 x 0.05</div><div className="depth-row">68,248.42 x 0.11</div></section>
      </div>
    </div>
  );
}
