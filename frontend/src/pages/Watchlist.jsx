import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Star, Trash2, RefreshCw, TrendingUp, TrendingDown,
  Plus, X, ChevronLeft, BarChart2, Clock, Activity, Target,
  ArrowUpRight, ArrowDownRight, Eye, Bell, ShoppingCart
} from 'lucide-react';
import { Line, LineChart, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api, errorMessage } from '../api.js';
import Badge from '../components/Badge.jsx';

export default function Watchlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState('all');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Stock detail view
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockQuote, setStockQuote] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [chartInterval, setChartInterval] = useState('1d');
  const [detailLoading, setDetailLoading] = useState(false);

  // Live prices for watchlist
  const [livePrices, setLivePrices] = useState({});

  const exchanges = [
    { value: 'all', label: 'All Exchanges' },
    { value: 'Binance', label: 'Binance' },
    { value: 'Bybit', label: 'Bybit' },
    { value: 'CoinDCX', label: 'CoinDCX' },
    { value: 'Pionex', label: 'Pionex' },
    { value: 'Kraken', label: 'Kraken' },
    { value: 'NSE', label: 'NSE' },
    { value: 'BSE', label: 'BSE' },
    { value: 'AngelOne', label: 'Angel One' },
    { value: 'Jupiter', label: 'Jupiter (Solana DEX)' },
    { value: 'NASDAQ', label: 'NASDAQ' },
    { value: 'NYSE', label: 'NYSE' }
  ];

  useEffect(() => {
    loadWatchlist();
  }, []);

  // Load live prices periodically
  useEffect(() => {
    if (items.length === 0) return;
    loadLivePrices();
    const interval = setInterval(loadLivePrices, 15000);
    return () => clearInterval(interval);
  }, [items]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 1) {
        searchSymbols();
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load chart when interval changes
  useEffect(() => {
    if (selectedStock) {
      loadStockHistory(selectedStock.symbol, selectedStock.exchange);
    }
  }, [chartInterval]);

  async function loadWatchlist() {
    setLoading(true);
    try {
      const response = await api.get('/api/watchlist');
      setItems(response.data.items || []);
    } catch (err) {
      console.error('Failed to load watchlist:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadLivePrices() {
    const prices = {};
    await Promise.all(
      items.map(async (item) => {
        try {
          const response = await api.get('/api/market/quote', {
            params: { symbol: item.symbol, exchange: item.exchange_name }
          });
          if (response.data.quote) {
            prices[`${item.symbol}-${item.exchange_name}`] = response.data.quote;
          }
        } catch (err) {
          // Keep existing price
        }
      })
    );
    setLivePrices(prev => ({ ...prev, ...prices }));
  }

  async function searchSymbols() {
    setSearchLoading(true);
    try {
      const exchange = selectedExchange === 'all' ? '' : selectedExchange;
      const response = await api.get('/api/market/search', {
        params: { q: searchQuery, exchange }
      });
      setSearchResults(response.data.symbols || []);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function addToWatchlist(symbol, exchange) {
    try {
      await api.post('/api/watchlist', { symbol, exchangeName: exchange });
      setMessage({ text: `${symbol} added to watchlist`, type: 'success' });
      setSearchQuery('');
      setSearchResults([]);
      setShowSearch(false);
      loadWatchlist();
    } catch (err) {
      setMessage({ text: errorMessage(err), type: 'error' });
    }
  }

  async function removeFromWatchlist(id, symbol) {
    try {
      await api.delete(`/api/watchlist/${id}`);
      setMessage({ text: `${symbol} removed from watchlist`, type: 'success' });
      if (selectedStock?.id === id) {
        setSelectedStock(null);
      }
      loadWatchlist();
    } catch (err) {
      setMessage({ text: errorMessage(err), type: 'error' });
    }
  }

  async function openStockDetail(item) {
    setSelectedStock(item);
    setDetailLoading(true);
    try {
      const [quoteRes, historyRes] = await Promise.all([
        api.get('/api/market/quote', { params: { symbol: item.symbol, exchange: item.exchange_name } }),
        api.get('/api/market/history', { params: { symbol: item.symbol, exchange: item.exchange_name, interval: chartInterval, limit: 60 } })
      ]);
      setStockQuote(quoteRes.data.quote);
      setStockHistory(historyRes.data.candles || []);
    } catch (err) {
      console.error('Failed to load stock detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadStockHistory(symbol, exchange) {
    try {
      const response = await api.get('/api/market/history', {
        params: { symbol, exchange, interval: chartInterval, limit: 60 }
      });
      setStockHistory(response.data.candles || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  function getPrice(item) {
    const key = `${item.symbol}-${item.exchange_name}`;
    return livePrices[key] || null;
  }

  function formatPrice(price, exchange) {
    const symbol = ['NSE', 'BSE'].includes(exchange) ? '₹' : '$';
    if (price >= 1000) return `${symbol}${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `${symbol}${price.toFixed(2)}`;
    return `${symbol}${price.toFixed(6)}`;
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Filter items
  const filteredItems = items.filter(item => {
    if (selectedExchange !== 'all' && item.exchange_name !== selectedExchange) return false;
    return true;
  });

  // Generate sparkline data
  function generateSparkline(positive = true) {
    const base = 100;
    return Array.from({ length: 20 }, (_, i) => ({
      value: base + (positive ? 1 : -1) * (Math.random() * 5 + i * 0.3)
    }));
  }

  return (
    <div className="watchlist-page">
      {/* Stock Detail View */}
      {selectedStock && (
        <div className="stock-detail-panel">
          <div className="detail-header">
            <button className="btn-back" onClick={() => setSelectedStock(null)}>
              <ChevronLeft size={18} /> Back
            </button>
            <div className="detail-title">
              <h2>{selectedStock.symbol}</h2>
              <Badge small>{selectedStock.exchange_name}</Badge>
            </div>
            <div className="detail-actions">
              <Link
                to={`/trading?symbol=${selectedStock.symbol}&exchange=${selectedStock.exchange_name}`}
                className="btn-trade"
              >
                <ShoppingCart size={14} /> Trade
              </Link>
              <button
                className="btn-remove"
                onClick={() => removeFromWatchlist(selectedStock.id, selectedStock.symbol)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {detailLoading ? (
            <div className="detail-loading">
              <RefreshCw size={32} className="spin" />
              <p>Loading stock data...</p>
            </div>
          ) : stockQuote ? (
            <div className="detail-content">
              {/* Price Section */}
              <div className="detail-price-section">
                <div className="current-price">
                  <span className="price-value">
                    {formatPrice(stockQuote.price, selectedStock.exchange_name)}
                  </span>
                  <div className={`price-change ${stockQuote.change >= 0 ? 'gain' : 'loss'}`}>
                    {stockQuote.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    <span>
                      {stockQuote.change >= 0 ? '+' : ''}
                      {formatPrice(Math.abs(stockQuote.change), selectedStock.exchange_name)}
                      ({stockQuote.changePercent >= 0 ? '+' : ''}{stockQuote.changePercent?.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="price-stats">
                  <div className="stat">
                    <span className="stat-label">Open</span>
                    <span className="stat-value">{formatPrice(stockQuote.open || stockQuote.price, selectedStock.exchange_name)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">High</span>
                    <span className="stat-value gain">{formatPrice(stockQuote.high24h || stockQuote.price, selectedStock.exchange_name)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Low</span>
                    <span className="stat-value loss">{formatPrice(stockQuote.low24h || stockQuote.price, selectedStock.exchange_name)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Volume</span>
                    <span className="stat-value">{(stockQuote.volume24h || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              <div className="detail-chart-section">
                <div className="chart-header">
                  <h3><BarChart2 size={16} /> Price Chart</h3>
                  <div className="chart-intervals">
                    {['1m', '5m', '15m', '1h', '1d', '1w'].map(int => (
                      <button
                        key={int}
                        className={chartInterval === int ? 'active' : ''}
                        onClick={() => setChartInterval(int)}
                      >
                        {int}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="chart-container">
                  {stockHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={stockHistory}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={stockQuote.change >= 0 ? '#00ff88' : '#ff4757'} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={stockQuote.change >= 0 ? '#00ff88' : '#ff4757'} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1d2938" />
                        <XAxis
                          dataKey="time"
                          tickFormatter={(t) => chartInterval.includes('d') || chartInterval.includes('w') ? formatDate(t) : formatTime(t)}
                          stroke="#6b7a90"
                          fontSize={11}
                        />
                        <YAxis
                          domain={['auto', 'auto']}
                          stroke="#6b7a90"
                          fontSize={11}
                          tickFormatter={(v) => v.toFixed(2)}
                        />
                        <Tooltip
                          contentStyle={{ background: '#101720', border: '1px solid #223044', borderRadius: '8px' }}
                          labelFormatter={(t) => new Date(t).toLocaleString()}
                          formatter={(v) => [formatPrice(v, selectedStock.exchange_name), 'Price']}
                        />
                        <Area
                          type="monotone"
                          dataKey="close"
                          stroke={stockQuote.change >= 0 ? '#00ff88' : '#ff4757'}
                          fillOpacity={1}
                          fill="url(#colorPrice)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-empty">No chart data available</div>
                  )}
                </div>
              </div>

              {/* OHLCV Table */}
              {stockHistory.length > 0 && (
                <div className="detail-ohlcv">
                  <h3><Clock size={16} /> Recent Data</h3>
                  <div className="ohlcv-table">
                    <div className="ohlcv-header">
                      <span>Time</span>
                      <span>Open</span>
                      <span>High</span>
                      <span>Low</span>
                      <span>Close</span>
                      <span>Volume</span>
                    </div>
                    {stockHistory.slice(-10).reverse().map((candle, i) => (
                      <div key={i} className="ohlcv-row">
                        <span>{formatTime(candle.time)}</span>
                        <span>{formatPrice(candle.open, selectedStock.exchange_name)}</span>
                        <span className="gain">{formatPrice(candle.high, selectedStock.exchange_name)}</span>
                        <span className="loss">{formatPrice(candle.low, selectedStock.exchange_name)}</span>
                        <span className={candle.close >= candle.open ? 'gain' : 'loss'}>
                          {formatPrice(candle.close, selectedStock.exchange_name)}
                        </span>
                        <span>{(candle.volume || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="detail-error">Failed to load stock data</div>
          )}
        </div>
      )}

      {/* Main Watchlist View */}
      {!selectedStock && (
        <>
          {/* Header */}
          <div className="watchlist-header">
            <div className="header-left">
              <h2><Star size={20} /> My Watchlist</h2>
              <Badge>{filteredItems.length} stocks</Badge>
            </div>
            <div className="header-actions">
              <button className="btn-refresh" onClick={loadWatchlist} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
              </button>
              <button className="btn-add" onClick={() => setShowSearch(true)}>
                <Plus size={16} /> Add Stock
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="watchlist-filters">
            <div className="filter-tabs">
              {exchanges.map(ex => (
                <button
                  key={ex.value}
                  className={selectedExchange === ex.value ? 'active' : ''}
                  onClick={() => setSelectedExchange(ex.value)}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          {message.text && (
            <div className={`watchlist-message ${message.type}`}>
              {message.text}
              <button onClick={() => setMessage({ text: '', type: '' })}><X size={14} /></button>
            </div>
          )}

          {/* Search Modal */}
          {showSearch && (
            <div className="search-modal-overlay" onClick={() => setShowSearch(false)}>
              <div className="search-modal" onClick={e => e.stopPropagation()}>
                <div className="search-modal-header">
                  <h3>Add to Watchlist</h3>
                  <button className="btn-close" onClick={() => setShowSearch(false)}>
                    <X size={20} />
                  </button>
                </div>
                <div className="search-input-wrapper">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search stocks, crypto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchLoading && <RefreshCw size={16} className="spin" />}
                </div>
                <div className="search-results">
                  {searchResults.length > 0 ? (
                    searchResults.map(result => {
                      const alreadyAdded = items.some(
                        i => i.symbol === result.symbol && i.exchange_name === result.exchange
                      );
                      return (
                        <div key={`${result.symbol}-${result.exchange}`} className="search-result-item">
                          <div className="result-info">
                            <span className="result-symbol">{result.symbol}</span>
                            <span className="result-name">{result.name}</span>
                            <Badge small>{result.exchange}</Badge>
                          </div>
                          {alreadyAdded ? (
                            <span className="already-added"><Star size={14} /> Added</span>
                          ) : (
                            <button
                              className="btn-add-small"
                              onClick={() => addToWatchlist(result.symbol, result.exchange)}
                            >
                              <Plus size={14} /> Add
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : searchQuery ? (
                    <div className="search-empty">
                      {searchLoading ? 'Searching...' : 'No results found'}
                    </div>
                  ) : (
                    <div className="search-hint">
                      <Search size={32} />
                      <p>Search by symbol or company name</p>
                      <span>Try: AAPL, RELIANCE, BTC/USDT</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Watchlist Grid */}
          {loading ? (
            <div className="watchlist-loading">
              <RefreshCw size={32} className="spin" />
              <p>Loading watchlist...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="watchlist-empty">
              <Star size={48} />
              <h3>Your Watchlist is Empty</h3>
              <p>Add stocks to track their prices and performance</p>
              <button className="btn-add" onClick={() => setShowSearch(true)}>
                <Plus size={16} /> Add Your First Stock
              </button>
            </div>
          ) : (
            <div className="watchlist-grid">
              {filteredItems.map(item => {
                const quote = getPrice(item);
                const price = quote?.price || 0;
                const change = quote?.change || 0;
                const changePercent = quote?.changePercent || 0;
                const isPositive = change >= 0;
                const sparkData = generateSparkline(isPositive);

                return (
                  <div
                    key={item.id}
                    className={`watchlist-card ${isPositive ? 'positive' : 'negative'}`}
                    onClick={() => openStockDetail(item)}
                  >
                    <div className="card-header">
                      <div className="card-symbol">
                        <span className="symbol">{item.symbol}</span>
                        <Badge small>{item.exchange_name}</Badge>
                      </div>
                      <button
                        className="btn-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromWatchlist(item.id, item.symbol);
                        }}
                        title="Remove from watchlist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="card-price">
                      {price > 0 ? (
                        <>
                          <span className="price-value">
                            {formatPrice(price, item.exchange_name)}
                          </span>
                          <div className={`price-change ${isPositive ? 'gain' : 'loss'}`}>
                            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            <span>
                              {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="price-loading">Loading...</span>
                      )}
                    </div>

                    <div className="card-chart">
                      <ResponsiveContainer width="100%" height={50}>
                        <LineChart data={sparkData}>
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={isPositive ? '#00ff88' : '#ff4757'}
                            strokeWidth={1.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="card-footer">
                      <span className="view-details">
                        <Eye size={12} /> View Details
                      </span>
                      <span className="added-time">
                        Added {new Date(item.added_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
