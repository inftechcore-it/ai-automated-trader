import { useEffect, useState, useCallback } from 'react';
import {
  KeyRound, Trash2, RefreshCw, CheckCircle, XCircle, Wallet,
  ToggleLeft, ToggleRight, Search, TrendingUp, TrendingDown,
  ArrowLeft, BarChart2, Clock, DollarSign, Activity, ExternalLink, Link2, AlertTriangle,
  Copy, Check, Zap, Globe, Layers, ShieldCheck, Sparkles
} from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Badge from '../components/Badge.jsx';

export default function Exchanges() {
  const [supported, setSupported] = useState([]);
  const [connected, setConnected] = useState([]);
  const [balances, setBalances] = useState({});
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState({});
  const [form, setForm] = useState({
    exchangeName: 'Binance',
    exchangeType: 'crypto',
    apiKey: '',
    apiSecret: '',
    clientCode: '',
    password: '',
    totpSecret: '',
    totp: '',
    privateKey: '',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    paperMode: false,
    useTestnet: false
  });
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

  // Show connect form for crypto and brokers
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [connectExchange, setConnectExchange] = useState(null);

  // Broker status
  const [upstoxStatus, setUpstoxStatus] = useState({ configured: false, authenticated: false });
  const [alpacaStatus, setAlpacaStatus] = useState({ configured: false, paperMode: false });
  const [angeloneStatus, setAngeloneStatus] = useState({ configured: false, authenticated: false });
  const [jupiterStatus, setJupiterStatus] = useState({ configured: false, authenticated: false, balances: [] });

  // Solana & Jupiter Dedicated UI State
  const [jupiterTab, setJupiterTab] = useState('phantom'); // 'phantom' | 'privateKey' | 'rpc'
  const [rpcEndpoints, setRpcEndpoints] = useState([]);
  const [testingRpc, setTestingRpc] = useState(false);
  const [rpcTestResult, setRpcTestResult] = useState(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [phantomConnecting, setPhantomConnecting] = useState(false);

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

  async function loadAlpacaStatus() {
    try {
      const response = await api.get('/api/broker/alpaca/status');
      // Only show as "configured" for the Live card if it's from database (not env paper)
      setAlpacaStatus({
        configured: response.data.configured && response.data.source === 'database',
        paperMode: response.data.paperMode,
        source: response.data.source
      });
    } catch {
      setAlpacaStatus({ configured: false, paperMode: false });
    }
  }

  async function loadAngelOneStatus() {
    try {
      const response = await api.get('/api/broker/angelone/status');
      setAngeloneStatus({
        configured: response.data.configured,
        authenticated: response.data.authenticated,
        source: response.data.source
      });
    } catch {
      setAngeloneStatus({ configured: false, authenticated: false });
    }
  }

  async function loadJupiterStatus() {
    try {
      const [statusRes, walletRes, rpcsRes] = await Promise.all([
        api.get('/api/broker/jupiter/status').catch(() => ({ data: {} })),
        api.get('/api/jupiter/wallet').catch(() => ({ data: {} })),
        api.get('/api/jupiter/rpcs').catch(() => ({ data: { rpcs: [] } }))
      ]);

      const merged = {
        ...statusRes.data,
        ...walletRes.data,
        configured: statusRes.data.configured || walletRes.data.configured,
        authenticated: statusRes.data.authenticated || walletRes.data.authenticated,
        walletAddress: statusRes.data.walletAddress || walletRes.data.walletAddress,
        solBalance: walletRes.data.solBalance || 0,
        balances: walletRes.data.balances || []
      };

      setJupiterStatus(merged);
      if (rpcsRes.data?.rpcs) {
        setRpcEndpoints(rpcsRes.data.rpcs);
      }
    } catch {
      setJupiterStatus({ configured: false, authenticated: false, balances: [] });
    }
  }

  async function connectPhantomWallet() {
    setMessage({ text: '', type: '' });
    setPhantomConnecting(true);

    try {
      const isPhantom = window.solana && window.solana.isPhantom;
      const isSolflare = window.solflare && window.solflare.isSolflare;
      const provider = isPhantom ? window.solana : isSolflare ? window.solflare : window.solana;

      if (!provider) {
        window.open('https://phantom.app/', '_blank');
        throw new Error('Phantom or Solflare wallet extension not detected in your browser. Opening Phantom install page...');
      }

      const resp = await provider.connect();
      const pubkey = resp.publicKey.toString();

      // Save public key to backend
      await api.post('/api/broker/connect', {
        exchange: 'Jupiter',
        apiKey: pubkey,
        apiSecret: 'phantom_injected_wallet',
        rpcUrl: form.rpcUrl || 'https://api.mainnet-beta.solana.com',
        paperMode: false
      });

      setMessage({ text: `Solana Wallet (${pubkey.slice(0, 4)}...${pubkey.slice(-4)}) connected successfully!`, type: 'success' });
      await loadJupiterStatus();
      setShowConnectForm(false);
      setConnectExchange(null);
    } catch (err) {
      setMessage({ text: err.message || 'Failed to connect Phantom wallet', type: 'error' });
    } finally {
      setPhantomConnecting(false);
    }
  }

  async function testSolanaRpc(url) {
    const targetUrl = url || form.rpcUrl;
    if (!targetUrl) return;
    setTestingRpc(true);
    setRpcTestResult(null);
    try {
      const res = await api.post('/api/jupiter/test-rpc', { url: targetUrl });
      if (res.data?.success && res.data.result) {
        setRpcTestResult(res.data.result);
      } else {
        setRpcTestResult({ success: false, error: res.data?.error || 'Test failed' });
      }
    } catch (err) {
      setRpcTestResult({ success: false, error: errorMessage(err) });
    } finally {
      setTestingRpc(false);
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
    loadAlpacaStatus();
    loadAngelOneStatus();
    loadJupiterStatus();

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
      const payload = {
        exchange: form.exchangeName,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret,
        clientCode: form.clientCode,
        password: form.password,
        totpSecret: form.totpSecret,
        totp: form.totp,
        privateKey: form.privateKey,
        rpcUrl: form.rpcUrl,
        paperMode: form.paperMode,
        useTestnet: form.useTestnet
      };
      const response = await api.post('/api/broker/connect', payload);
      setForm({
        exchangeName: 'Binance',
        exchangeType: 'crypto',
        apiKey: '',
        apiSecret: '',
        clientCode: '',
        password: '',
        totpSecret: '',
        totp: '',
        privateKey: '',
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        paperMode: false,
        useTestnet: false
      });
      setMessage({ text: `${form.exchangeName} connected! ${response.data.paperMode ? '(Paper Mode)' : '(Live Mode)'}`, type: 'success' });
      setShowConnectForm(false);
      setConnectExchange(null);
      loadConnected();
      loadAlpacaStatus();
      loadAngelOneStatus();
      loadJupiterStatus();
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

  function handleExchangeClick(exchange, action = 'default') {
    // If action is 'browse', just open explorer
    if (action === 'browse') {
      setSelectedExchange(exchange);
      setShowConnectForm(false);
      setConnectExchange(null);
      setStockSearch('');
      setStockResults([]);
      setSelectedStock(null);
      setStockQuote(null);
      setStockHistory([]);
      return;
    }

    if (exchange.type === 'crypto' || exchange.type === 'dex' || ['Alpaca', 'AngelOne', 'Jupiter'].includes(exchange.name)) {
      if (action === 'reconfigure' || action === 'connect') {
        setConnectExchange(exchange);
        setForm({
          ...form,
          exchangeName: exchange.name,
          exchangeType: exchange.type,
          apiKey: exchange.name === 'Jupiter'
            ? (form.apiKey || 'jup_e254889340b2c9eff161bbda9832fd12b299927ce7ec7d4ac025fdd99c0db00d')
            : exchange.name === 'AngelOne'
            ? (form.apiKey || 'AThErGZk')
            : form.apiKey,
          rpcUrl: jupiterStatus.rpcUrl || 'https://api.mainnet-beta.solana.com',
          privateKey: '',
          paperMode: false
        });
        setShowConnectForm(true);
        setSelectedExchange(null);
        return;
      }

      // Check if already connected (for Alpaca/AngelOne/Jupiter, check configured/live)
      const isConnected = exchange.name === 'Alpaca'
        ? alpacaStatus.configured && !alpacaStatus.paperMode
        : exchange.name === 'AngelOne'
        ? angeloneStatus.authenticated
        : exchange.name === 'Jupiter'
        ? (jupiterStatus.authenticated || jupiterStatus.configured)
        : connected.some(c => c.exchangeName.toLowerCase() === exchange.name.toLowerCase());
      if (!isConnected) {
        setConnectExchange(exchange);
        setForm({
          ...form,
          exchangeName: exchange.name,
          exchangeType: exchange.type,
          apiKey: exchange.name === 'Jupiter'
            ? (form.apiKey || 'jup_e254889340b2c9eff161bbda9832fd12b299927ce7ec7d4ac025fdd99c0db00d')
            : exchange.name === 'AngelOne'
            ? (form.apiKey || 'AThErGZk')
            : form.apiKey,
          rpcUrl: jupiterStatus.rpcUrl || 'https://api.mainnet-beta.solana.com',
          privateKey: '',
          paperMode: false
        });
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

  async function disconnectExchange(exchangeName) {
    if (!confirm(`Disconnect from ${exchangeName}?`)) return;
    setLoading(prev => ({ ...prev, [`disconnect_${exchangeName}`]: true }));
    try {
      await api.delete(`/api/broker/disconnect/${exchangeName}`);
      setMessage({ text: `Disconnected from ${exchangeName}`, type: 'success' });
      loadConnected();
      loadAlpacaStatus();
      loadAngelOneStatus();
      loadJupiterStatus();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, [`disconnect_${exchangeName}`]: false }));
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

  const cryptoExchanges = supported.filter(e => (e.type === 'crypto' || e.type === 'dex') && !['Jupiter'].includes(e.name));
  const stockExchanges = supported.filter(e => e.type === 'stock' && !['AngelOne', 'Alpaca'].includes(e.name));

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
              <h2>Crypto & Solana DEX</h2>
              <p className="panel-hint">Connect exchange API keys or Solana wallet for live trading and portfolio sync</p>

              {/* Jupiter Solana DEX Dedicated Card */}
              <div
                className={`broker-card clickable ${jupiterStatus.authenticated ? 'connected live' : jupiterStatus.configured ? 'connected' : ''}`}
                onClick={() => handleExchangeClick({ name: 'Jupiter', type: 'dex', description: 'Solana DEX Aggregator' }, 'connect')}
              >
                <div className="broker-card-header">
                  <strong>Jupiter DEX (Solana)</strong>
                  {jupiterStatus.authenticated ? (
                    <Badge tone="green" small><CheckCircle size={10} /> Active (Wallet Connected)</Badge>
                  ) : jupiterStatus.configured ? (
                    <Badge tone="blue" small><CheckCircle size={10} /> Configured (Public RPC)</Badge>
                  ) : (
                    <Badge tone="yellow" small><KeyRound size={10} /> Connect Wallet</Badge>
                  )}
                </div>
                <span>Solana Decentralized Exchange Aggregator (Price V3, Live Swaps, Emulated Limit Bots)</span>

                {jupiterStatus.walletAddress && (
                  <>
                    <div className="broker-detail-stats">
                      <div className="stat-chip">
                        <span className="chip-label">Wallet:</span>
                        <span className="chip-val mono">
                          {jupiterStatus.walletAddress.slice(0, 4)}...{jupiterStatus.walletAddress.slice(-4)}
                        </span>
                        <a
                          href={`https://solscan.io/account/${jupiterStatus.walletAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ color: '#38bdf8', marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      <div className="stat-chip">
                        <span className="chip-label">SOL Gas:</span>
                        <span className={`chip-val ${jupiterStatus.solBalance < 0.005 ? 'text-warn' : 'text-success'}`}>
                          {Number(jupiterStatus.solBalance || 0).toFixed(4)} SOL
                        </span>
                      </div>
                      {jupiterStatus.solBalance < 0.005 && (
                        <div className="gas-warning-chip">
                          <AlertTriangle size={12} /> Low gas (min 0.005 SOL needed for live on-chain swaps)
                        </div>
                      )}
                    </div>

                    {/* SPL Token Balances List */}
                    {Array.isArray(jupiterStatus.balances) && jupiterStatus.balances.filter(b => b.asset !== 'SOL' && b.total > 0).length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginTop: '8px',
                        padding: '6px 8px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}>
                        {jupiterStatus.balances.filter(b => b.asset !== 'SOL' && b.total > 0).map(token => (
                          <span
                            key={token.asset}
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.2)',
                              color: '#38bdf8',
                              fontWeight: '600'
                            }}
                          >
                            {token.asset}: {token.total >= 1 ? token.total.toLocaleString() : token.total.toFixed(4)}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {jupiterStatus.configured || jupiterStatus.authenticated ? (
                  <div className="broker-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-small browse"
                      onClick={() => handleExchangeClick({ name: 'Jupiter', type: 'dex', description: 'Solana DEX Aggregator' }, 'reconfigure')}
                    >
                      <KeyRound size={12} /> Configure Wallet / RPC
                    </button>
                    <button
                      className="btn-small disconnect"
                      onClick={() => disconnectExchange('Jupiter')}
                      disabled={loading['disconnect_Jupiter']}
                    >
                      {loading['disconnect_Jupiter'] ? <RefreshCw size={12} className="spin" /> : <XCircle size={12} />}
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="card-action">Click to configure Solana RPC & Wallet</div>
                )}
              </div>

              <div className="exchange-list">
                {cryptoExchanges.filter(e => e.name !== 'Jupiter').map((ex) => {
                  const isConnected = connected.some(c => c.exchangeName.toLowerCase() === ex.name.toLowerCase());
                  return (
                    <div
                      key={ex.name}
                      className={`exchange-card clickable ${isConnected ? 'connected' : ''}`}
                      onClick={() => !isConnected && handleExchangeClick(ex)}
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
                      {isConnected ? (
                        <div className="broker-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className="btn-small disconnect"
                            onClick={() => disconnectExchange(ex.name)}
                            disabled={loading[`disconnect_${ex.name}`]}
                          >
                            {loading[`disconnect_${ex.name}`] ? <RefreshCw size={12} className="spin" /> : <XCircle size={12} />}
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <div className="card-action">Click to connect</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Stock Exchanges */}
            <section className="panel">
              <h2>Stock Exchanges & Indian Brokers</h2>
              <p className="panel-hint">Connect Indian brokers or browse live market data</p>

              {/* Angel One SmartAPI Live Trading for Indian Stocks */}
              <div
                className={`broker-card clickable ${angeloneStatus.configured || angeloneStatus.authenticated ? 'connected live' : ''}`}
                onClick={() => !(angeloneStatus.configured || angeloneStatus.authenticated) && handleExchangeClick({ name: 'AngelOne', type: 'stock', description: 'Angel One SmartAPI (NSE/BSE)' })}
              >
                <div className="broker-card-header">
                  <strong>Angel One SmartAPI</strong>
                  {angeloneStatus.authenticated ? (
                    <Badge tone="green" small><CheckCircle size={10} /> Active</Badge>
                  ) : angeloneStatus.configured ? (
                    <Badge tone="blue" small><CheckCircle size={10} /> Configured</Badge>
                  ) : (
                    <Badge tone="yellow" small><KeyRound size={10} /> Connect API</Badge>
                  )}
                </div>
                <span>Indian Stock Live Trading (NSE, BSE) & Automated Trading Bots</span>
                {angeloneStatus.configured || angeloneStatus.authenticated ? (
                  <div className="broker-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-small browse" onClick={() => handleExchangeClick({ name: 'NSE', type: 'stock' }, 'browse')}>
                      <BarChart2 size={12} /> Browse NSE
                    </button>
                    <button
                      className="btn-small disconnect"
                      onClick={() => disconnectExchange('AngelOne')}
                      disabled={loading['disconnect_AngelOne']}
                    >
                      {loading['disconnect_AngelOne'] ? <RefreshCw size={12} className="spin" /> : <XCircle size={12} />}
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="card-action">Click to connect SmartAPI credentials</div>
                )}
              </div>

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

              {/* Alpaca Live Trading for US Stocks */}
              <div
                className={`broker-card clickable ${alpacaStatus.configured && !alpacaStatus.paperMode ? 'connected live' : ''}`}
                onClick={() => !(alpacaStatus.configured && !alpacaStatus.paperMode) && handleExchangeClick({ name: 'Alpaca', type: 'stock', description: 'US Stocks Live Trading' })}
              >
                <div className="broker-card-header">
                  <strong>Alpaca Live Trading</strong>
                  {alpacaStatus.configured && !alpacaStatus.paperMode ? (
                    <Badge tone="green" small><CheckCircle size={10} /> Connected</Badge>
                  ) : (
                    <Badge tone="yellow" small><KeyRound size={10} /> API Required</Badge>
                  )}
                </div>
                <span>US Stock Live Trading (NASDAQ, NYSE) - Real Money</span>
                {alpacaStatus.configured && !alpacaStatus.paperMode ? (
                  <div className="broker-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-small browse" onClick={() => handleExchangeClick({ name: 'NASDAQ', type: 'stock' }, 'browse')}>
                      <BarChart2 size={12} /> Browse
                    </button>
                    <button
                      className="btn-small disconnect"
                      onClick={() => disconnectExchange('Alpaca')}
                      disabled={loading['disconnect_Alpaca']}
                    >
                      {loading['disconnect_Alpaca'] ? <RefreshCw size={12} className="spin" /> : <XCircle size={12} />}
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="card-action">Click to connect live trading API</div>
                )}
              </div>

              <div className="exchange-list">
                {stockExchanges.map((ex) => {
                  const isIndian = ['NSE', 'BSE'].includes(ex.name);
                  const isUS = ['NASDAQ', 'NYSE'].includes(ex.name);
                  const isLive = (isIndian && (angeloneStatus.authenticated || angeloneStatus.configured || upstoxStatus.authenticated)) || (isUS && alpacaStatus.configured);
                  const needsBroker = isIndian && !angeloneStatus.configured && !angeloneStatus.authenticated && !upstoxStatus.authenticated;

                  return (
                    <div
                      key={ex.name}
                      className={`exchange-card clickable stock ${needsBroker ? 'needs-auth' : ''}`}
                      onClick={() => handleExchangeClick(ex, 'browse')}
                    >
                      <div className="exchange-card-header">
                        <strong>{ex.name}</strong>
                        <div className="exchange-badges">
                          <Badge tone={isLive ? 'green' : 'neutral'} small>
                            {isLive ? 'LIVE' : 'DEMO'}
                          </Badge>
                        </div>
                      </div>
                      <span>{ex.description}</span>
                      {needsBroker ? (
                        <div className="card-action warning">
                          <ExternalLink size={14} /> Connect Angel One or Upstox
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
                  <label>API Key {connectExchange.name === 'AngelOne' && '(SmartAPI Key)'}</label>
                  <input
                    type="password"
                    placeholder={connectExchange.name === 'AngelOne' ? 'Enter Angel One SmartAPI Key' : 'Enter your API key'}
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    autoComplete="off"
                  />
                </div>

                {connectExchange.name === 'AngelOne' ? (
                  <>
                    <div className="form-group">
                      <label>Client Code / User ID</label>
                      <input
                        type="text"
                        placeholder="e.g. S1234567"
                        value={form.clientCode}
                        onChange={(e) => setForm({ ...form, clientCode: e.target.value, apiSecret: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                    <div className="form-group">
                      <label>Account Password / MPIN</label>
                      <input
                        type="password"
                        placeholder="Enter Angel One PIN / password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                    <div className="form-group">
                      <label>TOTP Secret Key (or 6-digit TOTP)</label>
                      <input
                        type="password"
                        placeholder="Base32 TOTP secret key for automatic 2FA"
                        value={form.totpSecret}
                        onChange={(e) => setForm({ ...form, totpSecret: e.target.value, totp: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                    <div className="form-note info">
                      <AlertTriangle size={14} />
                      <span>Angel One SmartAPI requires your API Key, Client Code, PIN, and TOTP key to establish authenticated sessions for order placement.</span>
                    </div>
                  </>
                ) : connectExchange.name === 'Jupiter' ? (
                  <div className="jupiter-connect-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Tab Selection */}
                    <div style={{
                      display: 'flex',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '4px',
                      borderRadius: '10px',
                      gap: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <button
                        type="button"
                        onClick={() => setJupiterTab('phantom')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: jupiterTab === 'phantom' ? 'linear-gradient(135deg, #ab9ff2 0%, #7962e6 100%)' : 'transparent',
                          color: jupiterTab === 'phantom' ? '#ffffff' : '#94a3b8',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>🦊 Phantom / Solflare</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setJupiterTab('privateKey')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: jupiterTab === 'privateKey' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                          color: jupiterTab === 'privateKey' ? '#ffffff' : '#94a3b8',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <KeyRound size={14} />
                        <span>Private Key</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setJupiterTab('rpc')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: jupiterTab === 'rpc' ? 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)' : 'transparent',
                          color: jupiterTab === 'rpc' ? '#ffffff' : '#94a3b8',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Zap size={14} />
                        <span>RPC & Failover</span>
                      </button>
                    </div>

                    {/* Tab 1: Phantom / Browser Wallet Connect */}
                    {jupiterTab === 'phantom' && (
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🦊</div>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1.05rem', fontWeight: '800' }}>
                          Connect Solana Browser Wallet
                        </h4>
                        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                          Connect your Phantom or Solflare wallet for 1-click live on-chain swaps and Super Zee Bot execution on Jupiter DEX.
                        </p>

                        <button
                          type="button"
                          onClick={connectPhantomWallet}
                          disabled={phantomConnecting}
                          style={{
                            width: '100%',
                            padding: '12px 20px',
                            background: 'linear-gradient(135deg, #ab9ff2 0%, #7962e6 100%)',
                            border: 'none',
                            borderRadius: '10px',
                            color: '#ffffff',
                            fontWeight: '800',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 15px rgba(121, 98, 230, 0.4)'
                          }}
                        >
                          {phantomConnecting ? (
                            <><RefreshCw size={16} className="spin" /> Connecting Phantom...</>
                          ) : (
                            <><Wallet size={16} /> 1-Click Connect Phantom / Solflare</>
                          )}
                        </button>

                        {jupiterStatus.walletAddress && (
                          <div style={{
                            marginTop: '1rem',
                            padding: '8px 12px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem',
                            color: '#10b981'
                          }}>
                            <span>Connected: {jupiterStatus.walletAddress.slice(0, 6)}...{jupiterStatus.walletAddress.slice(-6)}</span>
                            <span style={{ fontWeight: '700' }}>{Number(jupiterStatus.solBalance || 0).toFixed(4)} SOL</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Private Key Import */}
                    {jupiterTab === 'privateKey' && (
                      <div>
                        <div className="form-group">
                          <label>Solana Wallet Private Key (Base58 / Secret Key)</label>
                          <input
                            type="password"
                            placeholder="Base58 private key from Phantom/Solflare (e.g. 5K... or JSON array)"
                            value={form.privateKey}
                            onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                            autoComplete="off"
                          />
                          <small className="form-hint">
                            Allows automated autonomous bots (like Super Zee Bot) to execute live swaps without manual popup confirmations.
                          </small>
                        </div>
                        <div className="form-group">
                          <label>Jupiter API Key (Optional)</label>
                          <input
                            type="password"
                            placeholder="Optional: jup_..."
                            value={form.apiKey}
                            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    )}

                    {/* Tab 3: RPC & Failover Configuration */}
                    {jupiterTab === 'rpc' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label>Active Solana RPC URL</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="https://api.mainnet-beta.solana.com"
                              value={form.rpcUrl}
                              onChange={(e) => setForm({ ...form, rpcUrl: e.target.value })}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={() => testSolanaRpc(form.rpcUrl)}
                              disabled={testingRpc}
                              style={{
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                color: '#38bdf8',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                fontWeight: '700',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {testingRpc ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
                              <span>Test Latency</span>
                            </button>
                          </div>
                        </div>

                        {/* Test Result Indicator */}
                        {rpcTestResult && (
                          <div style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: rpcTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${rpcTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            color: rpcTestResult.success ? '#10b981' : '#ef4444',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <span>
                              {rpcTestResult.success ? `🟢 RPC Healthy (Slot: ${rpcTestResult.slot?.toLocaleString()})` : `🔴 RPC Error: ${rpcTestResult.error}`}
                            </span>
                            {rpcTestResult.latencyMs && (
                              <span style={{ fontWeight: '800' }}>{rpcTestResult.latencyMs} ms</span>
                            )}
                          </div>
                        )}

                        {/* Preset RPC Selector */}
                        <div>
                          <label style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>
                            Fast RPC Failover Pool:
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {[
                              { name: 'Solana Official (Mainnet Beta)', url: 'https://api.mainnet-beta.solana.com' },
                              { name: 'Ankr Solana Public RPC', url: 'https://rpc.ankr.com/solana' },
                              { name: 'PublicNode Solana RPC', url: 'https://solana-rpc.publicnode.com' },
                              { name: 'dRPC Decentralized RPC', url: 'https://solana.drpc.org' }
                            ].map(rpc => (
                              <div
                                key={rpc.url}
                                onClick={() => {
                                  setForm({ ...form, rpcUrl: rpc.url });
                                  testSolanaRpc(rpc.url);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  background: form.rpcUrl === rpc.url ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                  border: `1px solid ${form.rpcUrl === rpc.url ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.82rem',
                                  color: form.rpcUrl === rpc.url ? '#38bdf8' : '#e2e8f0'
                                }}
                              >
                                <span>{rpc.name}</span>
                                <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                  {rpc.url.replace('https://', '')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="form-note info">
                      <AlertTriangle size={14} />
                      <span><strong>High-Availability RPC Failover:</strong> TradePilot automatically rotates requests across our Solana RPC pool on any rate limit or network congestion event.</span>
                    </div>
                  </div>
                ) : (
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
                )}

                {connectExchange.type === 'crypto' && (
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.useTestnet}
                        onChange={(e) => setForm({ ...form, useTestnet: e.target.checked })}
                      />
                      <span>Use Testnet (for testing with fake funds)</span>
                    </label>
                    <small className="form-hint">
                      Check this if your API keys are from {connectExchange.name} Testnet
                    </small>
                  </div>
                )}
                {connectExchange.name === 'Alpaca' && (
                  <div className="form-note info">
                    <AlertTriangle size={14} />
                    <span>This connects your <strong>Live Trading</strong> account. Paper trading is always available without API connection.</span>
                  </div>
                )}
                {connectExchange.name === 'Bybit' && (
                  <div className="form-note info">
                    <AlertTriangle size={14} />
                    <span><strong>Bybit V5 Trading:</strong> Generate your API Key & Secret from your Bybit Account (API Management) with <em>Read-Write</em> and <em>Spot Trading / Account Balance</em> permissions enabled.</span>
                  </div>
                )}
                {connectExchange.name === 'Pionex' && (
                  <div className="form-note info">
                    <AlertTriangle size={14} />
                    <span><strong>Pionex Live Trading:</strong> Generate your API Key & Secret from your Pionex Account (Settings &rarr; API Management) with <em>Read</em> and <em>Trade</em> permissions enabled for live orders & automated grid bots.</span>
                  </div>
                )}
                {connectExchange.name === 'CoinDCX' && (
                  <div className="form-note info">
                    <AlertTriangle size={14} />
                    <span><strong>CoinDCX Live Trading:</strong> Generate your API Key & Secret from your CoinDCX Account (Profile &rarr; API Dashboard) with <em>Read</em> and <em>Trade</em> permissions enabled for spot trading and balance sync.</span>
                  </div>
                )}
                <div className="form-actions">
                  <button
                    type="submit"
                    disabled={connecting || !form.apiKey || (connectExchange.name === 'AngelOne' ? !form.clientCode : connectExchange.name === 'Jupiter' ? false : !form.apiSecret)}
                  >
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
