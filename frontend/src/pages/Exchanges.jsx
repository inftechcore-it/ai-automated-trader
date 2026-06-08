import { useEffect, useState, useCallback } from 'react';
import {
  KeyRound, Trash2, RefreshCw, CheckCircle, XCircle, Wallet,
  ToggleLeft, ToggleRight, Search, TrendingUp, TrendingDown,
  ArrowLeft, BarChart2, Clock, DollarSign, Activity, ExternalLink, Link2
} from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Badge from '../components/Badge.jsx';

export default function Exchanges() {
  const [supported, setSupported] = useState([]);
  const [connected, setConnected] = useState([]);
  const [balances, setBalances] = useState({});
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState({});
  const [form, setForm] = useState({ exchangeName: 'Binance', exchangeType: 'crypto', apiKey: '', apiSecret: '' });
  const [connecting, setConnecting] = useState(false);

  // Stock explorer state
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [stockSearch, setStockSearch] = useState('');
  const [stockResults, setStockResults] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockQuote, setStockQuote] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [chartInterval, setChartInterval] = useState('1h');

  // Show connect form for crypto
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [connectExchange, setConnectExchange] = useState(null);

  // Upstox auth state
  const [upstoxStatus, setUpstoxStatus] = useState({ configured: false, authenticated: false });

  async function loadSupported() {
    try {
      const response = await api.get('/api/exchanges/supported');
      setSupported(response.data.exchanges);
    } catch {
      setSupported([]);
    }
  }

  async function loadConnected() {
    try {
      const response = await api.get('/api/exchanges/connected');
      setConnected(response.data.exchanges);
    } catch {
      setConnected([]);
    }
  }

  async function loadBalances(id) {
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      const response = await api.get(`/api/exchanges/${id}/balances`);
      setBalances(prev => ({ ...prev, [id]: response.data }));
    } catch (error) {
      setBalances(prev => ({ ...prev, [id]: { error: errorMessage(error) } }));
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  async function loadUpstoxStatus() {
    try {
      const response = await api.get('/api/upstox/status');
      setUpstoxStatus(response.data);
    } catch {
      setUpstoxStatus({ configured: false, authenticated: false });
    }
  }

  async function connectUpstox() {
    try {
      const response = await api.get('/api/upstox/auth-url');
      console.log('[Upstox] Auth config:', response.data.debug);
      window.location.href = response.data.authUrl;
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    }
  }

  async function disconnectUpstox() {
    try {
      await api.post('/api/upstox/disconnect');
      setUpstoxStatus({ ...upstoxStatus, authenticated: false });
      setMessage({ text: 'Disconnected from Upstox', type: 'success' });
      loadSupported();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    }
  }

  useEffect(() => {
    loadSupported();
    loadConnected();
    loadUpstoxStatus();

    // Check for Upstox callback results
    const params = new URLSearchParams(window.location.search);
    if (params.get('upstox_connected') === 'true') {
      setMessage({ text: 'Successfully connected to Upstox! NSE/BSE live data is now available.', type: 'success' });
      window.history.replaceState({}, '', window.location.pathname);
      loadUpstoxStatus();
      loadSupported();
    } else if (params.get('upstox_error')) {
      setMessage({ text: `Upstox connection failed: ${params.get('upstox_error')}`, type: 'error' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function connect(event) {
    event.preventDefault();
    setMessage({ text: '', type: '' });
    setConnecting(true);
    try {
      const response = await api.post('/api/exchanges/connect', form);
      setForm({ ...form, apiKey: '', apiSecret: '' });
      setMessage({ text: `Exchange connected! ${response.data.canTrade ? 'Trading enabled.' : ''}`, type: 'success' });
      setShowConnectForm(false);
      setConnectExchange(null);
      loadConnected();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    } finally {
      setConnecting(false);
    }
  }

  async function remove(id) {
    setMessage({ text: '', type: '' });
    try {
      await api.delete(`/api/exchanges/${id}`);
      setMessage({ text: 'Exchange disconnected', type: 'success' });
      loadConnected();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    }
  }

  async function toggleActive(id, currentlyActive) {
    setLoading(prev => ({ ...prev, [`toggle_${id}`]: true }));
    try {
      await api.patch(`/api/exchanges/${id}`, { isActive: !currentlyActive });
      loadConnected();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, [`toggle_${id}`]: false }));
    }
  }

  async function verifyConnection(id) {
    setLoading(prev => ({ ...prev, [`verify_${id}`]: true }));
    try {
      await api.get(`/api/exchanges/${id}/verify`);
      setMessage({ text: 'Connection verified successfully', type: 'success' });
      loadConnected();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, [`verify_${id}`]: false }));
    }
  }

  // Stock search with debounce
  const searchStocks = useCallback(async (query, exchange) => {
    if (!query || query.length < 1) {
      setStockResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await api.get('/api/market/search', {
        params: { q: query, exchange }
      });
      setStockResults(response.data.symbols || []);
    } catch (error) {
      console.error('Search error:', error);
      setStockResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedExchange && stockSearch) {
        searchStocks(stockSearch, selectedExchange.name);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [stockSearch, selectedExchange, searchStocks]);

  async function loadStockData(symbol, exchange) {
    setSelectedStock(symbol);
    setQuoteLoading(true);
    try {
      const [quoteRes, historyRes] = await Promise.all([
        api.get('/api/market/quote', { params: { symbol, exchange } }),
        api.get('/api/market/history', { params: { symbol, exchange, interval: chartInterval, limit: 50 } })
      ]);
      setStockQuote(quoteRes.data.quote);
      setStockHistory(historyRes.data.candles || []);
    } catch (error) {
      console.error('Failed to load stock data:', error);
    } finally {
      setQuoteLoading(false);
    }
  }

  useEffect(() => {
    if (selectedStock && selectedExchange) {
      loadStockData(selectedStock, selectedExchange.name);
    }
  }, [chartInterval]);

  function handleExchangeClick(exchange) {
    if (exchange.type === 'crypto') {
      // Check if already connected
      const isConnected = connected.some(c => c.exchangeName === exchange.name);
      if (!isConnected) {
        setConnectExchange(exchange);
        setForm({ ...form, exchangeName: exchange.name, exchangeType: 'crypto' });
        setShowConnectForm(true);
      }
      setSelectedExchange(null);
    } else {
      // Stock exchange - open explorer
      setSelectedExchange(exchange);
      setShowConnectForm(false);
      setConnectExchange(null);
      setStockSearch('');
      setStockResults([]);
      setSelectedStock(null);
      setStockQuote(null);
      setStockHistory([]);
    }
  }

  function formatPrice(price, currency = 'USD') {
    const formatted = price >= 1000
      ? price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : price >= 1
        ? price.toFixed(2)
        : price.toFixed(6);
    return formatted;
  }

  function getCurrencySymbol(exchange) {
    return ['NSE', 'BSE'].includes(exchange) ? '₹' : '$';
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  const cryptoExchanges = supported.filter(e => e.type === 'crypto');
  const stockExchanges = supported.filter(e => e.type === 'stock');

  // Simple sparkline chart
  function Sparkline({ data, width = 200, height = 60 }) {
    if (!data || data.length < 2) return null;

    const prices = data.map(d => d.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const points = prices.map((price, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((price - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const isUp = prices[prices.length - 1] >= prices[0];

    return (
      <svg width={width} height={height} className="sparkline">
        <polyline
          points={points}
          fill="none"
          stroke={isUp ? '#00ff88' : '#ff4757'}
          strokeWidth="2"
        />
      </svg>
    );
  }

  // Mini bar chart for OHLCV
  function MiniChart({ data, width = 400, height = 150 }) {
    if (!data || data.length < 2) return <div className="chart-empty">No chart data available</div>;

    const prices = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const barWidth = Math.max(2, (width / data.length) - 2);

    return (
      <svg width={width} height={height} className="mini-chart">
        {data.map((candle, i) => {
          const x = (i / data.length) * width;
          const isUp = candle.close >= candle.open;
          const bodyTop = height - ((Math.max(candle.open, candle.close) - min) / range) * height;
          const bodyBottom = height - ((Math.min(candle.open, candle.close) - min) / range) * height;
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);
          const wickTop = height - ((candle.high - min) / range) * height;
          const wickBottom = height - ((candle.low - min) / range) * height;

          return (
            <g key={i}>
              <line
                x1={x + barWidth / 2}
                y1={wickTop}
                x2={x + barWidth / 2}
                y2={wickBottom}
                stroke={isUp ? '#00ff88' : '#ff4757'}
                strokeWidth="1"
              />
              <rect
                x={x}
                y={bodyTop}
                width={barWidth}
                height={bodyHeight}
                fill={isUp ? '#00ff88' : '#ff4757'}
              />
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <div className="exchanges-page">
      {/* Stock Explorer View */}
      {selectedExchange && (
        <div className="stock-explorer">
          <div className="explorer-header">
            <button className="btn-back" onClick={() => setSelectedExchange(null)}>
              <ArrowLeft size={18} /> Back to Exchanges
            </button>
            <h2>
              <BarChart2 size={24} />
              {selectedExchange.name} Market Data
            </h2>
            <Badge tone="green">LIVE DATA</Badge>
          </div>

          <div className="explorer-content">
            <div className="explorer-sidebar">
              <div className="search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder={`Search ${selectedExchange.name} stocks...`}
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  autoFocus
                />
                {searchLoading && <RefreshCw size={16} className="spin" />}
              </div>

              <div className="stock-list">
                {stockResults.length > 0 ? (
                  stockResults.map((stock) => (
                    <div
                      key={`${stock.symbol}-${stock.exchange}`}
                      className={`stock-item ${selectedStock === stock.symbol ? 'active' : ''}`}
                      onClick={() => loadStockData(stock.symbol, selectedExchange.name)}
                    >
                      <div className="stock-symbol">{stock.symbol}</div>
                      <div className="stock-name">{stock.name}</div>
                    </div>
                  ))
                ) : stockSearch ? (
                  <div className="stock-list-empty">
                    {searchLoading ? 'Searching...' : 'No stocks found'}
                  </div>
                ) : (
                  <div className="stock-list-hint">
                    <Search size={32} />
                    <p>Search for stocks by symbol or name</p>
                    <div className="hint-examples">
                      Try: {selectedExchange.name === 'NSE' || selectedExchange.name === 'BSE'
                        ? 'INFY, RELIANCE, TCS'
                        : 'AAPL, MSFT, GOOGL'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="explorer-main">
              {selectedStock && stockQuote ? (
                <div className="stock-detail">
                  <div className="stock-header">
                    <div className="stock-title">
                      <h3>{stockQuote.symbol}</h3>
                      <span className="stock-exchange">{stockQuote.exchange}</span>
                    </div>
                    <div className="stock-price-main">
                      <span className="price-value">{getCurrencySymbol(stockQuote.exchange)}{formatPrice(stockQuote.price)}</span>
                      <span className={`price-change ${stockQuote.change >= 0 ? 'gain' : 'loss'}`}>
                        {stockQuote.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {stockQuote.change >= 0 ? '+' : ''}{getCurrencySymbol(stockQuote.exchange)}{formatPrice(Math.abs(stockQuote.change))}
                        ({stockQuote.changePercent >= 0 ? '+' : ''}{stockQuote.changePercent?.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  <div className="stock-stats">
                    <div className="stat-item">
                      <DollarSign size={14} />
                      <span className="stat-label">Open</span>
                      <span className="stat-value">{getCurrencySymbol(stockQuote.exchange)}{formatPrice(stockQuote.open || stockQuote.price)}</span>
                    </div>
                    <div className="stat-item">
                      <TrendingUp size={14} />
                      <span className="stat-label">High</span>
                      <span className="stat-value">{getCurrencySymbol(stockQuote.exchange)}{formatPrice(stockQuote.high24h)}</span>
                    </div>
                    <div className="stat-item">
                      <TrendingDown size={14} />
                      <span className="stat-label">Low</span>
                      <span className="stat-value">{getCurrencySymbol(stockQuote.exchange)}{formatPrice(stockQuote.low24h)}</span>
                    </div>
                    <div className="stat-item">
                      <Activity size={14} />
                      <span className="stat-label">Volume</span>
                      <span className="stat-value">{(stockQuote.volume24h || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="chart-section">
                    <div className="chart-header">
                      <h4>Price Chart</h4>
                      <div className="chart-intervals">
                        {['1m', '5m', '15m', '1h', '1d'].map(int => (
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
                      {quoteLoading ? (
                        <div className="chart-loading"><RefreshCw size={24} className="spin" /></div>
                      ) : (
                        <MiniChart data={stockHistory} width={500} height={200} />
                      )}
                    </div>
                  </div>

                  {stockHistory.length > 0 && (
                    <div className="recent-prices">
                      <h4><Clock size={14} /> Recent Prices</h4>
                      <div className="prices-table">
                        <div className="prices-header">
                          <span>Time</span>
                          <span>Open</span>
                          <span>High</span>
                          <span>Low</span>
                          <span>Close</span>
                        </div>
                        {stockHistory.slice(-10).reverse().map((candle, i) => (
                          <div key={i} className="prices-row">
                            <span>{formatTime(candle.time)}</span>
                            <span>{getCurrencySymbol(stockQuote.exchange)}{formatPrice(candle.open)}</span>
                            <span className="gain">{getCurrencySymbol(stockQuote.exchange)}{formatPrice(candle.high)}</span>
                            <span className="loss">{getCurrencySymbol(stockQuote.exchange)}{formatPrice(candle.low)}</span>
                            <span className={candle.close >= candle.open ? 'gain' : 'loss'}>
                              {getCurrencySymbol(stockQuote.exchange)}{formatPrice(candle.close)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : quoteLoading ? (
                <div className="stock-loading">
                  <RefreshCw size={32} className="spin" />
                  <p>Loading stock data...</p>
                </div>
              ) : (
                <div className="stock-placeholder">
                  <BarChart2 size={48} />
                  <h3>Select a Stock</h3>
                  <p>Search and select a stock from the left panel to view detailed quotes and charts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Exchanges View */}
      {!selectedExchange && (
        <>
          <div className="grid two">
            {/* Crypto Exchanges */}
            <section className="panel">
              <h2>Crypto Exchanges</h2>
              <p className="panel-hint">Connect your exchange API keys to enable live trading and portfolio sync</p>
              <div className="exchange-list">
                {cryptoExchanges.map((ex) => {
                  const isConnected = connected.some(c => c.exchangeName === ex.name);
                  return (
                    <div
                      key={ex.name}
                      className={`exchange-card clickable ${isConnected ? 'connected' : ''}`}
                      onClick={() => handleExchangeClick(ex)}
                    >
                      <div className="exchange-card-header">
                        <strong>{ex.name}</strong>
                        <div className="exchange-badges">
                          {isConnected ? (
                            <Badge tone="green" small><CheckCircle size={10} /> Connected</Badge>
                          ) : (
                            <Badge tone="yellow" small><KeyRound size={10} /> API Required</Badge>
                          )}
                        </div>
                      </div>
                      <span>{ex.description}</span>
                      {!isConnected && <div className="card-action">Click to connect</div>}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Stock Exchanges */}
            <section className="panel">
              <h2>Stock Exchanges</h2>
              <p className="panel-hint">Click to browse live market data</p>

              {/* Upstox Connection Banner for Indian Exchanges */}
              {upstoxStatus.configured && (
                <div className={`upstox-banner ${upstoxStatus.authenticated ? 'connected' : ''}`}>
                  <div className="upstox-info">
                    <strong>Upstox</strong>
                    <span>Real-time NSE/BSE data provider</span>
                  </div>
                  {upstoxStatus.authenticated ? (
                    <div className="upstox-actions">
                      <Badge tone="green"><CheckCircle size={12} /> Connected</Badge>
                      <button className="btn-small" onClick={disconnectUpstox}>Disconnect</button>
                    </div>
                  ) : (
                    <button className="btn-upstox" onClick={connectUpstox}>
                      <Link2 size={14} /> Connect Upstox
                    </button>
                  )}
                </div>
              )}

              <div className="exchange-list">
                {stockExchanges.map((ex) => {
                  const isIndian = ['NSE', 'BSE'].includes(ex.name);
                  const needsUpstox = isIndian && upstoxStatus.configured && !upstoxStatus.authenticated;

                  return (
                    <div
                      key={ex.name}
                      className={`exchange-card clickable stock ${needsUpstox ? 'needs-auth' : ''}`}
                      onClick={() => handleExchangeClick(ex)}
                    >
                      <div className="exchange-card-header">
                        <strong>{ex.name}</strong>
                        <div className="exchange-badges">
                          {isIndian && upstoxStatus.authenticated ? (
                            <Badge tone="green" small>LIVE</Badge>
                          ) : (
                            <Badge tone={ex.live ? 'green' : 'neutral'} small>
                              {ex.live ? 'LIVE' : 'DEMO'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span>{ex.description}</span>
                      {needsUpstox ? (
                        <div className="card-action warning">
                          <ExternalLink size={14} /> Connect Upstox for live data
                        </div>
                      ) : (
                        <div className="card-action">
                          <BarChart2 size={14} /> Browse stocks
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Connect Exchange Modal/Form */}
          {showConnectForm && connectExchange && (
            <section className="panel connect-panel">
              <div className="panel-head">
                <h2>Connect {connectExchange.name}</h2>
                <button className="btn-close" onClick={() => { setShowConnectForm(false); setConnectExchange(null); }}>
                  <XCircle size={20} />
                </button>
              </div>
              <p className="connect-hint">
                Enter your {connectExchange.name} API credentials. Your keys are encrypted with AES-256 before storage.
              </p>
              <form className="form" onSubmit={connect}>
                <div className="form-group">
                  <label>API Key</label>
                  <input
                    type="password"
                    placeholder="Enter your API key"
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>API Secret</label>
                  <input
                    type="password"
                    placeholder="Enter your API secret"
                    value={form.apiSecret}
                    onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={connecting || !form.apiKey || !form.apiSecret}>
                    {connecting ? (
                      <><RefreshCw size={16} className="spin" /> Verifying...</>
                    ) : (
                      <><KeyRound size={16} /> Connect {connectExchange.name}</>
                    )}
                  </button>
                  <button type="button" className="secondary" onClick={() => { setShowConnectForm(false); setConnectExchange(null); }}>
                    Cancel
                  </button>
                </div>
                {message.text && (
                  <div className={`form-note ${message.type}`}>{message.text}</div>
                )}
              </form>
            </section>
          )}

          {/* Connected Exchanges */}
          {connected.length > 0 && (
            <section className="panel">
              <h2>Your Connected Exchanges</h2>
              <div className="connected-list">
                {connected.map((item) => (
                  <div className="connected-card" key={item.id}>
                    <div className="connected-header">
                      <div className="connected-info">
                        <strong>{item.exchangeName}</strong>
                        <span className="exchange-type">{item.exchangeType}</span>
                      </div>
                      <div className="connected-badges">
                        <Badge tone={item.isActive ? 'green' : 'neutral'}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {item.lastVerified && (
                          <Badge tone="blue" small>
                            <CheckCircle size={10} /> Verified
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="connected-meta">
                      <span>Connected: {formatDate(item.createdAt)}</span>
                      <span>Last verified: {formatDate(item.lastVerified)}</span>
                    </div>

                    {balances[item.id] && (
                      <div className="balances-section">
                        {balances[item.id].error ? (
                          <div className="balance-error">
                            <XCircle size={14} /> {balances[item.id].error}
                          </div>
                        ) : (
                          <>
                            <div className="balances-header">
                              <Wallet size={14} /> Balances
                              {balances[item.id].lastSync && (
                                <span className="sync-time">
                                  Synced: {formatDate(balances[item.id].lastSync)}
                                </span>
                              )}
                            </div>
                            <div className="balances-grid">
                              {balances[item.id].balances?.length > 0 ? (
                                balances[item.id].balances.map((b) => (
                                  <div className="balance-item" key={b.asset}>
                                    <span className="asset">{b.asset}</span>
                                    <span className="amount">{b.total.toFixed(8)}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="empty-balances">No balances found</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="connected-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => loadBalances(item.id)}
                        disabled={loading[item.id]}
                      >
                        {loading[item.id] ? <RefreshCw size={14} className="spin" /> : <Wallet size={14} />}
                        {balances[item.id] ? 'Refresh' : 'Load'} Balances
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => verifyConnection(item.id)}
                        disabled={loading[`verify_${item.id}`]}
                      >
                        {loading[`verify_${item.id}`] ? <RefreshCw size={14} className="spin" /> : <CheckCircle size={14} />}
                        Verify
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => toggleActive(item.id, item.isActive)}
                        disabled={loading[`toggle_${item.id}`]}
                      >
                        {item.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {item.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => remove(item.id)}
                        title="Delete connection"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
