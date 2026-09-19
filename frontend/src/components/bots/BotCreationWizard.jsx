import { useState, useEffect } from 'react';
import {
  X, ChevronRight, ChevronLeft, Check, Sparkles, Loader2,
  Grid3X3, Repeat, Target, ArrowUpDown, BarChart3, Scale, Shuffle, Radar,
  AlertTriangle, Info, Search, Zap, FlaskConical, Wallet, BookOpen, ShieldCheck, CheckCircle2, TrendingUp, TrendingDown
} from 'lucide-react';
import GridBotForm from './forms/GridBotForm.jsx';
import PrecisionGridForm from './forms/PrecisionGridForm.jsx';
import JarvisForm from './forms/JarvisForm.jsx';
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
    type: 'JARVIS',
    name: 'JARVIS Bot',
    icon: TrendingUp,
    description: '3-Grid progressive capital engine. 75%/25% staged entry, 70% harvest, midpoint Inter-Grid SL & runner surges.',
    difficulty: 'Intermediate',
    color: '#06b6d4',
    featured: true,
  },
  {
    type: 'PRECISION_GRID',
    name: 'Precision Grid',
    icon: Zap,
    description: 'Decimal tolerance corridor grid. Eliminates stranded orders with instant market fills on touch.',
    difficulty: 'Intermediate',
    color: '#0ea5e9',
  },
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

// Default supported exchanges (always available for Paper mode, connectable for Live mode)
const DEFAULT_SUPPORTED_EXCHANGES = [
  { name: 'Demo', label: 'Demo Exchange', isDemo: true, isConnected: true },
  { name: 'Pionex', label: 'Pionex', type: 'crypto', isDemo: false, isConnected: false },
  { name: 'Jupiter', label: 'Jupiter (Solana DEX)', type: 'dex', isDemo: false, isConnected: false },
  { name: 'AngelOne', label: 'Angel One (SmartAPI)', type: 'stock', isDemo: false, isConnected: false },
  { name: 'Binance', label: 'Binance', type: 'crypto', isDemo: false, isConnected: false },
  { name: 'Bybit', label: 'Bybit', type: 'crypto', isDemo: false, isConnected: false },
  { name: 'Kraken', label: 'Kraken', type: 'crypto', isDemo: false, isConnected: false },
  { name: 'Alpaca', label: 'Alpaca (US Stocks)', type: 'stock', isDemo: false, isConnected: false },
  { name: 'Upstox', label: 'Upstox (NSE/BSE)', type: 'stock', isDemo: false, isConnected: false },
];

// Common trading pairs for demo & quick selection
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

const SOLANA_SYMBOLS = [
  { symbol: 'SOL/USDC', price: 145, name: 'Solana' },
  { symbol: 'JUP/USDC', price: 0.95, name: 'Jupiter' },
  { symbol: 'RAY/USDC', price: 1.85, name: 'Raydium' },
  { symbol: 'BONK/USDC', price: 0.000022, name: 'Bonk' },
  { symbol: 'WIF/USDC', price: 1.65, name: 'dogwifhat' },
  { symbol: 'PYTH/USDC', price: 0.32, name: 'Pyth Network' },
  { symbol: 'JTO/USDC', price: 2.15, name: 'Jito' },
  { symbol: 'ORCA/USDC', price: 2.45, name: 'Orca' },
  { symbol: 'RENDER/USDC', price: 5.80, name: 'Render Token' },
  { symbol: 'POPCAT/USDC', price: 0.65, name: 'Popcat' },
];

