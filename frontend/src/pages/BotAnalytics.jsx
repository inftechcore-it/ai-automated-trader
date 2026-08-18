import { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Bot, Activity, DollarSign,
  Sparkles, Target, Clock, RefreshCw, PieChart
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RechartsPie, Pie, Cell, Legend
} from 'recharts';

const api = (path, opts = {}) =>
  fetch(`${import.meta.env.VITE_API || 'http://localhost:5000'}/api${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    ...opts
  }).then(r => r.json());

const STRATEGY_COLORS = {
  GRID: '#3b82f6',
  INFINITY_GRID: '#8b5cf6',
  DCA: '#10b981',
  SMART_TRADE: '#f59e0b',
  TRAILING: '#ec4899',
  MARTINGALE: '#ef4444',
  REBALANCING: '#06b6d4',
  ARBITRAGE: '#6366f1',
};

export default function BotAnalytics() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const res = await api('/bots');
      if (res.success) {
        setBots(res.bots || []);
      }
    } catch (e) {
      console.error('Failed to load bots:', e);
    } finally {
      setLoading(false);
    }
  };

  // Calculate analytics
  const totalBots = bots.length;
  const activeBots = bots.filter(b => b.status === 'RUNNING').length;
  const pausedBots = bots.filter(b => b.status === 'PAUSED').length;
  const stoppedBots = bots.filter(b => b.status === 'STOPPED' || b.status === 'CREATED').length;

  const totalInvested = bots.reduce((sum, b) => sum + Number(b.investedAmount || 0), 0);
  const totalProfit = bots.reduce((sum, b) => sum + Number(b.totalProfit || 0), 0);
  const totalTrades = bots.reduce((sum, b) => sum + (b.totalTrades || 0), 0);

  const bestBot = bots.reduce((best, b) =>
    Number(b.totalProfit || 0) > Number(best?.totalProfit || 0) ? b : best
  , null);

  const worstBot = bots.reduce((worst, b) =>
    Number(b.totalProfit || 0) < Number(worst?.totalProfit || -Infinity) ? b : worst
  , null);

  // Strategy breakdown
  const strategyStats = {};
  bots.forEach(b => {
    const type = b.strategyType;
    if (!strategyStats[type]) {
      strategyStats[type] = {
        type,
        count: 0,
        totalProfit: 0,
        totalTrades: 0,
        invested: 0,
        runtime: 0,
      };
    }
    strategyStats[type].count++;
    strategyStats[type].totalProfit += Number(b.totalProfit || 0);
    strategyStats[type].totalTrades += b.totalTrades || 0;
    strategyStats[type].invested += Number(b.investedAmount || 0);
    if (b.startedAt) {
      strategyStats[type].runtime += Date.now() - new Date(b.startedAt).getTime();
    }
  });

  const strategyData = Object.values(strategyStats).map(s => ({
    name: s.type.replace('_', ' '),
    profit: s.totalProfit,
    trades: s.totalTrades,
    bots: s.count,
    avgProfit: s.count > 0 ? s.totalProfit / s.count : 0,
    winRate: s.totalTrades > 0 ? Math.random() * 30 + 50 : 0, // Placeholder - would calculate from orders
    color: STRATEGY_COLORS[s.type] || '#718096',
  }));

  const pieData = strategyData.map(s => ({
    name: s.name,
    value: Math.abs(s.profit),
    color: s.color,
  }));

  // Status pie data
  const statusData = [
    { name: 'Running', value: activeBots, color: '#10b981' },
    { name: 'Paused', value: pausedBots, color: '#f59e0b' },
    { name: 'Stopped', value: stoppedBots, color: '#718096' },
  ].filter(d => d.value > 0);

  return (
    <div className="bot-analytics-page">
      <div className="analytics-header">
        <div className="header-left">
          <h1><BarChart3 size={28} /> Bot Analytics</h1>
          <p>Performance insights across all your trading bots</p>
        </div>
        <button className="refresh-btn" onClick={loadBots}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon"><Bot size={24} /></div>
          <div className="card-content">
            <span className="card-value">{totalBots}</span>
            <span className="card-label">Total Bots</span>
            <span className="card-detail">{activeBots} active / {pausedBots} paused</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon"><DollarSign size={24} /></div>
          <div className="card-content">
            <span className="card-value">${totalInvested.toFixed(2)}</span>
            <span className="card-label">Total Invested</span>
          </div>
        </div>
        <div className="summary-card highlight">
          <div className={`card-icon ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
            {totalProfit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
          <div className="card-content">
            <span className={`card-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
              {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
            </span>
            <span className="card-label">Total Profit</span>
            <span className="card-detail">
              {totalInvested > 0 ? `${((totalProfit / totalInvested) * 100).toFixed(2)}% ROI` : '-'}
            </span>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon"><Activity size={24} /></div>
          <div className="card-content">
            <span className="card-value">{totalTrades}</span>
            <span className="card-label">Total Trades</span>
          </div>
        </div>
        {bestBot && (
          <div className="summary-card best">
            <div className="card-icon"><Sparkles size={24} /></div>
            <div className="card-content">
              <span className="card-value">{bestBot.name}</span>
              <span className="card-label">Best Performer</span>
              <span className="card-detail positive">+${Number(bestBot.totalProfit || 0).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Profit by Strategy */}
        <div className="chart-card">
          <h3><BarChart3 size={18} /> Profit by Strategy</h3>
          <div className="chart-container">
            {strategyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={strategyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2938" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#718096' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#718096' }} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1d2938', borderRadius: 8 }}
                    formatter={(value) => [`$${value.toFixed(2)}`, 'Profit']}
                  />
                  <Bar dataKey="profit" fill="#3b82f6">
                    {strategyData.map((entry, index) => (
                      <Cell key={index} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-data">No data available</div>
            )}
          </div>
        </div>

        {/* Bot Status Distribution */}
        <div className="chart-card">
          <h3><PieChart size={18} /> Bot Status</h3>
          <div className="chart-container pie-chart">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend formatter={(value) => <span style={{ color: '#e7edf5' }}>{value}</span>} />
                  <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1d2938', borderRadius: 8 }} />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="no-data">No bots</div>
            )}
          </div>
        </div>
      </div>

      {/* Strategy Comparison Table */}
      <div className="comparison-section">
        <h3><Target size={18} /> Strategy Comparison</h3>
        <div className="table-container">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Bots</th>
                <th>Total Profit</th>
                <th>Avg Profit/Bot</th>
                <th>Total Trades</th>
                <th>Avg Trades/Day</th>
              </tr>
            </thead>
            <tbody>
              {strategyData.length > 0 ? (
                strategyData
                  .sort((a, b) => b.profit - a.profit)
                  .map(strategy => (
                    <tr key={strategy.name}>
                      <td>
                        <span className="strategy-dot" style={{ background: strategy.color }} />
                        {strategy.name}
                      </td>
                      <td>{strategy.bots}</td>
                      <td className={strategy.profit >= 0 ? 'positive' : 'negative'}>
                        {strategy.profit >= 0 ? '+' : ''}${strategy.profit.toFixed(2)}
                      </td>
                      <td className={strategy.avgProfit >= 0 ? 'positive' : 'negative'}>
                        {strategy.avgProfit >= 0 ? '+' : ''}${strategy.avgProfit.toFixed(2)}
                      </td>
                      <td>{strategy.trades}</td>
                      <td>{strategy.trades > 0 ? (strategy.trades / 30).toFixed(1) : '-'}</td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={6} className="no-data">No strategy data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top & Bottom Performers */}
      <div className="performers-row">
        <div className="performers-card top">
          <h3><TrendingUp size={18} /> Top Performers</h3>
          <div className="performers-list">
            {bots
              .sort((a, b) => Number(b.totalProfit || 0) - Number(a.totalProfit || 0))
              .slice(0, 5)
              .map(bot => (
                <div key={bot.id} className="performer-item">
                  <span className="performer-name">{bot.name}</span>
                  <span className="performer-strategy">{bot.strategyType.replace('_', ' ')}</span>
                  <span className="performer-profit positive">
                    +${Number(bot.totalProfit || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            {bots.length === 0 && <div className="no-data">No bots yet</div>}
          </div>
        </div>

        <div className="performers-card bottom">
          <h3><TrendingDown size={18} /> Underperformers</h3>
          <div className="performers-list">
            {bots
              .filter(b => Number(b.totalProfit || 0) < 0)
              .sort((a, b) => Number(a.totalProfit || 0) - Number(b.totalProfit || 0))
              .slice(0, 5)
              .map(bot => (
                <div key={bot.id} className="performer-item">
                  <span className="performer-name">{bot.name}</span>
                  <span className="performer-strategy">{bot.strategyType.replace('_', ' ')}</span>
                  <span className="performer-profit negative">
                    ${Number(bot.totalProfit || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            {bots.filter(b => Number(b.totalProfit || 0) < 0).length === 0 && (
              <div className="no-data">No underperforming bots</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
