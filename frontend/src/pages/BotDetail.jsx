import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Bot, ArrowLeft, Play, Pause, Square, Edit2, Trash2, Share2,
  TrendingUp, TrendingDown, DollarSign, Activity, Clock, Target,
  BarChart3, Wallet, FlaskConical, RefreshCw, Loader2, AlertTriangle,
  ChevronDown, Grid3X3, Repeat, ArrowUpDown, Scale, Shuffle, Terminal, Radar
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine
} from 'recharts';

const api = (path, opts = {}) =>
  fetch(`${import.meta.env.VITE_API || 'http://localhost:5000'}/api${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    ...opts
  }).then(r => r.json());

const STRATEGY_ICONS = {
  GRID: Grid3X3,
  INFINITY_GRID: Grid3X3,
  DCA: Repeat,
  SMART_TRADE: Target,
  TRAILING: ArrowUpDown,
  MARTINGALE: BarChart3,
  REBALANCING: Scale,
  ARBITRAGE: Shuffle,
  DYNAMIC_GRID: Radar,
};

const formatDuration = (startedAt) => {
  if (!startedAt) return '-';
  const ms = Date.now() - new Date(startedAt).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

export default function BotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bot, setBot] = useState(null);
  const [orders, setOrders] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeframe, setTimeframe] = useState('7d');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const socketRef = useRef(null);
  const logsEndRef = useRef(null);

  const loadLogs = async () => {
    try {
      const res = await api(`/bots/${id}/logs?limit=100`);
      if (res.success && res.logs) {
        setLogs(res.logs.map(l => ({
          ...l,
          timestamp: l.createdAt || l.timestamp,
        })));
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
    }
  };

  useEffect(() => {
    loadBot();
    loadOrders();
    loadSnapshots();
    loadLogs();

    const socket = io(import.meta.env.VITE_API || 'http://localhost:5000');
    socketRef.current = socket;

    socket.on('bot:status', (data) => {
      if (data.botId === id) {
        setBot(prev => prev ? { ...prev, ...data } : prev);
      }
    });

    socket.on('bot:trade', (data) => {
      if (data.botId === id) {
        loadOrders();
        setBot(prev => prev ? { ...prev, totalTrades: (prev.totalTrades || 0) + 1 } : prev);
      }
    });

    socket.on('bot:log', (data) => {
      if (data.botId === id) {
        setLogs(prev => [...prev.slice(-99), data]);
      }
    });

    socket.on('bot:error', (data) => {
      if (data.botId === id) {
        setLogs(prev => [...prev.slice(-99), { ...data, level: 'error', message: data.error }]);
      }
    });

    return () => socket.disconnect();
  }, [id]);

  const loadBot = async () => {
    try {
      const res = await api(`/bots/${id}`);
      if (res.success) {
        setBot(res.bot);
      }
    } catch (e) {
      console.error('Failed to load bot:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await api(`/bots/${id}/orders?limit=100`);
      if (res.success) {
        setOrders(res.orders || []);
      }
    } catch (e) {
      console.error('Failed to load orders:', e);
    }
  };

  const loadSnapshots = async () => {
    try {
      const limit = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : timeframe === '30d' ? 720 : 2000;
      const res = await api(`/bots/${id}/equity-curve?limit=${limit}`);
      if (res.success) {
        setSnapshots(res.snapshots || []);
      }
    } catch (e) {
      console.error('Failed to load snapshots:', e);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, [timeframe]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      const res = await api(`/bots/${id}/${action}`, { method: 'POST' });
      if (res.success) {
        loadBot();
      }
    } catch (e) {
      console.error(`Failed to ${action}:`, e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await api(`/bots/${id}`, { method: 'DELETE' });
      if (res.success) {
        navigate('/bots');
      }
    } catch (e) {
      console.error('Failed to delete:', e);
    } finally {
      setActionLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="bot-detail-page loading">
        <Loader2 size={32} className="spin" />
        <p>Loading bot...</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="bot-detail-page error">
        <AlertTriangle size={48} />
        <h2>Bot not found</h2>
        <button onClick={() => navigate('/bots')}>Back to Bots</button>
      </div>
    );
  }

  const Icon = STRATEGY_ICONS[bot.strategyType] || Bot;
  const profit = Number(bot.totalProfit || 0);
  const profitPercent = bot.investedAmount > 0 ? (profit / Number(bot.investedAmount)) * 100 : 0;
  const isPositive = profit >= 0;

  const equityData = snapshots.map(s => ({
    time: new Date(s.snapshotAt).toLocaleString(),
    equity: Number(s.equity || 0),
    profit: Number(s.profit || 0),
  })).reverse();

  const winningTrades = orders.filter(o => Number(o.profit || 0) > 0).length;
  const losingTrades = orders.filter(o => Number(o.profit || 0) < 0).length;
  const winRate = orders.length > 0 ? ((winningTrades / orders.length) * 100).toFixed(1) : 0;

  return (
    <div className="bot-detail-page">
      {/* Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate('/bots')}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-info">
          <div className="bot-title">
            <Icon size={24} />
            <h1>{bot.name}</h1>
            <span className={`status-badge ${bot.status?.toLowerCase()}`}>
              <span className="status-dot" />
              {bot.status}
            </span>
          </div>
          <div className="bot-meta">
            <span className="strategy-tag">{bot.strategyType.replace('_', ' ')}</span>
            <span className="exchange-tag">{bot.exchangeName}</span>
            <span className="symbol-tag">{bot.symbol}</span>
            <span className={`mode-tag ${bot.mode?.toLowerCase()}`}>
              {bot.mode === 'PAPER' ? <FlaskConical size={12} /> : <Wallet size={12} />}
              {bot.mode}
            </span>
            <span className="runtime-tag">
              <Clock size={12} />
              {formatDuration(bot.startedAt)}
            </span>
          </div>
        </div>
        <div className="header-actions">
          {bot.status === 'RUNNING' && (
            <button className="action-btn pause" onClick={() => handleAction('pause')} disabled={actionLoading}>
              <Pause size={16} /> Pause
            </button>
          )}
          {bot.status === 'PAUSED' && (
            <button className="action-btn resume" onClick={() => handleAction('resume')} disabled={actionLoading}>
              <Play size={16} /> Resume
            </button>
          )}
          {(bot.status === 'CREATED' || bot.status === 'STOPPED') && (
            <button className="action-btn start" onClick={() => handleAction('start')} disabled={actionLoading}>
              <Play size={16} /> {bot.status === 'STOPPED' ? 'Restart' : 'Start'}
            </button>
          )}
          {(bot.status === 'RUNNING' || bot.status === 'PAUSED') && (
            <button className="action-btn stop" onClick={() => handleAction('stop')} disabled={actionLoading}>
              <Square size={16} /> Stop
            </button>
          )}
          <button className="action-btn delete" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="performance-cards">
        <div className="perf-card">
          <div className="perf-icon"><DollarSign size={20} /></div>
          <div className="perf-info">
            <span className="perf-label">Invested</span>
            <span className="perf-value">${Number(bot.investedAmount || 0).toFixed(2)}</span>
          </div>
        </div>
        <div className="perf-card">
          <div className="perf-icon"><Wallet size={20} /></div>
          <div className="perf-info">
            <span className="perf-label">Current Value</span>
            <span className="perf-value">${Number(bot.currentValue || 0).toFixed(2)}</span>
          </div>
        </div>
        <div className="perf-card highlight">
          <div className={`perf-icon ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div className="perf-info">
            <span className="perf-label">Profit/Loss</span>
            <span className={`perf-value ${isPositive ? 'positive' : 'negative'}`}>
              {isPositive ? '+' : ''}${profit.toFixed(2)} ({profitPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="perf-card">
          <div className="perf-icon"><Activity size={20} /></div>
          <div className="perf-info">
            <span className="perf-label">Total Trades</span>
            <span className="perf-value">{bot.totalTrades || 0}</span>
          </div>
        </div>
        <div className="perf-card">
          <div className="perf-icon"><Target size={20} /></div>
          <div className="perf-info">
            <span className="perf-label">Win Rate</span>
            <span className="perf-value">{winRate}%</span>
          </div>
        </div>
      </div>

      {/* Equity Chart */}
      <div className="equity-section">
        <div className="section-header">
          <h2><BarChart3 size={20} /> Equity Curve</h2>
          <div className="timeframe-selector">
            {['24h', '7d', '30d', 'All'].map(tf => (
              <button
                key={tf}
                className={timeframe === tf ? 'active' : ''}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-container">
          {equityData.length > 1 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2938" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#718096' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#718096' }} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#0d1117', border: '1px solid #1d2938', borderRadius: 8 }}
                  labelStyle={{ color: '#e7edf5' }}
                />
                <ReferenceLine y={Number(bot.investedAmount)} stroke="#718096" strokeDasharray="5 5" />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={isPositive ? "#10b981" : "#ef4444"}
                  fill="url(#equityGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">
              <p>Not enough data yet. Snapshots are taken hourly.</p>
            </div>
          )}
        </div>
      </div>

      {/* Strategy Status */}
      {bot.strategyStatus && (
        <div className="strategy-section">
          <h2><Icon size={20} /> Strategy Status</h2>
          <div className="strategy-metrics">
            {Object.entries(bot.strategyStatus.metrics || {}).map(([key, value]) => (
              <div key={key} className="metric-item">
                <span className="metric-label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="metric-value">{typeof value === 'number' ? value.toFixed(4) : String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Grid - Active Coins & Grid Levels */}
      {bot.strategyType === 'DYNAMIC_GRID' && bot.gridData && (
        <div className="grid-levels-section">
          <div className="section-header">
            <h2><Radar size={20} /> Active Coin Grids ({bot.gridData.activeCoins})</h2>
            <div className="grid-summary">
              <span className="buy-count">Buys: {bot.gridData.totalBuys}</span>
              <span className="sell-count">Sells: {bot.gridData.totalSells}</span>
              <span className={`profit ${bot.gridData.realizedProfit >= 0 ? 'positive' : 'negative'}`}>
                Profit: ${bot.gridData.realizedProfit?.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>
          {bot.gridData.coinGrids && bot.gridData.coinGrids.length > 0 ? (
            <div className="coin-grids-table">
              <table>
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>Current Price</th>
                    <th>Grid Range</th>
                    <th>Buys</th>
                    <th>Sells</th>
                    <th>Holdings</th>
                    <th>Avg Buy</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {bot.gridData.coinGrids.map(grid => (
                    <tr key={grid.symbol}>
                      <td className="symbol">{grid.symbol}</td>
                      <td>${grid.currentPrice?.toFixed(4)}</td>
                      <td className="grid-range">
                        ${grid.lowerPrice?.toFixed(4)} - ${grid.upperPrice?.toFixed(4)}
                      </td>
                      <td className="buy">{grid.buyCount}</td>
                      <td className="sell">{grid.sellCount}</td>
                      <td>{grid.holdings?.toFixed(4) || '0'}</td>
                      <td>${grid.avgBuyPrice?.toFixed(4) || '-'}</td>
                      <td className={grid.profit >= 0 ? 'profit positive' : 'profit negative'}>
                        ${grid.profit?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-grids">
              <p>No active coin grids yet. The bot will discover coins within the price range.</p>
            </div>
          )}
        </div>
      )}

      {/* Bot Logs */}
      <div className="logs-section">
        <div className="section-header">
          <h2><Terminal size={20} /> Live Logs</h2>
          <button className="refresh-btn" onClick={() => setLogs([])}>
            Clear
          </button>
        </div>
        <div className="logs-container">
          {logs.length > 0 ? (
            <div className="logs-list">
              {logs.map((log, i) => {
                const msg = log.message?.toLowerCase() || '';
                let tradeClass = '';
                if (msg.includes('buy') && (msg.includes('#') || msg.includes('order'))) tradeClass = 'trade-buy';
                else if (msg.includes('sell') || msg.includes('sold')) tradeClass = 'trade-sell';
                else if (msg.includes('added')) tradeClass = 'trade-added';
                else if (msg.includes('profit target')) tradeClass = 'trade-profit';
                else if (msg.includes('stop loss')) tradeClass = 'trade-stoploss';

                return (
                  <div key={i} className={`log-entry ${log.level} ${tradeClass}`}>
                    <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`log-level ${log.level}`}>{log.level?.toUpperCase()}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          ) : (
            <div className="no-logs">
              <p>No logs yet. Logs will appear here in real-time when the bot is running.</p>
            </div>
          )}
        </div>
      </div>

      {/* Open Orders */}
      {bot.openOrders && bot.openOrders.length > 0 && (
        <div className="orders-section open-orders">
          <div className="section-header">
            <h2><Clock size={20} /> Open Orders ({bot.openOrders.length})</h2>
            <button className="refresh-btn" onClick={() => handleAction('sync')} disabled={actionLoading}>
              <RefreshCw size={16} /> Sync
            </button>
          </div>
          <div className="orders-table-container">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Side</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Filled</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bot.openOrders.map(order => (
                  <tr key={order.id}>
                    <td className="order-id">{order.exchangeOrderId || order.id}</td>
                    <td className={order.side?.toLowerCase()}>{order.side}</td>
                    <td>${Number(order.price || 0).toFixed(6)}</td>
                    <td>{Number(order.quantity || 0).toFixed(4)}</td>
                    <td>{Number(order.filledQuantity || 0).toFixed(4)}</td>
                    <td><span className={`status ${order.status?.toLowerCase()}`}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="orders-section">
        <div className="section-header">
          <h2><Activity size={20} /> Trade History</h2>
          <button className="refresh-btn" onClick={loadOrders}>
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="orders-table-container">
          {orders.length > 0 ? (
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Side</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Fee</th>
                  <th>Profit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 50).map(order => (
                  <tr key={order.id}>
                    <td>{new Date(order.createdAt).toLocaleString()}</td>
                    <td className={order.side?.toLowerCase()}>{order.side}</td>
                    <td>${Number(order.filledPrice || order.price || 0).toFixed(4)}</td>
                    <td>{Number(order.quantity || 0).toFixed(6)}</td>
                    <td>${Number(order.fee || 0).toFixed(4)}</td>
                    <td className={Number(order.profit || 0) >= 0 ? 'positive' : 'negative'}>
                      {order.profit ? `${Number(order.profit) >= 0 ? '+' : ''}$${Number(order.profit).toFixed(4)}` : '-'}
                    </td>
                    <td><span className={`status ${order.status?.toLowerCase()}`}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-orders">
              <p>No trades yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Logs Console */}
      <div className="logs-section">
        <div className="section-header">
          <h2><Terminal size={20} /> Bot Logs</h2>
          <div className="logs-actions">
            <span className="log-count">{logs.length} messages</span>
            <button className="clear-btn" onClick={() => setLogs([])}>Clear</button>
          </div>
        </div>
        <div className="logs-console">
          {logs.length === 0 ? (
            <div className="logs-empty">
              <Terminal size={24} />
              <p>No logs yet. Start the bot to see real-time activity.</p>
            </div>
          ) : (
            <div className="logs-list">
              {logs.map((log, idx) => (
                <div key={idx} className={`log-entry ${log.level || 'info'}`}>
                  <span className="log-time">
                    {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                  <span className={`log-level ${log.level || 'info'}`}>
                    {(log.level || 'INFO').toUpperCase()}
                  </span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <h3><AlertTriangle size={24} /> Delete Bot?</h3>
            <p>This will permanently delete "{bot.name}" and all its history. This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="delete-btn" onClick={handleDelete} disabled={actionLoading}>
                {actionLoading ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                Delete Bot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
