import { useState, useEffect } from 'react';
import {
  X, ChevronRight, ChevronLeft, Check, Sparkles, Loader2,
  Grid3X3, Repeat, Target, ArrowUpDown, BarChart3, Scale, Shuffle, Radar,
  AlertTriangle, Info, Search, Zap, FlaskConical, Wallet
} from 'lucide-react';
import GridBotForm from './forms/GridBotForm.jsx';
import DCABotForm from './forms/DCABotForm.jsx';
import SmartTradeForm from './forms/SmartTradeForm.jsx';
import TrailingBotForm from './forms/TrailingBotForm.jsx';
import MartingaleForm from './forms/MartingaleForm.jsx';
import RebalancingForm from './forms/RebalancingForm.jsx';
import InfinityGridForm from './forms/InfinityGridForm.jsx';
import DynamicGridForm from './forms/DynamicGridForm.jsx';

const api = (path, opts = {}) =>
  fetch(`${import.meta.env.VITE_API || 'http://localhost:5000'}/api${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    ...opts
  }).then(r => r.json());

const STRATEGIES = [
  {
    type: 'GRID',
    name: 'Grid Bot',
    icon: Grid3X3,
    description: 'Buy low sell high within a price range. Best for sideways markets.',
    difficulty: 'Beginner',
    color: '#3b82f6',
  },
  {
    type: 'INFINITY_GRID',
    name: 'Infinity Grid',
    icon: Grid3X3,
    description: 'Grid with no upper limit. For long-term bullish assets.',
    difficulty: 'Beginner',
    color: '#8b5cf6',
  },
  {
    type: 'DCA',
    name: 'DCA Bot',
    icon: Repeat,
    description: 'Buy at regular intervals. Simplest set-and-forget strategy.',
    difficulty: 'Beginner',
    color: '#10b981',
  },
  {
    type: 'SMART_TRADE',
    name: 'Smart Trade',
    icon: Target,
    description: 'One trade with auto take-profit and stop-loss.',
    difficulty: 'Intermediate',
    color: '#f59e0b',
  },
  {
    type: 'TRAILING',
    name: 'Trailing Bot',
    icon: ArrowUpDown,
    description: 'Ride trends and auto-exit on reversal.',
    difficulty: 'Intermediate',
    color: '#ec4899',
  },
  {
    type: 'MARTINGALE',
    name: 'Martingale',
    icon: BarChart3,
    description: 'Double down on dips, sell on recovery. High risk.',
    difficulty: 'Advanced',
    color: '#ef4444',
    warning: true,
  },
  {
    type: 'REBALANCING',
    name: 'Rebalancing',
    icon: Scale,
    description: 'Maintain target portfolio allocations automatically.',
    difficulty: 'Intermediate',
    color: '#06b6d4',
  },
  {
    type: 'ARBITRAGE',
    name: 'Arbitrage',
    icon: Shuffle,
    description: 'Cross-exchange and triangular arbitrage (auto or manual).',
    difficulty: 'Advanced',
    color: '#6366f1',
  },
  {
    type: 'DYNAMIC_GRID',
    name: 'Dynamic Grid',
    icon: Radar,
    description: 'Auto-discovers coins in your price range and trades multiple simultaneously. Set max buys per coin.',
    difficulty: 'Intermediate',
    color: '#14b8a6',
    featured: true,
  },
];

const DIFFICULTY_COLORS = {
  'Beginner': '#10b981',
  'Intermediate': '#f59e0b',
  'Advanced': '#ef4444',
};

// Demo exchanges for paper trading (always available)
const DEMO_EXCHANGES = [
  { name: 'Demo', label: 'Demo Exchange', isDemo: true },
];

// Common trading pairs for demo mode
const DEMO_SYMBOLS = [
  { symbol: 'BTC/USDT', price: 67500, name: 'Bitcoin' },
  { symbol: 'ETH/USDT', price: 3450, name: 'Ethereum' },
  { symbol: 'BNB/USDT', price: 580, name: 'BNB' },
  { symbol: 'SOL/USDT', price: 145, name: 'Solana' },
  { symbol: 'XRP/USDT', price: 0.52, name: 'XRP' },
  { symbol: 'DOGE/USDT', price: 0.12, name: 'Dogecoin' },
  { symbol: 'ADA/USDT', price: 0.45, name: 'Cardano' },
  { symbol: 'AVAX/USDT', price: 35, name: 'Avalanche' },
  { symbol: 'SHIB/USDT', price: 0.000024, name: 'Shiba Inu' },
  { symbol: 'DOT/USDT', price: 7.2, name: 'Polkadot' },
  { symbol: 'MATIC/USDT', price: 0.58, name: 'Polygon' },
  { symbol: 'LTC/USDT', price: 85, name: 'Litecoin' },
  { symbol: 'LINK/USDT', price: 14.5, name: 'Chainlink' },
  { symbol: 'UNI/USDT', price: 9.8, name: 'Uniswap' },
  { symbol: 'ATOM/USDT', price: 8.5, name: 'Cosmos' },
  { symbol: 'XLM/USDT', price: 0.11, name: 'Stellar' },
  { symbol: 'TRX/USDT', price: 0.12, name: 'TRON' },
  { symbol: 'NEAR/USDT', price: 5.2, name: 'NEAR Protocol' },
  { symbol: 'APT/USDT', price: 9.5, name: 'Aptos' },
  { symbol: 'ARB/USDT', price: 0.85, name: 'Arbitrum' },
  { symbol: 'OP/USDT', price: 2.1, name: 'Optimism' },
  { symbol: 'INJ/USDT', price: 25, name: 'Injective' },
  { symbol: 'SUI/USDT', price: 1.2, name: 'Sui' },
  { symbol: 'PEPE/USDT', price: 0.000012, name: 'Pepe' },
];

export default function BotCreationWizard({ onClose, onCreated, prefilledConfig }) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    name: '',
    strategyType: prefilledConfig?.strategyType || '',
    exchangeName: prefilledConfig?.exchangeName || '',
    symbol: prefilledConfig?.symbol || '',
    mode: 'PAPER',
    params: prefilledConfig?.params || {},
    investedAmount: 100,
  });
  const [exchanges, setExchanges] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [symbolInfo, setSymbolInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadExchanges();
  }, []);

  useEffect(() => {
    // For demo exchange, show all symbols when selected (no search needed)
    if (config.exchangeName === 'Demo' && !config.symbol) {
      setSymbols(DEMO_SYMBOLS);
    }
  }, [config.exchangeName, config.symbol]);

  // Debounced search for live exchanges
  useEffect(() => {
    if (config.exchangeName === 'Demo' || !config.exchangeName || symbolSearch.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api(`/market/search?exchange=${config.exchangeName}&q=${encodeURIComponent(symbolSearch)}`);
        if (res.success && res.symbols && res.symbols.length > 0) {
          const normalized = res.symbols.slice(0, 20).map(s => ({
            symbol: s.symbol,
            price: s.price || s.last || null,
            name: s.name || s.symbol
          }));
          setSymbols(normalized);
        } else {
          setSymbols([]);
        }
      } catch (e) {
        console.error('[Wizard] Search error:', e);
        setSymbols([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [config.exchangeName, symbolSearch]);

  const loadExchanges = async () => {
    try {
      // Get connected exchanges from bot-specific endpoint (auto-connected from env)
      const res = await api('/bots/exchanges');

      if (res.success && res.exchanges) {
        const liveExchanges = res.exchanges.map(ex => ({
          name: ex.name,
          label: ex.label || ex.name,
          type: ex.type || 'crypto',
          isDemo: false,
          tradingEnabled: ex.tradingEnabled
        }));

        // Always include demo exchange, plus any real connected exchanges
        setExchanges([...DEMO_EXCHANGES, ...liveExchanges]);
      } else {
        // Fallback to demo exchange only
        setExchanges(DEMO_EXCHANGES);
      }
    } catch (e) {
      console.error('Failed to load exchanges:', e);
      // Fallback to demo exchange only
      setExchanges(DEMO_EXCHANGES);
    }
  };

  const selectSymbol = async (symbol) => {
    setConfig(c => ({ ...c, symbol }));
    setSymbolSearch(symbol);
    setSymbols([]); // Hide dropdown

    // Handle demo exchange locally
    if (config.exchangeName === 'Demo') {
      const demoSymbol = DEMO_SYMBOLS.find(s => s.symbol === symbol);
      if (demoSymbol) {
        setSymbolInfo({
          last: demoSymbol.price,
          percentage: (Math.random() * 10 - 5).toFixed(2),
          quoteVolume: Math.floor(Math.random() * 500000000) + 10000000,
        });
      }
      return;
    }

    try {
      const res = await api(`/market/quote?exchange=${config.exchangeName}&symbol=${encodeURIComponent(symbol)}`);
      if (res.success && res.quote) {
        setSymbolInfo({
          last: res.quote.price || res.quote.last || res.quote.c,
          percentage: res.quote.changePercent || res.quote.percentage || res.quote.P || 0,
          quoteVolume: res.quote.volume || res.quote.quoteVolume || res.quote.v || 0
        });
      }
    } catch (e) {
      console.error('Failed to load symbol info:', e);
    }
  };

  const getAiSuggestion = async () => {
    if (!config.strategyType || !config.symbol || !config.exchangeName) return;

    setAiSuggesting(true);
    setAiSuggestion(null);

    try {
      const res = await api('/bots/ai-suggest', {
        method: 'POST',
        body: JSON.stringify({
          strategyType: config.strategyType,
          symbol: config.symbol,
          exchange: config.exchangeName,
        }),
      });

      if (res.success) {
        setAiSuggestion(res);
        setConfig(c => ({
          ...c,
          params: { ...c.params, ...res.suggestedParams },
        }));
      }
    } catch (e) {
      console.error('Failed to get AI suggestion:', e);
    } finally {
      setAiSuggesting(false);
    }
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        return !!config.strategyType;
      case 2:
        // Dynamic Grid doesn't need symbol - it auto-discovers coins
        if (config.strategyType === 'DYNAMIC_GRID') {
          return !!config.exchangeName;
        }
        return !!config.exchangeName && !!config.symbol;
      case 3:
        return Object.keys(config.params).length > 0;
      case 4:
        return !!config.name && config.investedAmount > 0;
      default:
        return false;
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');

    try {
      const res = await api('/bots/create', {
        method: 'POST',
        body: JSON.stringify(config),
      });

      if (res.success) {
        // Start bot immediately if requested
        if (config.autoStart) {
          await api(`/bots/${res.bot.id}/start`, { method: 'POST' });
        }
        onCreated(res.bot);
      } else {
        setError(res.message || 'Failed to create bot');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const selectedStrategy = STRATEGIES.find(s => s.type === config.strategyType);

  const renderStrategyForm = () => {
    switch (config.strategyType) {
      case 'GRID':
        return <GridBotForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} symbolInfo={symbolInfo} />;
      case 'INFINITY_GRID':
        return <InfinityGridForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} symbolInfo={symbolInfo} />;
      case 'DCA':
        return <DCABotForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} />;
      case 'SMART_TRADE':
        return <SmartTradeForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} symbolInfo={symbolInfo} />;
      case 'TRAILING':
        return <TrailingBotForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} symbolInfo={symbolInfo} />;
      case 'MARTINGALE':
        return <MartingaleForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} />;
      case 'REBALANCING':
        return <RebalancingForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} exchanges={exchanges} />;
      case 'DYNAMIC_GRID':
        return <DynamicGridForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} symbolInfo={symbolInfo} />;
      default:
        return <div className="no-form">Select a strategy first</div>;
    }
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        <div className="wizard-header">
          <h2>Create Trading Bot</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="wizard-progress">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`progress-step ${step >= s ? 'active' : ''} ${step === s ? 'current' : ''}`}>
              <div className="step-number">{step > s ? <Check size={14} /> : s}</div>
              <span className="step-label">
                {s === 1 ? 'Strategy' : s === 2 ? 'Exchange' : s === 3 ? 'Parameters' : 'Review'}
              </span>
            </div>
          ))}
        </div>

        <div className="wizard-content">
          {/* Step 1: Choose Strategy */}
          {step === 1 && (
            <div className="step-content strategy-selection">
              <h3>Choose a Strategy</h3>
              <div className="strategy-grid">
                {STRATEGIES.map(strategy => (
                  <div
                    key={strategy.type}
                    className={`strategy-card ${config.strategyType === strategy.type ? 'selected' : ''}`}
                    onClick={() => setConfig(c => ({ ...c, strategyType: strategy.type }))}
                    style={{ '--strategy-color': strategy.color }}
                  >
                    <div className="strategy-icon" style={{ background: `${strategy.color}15`, color: strategy.color }}>
                      <strategy.icon size={24} />
                    </div>
                    <div className="strategy-info">
                      <div className="strategy-header">
                        <h4>{strategy.name}</h4>
                        {strategy.warning && (
                          <span className="risk-badge">
                            <AlertTriangle size={12} /> High Risk
                          </span>
                        )}
                      </div>
                      <p>{strategy.description}</p>
                      <span
                        className="difficulty-badge"
                        style={{ background: `${DIFFICULTY_COLORS[strategy.difficulty]}15`, color: DIFFICULTY_COLORS[strategy.difficulty] }}
                      >
                        {strategy.difficulty}
                      </span>
                    </div>
                    {config.strategyType === strategy.type && (
                      <div className="selected-check" style={{ background: strategy.color }}>
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Exchange & Symbol */}
          {step === 2 && (
            <div className="step-content exchange-selection">
              <h3>{config.strategyType === 'DYNAMIC_GRID' ? 'Select Exchange' : 'Select Exchange & Symbol'}</h3>

              <div className="mode-toggle">
                <button
                  className={`mode-btn ${config.mode === 'PAPER' ? 'active' : ''}`}
                  onClick={() => setConfig(c => ({ ...c, mode: 'PAPER' }))}
                >
                  <FlaskConical size={16} />
                  Paper Trading
                  <small>Test without real funds</small>
                </button>
                <button
                  className={`mode-btn ${config.mode === 'LIVE' ? 'active' : ''}`}
                  onClick={() => {
                    // When switching to Live mode, clear Demo exchange if selected
                    setConfig(c => ({
                      ...c,
                      mode: 'LIVE',
                      exchangeName: c.exchangeName === 'Demo' ? '' : c.exchangeName,
                      symbol: c.exchangeName === 'Demo' ? '' : c.symbol
                    }));
                    if (config.exchangeName === 'Demo') {
                      setSymbols([]);
                      setSymbolInfo(null);
                      setSymbolSearch('');
                    }
                  }}
                >
                  <Wallet size={16} />
                  Live Trading
                  <small>Trade with real funds</small>
                </button>
              </div>

              <div className="form-group">
                <label>Exchange</label>
                {(() => {
                  // Filter exchanges based on mode
                  const filteredExchanges = config.mode === 'LIVE'
                    ? exchanges.filter(ex => !ex.isDemo)  // Live mode: only real exchanges
                    : exchanges;  // Paper mode: demo + real exchanges

                  const hasRealExchanges = exchanges.some(ex => !ex.isDemo);

                  return (
                    <>
                      <div className="exchange-selector">
                        {filteredExchanges.length > 0 ? filteredExchanges.map(ex => (
                          <button
                            key={ex.name}
                            className={`exchange-btn ${config.exchangeName === ex.name ? 'selected' : ''} ${ex.isDemo ? 'demo' : ''}`}
                            onClick={() => {
                              setConfig(c => ({ ...c, exchangeName: ex.name, symbol: '' }));
                              setSymbolSearch('');
                              setSymbolInfo(null);
                              // For demo exchange, show all symbols immediately
                              if (ex.isDemo) {
                                setSymbols(DEMO_SYMBOLS);
                              } else {
                                setSymbols([]);
                              }
                            }}
                          >
                            {ex.isDemo ? <FlaskConical size={14} /> : null}
                            {ex.label || ex.name}
                          </button>
                        )) : (
                          <div className="no-exchanges-msg">
                            <AlertTriangle size={16} />
                            <span>No exchanges connected for live trading</span>
                          </div>
                        )}
                      </div>
                      {config.mode === 'LIVE' && !hasRealExchanges && (
                        <small className="exchange-hint warning">
                          <AlertTriangle size={12} />
                          Connect an exchange in the <a href="/exchanges">Exchanges</a> page to enable live trading
                        </small>
                      )}
                      {config.mode === 'PAPER' && !hasRealExchanges && (
                        <small className="exchange-hint">
                          Using Demo Exchange for paper trading. Connect real exchanges in <a href="/exchanges">Exchanges</a> for live data.
                        </small>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Dynamic Grid: Show auto-discovery info instead of symbol selection */}
              {config.exchangeName && config.strategyType === 'DYNAMIC_GRID' && (
                <div className="auto-discovery-info">
                  <div className="info-banner featured">
                    <Radar size={20} />
                    <div>
                      <strong>Automatic Coin Discovery</strong>
                      <p>This bot will scan {config.exchangeName} for coins matching your price range and trade them automatically. No manual coin selection needed.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Regular symbol selection for other strategies */}
              {config.exchangeName && config.strategyType !== 'DYNAMIC_GRID' && (
                <div className="form-group">
                  <label>
                    Trading Pair {config.symbol && <span className="selected-symbol">({config.symbol})</span>}
                  </label>
                  <div className="symbol-search">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder={config.exchangeName === 'Demo' ? "Select or search symbol" : "Type to search (e.g. BTC)"}
                      value={symbolSearch}
                      onChange={e => {
                        const val = e.target.value;
                        setSymbolSearch(val);
                        // Clear selected symbol when user starts typing again
                        if (config.symbol && val !== config.symbol) {
                          setConfig(c => ({ ...c, symbol: '' }));
                        }
                        // For demo, filter locally on each keystroke
                        if (config.exchangeName === 'Demo') {
                          const query = val.toLowerCase();
                          setSymbols(query
                            ? DEMO_SYMBOLS.filter(s =>
                                s.symbol.toLowerCase().includes(query) ||
                                (s.name && s.name.toLowerCase().includes(query))
                              )
                            : DEMO_SYMBOLS
                          );
                        }
                      }}
                      onFocus={() => {
                        // Show dropdown on focus if we have symbols
                        if (config.exchangeName === 'Demo' && symbols.length === 0) {
                          setSymbols(DEMO_SYMBOLS);
                        }
                      }}
                    />
                    {config.symbol && (
                      <button
                        type="button"
                        className="clear-symbol-btn"
                        onClick={() => {
                          setConfig(c => ({ ...c, symbol: '' }));
                          setSymbolSearch('');
                          setSymbolInfo(null);
                          if (config.exchangeName === 'Demo') {
                            setSymbols(DEMO_SYMBOLS);
                          } else {
                            setSymbols([]);
                          }
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {/* Symbol dropdown */}
                  {symbols.length > 0 ? (
                    <div
                      style={{
                        display: 'block',
                        position: 'relative',
                        background: '#1a2332',
                        border: '2px solid #3b82f6',
                        borderRadius: '8px',
                        marginTop: '8px',
                        maxHeight: '250px',
                        overflowY: 'auto',
                        zIndex: 9999,
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      {symbols.map(s => (
                        <div
                          key={s.symbol}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #2d3748',
                            color: '#e7edf5',
                            background: '#1a2332',
                          }}
                          onClick={() => selectSymbol(s.symbol)}
                          onMouseEnter={e => e.currentTarget.style.background = '#2d3748'}
                          onMouseLeave={e => e.currentTarget.style.background = '#1a2332'}
                        >
                          <span style={{ fontWeight: 600, color: '#fff' }}>{s.symbol}</span>
                          <span style={{ color: '#a0aec0', fontFamily: 'monospace' }}>
                            {s.price ? `$${typeof s.price === 'number' ? s.price.toLocaleString() : s.price}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!config.symbol && symbolSearch.length >= 2 && symbols.length === 0 && config.exchangeName !== 'Demo' && (
                    <div className="search-hint">Searching for "{symbolSearch}"...</div>
                  )}
                </div>
              )}

              {symbolInfo && config.strategyType !== 'DYNAMIC_GRID' && (
                <div className="symbol-info-card">
                  <div className="symbol-detail">
                    <span className="label">Current Price</span>
                    <span className="value">${symbolInfo.last?.toFixed(6)}</span>
                  </div>
                  <div className="symbol-detail">
                    <span className="label">24h Change</span>
                    <span className={`value ${symbolInfo.percentage >= 0 ? 'positive' : 'negative'}`}>
                      {symbolInfo.percentage >= 0 ? '+' : ''}{symbolInfo.percentage?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="symbol-detail">
                    <span className="label">24h Volume</span>
                    <span className="value">${(symbolInfo.quoteVolume || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Strategy Parameters */}
          {step === 3 && (
            <div className="step-content parameters-form">
              <div className="params-header">
                <h3>Configure {selectedStrategy?.name} Parameters</h3>
                <button
                  className="ai-suggest-btn"
                  onClick={getAiSuggestion}
                  disabled={aiSuggesting}
                >
                  {aiSuggesting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                  AI Suggest
                </button>
              </div>

              {aiSuggestion && (
                <div className="ai-suggestion-banner">
                  <Sparkles size={16} />
                  <div className="suggestion-content">
                    <strong>AI Recommendation</strong>
                    <p>{aiSuggestion.reasoning}</p>
                    <div className="market-analysis">
                      <span>Trend: {aiSuggestion.marketAnalysis?.trend}</span>
                      <span>Volatility: {aiSuggestion.marketAnalysis?.volatility}</span>
                    </div>
                  </div>
                </div>
              )}

              {renderStrategyForm()}
            </div>
          )}

          {/* Step 4: Review & Launch */}
          {step === 4 && (
            <div className="step-content review-section">
              <h3>Review & Launch</h3>

              <div className="form-group">
                <label>Bot Name</label>
                <input
                  type="text"
                  placeholder="My BTC Grid Bot"
                  value={config.name}
                  onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Investment Amount (USDT)</label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={config.investedAmount}
                  onChange={e => setConfig(c => ({ ...c, investedAmount: Number(e.target.value) }))}
                />
              </div>

              <div className="review-summary">
                <h4>Summary</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="label">Strategy</span>
                    <span className="value">{selectedStrategy?.name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Exchange</span>
                    <span className="value">{config.exchangeName}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Symbol</span>
                    <span className="value">
                      {config.strategyType === 'DYNAMIC_GRID' ? (
                        <><Radar size={14} /> Auto-Discovery</>
                      ) : (
                        config.symbol
                      )}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Mode</span>
                    <span className={`value mode-${config.mode.toLowerCase()}`}>
                      {config.mode === 'PAPER' ? <FlaskConical size={14} /> : <Wallet size={14} />}
                      {config.mode}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Investment</span>
                    <span className="value">${config.investedAmount}</span>
                  </div>
                </div>

                <div className="params-summary">
                  <h5>Parameters</h5>
                  {Object.entries(config.params).map(([key, value]) => (
                    <div key={key} className="param-item">
                      <span className="param-key">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="param-value">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="launch-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.autoStart}
                    onChange={e => setConfig(c => ({ ...c, autoStart: e.target.checked }))}
                  />
                  <span>Start bot immediately after creation</span>
                </label>
              </div>

              {config.mode === 'LIVE' && (
                <div className="live-warning">
                  <AlertTriangle size={16} />
                  <span>This bot will trade with real funds. Make sure you understand the risks.</span>
                </div>
              )}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          {step > 1 && (
            <button className="back-btn" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <div className="footer-right">
            {step < 4 ? (
              <button
                className="next-btn"
                onClick={() => setStep(s => s + 1)}
                disabled={!validateStep()}
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                className="create-btn"
                onClick={handleCreate}
                disabled={creating || !validateStep()}
              >
                {creating ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                {config.autoStart ? 'Create & Start' : 'Create Bot'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
