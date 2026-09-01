import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, Search, Filter, ChevronDown, ChevronUp, XCircle,
  CheckCircle, Clock, AlertCircle, TrendingUp, TrendingDown,
  Calendar, Download, BarChart3, Activity, Target, ArrowUpRight,
  ArrowDownRight, Eye, X, FileText, DollarSign
} from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Badge from '../components/Badge.jsx';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);

  // Filters
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
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const response = await api.get('/api/orders');
      const data = response.data.orders || [];
      setOrders(data.map(order => ({
        id: order.id,
        symbol: order.symbol,
        exchange: order.exchange_name || 'Unknown',
        side: order.side,
        orderType: order.order_type,
        quantity: Number(order.quantity),
        price: Number(order.price || 0),
        stopPrice: Number(order.stop_price || 0),
        filledQty: Number(order.filled_quantity || 0),
        avgFillPrice: Number(order.avg_fill_price || order.price || 0),
        status: order.status,
        mode: order.mode,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        filledAt: order.filled_at,
        externalOrderId: order.external_order_id,
        fees: Number(order.fees || 0),
        total: Number(order.quantity) * Number(order.price || 0)
      })));
    } catch (err) {
      console.error('Failed to load orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder(orderId) {
    try {
      await api.post(`/api/orders/${orderId}/cancel`);
      setMessage({ text: 'Order cancelled successfully', type: 'success' });
      loadOrders();
    } catch (err) {
      setMessage({ text: errorMessage(err), type: 'error' });
    }
  }

  // Calculate statistics
  const stats = orders.reduce((acc, order) => {
    acc.total++;
    acc[order.status] = (acc[order.status] || 0) + 1;
    if (order.status === 'filled') {
      acc.volume += order.total;
      if (order.side === 'buy') {
        acc.buyVolume += order.total;
      } else {
        acc.sellVolume += order.total;
      }
    }
    return acc;
  }, { total: 0, filled: 0, pending: 0, cancelled: 0, open: 0, volume: 0, buyVolume: 0, sellVolume: 0 });

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (sideFilter !== 'all' && order.side !== sideFilter) return false;
    if (exchangeFilter !== 'all' && order.exchange !== exchangeFilter) return false;
    if (modeFilter !== 'all' && order.mode !== modeFilter) return false;
    if (searchQuery && !order.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    if (dateRange !== 'all') {
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      const daysDiff = (now - orderDate) / (1000 * 60 * 60 * 24);
      if (dateRange === 'today' && daysDiff > 1) return false;
      if (dateRange === 'week' && daysDiff > 7) return false;
      if (dateRange === 'month' && daysDiff > 30) return false;
    }

    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
      case 'rejected': return <AlertCircle size={14} />;
      default: return <Clock size={14} />;
    }
  }

  function getStatusTone(status) {
    switch (status) {
      case 'filled': return 'green';
      case 'pending': case 'open': return 'yellow';
      case 'cancelled': case 'rejected': return 'red';
      default: return 'neutral';
    }
  }

  function exportOrders() {
    const csv = [
      ['Date', 'Time', 'Symbol', 'Exchange', 'Side', 'Type', 'Quantity', 'Price', 'Total', 'Status', 'Mode'].join(','),
      ...filteredOrders.map(o => [
        formatDate(o.createdAt),
        formatTime(o.createdAt),
        o.symbol,
        o.exchange,
        o.side,
        o.orderType,
        o.quantity,
        o.price,
        o.total.toFixed(2),
        o.status,
        o.mode
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  return (
    <div className="orders-page">
      {/* Header */}
      <div className="orders-header">
        <div className="header-left">
          <h2><FileText size={22} /> Order History</h2>
          <Badge>{filteredOrders.length} orders</Badge>
        </div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={loadOrders} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn-export" onClick={exportOrders}>
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
            <span className="stat-label">Filled</span>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon"><Clock size={20} /></div>
          <div className="stat-content">
            <span className="stat-value">{(stats.pending || 0) + (stats.open || 0)}</span>
            <span className="stat-label">Pending</span>
          </div>
        </div>
        <div className="stat-card cancelled">
          <div className="stat-icon"><XCircle size={20} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.cancelled || 0}</span>
            <span className="stat-label">Cancelled</span>
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

      {/* Buy/Sell Volume */}
      <div className="volume-bar-container">
        <div className="volume-labels">
          <span className="buy-label">
            <TrendingUp size={14} /> Buy: ${stats.buyVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span className="sell-label">
            Sell: ${stats.sellVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} <TrendingDown size={14} />
          </span>
        </div>
        <div className="volume-bar">
          <div
            className="volume-fill buy"
            style={{ width: `${stats.volume > 0 ? (stats.buyVolume / stats.volume) * 100 : 50}%` }}
          />
          <div
            className="volume-fill sell"
            style={{ width: `${stats.volume > 0 ? (stats.sellVolume / stats.volume) * 100 : 50}%` }}
          />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-tabs">
          {['all', 'filled', 'pending', 'cancelled'].map(status => (
            <button
              key={status}
              className={statusFilter === status ? 'active' : ''}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="count">
                  {status === 'pending' ? (stats.pending || 0) + (stats.open || 0) : stats[status] || 0}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          className={`btn-filters ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={14} /> Filters
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
          <p>Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty">
          <FileText size={48} />
          <h3>No Orders Found</h3>
          <p>{searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Place your first order to see it here'}</p>
          <Link to="/trading" className="btn-trade">Start Trading</Link>
        </div>
      ) : viewMode === 'table' ? (
        <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
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
                    <td className="qty-cell">
                      {order.filledQty > 0 && order.filledQty < order.quantity ? (
                        <span>{order.filledQty}/{order.quantity}</span>
                      ) : (
                        order.quantity
                      )}
                    </td>
                    <td className="price-cell">{formatPrice(order.price, order.exchange)}</td>
                    <td className="total-cell">{formatPrice(order.total, order.exchange)}</td>
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
                      <td colSpan={10}>
                        <div className="order-details">
                          <div className="details-grid">
                            <div className="detail-item">
                              <span className="detail-label">Order ID</span>
                              <span className="detail-value">#{order.id}</span>
                            </div>
                            {order.externalOrderId && (
                              <div className="detail-item">
                                <span className="detail-label">External ID</span>
                                <span className="detail-value">{order.externalOrderId}</span>
                              </div>
                            )}
                            <div className="detail-item">
                              <span className="detail-label">Avg Fill Price</span>
                              <span className="detail-value">{formatPrice(order.avgFillPrice, order.exchange)}</span>
                            </div>
                            {order.stopPrice > 0 && (
                              <div className="detail-item">
                                <span className="detail-label">Stop Price</span>
                                <span className="detail-value">{formatPrice(order.stopPrice, order.exchange)}</span>
                              </div>
                            )}
                            <div className="detail-item">
                              <span className="detail-label">Fees</span>
                              <span className="detail-value">{formatPrice(order.fees, order.exchange)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Created</span>
                              <span className="detail-value">{formatDateTime(order.createdAt)}</span>
                            </div>
                            {order.filledAt && (
                              <div className="detail-item">
                                <span className="detail-label">Filled</span>
                                <span className="detail-value">{formatDateTime(order.filledAt)}</span>
                              </div>
                            )}
                            <div className="detail-item">
                              <span className="detail-label">Last Updated</span>
                              <span className="detail-value">{formatDateTime(order.updatedAt)}</span>
                            </div>
                          </div>
                          <div className="details-actions">
                            <Link
                              to={`/trading?symbol=${order.symbol}&exchange=${order.exchange}`}
                              className="btn-trade-again"
                            >
                              <TrendingUp size={14} /> Trade {order.symbol}
                            </Link>
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
                  </div>
                </div>
                <div className="card-status">
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
                  <span className="type">{order.orderType}</span>
                  <span className="time">{formatDateTime(order.createdAt)}</span>
                </div>
              </div>

              {expandedOrder === order.id && (
                <div className="card-details">
                  <div className="details-row">
                    <span className="label">Order ID</span>
                    <span className="value">#{order.id}</span>
                  </div>
                  <div className="details-row">
                    <span className="label">Avg Fill Price</span>
                    <span className="value">{formatPrice(order.avgFillPrice, order.exchange)}</span>
                  </div>
                  <div className="details-row">
                    <span className="label">Filled Qty</span>
                    <span className="value">{order.filledQty}/{order.quantity}</span>
                  </div>
                  <div className="details-row">
                    <span className="label">Fees</span>
                    <span className="value">{formatPrice(order.fees, order.exchange)}</span>
                  </div>
                  <div className="card-actions">
                    {(order.status === 'pending' || order.status === 'open') && (
                      <button className="btn-cancel-order" onClick={() => cancelOrder(order.id)}>
                        <XCircle size={14} /> Cancel Order
                      </button>
                    )}
                    <Link
                      to={`/trading?symbol=${order.symbol}&exchange=${order.exchange}`}
                      className="btn-trade-link"
                    >
                      <TrendingUp size={14} /> Trade Again
                    </Link>
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
