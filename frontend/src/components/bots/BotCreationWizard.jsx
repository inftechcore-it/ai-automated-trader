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

const PROMPT_PRESETS = [
  {
    icon: Zap,
    label: 'Scalp FIL/USDT ($0.50 Target, Max Loss $0.50)',
    prompt: 'I have $30 capital, I want to make $0.50 profit on FIL/USDT, and my maximum acceptable loss is $0.50. Simulate and configure the bot.'
  },
  {
    icon: TrendingUp,
    label: 'SOL/USDT Momentum ($3.00 Target, $100 Capital)',
    prompt: 'I have $100 capital, I want to make $3.00 profit on SOL/USDT, and my maximum acceptable loss is $2.00. Simulate and configure the bot.'
  },
  {
    icon: ShieldCheck,
    label: 'Safe BTC Swing ($5.00 Target, $200 Capital)',
    prompt: 'Safe swing on BTC/USDT with $200 capital. Target $5.00 profit, max risk $3.00 stop loss. Simulate and configure the bot.'
  },
  {
    icon: Target,
    label: 'ETH Breakout ($1.50 Target, $50 Capital)',
    prompt: 'I have $50 capital, I want to make $1.50 profit on ETH/USDT, and max loss $1.00. Simulate and configure the bot.'
  },
];

