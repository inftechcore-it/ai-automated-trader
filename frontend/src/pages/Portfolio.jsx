import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, RefreshCw, ChevronDown, ChevronUp,
  PieChart as PieChartIcon, BarChart3, ArrowUpRight, ArrowDownRight,
  Filter, Search, Plus, Minus, Eye, EyeOff, Wallet, Target,
  Calendar, Clock, IndianRupee, DollarSign
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';
import { api } from '../api.js';
import Badge from '../components/Badge.jsx';

export default function Portfolio() {
  const [mode, setMode] = useState('paper');
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedStock, setExpandedStock] = useState(null);
  const [sortBy, setSortBy] = useState('value');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterExchange, setFilterExchange] = useState('all');
  const [hideSmall, setHideSmall] = useState(false);
  const [viewMode, setViewMode] = useState('cards');

  useEffect(() => {
    loadPortfolio();
  }, [mode]);

  async function loadPortfolio() {
    setLoading(true);
    try {
      const response = await api.get(`/api/portfolio/${mode}`);
      const data = response.data.holdings || [];
      setHoldings(data.map(h => ({
        id: h.id,
        symbol: h.symbol,
        name: h.name || h.symbol,
        exchange: h.exchange || 'NSE',
        quantity: Number(h.quantity),
        avgPrice: Number(h.average_buy_price),
        currentPrice: Number(h.current_price),
        previousClose: Number(h.previous_close || h.current_price),
        investedValue: Number(h.quantity) * Number(h.average_buy_price),
        currentValue: Number(h.quantity) * Number(h.current_price),
        pnl: (Number(h.current_price) - Number(h.average_buy_price)) * Number(h.quantity),
        pnlPercent: ((Number(h.current_price) - Number(h.average_buy_price)) / Number(h.average_buy_price)) * 100,
        dayChange: Number(h.current_price) - Number(h.previous_close || h.current_price),
        dayChangePercent: ((Number(h.current_price) - Number(h.previous_close || h.current_price)) / Number(h.previous_close || h.current_price)) * 100,
        sector: h.sector || 'Others',
        sparkline: h.sparkline || generateSparkline(),
        mode: h.mode
      })));
    } catch (err) {
      console.error('Failed to load portfolio:', err);
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }

  function generateSparkline() {
    const base = 100 + Math.random() * 50;
    return Array.from({ length: 20 }, (_, i) => ({
      value: base + (Math.random() - 0.5) * 10 + (i * 0.5)
    }));
  }

  // Calculate portfolio summary
  const summary = holdings.reduce((acc, h) => ({
    totalInvested: acc.totalInvested + h.investedValue,
    currentValue: acc.currentValue + h.currentValue,
    totalPnl: acc.totalPnl + h.pnl,
    dayPnl: acc.dayPnl + (h.dayChange * h.quantity),
    holdings: acc.holdings + 1
  }), { totalInvested: 0, currentValue: 0, totalPnl: 0, dayPnl: 0, holdings: 0 });

  summary.pnlPercent = summary.totalInvested > 0
    ? (summary.totalPnl / summary.totalInvested) * 100
    : 0;
  summary.dayPnlPercent = summary.currentValue > 0
    ? (summary.dayPnl / (summary.currentValue - summary.dayPnl)) * 100
    : 0;

  // Filter and sort holdings
  let filteredHoldings = holdings
    .filter(h => {
      if (searchQuery && !h.symbol.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !h.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterExchange !== 'all' && h.exchange !== filterExchange) return false;
      if (hideSmall && h.currentValue < 100) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'value': cmp = a.currentValue - b.currentValue; break;
        case 'pnl': cmp = a.pnl - b.pnl; break;
        case 'pnlPercent': cmp = a.pnlPercent - b.pnlPercent; break;
        case 'dayChange': cmp = a.dayChangePercent - b.dayChangePercent; break;
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        default: cmp = a.currentValue - b.currentValue;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

  // Sector allocation data
  const sectorData = holdings.reduce((acc, h) => {
    const existing = acc.find(s => s.name === h.sector);
    if (existing) {
      existing.value += h.currentValue;
    } else {
      acc.push({ name: h.sector, value: h.currentValue });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  // Top gainers and losers
  const topGainers = [...holdings].sort((a, b) => b.pnlPercent - a.pnlPercent).slice(0, 3);
  const topLosers = [...holdings].sort((a, b) => a.pnlPercent - b.pnlPercent).slice(0, 3);

  const COLORS = ['#00b4d8', '#00ff88', '#ffcc00', '#ff6b6b', '#c084fc', '#f472b6', '#38bdf8', '#a3e635'];

  function formatCurrency(val, exchange = 'NSE') {
    const isINR = ['NSE', 'BSE'].includes(exchange);
    const symbol = isINR ? '₹' : '$';
    if (Math.abs(val) >= 10000000) return `${symbol}${(val / 10000000).toFixed(2)}Cr`;
    if (Math.abs(val) >= 100000) return `${symbol}${(val / 100000).toFixed(2)}L`;
    if (Math.abs(val) >= 1000) return `${symbol}${(val / 1000).toFixed(2)}K`;
    return `${symbol}${val.toFixed(2)}`;
  }

  function formatNumber(val) {
    return val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  function handleSort(column) {
    if (sortBy === column) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  }

  function MiniSparkline({ data, positive }) {
    if (!data || data.length < 2) return null;
    return (
      <div className="mini-sparkline">
        <ResponsiveContainer width={60} height={24}>
          <AreaChart data={data}>
            <Area
              type="monotone"
              dataKey="value"
              stroke={positive ? '#00ff88' : '#ff4757'}
              fill={positive ? 'rgba(0,255,136,0.2)' : 'rgba(255,71,87,0.2)'}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="portfolio-page">
      {/* Header */}
      <div className="portfolio-header">
        <div className="portfolio-mode-switch">
          <button className={mode === 'paper' ? 'active' : ''} onClick={() => setMode('paper')}>
            Paper Portfolio
          </button>
          <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}>
            Live Portfolio
          </button>
        </div>
        <button className="btn-refresh" onClick={loadPortfolio} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="portfolio-summary">
        <div className="summary-card main">
          <div className="summary-label">
            <Wallet size={16} />
            Current Value
          </div>
          <div className="summary-value large">
            {formatCurrency(summary.currentValue)}
          </div>
          <div className="summary-meta">
            Invested: {formatCurrency(summary.totalInvested)}
          </div>
        </div>

        <div className={`summary-card ${summary.totalPnl >= 0 ? 'positive' : 'negative'}`}>
          <div className="summary-label">
            {summary.totalPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            Total P&L
          </div>
          <div className="summary-value">
            {summary.totalPnl >= 0 ? '+' : ''}{formatCurrency(summary.totalPnl)}
          </div>
          <div className="summary-percent">
            {summary.pnlPercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {summary.pnlPercent >= 0 ? '+' : ''}{summary.pnlPercent.toFixed(2)}%
          </div>
        </div>

        <div className={`summary-card ${summary.dayPnl >= 0 ? 'positive' : 'negative'}`}>
          <div className="summary-label">
            <Calendar size={16} />
            Today's P&L
          </div>
          <div className="summary-value">
            {summary.dayPnl >= 0 ? '+' : ''}{formatCurrency(summary.dayPnl)}
          </div>
          <div className="summary-percent">
            {summary.dayPnlPercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {summary.dayPnlPercent >= 0 ? '+' : ''}{summary.dayPnlPercent.toFixed(2)}%
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-label">
            <BarChart3 size={16} />
            Holdings
          </div>
          <div className="summary-value">{summary.holdings}</div>
          <div className="summary-meta">Stocks in portfolio</div>
        </div>
      </div>

      {/* Analytics Row */}
      <div className="portfolio-analytics">
        {/* Sector Allocation */}
        <div className="analytics-card">
          <h3><PieChartIcon size={16} /> Sector Allocation</h3>
          {sectorData.length > 0 ? (
            <div className="sector-chart">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={sectorData}
                    dataKey="value"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                  >
                    {sectorData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatCurrency(val)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="sector-legend">
                {sectorData.slice(0, 5).map((s, i) => (
                  <div key={s.name} className="legend-item">
                    <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="legend-name">{s.name}</span>
                    <span className="legend-value">{((s.value / summary.currentValue) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">No holdings to analyze</div>
          )}
        </div>

        {/* Top Gainers */}
        <div className="analytics-card">
          <h3><TrendingUp size={16} /> Top Gainers</h3>
          <div className="top-movers">
            {topGainers.length > 0 ? topGainers.map(h => (
              <div key={h.symbol} className="mover-item gain">
                <div className="mover-symbol">{h.symbol}</div>
                <div className="mover-change">+{h.pnlPercent.toFixed(2)}%</div>
              </div>
            )) : <div className="empty-state">No gainers</div>}
          </div>
        </div>

        {/* Top Losers */}
        <div className="analytics-card">
          <h3><TrendingDown size={16} /> Top Losers</h3>
          <div className="top-movers">
            {topLosers.filter(h => h.pnl < 0).length > 0 ?
              topLosers.filter(h => h.pnl < 0).map(h => (
                <div key={h.symbol} className="mover-item loss">
                  <div className="mover-symbol">{h.symbol}</div>
                  <div className="mover-change">{h.pnlPercent.toFixed(2)}%</div>
                </div>
              )) : <div className="empty-state">No losers</div>}
          </div>
        </div>
      </div>

      {/* Holdings Section */}
      <div className="holdings-section">
        <div className="holdings-header">
          <h2>Holdings ({filteredHoldings.length})</h2>

          <div className="holdings-controls">
            <div className="search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              className={`btn-filter ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={14} />
            </button>

            <div className="view-toggle">
              <button
                className={viewMode === 'cards' ? 'active' : ''}
                onClick={() => setViewMode('cards')}
                title="Card View"
              >
                <BarChart3 size={14} />
              </button>
              <button
                className={viewMode === 'table' ? 'active' : ''}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <Target size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="holdings-filters">
            <div className="filter-group">
              <label>Exchange</label>
              <select value={filterExchange} onChange={(e) => setFilterExchange(e.target.value)}>
                <option value="all">All Exchanges</option>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
                <option value="NASDAQ">NASDAQ</option>
                <option value="NYSE">NYSE</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Sort By</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="value">Current Value</option>
                <option value="pnl">P&L Amount</option>
                <option value="pnlPercent">P&L %</option>
                <option value="dayChange">Day Change</option>
                <option value="symbol">Symbol</option>
              </select>
            </div>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={hideSmall}
                onChange={(e) => setHideSmall(e.target.checked)}
              />
              Hide small holdings (&lt;$100)
            </label>
          </div>
        )}

        {/* Holdings Content */}
        {loading ? (
          <div className="holdings-loading">
            <RefreshCw size={32} className="spin" />
            <p>Loading portfolio...</p>
          </div>
        ) : filteredHoldings.length === 0 ? (
          <div className="holdings-empty">
            <Wallet size={48} />
            <h3>No Holdings Found</h3>
            <p>{mode === 'paper' ? 'Start paper trading to build your portfolio' : 'Connect your broker and sync holdings'}</p>
            <Link to="/trading" className="btn-primary">Start Trading</Link>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="holdings-cards">
            {filteredHoldings.map(holding => (
              <div
                key={holding.id || holding.symbol}
                className={`holding-card ${expandedStock === holding.symbol ? 'expanded' : ''}`}
              >
                <div className="holding-card-main" onClick={() => setExpandedStock(expandedStock === holding.symbol ? null : holding.symbol)}>
                  <div className="holding-info">
                    <div className="holding-symbol">
                      <span className="symbol">{holding.symbol}</span>
                      <span className="exchange">{holding.exchange}</span>
                    </div>
                    <div className="holding-name">{holding.name}</div>
                    <div className="holding-qty">{holding.quantity} shares @ {formatCurrency(holding.avgPrice, holding.exchange)}</div>
                  </div>

                  <div className="holding-chart">
                    <MiniSparkline data={holding.sparkline} positive={holding.pnl >= 0} />
                  </div>

                  <div className="holding-values">
                    <div className="current-value">
                      <span className="label">Current</span>
                      <span className="value">{formatCurrency(holding.currentValue, holding.exchange)}</span>
                    </div>
                    <div className={`pnl ${holding.pnl >= 0 ? 'gain' : 'loss'}`}>
                      <span className="pnl-amount">
                        {holding.pnl >= 0 ? '+' : ''}{formatCurrency(holding.pnl, holding.exchange)}
                      </span>
                      <span className="pnl-percent">
                        {holding.pnlPercent >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {holding.pnlPercent >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className={`holding-day-change ${holding.dayChange >= 0 ? 'gain' : 'loss'}`}>
                    <span className="day-label">Today</span>
                    <span className="day-value">
                      {holding.dayChangePercent >= 0 ? '+' : ''}{holding.dayChangePercent.toFixed(2)}%
                    </span>
                  </div>

                  <button className="expand-btn">
                    {expandedStock === holding.symbol ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {expandedStock === holding.symbol && (
                  <div className="holding-card-details">
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Avg Buy Price</span>
                        <span className="detail-value">{formatCurrency(holding.avgPrice, holding.exchange)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Current Price</span>
                        <span className="detail-value">{formatCurrency(holding.currentPrice, holding.exchange)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Invested Value</span>
                        <span className="detail-value">{formatCurrency(holding.investedValue, holding.exchange)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Current Value</span>
                        <span className="detail-value">{formatCurrency(holding.currentValue, holding.exchange)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Day High/Low</span>
                        <span className="detail-value">-</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">52W High/Low</span>
                        <span className="detail-value">-</span>
                      </div>
                    </div>
                    <div className="detail-actions">
                      <Link to={`/trading?symbol=${holding.symbol}&exchange=${holding.exchange}`} className="btn-action buy">
                        <Plus size={14} /> Buy More
                      </Link>
                      <Link to={`/trading?symbol=${holding.symbol}&exchange=${holding.exchange}&side=sell`} className="btn-action sell">
                        <Minus size={14} /> Sell
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="holdings-table-wrapper">
            <table className="holdings-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('symbol')} className="sortable">
                    Stock {sortBy === 'symbol' && (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                  </th>
                  <th>Qty</th>
                  <th>Avg Price</th>
                  <th>LTP</th>
                  <th onClick={() => handleSort('value')} className="sortable">
                    Current Value {sortBy === 'value' && (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                  </th>
                  <th onClick={() => handleSort('pnl')} className="sortable">
                    P&L {sortBy === 'pnl' && (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                  </th>
                  <th onClick={() => handleSort('dayChange')} className="sortable">
                    Day Chg {sortBy === 'dayChange' && (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.map(h => (
                  <tr key={h.id || h.symbol}>
                    <td>
                      <div className="stock-cell">
                        <span className="symbol">{h.symbol}</span>
                        <span className="exchange">{h.exchange}</span>
                      </div>
                    </td>
                    <td>{h.quantity}</td>
                    <td>{formatCurrency(h.avgPrice, h.exchange)}</td>
                    <td>{formatCurrency(h.currentPrice, h.exchange)}</td>
                    <td>{formatCurrency(h.currentValue, h.exchange)}</td>
                    <td className={h.pnl >= 0 ? 'gain' : 'loss'}>
                      <div className="pnl-cell">
                        <span>{h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl, h.exchange)}</span>
                        <span className="pnl-percent">({h.pnlPercent >= 0 ? '+' : ''}{h.pnlPercent.toFixed(2)}%)</span>
                      </div>
                    </td>
                    <td className={h.dayChange >= 0 ? 'gain' : 'loss'}>
                      {h.dayChangePercent >= 0 ? '+' : ''}{h.dayChangePercent.toFixed(2)}%
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/trading?symbol=${h.symbol}&exchange=${h.exchange}`} className="btn-sm buy">Buy</Link>
                        <Link to={`/trading?symbol=${h.symbol}&exchange=${h.exchange}&side=sell`} className="btn-sm sell">Sell</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