const INDIAN_STOCK_SYMBOLS = [
  { symbol: 'RELIANCE', price: 2950, name: 'Reliance Industries Ltd' },
  { symbol: 'TCS', price: 4180, name: 'Tata Consultancy Services' },
  { symbol: 'INFY', price: 1870, name: 'Infosys Ltd' },
  { symbol: 'HDFCBANK', price: 1650, name: 'HDFC Bank Ltd' },
  { symbol: 'ICICIBANK', price: 1200, name: 'ICICI Bank Ltd' },
  { symbol: 'SBIN', price: 810, name: 'State Bank of India' },
  { symbol: 'TATAMOTORS', price: 980, name: 'Tata Motors Ltd' },
  { symbol: 'BHARTIARTL', price: 1550, name: 'Bharti Airtel Ltd' },
  { symbol: 'ITC', price: 505, name: 'ITC Ltd' },
  { symbol: 'LT', price: 3650, name: 'Larsen & Toubro Ltd' },
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
  const [exchanges, setExchanges] = useState(DEFAULT_SUPPORTED_EXCHANGES);
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
    // Show popular symbols when exchange selected (if search empty)
    if (config.exchangeName && !config.symbol && !symbolSearch) {
      const exLower = config.exchangeName.toLowerCase();
      if (['angelone', 'upstox'].includes(exLower)) {
        setSymbols(INDIAN_STOCK_SYMBOLS.map(s => ({ ...s, exchange: config.exchangeName })));
      } else if (exLower === 'jupiter') {
        setSymbols(SOLANA_SYMBOLS.map(s => ({ ...s, exchange: config.exchangeName })));
      } else {
        setSymbols(DEMO_SYMBOLS.map(s => ({ ...s, exchange: config.exchangeName })));
      }
    }
  }, [config.exchangeName, config.symbol, symbolSearch]);

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
      // Get connected and supported exchanges from endpoints
      const [res, brokerRes] = await Promise.all([
        api('/bots/exchanges').catch(() => null),
        api('/brokers/status').catch(() => null),
      ]);

      const connectedSet = new Set();

      if (res?.success && Array.isArray(res.connected)) {
        res.connected.forEach(c => connectedSet.add((c.name || '').toLowerCase()));
      }
      if (brokerRes?.success && Array.isArray(brokerRes.connectedBrokers)) {
        brokerRes.connectedBrokers.forEach(b => connectedSet.add((b.exchange || '').toLowerCase()));
      }
      if (brokerRes?.success && Array.isArray(brokerRes.exchanges)) {
        brokerRes.exchanges.filter(e => e.connected).forEach(e => connectedSet.add((e.name || '').toLowerCase()));
      }

      if (res?.success && res.exchanges && res.exchanges.length > 0) {
        const apiExchanges = res.exchanges.map(ex => {
          const isConn = connectedSet.has((ex.name || '').toLowerCase()) || !!ex.isConnected;
          return {
            name: ex.name,
            label: ex.label || ex.name,
            type: ex.type || 'crypto',
            isDemo: false,
            isConnected: isConn,
            tradingEnabled: isConn || !!ex.tradingEnabled
          };
        });

        const merged = [
          { name: 'Demo', label: 'Demo Exchange', isDemo: true, isConnected: true },
          ...apiExchanges
        ];

        // Deduplicate
        const seen = new Set();
        const unique = merged.filter(ex => {
          const key = ex.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setExchanges(unique);
      } else {
        setExchanges(DEFAULT_SUPPORTED_EXCHANGES.map(ex => ({
          ...ex,
          isConnected: ex.isDemo || connectedSet.has((ex.name || '').toLowerCase())
        })));
      }
    } catch (e) {
      console.error('Failed to load exchanges:', e);
      setExchanges(DEFAULT_SUPPORTED_EXCHANGES);
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
      case 2: {
        if (config.mode === 'LIVE') {
          const selectedEx = exchanges.find(e => e.name.toLowerCase() === config.exchangeName?.toLowerCase());
          if (!selectedEx || (!selectedEx.isConnected && !selectedEx.isDemo)) return false;
        }
        // Dynamic Grid doesn't need symbol - it auto-discovers coins
        if (config.strategyType === 'DYNAMIC_GRID') {
          return !!config.exchangeName;
        }
        return !!config.exchangeName && !!config.symbol;
      }
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
      case 'JARVIS':
        return <JarvisForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} symbolInfo={symbolInfo} />;
      case 'PRECISION_GRID':
        return <PrecisionGridForm params={config.params} onChange={p => setConfig(c => ({ ...c, params: p }))} symbolInfo={symbolInfo} />;
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
                    : exchanges;  // Paper mode: demo + all real exchanges

                  const selectedExObj = exchanges.find(e => e.name.toLowerCase() === config.exchangeName?.toLowerCase());
                  const isSelectedConnected = selectedExObj?.isConnected || selectedExObj?.isDemo;

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
                              const cryptoExchanges = ['demo', 'pionex', 'binance', 'bybit', 'kraken'];
                              if (cryptoExchanges.includes(ex.name.toLowerCase())) {
                                setSymbols(DEMO_SYMBOLS.map(s => ({ ...s, exchange: ex.name })));
                              } else {
                                setSymbols([]);
                              }
                            }}
                          >
                            {ex.isDemo ? <FlaskConical size={14} /> : null}
                            {ex.label || ex.name}
                            {config.mode === 'LIVE' && !ex.isDemo && (
                              <span
                                className={`connection-pill ${ex.isConnected ? 'live-on' : 'live-off'}`}
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginLeft: '6px',
                                  background: ex.isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: ex.isConnected ? '#10b981' : '#ef4444'
                                }}
                              >
                                {ex.isConnected ? 'Ready' : 'Setup Required'}
                              </span>
                            )}
                          </button>
                        )) : (
                          <div className="no-exchanges-msg">
                            <AlertTriangle size={16} />
                            <span>No exchanges configured</span>
                          </div>
                        )}
                      </div>

                      {config.mode === 'LIVE' && config.exchangeName && !isSelectedConnected && (
                        <small className="exchange-hint warning" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                          <AlertTriangle size={14} />
                          <span>
                            {config.exchangeName} API keys are not connected. Add your credentials in the <a href="/exchanges" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Exchanges</a> page to trade live.
                          </span>
                        </small>
                      )}

                      {config.mode === 'PAPER' && (
                        <small className="exchange-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                          <FlaskConical size={14} />
                          Paper trading simulates orders with virtual funds using live market prices from {config.exchangeName || 'the selected exchange'}.
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
                <div
                  className="ai-suggestion-banner"
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '20px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontWeight: 600, fontSize: '14px' }}>
                      <Sparkles size={18} style={{ color: '#3b82f6' }} />
                      <span>{aiSuggestion.ragEnhanced ? '⚡ RAG Strategy Intelligence' : 'AI Recommendation'}</span>
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={12} /> Auto-Applied
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {aiSuggestion.direction && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            textTransform: 'uppercase',
                            background: aiSuggestion.direction === 'LONG' ? 'rgba(16, 185, 129, 0.2)' : aiSuggestion.direction === 'SHORT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                            color: aiSuggestion.direction === 'LONG' ? '#34d399' : aiSuggestion.direction === 'SHORT' ? '#f87171' : '#cbd5e1',
                            border: `1px solid ${aiSuggestion.direction === 'LONG' ? 'rgba(16, 185, 129, 0.4)' : aiSuggestion.direction === 'SHORT' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.4)'}`,
                          }}
                        >
                          {aiSuggestion.direction}
                        </span>
                      )}
                      {aiSuggestion.confidence !== undefined && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#93c5fd',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                          }}
                        >
                          {(aiSuggestion.confidence * 100).toFixed(0)}% Confidence
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '13px', color: '#e2e8f0', lineHeight: 1.5 }}>
                    {aiSuggestion.reasoning}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#94a3b8' }}>
                      <span>Trend: <strong style={{ color: '#f1f5f9' }}>{aiSuggestion.marketAnalysis?.trend || 'sideways'}</strong></span>
                      <span>Volatility: <strong style={{ color: '#f1f5f9' }}>{aiSuggestion.marketAnalysis?.volatility || 'N/A'}</strong></span>
                      {aiSuggestion.sentiment_score !== undefined && (
                        <span>Sentiment: <strong style={{ color: aiSuggestion.sentiment_score >= 0 ? '#34d399' : '#f87171' }}>{aiSuggestion.sentiment_score > 0 ? `+${aiSuggestion.sentiment_score.toFixed(2)}` : aiSuggestion.sentiment_score.toFixed(2)}</strong></span>
                      )}
                    </div>

                    {aiSuggestion.citations && aiSuggestion.citations.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <BookOpen size={12} /> Sources:
                        </span>
                        {aiSuggestion.citations.slice(0, 3).map((cit, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#a5b4fc',
                              borderRadius: '4px',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                            }}
                            title={cit.content}
                          >
                            {cit.collection || cit.title || `KB-${idx + 1}`}
                          </span>
                        ))}
                      </div>
                    )}
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