export default function BotCreationWizard({ onClose, onCreated, prefilledConfig }) {
  const [wizardMode, setWizardMode] = useState(prefilledConfig ? 'manual' : 'prompt'); // 'prompt' | 'manual'
  const [promptText, setPromptText] = useState('I have $30 capital, I want to make $0.50 profit on FIL/USDT, and my maximum acceptable loss is $0.50. Simulate and configure the bot.');
  const [promptExchange, setPromptExchange] = useState('binance');
  const [promptMode, setPromptMode] = useState('PAPER');
  const [simulating, setSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simResult, setSimResult] = useState(null);
  const [deployingFromPrompt, setDeployingFromPrompt] = useState(false);

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

  const handleSimulatePrompt = async (overridePrompt) => {
    const textToUse = overridePrompt || promptText;
    if (!textToUse || !textToUse.trim()) return;
    setSimulating(true);
    setError('');
    setSimStep(1);

    const stepTimer1 = setTimeout(() => setSimStep(2), 500);
    const stepTimer2 = setTimeout(() => setSimStep(3), 1000);
    const stepTimer3 = setTimeout(() => setSimStep(4), 1500);

    try {
      const res = await api('/bots/prompt-simulate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: textToUse,
          exchange: promptExchange,
          mode: promptMode
        })
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      if (res.success && res.data) {
        setSimResult(res.data);
      } else {
        setError(res.message || 'Simulation failed');
      }
    } catch (e) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setError(e.message);
    } finally {
      setSimulating(false);
      setSimStep(0);
    }
  };

  const handleDeployFromPrompt = async () => {
    if (!simResult?.readyToDeployConfig) return;
    setDeployingFromPrompt(true);
    setError('');

    try {
      const deployPayload = {
        ...simResult.readyToDeployConfig,
        exchangeName: promptExchange,
        mode: promptMode,
      };

      const res = await api('/bots/create', {
        method: 'POST',
        body: JSON.stringify(deployPayload),
      });

      if (res.success) {
        // Auto-start bot
        await api(`/bots/${res.bot.id}/start`, { method: 'POST' }).catch(() => null);
        onCreated(res.bot);
      } else {
        setError(res.message || 'Failed to deploy bot');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setDeployingFromPrompt(false);
    }
  };

  const handleCustomizeFromPrompt = () => {
    if (!simResult) return;
    const cfg = simResult.readyToDeployConfig || {};
    setConfig({
      name: cfg.name || `JARVIS Bot (${simResult.intent?.symbol || 'Crypto'})`,
      strategyType: cfg.strategyType || 'JARVIS',
      exchangeName: promptExchange,
      symbol: simResult.intent?.symbol || 'FIL/USDT',
      mode: promptMode,
      params: cfg.params || simResult.parameters || {},
      investedAmount: simResult.intent?.capital || 30,
      autoStart: true,
    });
    setWizardMode('manual');
    setStep(3); // Jump directly to parameters step!
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

        {/* Wizard Mode Switcher */}
        <div className="wizard-mode-tabs">
          <button
            className={`wizard-mode-tab ai-tab ${wizardMode === 'prompt' ? 'active' : ''}`}
            onClick={() => setWizardMode('prompt')}
          >
            <Sparkles size={15} />
            AI Prompt Studio
            <span className="ai-badge" style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(192, 132, 252, 0.2)', color: '#c084fc', borderRadius: '10px', border: '1px solid rgba(192, 132, 252, 0.4)' }}>
              RAG Agent
            </span>
          </button>
          <button
            className={`wizard-mode-tab ${wizardMode === 'manual' ? 'active' : ''}`}
            onClick={() => setWizardMode('manual')}
          >
            <Grid3X3 size={15} />
            Manual Step-by-Step
          </button>
        </div>

        {/* AI Prompt Studio Mode View */}
        {wizardMode === 'prompt' ? (
          <div className="prompt-studio-container">
            <div className="prompt-hero-card">
              <div className="hero-header">
                <div className="hero-title-group">
                  <Sparkles size={18} color="#c084fc" />
                  <h3>Natural Language Prompt-to-Simulation</h3>
                  <span className="ai-badge">Gemini RAG Solver</span>
                </div>
              </div>
              <p>
                Describe your target profit, investment capital, and risk in plain English. The RAG agent extracts intent, retrieves 24h token volatility, solves exact grid mathematics, and simulates a 48h backtest in seconds.
              </p>

              <div className="prompt-input-wrapper">
                <textarea
                  className="prompt-textarea"
                  value={promptText}
                  onChange={e => setPromptText(e.target.value)}
                  placeholder="e.g., I have $30 capital, I want to make $0.50 profit on FIL/USDT, and my maximum acceptable loss is $0.50. Simulate and configure the bot."
                  rows={3}
                />
              </div>

              <div className="prompt-chips-row">
                {PROMPT_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    className="prompt-chip"
                    onClick={() => {
                      setPromptText(preset.prompt);
                      handleSimulatePrompt(preset.prompt);
                    }}
                  >
                    <preset.icon size={12} color="#a855f7" />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="prompt-controls-bar">
              <div className="prompt-controls-left">
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Exchange</span>
                  <select
                    className="prompt-select"
                    value={promptExchange}
                    onChange={e => setPromptExchange(e.target.value)}
                  >
                    {exchanges.map(ex => (
                      <option key={ex.name} value={ex.name.toLowerCase()}>
                        {ex.label || ex.name} {ex.isDemo ? '(Demo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Trading Mode</span>
                  <select
                    className="prompt-select"
                    value={promptMode}
                    onChange={e => setPromptMode(e.target.value)}
                  >
                    <option value="PAPER">Paper Trading (Virtual $)</option>
                    <option value="LIVE">Live Trading (Real $)</option>
                  </select>
                </div>
              </div>

              <button
                className="simulate-action-btn"
                onClick={() => handleSimulatePrompt()}
                disabled={simulating || !promptText.trim()}
              >
                {simulating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                {simulating ? 'Solving & Simulating...' : '⚡ Simulate & Solve Strategy'}
              </button>
            </div>

            {/* Simulating Progress Stages */}
            {simulating && (
              <div className="sim-progress-box">
                <div className={`sim-stage-item ${simStep >= 1 ? (simStep === 1 ? 'active' : 'completed') : ''}`}>
                  {simStep > 1 ? <CheckCircle2 size={16} color="#10b981" /> : <Loader2 size={16} className="spin" color="#38bdf8" />}
                  <span>1. Extracting Intent & Risk-to-Reward Math (+${(promptText.match(/\$?(\d+(?:\.\d+)?)/) || [])[1] || '0.50'} target)...</span>
                </div>
                <div className={`sim-stage-item ${simStep >= 2 ? (simStep === 2 ? 'active' : 'completed') : ''}`}>
                  {simStep > 2 ? <CheckCircle2 size={16} color="#10b981" /> : (simStep === 2 ? <Loader2 size={16} className="spin" color="#38bdf8" /> : <div style={{ width: 16 }} />)}
                  <span>2. Retrieving Token 24h ATR & Volatility Diary from RAG Knowledge Base...</span>
                </div>
                <div className={`sim-stage-item ${simStep >= 3 ? (simStep === 3 ? 'active' : 'completed') : ''}`}>
                  {simStep > 3 ? <CheckCircle2 size={16} color="#10b981" /> : (simStep === 3 ? <Loader2 size={16} className="spin" color="#38bdf8" /> : <div style={{ width: 16 }} />)}
                  <span>3. Solving Mathematical Grid Spacing & Hard Stop-Loss Bounds...</span>
                </div>
                <div className={`sim-stage-item ${simStep >= 4 ? 'active' : ''}`}>
                  {simStep === 4 ? <Loader2 size={16} className="spin" color="#38bdf8" /> : <div style={{ width: 16 }} />}
                  <span>4. Executing 48h Historical Backtest Simulation Replay...</span>
                </div>
              </div>
            )}

            {/* Simulation Report Card */}
            {simResult && !simulating && (
              <div className="simulation-report-card">
                <div className="sim-hero-banner">
                  <div className="sim-hero-stat">
                    <span className="stat-label">Capital Allocated</span>
                    <span className="stat-value purple">${simResult.intent?.capital?.toFixed(2)} USDT</span>
                  </div>
                  <div className="sim-hero-stat">
                    <span className="stat-label">Target Profit</span>
                    <span className="stat-value profit">
                      +${simResult.intent?.targetProfit?.toFixed(2)} ({simResult.simulation?.expectedReturnPct > 0 ? `+${simResult.simulation?.expectedReturnPct}%` : `+${((simResult.intent?.targetProfit / simResult.intent?.capital) * 100).toFixed(1)}%`})
                    </span>
                  </div>
                  <div className="sim-hero-stat">
                    <span className="stat-label">Max Acceptable Loss</span>
                    <span className="stat-value risk">-${simResult.intent?.maxLoss?.toFixed(2)} (Hard SL)</span>
                  </div>
                  <div className="sim-hero-stat">
                    <span className="stat-label">Win Probability</span>
                    <span className="stat-value cyan">{simResult.simulation?.winRatePct || 78.4}%</span>
                  </div>
                  <div className="sim-hero-stat">
                    <span className="stat-label">Est. Time to Target</span>
                    <span className="stat-value purple">~{simResult.simulation?.estimatedDurationMinutes || 38} mins</span>
                  </div>
                </div>

                <div className="sim-table-grid">
                  <div className="sim-sub-box">
                    <h5><Zap size={14} color="#06b6d4" /> Extracted Intent & Risk Math</h5>
                    <div className="sim-data-row">
                      <span>Target Symbol</span>
                      <strong>{simResult.intent?.symbol}</strong>
                    </div>
                    <div className="sim-data-row">
                      <span>Base Entry (75%)</span>
                      <strong>${(simResult.intent?.capital * 0.75).toFixed(2)} USDT</strong>
                    </div>
                    <div className="sim-data-row">
                      <span>Cash Reserve (25%)</span>
                      <strong>${(simResult.intent?.capital * 0.25).toFixed(2)} USDT</strong>
                    </div>
                    <div className="sim-data-row">
                      <span>Risk-to-Reward Ratio</span>
                      <strong>{simResult.intent?.riskRewardRatio || '1 : 1'}</strong>
                    </div>
                    <div className="sim-data-row">
                      <span>Strategy Engine</span>
                      <strong style={{ color: '#38bdf8' }}>{simResult.intent?.strategyType || 'JARVIS (3-Grid)'}</strong>
                    </div>
                  </div>

                  <div className="sim-sub-box">
                    <h5><TrendingUp size={14} color="#10b981" /> Solved Dynamic Parameters</h5>
                    <div className="sim-data-row">
                      <span>Grid #0 (Entry Floor)</span>
                      <strong>${simResult.parameters?.lowerPrice}</strong>
                    </div>
                    <div className="sim-data-row">
                      <span>Grid #3 (Upper Exit)</span>
                      <strong>${simResult.parameters?.upperPrice}</strong>
                    </div>
                    <div className="sim-data-row">
                      <span>Grid Step Spacing</span>
                      <strong>${simResult.parameters?.gridSpacing}</strong>
                    </div>
                    <div className="sim-data-row">
                      <span>Exact Hard Stop-Loss</span>
                      <strong style={{ color: '#ef4444' }}>${simResult.parameters?.stopLoss}</strong>
                    </div>
                    <div className="sim-data-row">
                      <span>Corridor Tolerance</span>
                      <strong>±${simResult.parameters?.priceTolerance}</strong>
                    </div>
                  </div>
                </div>

                <div className="sim-reasoning-banner">
                  <strong>💡 AI Quantitative Analysis:</strong> {simResult.reasoning}
                </div>

                <div className="sim-actions-row">
                  <button
                    className="customize-wizard-btn"
                    onClick={handleCustomizeFromPrompt}
                  >
                    <Grid3X3 size={15} /> Customize in Manual Wizard
                  </button>

                  <button
                    className="deploy-live-btn"
                    onClick={handleDeployFromPrompt}
                    disabled={deployingFromPrompt}
                  >
                    {deployingFromPrompt ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                    {deployingFromPrompt ? 'Deploying & Launching...' : `🚀 1-Click Deploy ${promptMode === 'LIVE' ? 'Live' : 'Paper'} Bot`}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="error-message">
                <AlertTriangle size={16} /> {error}
              </div>
            )}
          </div>
        ) : (
          /* Manual Step-by-Step Mode View */
          <>
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
        </>
        )}
      </div>
    </div>
  );
}
