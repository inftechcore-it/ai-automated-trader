import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  RefreshCw, Search, Filter, ChevronDown, ChevronUp, XCircle,
  CheckCircle, Clock, AlertCircle, TrendingUp, TrendingDown,
  Calendar, Download, BarChart3, Activity, Target, ArrowUpRight,
  ArrowDownRight, Eye, X, FileText, DollarSign, Bot, User,
  Layers, ExternalLink, Sparkles, Zap, Shield
} from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Badge from '../components/Badge.jsx';

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [botsList, setBotsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || 'all'); // 'all', 'bot', 'manual'
  const [selectedBotId, setSelectedBotId] = useState(searchParams.get('botId') || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState('all');
  const [exchangeFilter, setExchangeFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState('table');

  // Message
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    loadOrders(true);
  }, [sourceFilter, selectedBotId]);

  async function loadOrders(showInitial = false) {
    if (showInitial) setLoading(true);
    else setRefreshing(true);

    try {
      const queryParams = new URLSearchParams();
      if (sourceFilter && sourceFilter !== 'all') queryParams.append('source', sourceFilter);
      if (selectedBotId && selectedBotId !== 'all') queryParams.append('botId', selectedBotId);
      queryParams.append('limit', '200');

      const response = await api.get(`/api/orders?${queryParams.toString()}`);
      const data = response.data?.orders || response.data?.data?.orders || [];
      const bots = response.data?.botsList || response.data?.data?.botsList || [];

      setBotsList(bots);
      setOrders(data.map(order => ({
        id: order.id,
        symbol: order.symbol,
        exchange: order.exchange || order.exchange_name || 'Binance',
        side: order.side,
        orderType: order.order_type || order.orderType || 'market',
        quantity: Number(order.quantity),
        price: Number(order.price || order.avg_fill_price || 0),
        stopPrice: Number(order.stop_price || 0),
        filledQty: Number(order.filled_quantity || order.quantity || 0),
        avgFillPrice: Number(order.avg_fill_price || order.price || 0),
        status: order.status,
        mode: order.mode,
        createdAt: order.created_at || order.createdAt,
        updatedAt: order.updated_at || order.updatedAt,
        filledAt: order.filled_at || order.filledAt,
        externalOrderId: order.external_order_id || order.id,
        fees: Number(order.fees || 0),
        profit: Number(order.profit || 0),
        gridLevel: order.grid_level,
        botId: order.bot_id,
        botName: order.bot_name,
        botStrategy: order.bot_strategy,
        source: order.source || (order.bot_id ? 'BOT' : 'MANUAL'),
        total: Number(order.quantity) * Number(order.avg_fill_price || order.price || 0)
      })));
    } catch (err) {
      console.error('Failed to load orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function cancelOrder(orderId) {
    try {
      await api.post(`/api/orders/${orderId}/cancel`);
      setMessage({ text: 'Order cancelled successfully', type: 'success' });
      loadOrders(false);
    } catch (err) {
      setMessage({ text: errorMessage(err), type: 'error' });
    }
  }

  // Calculate statistics
  const stats = orders.reduce((acc, order) => {
    acc.total++;
    acc[order.status] = (acc[order.status] || 0) + 1;
    if (order.source === 'BOT') {
      acc.botOrders++;
      acc.botProfit += Number(order.profit || 0);
    } else {
      acc.manualOrders++;
    }
    if (order.status === 'filled') {
      acc.volume += order.total;
      if (order.side === 'buy') {
        acc.buyVolume += order.total;
      } else {
        acc.sellVolume += order.total;
      }
    }
    return acc;
  }, {
    total: 0,
    filled: 0,
    pending: 0,
    cancelled: 0,
    open: 0,
    volume: 0,
    buyVolume: 0,
    sellVolume: 0,
    botOrders: 0,
    manualOrders: 0,
    botProfit: 0
  });

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (sourceFilter !== 'all' && order.source?.toLowerCase() !== sourceFilter.toLowerCase()) return false;
    if (selectedBotId !== 'all' && order.botId !== selectedBotId) return false;
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (sideFilter !== 'all' && order.side !== sideFilter) return false;
    if (exchangeFilter !== 'all' && order.exchange !== exchangeFilter) return false;
    if (modeFilter !== 'all' && order.mode !== modeFilter) return false;
    if (searchQuery && !order.symbol.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(order.botName && order.botName.toLowerCase().includes(searchQuery.toLowerCase()))) return false;

    if (dateRange !== 'all') {
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      const daysDiff = (now - orderDate) / (1000 * 60 * 60 * 24);
      if (dateRange === 'today' && daysDiff > 1) return false;
      if (dateRange === 'week' && daysDiff > 7) return false;
      if (dateRange === 'month' && daysDiff > 30) return false;
    }

    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Get unique exchanges
  const exchanges = [...new Set(orders.map(o => o.exchange))];

  function formatPrice(price, exchange) {
    const symbol = ['NSE', 'BSE'].includes(exchange) ? '₹' : '$';
    if (price >= 1000) return `${symbol}${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `${symbol}${price.toFixed(2)}`;
    return `${symbol}${price.toFixed(6)}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function formatTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'filled': return <CheckCircle size={14} />;
      case 'pending': case 'open': return <Clock size={14} />;
      case 'cancelled': return <XCircle size={14} />;
      case 'rejected': case 'failed': return <AlertCircle size={14} />;
      default: return <Clock size={14} />;
    }
  }

  function getStatusTone(status) {
    switch (status) {
      case 'filled': return 'green';
      case 'pending': case 'open': return 'yellow';
      case 'cancelled': case 'rejected': case 'failed': return 'red';
      default: return 'neutral';
    }
  }

  function exportOrders() {
    const csv = [
      ['Date', 'Time', 'Source', 'Bot Name', 'Strategy', 'Symbol', 'Exchange', 'Side', 'Type', 'Quantity', 'Price', 'Total', 'Profit', 'Status', 'Mode'].join(','),
      ...filteredOrders.map(o => [
        formatDate(o.createdAt),
        formatTime(o.createdAt),
        o.source,
        o.botName || 'Manual',
        o.botStrategy || '-',
        o.symbol,
        o.exchange,
        o.side,
        o.orderType,
        o.quantity,
        o.price,
        o.total.toFixed(2),
        o.profit ? o.profit.toFixed(4) : '0.00',
        o.status,
        o.mode
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${sourceFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  return (
    <div className="orders-page">
      {/* Header */}
      <div className="orders-header">
        <div className="header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={22} className="text-accent" />
            <h2>Order & Trade History</h2>
          </div>
          <Badge>{filteredOrders.length} orders</Badge>
        </div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={() => loadOrders(false)} disabled={loading || refreshing} title="Refresh orders">
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          </button>
          <button className="btn-export" onClick={exportOrders} title="Export CSV">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="orders-stats">
        <div className="stat-card total">
          <div className="stat-icon"><Activity size={20} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Orders</span>
          </div>
        </div>

        <div className="stat-card filled">
          <div className="stat-icon"><CheckCircle size={20} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.filled || 0}</span>
            <span className="stat-label">Filled Trades</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #06b6d4' }}>
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
            <Bot size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value font-mono">{stats.botOrders || 0}</span>
            <span className="stat-label">Bot Executions</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <TrendingUp size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-value font-mono text-positive">
              {stats.botProfit >= 0 ? '+' : ''}${stats.botProfit.toFixed(2)}
            </span>
            <span className="stat-label">Realized Bot P&L</span>
          </div>
        </div>

        <div className="stat-card volume">
          <div className="stat-icon"><DollarSign size={20} /></div>
          <div className="stat-content">
            <span className="stat-value">${stats.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            <span className="stat-label">Total Volume</span>
          </div>
        </div>
      </div>

      {/* Main Filter Bar with Source Selection */}
      <div className="filters-bar" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Order Source Tabs (All / Bot / Manual) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#090d14', padding: '4px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <button
              className={`filter-source-btn ${sourceFilter === 'all' ? 'active' : ''}`}
              onClick={() => { setSourceFilter('all'); setSelectedBotId('all'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: sourceFilter === 'all' ? '#1e293b' : 'transparent',
                color: sourceFilter === 'all' ? '#f8fafc' : '#94a3b8'
              }}
            >
              <Layers size={14} /> All Trades
            </button>

            <button
              className={`filter-source-btn ${sourceFilter === 'bot' ? 'active' : ''}`}
              onClick={() => setSourceFilter('bot')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: sourceFilter === 'bot' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                color: sourceFilter === 'bot' ? '#38bdf8' : '#94a3b8'
              }}
            >
              <Bot size={14} /> Bot Trades
              <span style={{ fontSize: '10px', background: '#0f172a', padding: '1px 6px', borderRadius: '10px', color: '#06b6d4' }}>
                {stats.botOrders || 0}
              </span>
            </button>

            <button
              className={`filter-source-btn ${sourceFilter === 'manual' ? 'active' : ''}`}
              onClick={() => { setSourceFilter('manual'); setSelectedBotId('all'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: sourceFilter === 'manual' ? '#1e293b' : 'transparent',
                color: sourceFilter === 'manual' ? '#f8fafc' : '#94a3b8'
              }}
            >
              <User size={14} /> Manual Trades
              <span style={{ fontSize: '10px', background: '#0f172a', padding: '1px 6px', borderRadius: '10px', color: '#94a3b8' }}>
                {stats.manualOrders || 0}
              </span>
            </button>
          </div>

          {/* Bot Dropdown Selector (Active when source is bot or all) */}
          {(sourceFilter === 'bot' || sourceFilter === 'all') && botsList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Filter by Bot:</span>
              <select
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <option value="all">🤖 All Bots ({botsList.length})</option>
                {botsList.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.strategyType} · {b.symbol})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="search-box" style={{ flex: '1 1 200px', maxWidth: '300px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Search symbol or bot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Status Tabs and View Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div className="filter-tabs">
            {['all', 'filled', 'pending', 'cancelled'].map(status => (
              <button
                key={status}
                className={statusFilter === status ? 'active' : ''}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && (
                  <span className="count">
                    {status === 'pending' ? (stats.pending || 0) + (stats.open || 0) : stats[status] || 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`btn-filters ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={14} /> More Filters
              {(sideFilter !== 'all' || exchangeFilter !== 'all' || modeFilter !== 'all' || dateRange !== 'all') && (
                <span className="filter-badge" />
              )}
            </button>

            <div className="view-toggle">
              <button
                className={viewMode === 'table' ? 'active' : ''}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <BarChart3 size={14} />
              </button>
              <button
                className={viewMode === 'cards' ? 'active' : ''}
                onClick={() => setViewMode('cards')}
                title="Card View"
              >
                <Target size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Extended Filters */}
      {showFilters && (
        <div className="extended-filters">
          <div className="filter-group">
            <label>Side</label>
            <select value={sideFilter} onChange={(e) => setSideFilter(e.target.value)}>
              <option value="all">All Sides</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Exchange</label>
            <select value={exchangeFilter} onChange={(e) => setExchangeFilter(e.target.value)}>
              <option value="all">All Exchanges</option>
              {exchanges.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Mode</label>
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
              <option value="all">All Modes</option>
              <option value="paper">Paper</option>
              <option value="live">Live</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Date Range</label>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
          <button
            className="btn-clear-filters"
            onClick={() => {
              setSideFilter('all');
              setExchangeFilter('all');
              setModeFilter('all');
              setDateRange('all');
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Message */}
      {message.text && (
        <div className={`orders-message ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ text: '', type: '' })}><X size={14} /></button>
        </div>
      )}

      {/* Orders Content */}
      {loading ? (
        <div className="orders-loading">
          <RefreshCw size={32} className="spin" />
          <p>Loading order history...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty">
          <FileText size={48} />
          <h3>No Orders Found</h3>
          <p>
            {sourceFilter === 'bot'
              ? 'No bot trades found for the selected filter. Start a bot to generate automated trades.'
              : (searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Place an order or start a bot to see trades here')}
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <Link to="/bots" className="btn-trade">
              <Bot size={16} /> View Trading Bots
            </Link>
            <Link to="/trading" className="btn-trade" style={{ background: '#1e293b' }}>
              <TrendingUp size={16} /> Manual Trade
            </Link>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Source / Bot</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Fill Price</th>
                <th>Total Value</th>
                <th>Realized P&L</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <>
                  <tr
                    key={order.id}
                    className={`order-row ${expandedOrder === order.id ? 'expanded' : ''}`}
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <td>
                      <div className="date-cell">
                        <span className="date">{formatDate(order.createdAt)}</span>
                        <span className="time">{formatTime(order.createdAt)}</span>
                      </div>
                    </td>
                    <td>
                      {order.source === 'BOT' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <Link
                            to={`/bots/${order.botId}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#38bdf8',
                              fontWeight: 600,
                              fontSize: '12px',
                              textDecoration: 'none'
                            }}
                            className="link-hover"
                            title="View Bot Details"
                          >
                            <Bot size={13} style={{ color: '#06b6d4' }} />
                            <span>{order.botName || 'Bot'}</span>
                          </Link>
                          {order.botStrategy && (
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                              {order.botStrategy.replace('_', ' ')}
                              {order.gridLevel !== null && order.gridLevel !== undefined && ` · Grid #${order.gridLevel}`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8' }}>
                          <User size={13} /> Manual
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="symbol-cell">
                        <span className="symbol">{order.symbol}</span>
                        <span className="exchange">{order.exchange}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`side-badge ${order.side}`}>
                        {order.side === 'buy' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {order.side.toUpperCase()}
                      </span>
                    </td>
                    <td><span className="type-badge">{order.orderType}</span></td>
                    <td className="qty-cell font-mono">
                      {order.quantity > 1 ? order.quantity.toFixed(4) : order.quantity.toFixed(6)}
                    </td>
                    <td className="price-cell">{formatPrice(order.avgFillPrice || order.price, order.exchange)}</td>
                    <td className="total-cell font-mono">{formatPrice(order.total, order.exchange)}</td>
                    <td>
                      {order.profit !== 0 ? (
                        <span className={`font-mono font-semibold ${order.profit > 0 ? 'text-positive' : 'text-negative'}`} style={{ fontSize: '12px' }}>
                          {order.profit > 0 ? '+' : ''}${order.profit.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={getStatusTone(order.status)} small>
                        {getStatusIcon(order.status)} {order.status}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={order.mode === 'live' ? 'green' : 'yellow'} small>
                        {order.mode}
                      </Badge>
                    </td>
                    <td className="actions-cell">
                      {(order.status === 'pending' || order.status === 'open') && (
                        <button
                          className="btn-cancel"
                          onClick={(e) => { e.stopPropagation(); cancelOrder(order.id); }}
                          title="Cancel Order"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                      <button className="btn-expand">
                        {expandedOrder === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {expandedOrder === order.id && (
                    <tr className="order-details-row">
                      <td colSpan={12}>
                        <div className="order-details">
                          <div className="details-grid">
                            <div className="detail-item">
                              <span className="detail-label">Order ID</span>
                              <span className="detail-value">#{order.id}</span>
                            </div>
                            {order.externalOrderId && (
                              <div className="detail-item">
                                <span className="detail-label">External Exchange ID</span>
                                <span className="detail-value">{order.externalOrderId}</span>
                              </div>
                            )}
                            {order.botName && (
                              <div className="detail-item">
                                <span className="detail-label">Origin Bot</span>
                                <span className="detail-value" style={{ color: '#38bdf8' }}>
                                  {order.botName} ({order.botStrategy})
                                </span>
                              </div>
                            )}
                            <div className="detail-item">
                              <span className="detail-label">Avg Fill Price</span>
                              <span className="detail-value">{formatPrice(order.avgFillPrice, order.exchange)}</span>
                            </div>
                            {order.profit !== 0 && (
                              <div className="detail-item">
                                <span className="detail-label">Roundtrip Realized Profit</span>
                                <span className="detail-value text-positive">
                                  +${order.profit.toFixed(4)}
                                </span>
                              </div>
                            )}
                            {order.fees > 0 && (
                              <div className="detail-item">
                                <span className="detail-label">Fees</span>
                                <span className="detail-value">{formatPrice(order.fees, order.exchange)}</span>
                              </div>
                            )}
                            <div className="detail-item">
                              <span className="detail-label">Execution Time</span>
                              <span className="detail-value">{formatDateTime(order.filledAt || order.createdAt)}</span>
                            </div>
                          </div>
                          <div className="details-actions">
                            {order.botId ? (
                              <Link
                                to={`/bots/${order.botId}`}
                                className="btn-trade-again"
                              >
                                <Bot size={14} /> View Bot Analytics
                              </Link>
                            ) : (
                              <Link
                                to={`/trading?symbol=${order.symbol}&exchange=${order.exchange}`}
                                className="btn-trade-again"
                              >
                                <TrendingUp size={14} /> Trade {order.symbol}
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="orders-cards">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className={`order-card ${order.side} ${expandedOrder === order.id ? 'expanded' : ''}`}
            >
              <div className="card-header" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                <div className="card-symbol">
                  <span className={`side-indicator ${order.side}`}>
                    {order.side === 'buy' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </span>
                  <div className="symbol-info">
                    <span className="symbol">{order.symbol}</span>
                    <span className="exchange">{order.exchange}</span>
                    {order.botName && (
                      <span style={{ fontSize: '10px', color: '#06b6d4', fontWeight: 600 }}>
                        🤖 {order.botName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="card-status">
                  {order.profit !== 0 && (
                    <span className="profit-badge positive" style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                      +${order.profit.toFixed(2)}
                    </span>
                  )}
                  <Badge tone={getStatusTone(order.status)} small>
                    {getStatusIcon(order.status)} {order.status}
                  </Badge>
                  <Badge tone={order.mode === 'live' ? 'green' : 'yellow'} small>
                    {order.mode}
                  </Badge>
                </div>
              </div>

              <div className="card-body">
                <div className="card-row">
                  <div className="card-item">
                    <span className="label">Quantity</span>
                    <span className="value">{order.quantity}</span>
                  </div>
                  <div className="card-item">
                    <span className="label">Price</span>
                    <span className="value">{formatPrice(order.price, order.exchange)}</span>
                  </div>
                  <div className="card-item">
                    <span className="label">Total</span>
                    <span className="value total">{formatPrice(order.total, order.exchange)}</span>
                  </div>
                </div>
                <div className="card-meta">
                  <span className="type">{order.source === 'BOT' ? `🤖 ${order.botStrategy || 'Bot'}` : `👤 ${order.orderType}`}</span>
                  <span className="time">{formatDateTime(order.createdAt)}</span>
                </div>
              </div>

              {expandedOrder === order.id && (
                <div className="card-details">
                  <div className="details-row">
                    <span className="label">Order ID</span>
                    <span className="value">#{order.id}</span>
                  </div>
                  {order.botName && (
                    <div className="details-row">
                      <span className="label">Bot</span>
                      <span className="value">{order.botName}</span>
                    </div>
                  )}
                  <div className="details-row">
                    <span className="label">Avg Fill Price</span>
                    <span className="value">{formatPrice(order.avgFillPrice, order.exchange)}</span>
                  </div>
                  {order.profit !== 0 && (
                    <div className="details-row">
                      <span className="label">Realized Profit</span>
                      <span className="value text-positive">+${order.profit.toFixed(4)}</span>
                    </div>
                  )}
                  <div className="card-actions">
                    {order.botId ? (
                      <Link to={`/bots/${order.botId}`} className="btn-trade-link">
                        <Bot size={14} /> Open Bot Details
                      </Link>
                    ) : (
                      <Link to={`/trading?symbol=${order.symbol}&exchange=${order.exchange}`} className="btn-trade-link">
                        <TrendingUp size={14} /> Trade Again
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <button
                className="expand-toggle"
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              >
                {expandedOrder === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats Footer */}
      {filteredOrders.length > 0 && (
        <div className="orders-footer">
          <div className="footer-stat">
            <span className="label">Showing</span>
            <span className="value">{filteredOrders.length} of {orders.length} orders</span>
          </div>
          <div className="footer-stat">
            <span className="label">Filtered Volume</span>
            <span className="value">
              ${filteredOrders.filter(o => o.status === 'filled').reduce((sum, o) => sum + o.total, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
