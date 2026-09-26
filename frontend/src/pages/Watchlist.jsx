import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Star, Trash2, RefreshCw, TrendingUp, TrendingDown,
  Plus, X, ChevronLeft, BarChart2, Clock, Activity, Target,
  ArrowUpRight, ArrowDownRight, Eye, Bell, ShoppingCart, BookOpen,
  Zap, ShieldAlert, Layers, Sparkles
} from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Badge from '../components/Badge.jsx';
import CandlestickChart from '../components/CandlestickChart.jsx';
import PatternEncyclopediaModal from '../components/PatternEncyclopediaModal.jsx';
import WatchlistPatternInsights from '../components/WatchlistPatternInsights.jsx';
import { CANDLESTICK_PATTERNS_DB } from '../utils/candlestickPatterns.js';

export default function Watchlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [selectedPatternFilter, setSelectedPatternFilter] = useState('all'); // 'all' | 'bullish' | 'bearish' | 'neutral'
  const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);

  // Search state
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
  const [stockPatterns, setStockPatterns] = useState([]);
  const [stockAnalysis, setStockAnalysis] = useState(null);
  const [chartInterval, setChartInterval] = useState('1h');
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
    loadWatchlistAndAnalysis();
  }, []);

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
      loadStockHistory(selectedStock.symbol, selectedStock.exchange_name || selectedStock.exchange);
    }
  }, [chartInterval]);

  async function loadWatchlistAndAnalysis() {
    setLoading(true);
    setAnalysisLoading(true);
    try {
      const [listRes, analysisRes] = await Promise.allSettled([
        api.get('/api/watchlist'),
        api.get('/api/watchlist/analysis', { params: { interval: chartInterval } })
      ]);

      if (listRes.status === 'fulfilled') {
        setItems(listRes.value.data.items || []);
      }
      if (analysisRes.status === 'fulfilled') {
        setAnalysisData(analysisRes.value.data);
      }
    } catch (err) {
      console.error('Failed to load watchlist analysis:', err);
    } finally {
      setLoading(false);
      setAnalysisLoading(false);
    }
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
      loadWatchlistAndAnalysis();
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
      loadWatchlistAndAnalysis();
    } catch (err) {
      setMessage({ text: errorMessage(err), type: 'error' });
    }
  }

  async function openStockDetail(item) {
    setSelectedStock(item);
    setDetailLoading(true);
    const exchangeName = item.exchange_name || item.exchange || 'Binance';
    try {
      const [quoteRes, historyRes, patternsRes] = await Promise.allSettled([
        api.get('/api/market/quote', { params: { symbol: item.symbol, exchange: exchangeName } }),
        api.get('/api/market/history', { params: { symbol: item.symbol, exchange: exchangeName, interval: chartInterval, limit: 70 } }),
        api.get('/api/market/patterns', { params: { symbol: item.symbol, exchange: exchangeName, interval: chartInterval } })
      ]);

      if (quoteRes.status === 'fulfilled') {
        setStockQuote(quoteRes.value.data.quote);
      }
      if (historyRes.status === 'fulfilled') {
        setStockHistory(historyRes.value.data.candles || []);
      }
      if (patternsRes.status === 'fulfilled') {
        setStockPatterns(patternsRes.value.data.detectedPatterns || []);
        setStockAnalysis(patternsRes.value.data.analysis || null);
      }
    } catch (err) {
      console.error('Failed to load stock detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadStockHistory(symbol, exchange) {
    try {
      const [historyRes, patternsRes] = await Promise.allSettled([
        api.get('/api/market/history', {
          params: { symbol, exchange, interval: chartInterval, limit: 70 }
        }),
        api.get('/api/market/patterns', {
          params: { symbol, exchange, interval: chartInterval }
        })
      ]);

      if (historyRes.status === 'fulfilled') {
        setStockHistory(historyRes.value.data.candles || []);
      }
      if (patternsRes.status === 'fulfilled') {
        setStockPatterns(patternsRes.value.data.detectedPatterns || []);
        setStockAnalysis(patternsRes.value.data.analysis || null);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  function formatPrice(price, exchange) {
    if (price === undefined || price === null || isNaN(price)) return '0.00';
    const symbol = ['NSE', 'BSE', 'AngelOne'].includes(exchange) ? '₹' : '$';
    if (price >= 1000) return `${symbol}${Number(price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `${symbol}${Number(price).toFixed(2)}`;
    return `${symbol}${Number(price).toFixed(5)}`;
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  // Filter items by exchange and detected pattern filter
  const analyzedItemsMap = (analysisData?.items || []).reduce((acc, it) => {
    acc[it.symbol] = it;
    return acc;
  }, {});

  const filteredItems = items.filter(item => {
    if (selectedExchange !== 'all' && item.exchange_name !== selectedExchange) return false;
    const analyzed = analyzedItemsMap[item.symbol];
    if (selectedPatternFilter === 'bullish') return (analyzed?.score || 0) > 10;
    if (selectedPatternFilter === 'bearish') return (analyzed?.score || 0) < -10;
    if (selectedPatternFilter === 'neutral') return Math.abs(analyzed?.score || 0) <= 10;
    return true;
  });

  return (
    <div className="watchlist-page">
      {/* Pattern Encyclopedia Modal */}
      <PatternEncyclopediaModal
        isOpen={isEncyclopediaOpen}
        onClose={() => setIsEncyclopediaOpen(false)}
      />

      {/* Stock Detail View */}
      {selectedStock && (
        <div className="stock-detail-panel">
          <div className="detail-header">
            <button className="btn-back" onClick={() => setSelectedStock(null)}>
              <ChevronLeft size={18} /> Back to Watchlist
            </button>
            <div className="detail-title">
              <h2>{selectedStock.symbol}</h2>
              <Badge small>{selectedStock.exchange_name || selectedStock.exchange}</Badge>
              {stockAnalysis?.latestPattern && (
                <span className={`pattern-header-badge ${stockAnalysis.latestPattern.sentiment}`}>
                  🎯 Pattern: {stockAnalysis.latestPattern.name} ({stockAnalysis.latestPattern.confidence}%)
                </span>
              )}
            </div>
            <div className="detail-actions">
              <button
                className="btn-encyclopedia-small"
                onClick={() => setIsEncyclopediaOpen(true)}
              >
                <BookOpen size={14} /> 38 Patterns Guide
              </button>
              <Link
                to={`/trading?symbol=${selectedStock.symbol}&exchange=${selectedStock.exchange_name || selectedStock.exchange}`}
                className="btn-trade"
              >
                <ShoppingCart size={14} /> Trade Now
              </Link>
              <button
                className="btn-remove"
                onClick={() => removeFromWatchlist(selectedStock.id, selectedStock.symbol)}
                title="Remove from Watchlist"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {detailLoading ? (
            <div className="detail-loading">
              <RefreshCw size={32} className="spin text-primary" />
              <p>Analyzing candlestick patterns and live order book data...</p>
            </div>
          ) : (
            <div className="detail-content">
              {/* Price & Prediction Summary Section */}
              <div className="detail-price-section">
                <div className="current-price">
                  <span className="price-value">
                    {formatPrice(stockQuote?.price || stockAnalysis?.currentPrice || 0, selectedStock.exchange_name)}
                  </span>
                  {stockQuote && (
                    <div className={`price-change ${stockQuote.change >= 0 ? 'gain' : 'loss'}`}>
                      {stockQuote.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      <span>
                        {stockQuote.change >= 0 ? '+' : ''}
                        {formatPrice(Math.abs(stockQuote.change || 0), selectedStock.exchange_name)}
                        ({stockQuote.changePercent >= 0 ? '+' : ''}{(stockQuote.changePercent || 0).toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>

                <div className="price-stats">
                  <div className="stat">
                    <span className="stat-label">AI Prediction</span>
                    <span className={`stat-value bold ${stockAnalysis?.score > 0 ? 'gain' : (stockAnalysis?.score < 0 ? 'loss' : '')}`}>
                      {stockAnalysis?.prediction || 'NEUTRAL'} ({stockAnalysis?.confidence || 50}%)
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Target Price</span>
                    <span className="stat-value gain">{formatPrice(stockAnalysis?.targetPrice || 0, selectedStock.exchange_name)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Stop Loss</span>
                    <span className="stat-value loss">{formatPrice(stockAnalysis?.stopLoss || 0, selectedStock.exchange_name)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Risk/Reward</span>
                    <span className="stat-value">{stockAnalysis?.riskReward || '1:2.0'}</span>
                  </div>
                </div>
              </div>

              {/* Live Candlestick AI Market Prediction Banner */}
              {stockAnalysis && (
                <div className="market-behavior-banner">
                  <div className="banner-icon">
                    <Sparkles size={20} className="text-primary" />
                  </div>
                  <div className="banner-body">
                    <h4>Live Candlestick Market Behavior & Prediction</h4>
                    <p>{stockAnalysis.summary}</p>
                  </div>
                </div>
              )}

              {/* Interactive Candlestick Chart */}
              <div className="detail-chart-section">
                <CandlestickChart
                  candles={stockHistory}
                  detectedPatterns={stockPatterns}
                  symbol={selectedStock.symbol}
                  exchange={selectedStock.exchange_name || selectedStock.exchange}
                  interval={chartInterval}
                  onIntervalChange={setChartInterval}
                  currencySymbol={['NSE', 'BSE', 'AngelOne'].includes(selectedStock.exchange_name) ? '₹' : '$'}
                  height={430}
                  showControls={true}
                />
              </div>

              {/* Detected Patterns List Section */}
              {stockPatterns.length > 0 && (
                <div className="detected-patterns-section">
                  <h3><Target size={16} /> Identified Candlestick Patterns ({stockPatterns.length})</h3>
                  <div className="patterns-card-list">
                    {stockPatterns.map((pat, idx) => (
                      <div key={idx} className={`pattern-signal-item ${pat.sentiment}`}>
                        <div className="signal-top">
                          <span className="signal-name">
                            {pat.sentiment === 'bullish' ? '🟢' : (pat.sentiment === 'bearish' ? '🔴' : '🟡')} {pat.name}
                          </span>
                          <span className="signal-conf">
                            Confidence: <strong>{pat.confidence}%</strong>
                          </span>
                        </div>
                        <p className="signal-desc">{pat.description}</p>
                        <div className="signal-footer">
                          <span className="signal-rule">💡 {pat.psychology}</span>
                          <div className="signal-targets">
                            {pat.targetPrice && <span className="gain">Target: {formatPrice(pat.targetPrice, selectedStock.exchange_name)}</span>}
                            {pat.stopLoss && <span className="loss">SL: {formatPrice(pat.stopLoss, selectedStock.exchange_name)}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OHLCV Table */}
              {stockHistory.length > 0 && (
                <div className="detail-ohlcv">
                  <h3><Clock size={16} /> Recent Candlestick Feed (OHLCV)</h3>
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
          )}
        </div>
      )}

      {/* Main Watchlist View */}
      {!selectedStock && (
        <>
          {/* Header */}
          <div className="watchlist-header">
            <div className="header-left">
              <h2><Star size={20} /> My Watchlist & Market Screener</h2>
              <Badge>{filteredItems.length} assets</Badge>
            </div>
            <div className="header-actions">
              <button
                className="btn-encyclopedia"
                onClick={() => setIsEncyclopediaOpen(true)}
              >
                <BookOpen size={16} /> 38 Patterns Guide
              </button>
              <button className="btn-refresh" onClick={loadWatchlistAndAnalysis} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
              </button>
              <button className="btn-add" onClick={() => setShowSearch(true)}>
                <Plus size={16} /> Add Asset
              </button>
            </div>
          </div>

          {/* Live Market Behavior & Candlestick Pattern Insights Panel */}
          {items.length > 0 && (
            <WatchlistPatternInsights
              analysisData={analysisData}
              loading={analysisLoading}
              onSelectStock={openStockDetail}
              onOpenEncyclopedia={() => setIsEncyclopediaOpen(true)}
              selectedPatternFilter={selectedPatternFilter}
              onFilterChange={setSelectedPatternFilter}
            />
          )}

          {/* Exchange Filter Tabs */}
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

          {/* Alert Message */}
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
                  <h3>Add Asset to Watchlist</h3>
                  <button className="btn-close" onClick={() => setShowSearch(false)}>
                    <X size={20} />
                  </button>
                </div>
                <div className="search-input-wrapper">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search stocks (NSE/BSE/US) or crypto (Binance/Bybit/CoinDCX)..."
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
                      <p>Search by symbol or asset name</p>
                      <span>Try: RELIANCE, TATAMOTORS, XRP, BTC/USDT, AAPL</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Watchlist Grid */}
          {loading ? (
            <div className="watchlist-loading">
              <RefreshCw size={32} className="spin text-primary" />
              <p>Loading watchlist and running candlestick pattern recognition...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="watchlist-empty">
              <Star size={48} />
              <h3>No Assets Found</h3>
              <p>{items.length === 0 ? 'Add stocks or crypto to track prices and candlestick patterns' : 'No assets match the selected filter.'}</p>
              <button className="btn-add" onClick={() => setShowSearch(true)}>
                <Plus size={16} /> Add Asset
              </button>
            </div>
          ) : (
            <div className="watchlist-grid">
              {filteredItems.map(item => {
                const analyzed = analyzedItemsMap[item.symbol];
                const price = analyzed?.quote?.price || 0;
                const change = analyzed?.quote?.change || 0;
                const changePercent = analyzed?.quote?.changePercent || 0;
                const isPositive = change >= 0;
                const latestPattern = analyzed?.latestPattern;
                const prediction = analyzed?.prediction || 'NEUTRAL';
                const score = analyzed?.score || 0;

                return (
                  <div
                    key={item.id}
                    className={`watchlist-card ${score > 15 ? 'bullish-glow' : (score < -15 ? 'bearish-glow' : '')}`}
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

                    {/* Price and 24h change */}
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
                        <span className="price-loading">Connecting feed...</span>
                      )}
                    </div>

                    {/* Candlestick Pattern Badge & AI Prediction */}
                    <div className="card-pattern-badge-row">
                      {latestPattern ? (
                        <div className={`card-pattern-tag ${latestPattern.sentiment}`}>
                          🎯 {latestPattern.name}
                        </div>
                      ) : (
                        <div className="card-pattern-tag neutral">
                          📊 Market Analysis Active
                        </div>
                      )}
                      <div className={`card-prediction-tag ${score > 0 ? 'gain' : (score < 0 ? 'loss' : '')}`}>
                        {prediction}
                      </div>
                    </div>

                    {/* Target and Stoploss row */}
                    {analyzed?.targetPrice > 0 && (
                      <div className="card-targets-row">
                        <span className="target">🎯 Tgt: {formatPrice(analyzed.targetPrice, item.exchange_name)}</span>
                        <span className="sl">🛑 SL: {formatPrice(analyzed.stopLoss, item.exchange_name)}</span>
                      </div>
                    )}

                    <div className="card-footer">
                      <span className="view-details">
                        <Eye size={12} /> View Candlestick Chart
                      </span>
                      <span className="confidence">
                        {analyzed?.confidence || 75}% Confidence
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
