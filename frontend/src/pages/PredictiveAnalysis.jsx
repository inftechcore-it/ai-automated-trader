import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, TrendingUp, TrendingDown, Activity, Zap, Shield,
  RefreshCw, Play, BarChart3, Clock, AlertTriangle, Layers,
  Compass, ArrowUpRight, CheckCircle2, ChevronRight, Info,
  Cpu, DollarSign, Target, Sliders, ShieldCheck, Flame, Radio,
  Search, X, ChevronDown, Check, CornerDownLeft, Eye, Award,
  Crosshair, ShieldAlert, ArrowDownRight, BarChart2, Hash,
  Camera, UploadCloud, BookOpen, Copy, Download, Trash2,
  Terminal, FileCode, Code2, ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts';

const api = (path, opts = {}) =>
  fetch(`${import.meta.env.VITE_API || 'http://localhost:5000'}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    ...opts
  }).then(r => r.json());

export const EXCHANGE_GROUPS = [
  {
    category: 'Crypto Exchanges & DEX',
    exchanges: [
      { id: 'Binance', name: 'Binance Spot', badge: 'CRYPTO' },
      { id: 'CoinDCX', name: 'CoinDCX Spot', badge: 'CRYPTO' },
      { id: 'Jupiter', name: 'Jupiter (Solana DEX)', badge: 'DEX' },
      { id: 'Pionex', name: 'Pionex Spot', badge: 'CRYPTO' },
      { id: 'Bybit', name: 'Bybit Spot', badge: 'CRYPTO' },
      { id: 'Kraken', name: 'Kraken Spot', badge: 'CRYPTO' }
    ]
  },
  {
    category: 'Indian Stock Brokers & Exchanges',
    exchanges: [
      { id: 'Upstox', name: 'Upstox (NSE/BSE)', badge: 'BROKER' },
      { id: 'AngelOne', name: 'Angel One (SmartAPI)', badge: 'BROKER' },
      { id: 'NSE', name: 'NSE (National Stock Exchange)', badge: 'INDIA' },
      { id: 'BSE', name: 'BSE (Bombay Stock Exchange)', badge: 'INDIA' }
    ]
  },
  {
    category: 'US Stock Brokers & Exchanges',
    exchanges: [
      { id: 'Alpaca', name: 'Alpaca Markets', badge: 'BROKER' },
      { id: 'NASDAQ', name: 'NASDAQ Equities', badge: 'US STOCKS' },
      { id: 'NYSE', name: 'NYSE Equities', badge: 'US STOCKS' }
    ]
  }
];

export const POPULAR_PAIRS_BY_EXCHANGE = {
  Binance: [
    { symbol: 'SOL/USDT', name: 'Solana' },
    { symbol: 'BTC/USDT', name: 'Bitcoin' },
    { symbol: 'ETH/USDT', name: 'Ethereum' },
    { symbol: 'XRP/USDT', name: 'XRP' },
    { symbol: 'BNB/USDT', name: 'BNB' },
    { symbol: 'DOGE/USDT', name: 'Dogecoin' },
    { symbol: 'PEPE/USDT', name: 'Pepe' },
    { symbol: 'NEAR/USDT', name: 'NEAR Protocol' },
    { symbol: 'SUI/USDT', name: 'Sui' },
    { symbol: 'RENDER/USDT', name: 'Render' },
    { symbol: 'AVAX/USDT', name: 'Avalanche' },
    { symbol: 'LINK/USDT', name: 'Chainlink' }
  ],
  CoinDCX: [
    { symbol: 'BTC/USDT', name: 'Bitcoin' },
    { symbol: 'ETH/USDT', name: 'Ethereum' },
    { symbol: 'SOL/USDT', name: 'Solana' },
    { symbol: 'XRP/USDT', name: 'XRP' },
    { symbol: 'DOGE/USDT', name: 'Dogecoin' },
    { symbol: 'MATIC/USDT', name: 'Polygon' },
    { symbol: 'BNB/USDT', name: 'BNB' },
    { symbol: 'AVAX/USDT', name: 'Avalanche' }
  ],
  Jupiter: [
    { symbol: 'SOL/USDC', name: 'Solana' },
    { symbol: 'JUP/USDC', name: 'Jupiter' },
    { symbol: 'RAY/USDC', name: 'Raydium' },
    { symbol: 'BONK/USDC', name: 'Bonk' },
    { symbol: 'WIF/USDC', name: 'dogwifhat' },
    { symbol: 'PYTH/USDC', name: 'Pyth Network' },
    { symbol: 'DRIFT/USDC', name: 'Drift' },
    { symbol: 'POPCAT/USDC', name: 'Popcat' }
  ],
  Pionex: [
    { symbol: 'BTC/USDT', name: 'Bitcoin' },
    { symbol: 'ETH/USDT', name: 'Ethereum' },
    { symbol: 'SOL/USDT', name: 'Solana' },
    { symbol: 'DOGE/USDT', name: 'Dogecoin' },
    { symbol: 'XRP/USDT', name: 'XRP' },
    { symbol: 'BNB/USDT', name: 'BNB' }
  ],
  Bybit: [
    { symbol: 'BTC/USDT', name: 'Bitcoin' },
    { symbol: 'ETH/USDT', name: 'Ethereum' },
    { symbol: 'SOL/USDT', name: 'Solana' },
    { symbol: 'XRP/USDT', name: 'XRP' },
    { symbol: 'SUI/USDT', name: 'Sui' },
    { symbol: 'TON/USDT', name: 'Toncoin' }
  ],
  Kraken: [
    { symbol: 'BTC/USD', name: 'Bitcoin' },
    { symbol: 'ETH/USD', name: 'Ethereum' },
    { symbol: 'SOL/USD', name: 'Solana' },
    { symbol: 'XRP/USD', name: 'XRP' },
    { symbol: 'ADA/USD', name: 'Cardano' },
    { symbol: 'DOT/USD', name: 'Polkadot' }
  ],
  Upstox: [
    { symbol: 'RELIANCE', name: 'Reliance Industries' },
    { symbol: 'TCS', name: 'Tata Consultancy Services' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'INFY', name: 'Infosys' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors' },
    { symbol: 'SBIN', name: 'State Bank of India' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
    { symbol: 'ITC', name: 'ITC Ltd' },
    { symbol: 'LT', name: 'Larsen & Toubro' }
  ],
  AngelOne: [
    { symbol: 'RELIANCE', name: 'Reliance Industries' },
    { symbol: 'TCS', name: 'Tata Consultancy Services' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'INFY', name: 'Infosys' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors' },
    { symbol: 'SBIN', name: 'State Bank of India' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
    { symbol: 'ITC', name: 'ITC Ltd' },
    { symbol: 'LT', name: 'Larsen & Toubro' }
  ],
  NSE: [
    { symbol: 'RELIANCE', name: 'Reliance Industries' },
    { symbol: 'TCS', name: 'Tata Consultancy Services' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'INFY', name: 'Infosys' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors' },
    { symbol: 'SBIN', name: 'State Bank of India' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
    { symbol: 'ITC', name: 'ITC Ltd' },
    { symbol: 'LT', name: 'Larsen & Toubro' }
  ],
  BSE: [
    { symbol: 'RELIANCE', name: 'Reliance Industries' },
    { symbol: 'TCS', name: 'Tata Consultancy Services' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'INFY', name: 'Infosys' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors' },
    { symbol: 'SBIN', name: 'State Bank of India' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
    { symbol: 'ITC', name: 'ITC Ltd' }
  ],
  Alpaca: [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' },
    { symbol: 'AMD', name: 'Advanced Micro Devices' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust' }
  ],
  NASDAQ: [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' },
    { symbol: 'AMD', name: 'Advanced Micro Devices' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
    { symbol: 'NFLX', name: 'Netflix Inc.' }
  ],
  NYSE: [
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway' },
    { symbol: 'V', name: 'Visa Inc.' },
    { symbol: 'UNH', name: 'UnitedHealth Group' },
    { symbol: 'JNJ', name: 'Johnson & Johnson' },
    { symbol: 'WMT', name: 'Walmart Inc.' },
    { symbol: 'PG', name: 'Procter & Gamble' },
    { symbol: 'MA', name: 'Mastercard Inc.' },
    { symbol: 'HD', name: 'The Home Depot' },
    { symbol: 'DIS', name: 'The Walt Disney Company' }
  ]
};

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const QUANT_METHODOLOGIES = [
  {
    id: 'HYBRID_ENSEMBLE',
    name: 'Hybrid Quant Ensemble',
    shortName: 'Hybrid Ensemble',
    tag: 'ALL-WEATHER CONSENSUS',
    icon: '🧠',
    accentColor: '#c084fc',
    desc: 'Weighted multi-factor engine combining Gaussian Bands (35%), CVD Absorption (25%), Squeeze Momentum (25%) & Kelly EV (15%).'
  },
  {
    id: 'GAUSSIAN_MEAN_REVERSION',
    name: 'Gaussian Mean Reversion',
    shortName: 'Gaussian Bands',
    tag: 'STATISTICAL VWAP BANDS',
    icon: '🟣',
    accentColor: '#a855f7',
    desc: 'Captures statistical price discounts at ±1σ, ±2σ, ±3σ Gaussian deviation bands from anchored VWAP with high-probability mean-reversion targets.'
  },
  {
    id: 'MOMENTUM_BREAKOUT',
    name: 'Momentum Breakout',
    shortName: 'Momentum Squeeze',
    tag: 'SQUEEZE EXPANSION',
    icon: '🚀',
    accentColor: '#38bdf8',
    desc: 'Detects Bollinger Band compression inside Keltner Channels & fires directional runner entries with dynamic trailing stops on expansion.'
  },
  {
    id: 'ORDER_FLOW_IMBALANCE',
    name: 'Order Flow Imbalance',
    shortName: 'CVD Order Flow',
    tag: 'CVD DELTA ABSORPTION',
    icon: '🌊',
    accentColor: '#10b981',
    desc: 'Tracks institutional taker buy/sell volume delta, aggressive limit bid absorptions, and CVD divergences for front-running reversals.'
  }
];

export default function PredictiveAnalysis() {
  const navigate = useNavigate();

  // Top-Level View Mode: STUDIO or SCREENER
  const [viewMode, setViewMode] = useState('STUDIO'); // 'STUDIO' | 'SCREENER'

  // Selected Methodology State
  const [selectedMethodology, setSelectedMethodology] = useState('HYBRID_ENSEMBLE');
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const methodologyRef = useRef(null);

  // Controls State
  const [selectedSymbol, setSelectedSymbol] = useState('SOL/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [selectedExchange, setSelectedExchange] = useState('Binance');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Screener State
  const [screenerCount, setScreenerCount] = useState(5); // 2 | 5 | 10
  const [screenerOpportunities, setScreenerOpportunities] = useState([]);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState('');
  const [screenerTimestamp, setScreenerTimestamp] = useState(null);

  // Symbol Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchDropdownRef = useRef(null);

  // Quant Analytics Data State
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Simulation State
  const [simInvestment, setSimInvestment] = useState(50);
  const [simLoading, setSimLoading] = useState(false);
  const [simulationData, setSimulationData] = useState(null);

  // Super Zee Bot Launch State
  const [botInvestment, setBotInvestment] = useState(50);
  const [botMode, setBotMode] = useState('PAPER');
  const [customKelly, setCustomKelly] = useState('');
  const [launching, setLaunching] = useState(false);
  const [launchSuccess, setLaunchSuccess] = useState(null);

  // Overlays View Toggles
  const [showVWAP, setShowVWAP] = useState(true);
  const [showBands, setShowBands] = useState(true);
  const [showCVD, setShowCVD] = useState(true);

  // Thought Stream History
  const [thoughtStream, setThoughtStream] = useState([]);

  // ══════════════════════════════════════════════════════════════════════════
  // ⭐ PILLAR 3 & 4: VISION QUANT STUDIO & SCRIPT LIBRARY VAULT STATES
  // ══════════════════════════════════════════════════════════════════════════
  const [isVisionStudioOpen, setIsVisionStudioOpen] = useState(false);
  const [visionAnalyzing, setVisionAnalyzing] = useState(false);
  const [visionResult, setVisionResult] = useState(null);
  const [visionActiveTab, setVisionActiveTab] = useState('PINE'); // 'PINE' | 'PYTHON' | 'BACKTEST'
  const [copiedPine, setCopiedPine] = useState(false);
  const [copiedPython, setCopiedPython] = useState(false);
  const [capturedThumbnail, setCapturedThumbnail] = useState(null);

  // Script Library Vault Drawer
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [vaultScripts, setVaultScripts] = useState([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultFilterWinRate, setVaultFilterWinRate] = useState(0);
  const [vaultFilterMethod, setVaultFilterMethod] = useState('');
  const [vaultSelectedScript, setVaultSelectedScript] = useState(null);

  // 1-Click Vault Script Launcher Modal
  const [deployModalScript, setDeployModalScript] = useState(null);
  const [deployCapital, setDeployCapital] = useState(50);
  const [deployMode, setDeployMode] = useState('PAPER');
  const [deploying, setDeploying] = useState(false);

  // Chart Container Ref for Canvas Snapshot
  const chartContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
      if (methodologyRef.current && !methodologyRef.current.contains(event.target)) {
        setIsMethodologyOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live Symbol Search against Market API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api(`/market/search?exchange=${selectedExchange}&q=${encodeURIComponent(searchQuery)}`);
        if (res.success && Array.isArray(res.symbols)) {
          setSearchResults(res.symbols.slice(0, 15));
        } else {
          const exchangeList = POPULAR_PAIRS_BY_EXCHANGE[selectedExchange] || POPULAR_PAIRS_BY_EXCHANGE.Binance;
          const filtered = exchangeList.filter(p =>
            p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSearchResults(filtered);
        }
      } catch {
        const exchangeList = POPULAR_PAIRS_BY_EXCHANGE[selectedExchange] || POPULAR_PAIRS_BY_EXCHANGE.Binance;
        const filtered = exchangeList.filter(p =>
          p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(filtered);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedExchange]);

  // Select a coin/stock from dropdown
  const handleSelectCoin = (sym) => {
    let formatted = sym.trim().toUpperCase();
    const isStockExchange = ['UPSTOX', 'ANGELONE', 'NSE', 'BSE', 'ALPACA', 'NASDAQ', 'NYSE'].includes(selectedExchange.toUpperCase());

    if (!isStockExchange) {
      if (!formatted.includes('/') && formatted.endsWith('USDT')) {
        formatted = `${formatted.slice(0, -4)}/USDT`;
      } else if (!formatted.includes('/') && formatted.endsWith('USDC')) {
        formatted = `${formatted.slice(0, -4)}/USDC`;
      } else if (!formatted.includes('/')) {
        formatted = `${formatted}/USDT`;
      }
    } else {
      formatted = formatted.replace(/\/USDT$/, '').replace(/\/USDC$/, '').replace(/\/USD$/, '');
    }

    setSelectedSymbol(formatted);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  // Switch Exchange & Broker handler
  const handleExchangeChange = (newEx) => {
    setSelectedExchange(newEx);
    const list = POPULAR_PAIRS_BY_EXCHANGE[newEx] || POPULAR_PAIRS_BY_EXCHANGE.Binance;
    if (list && list.length > 0) {
      setSelectedSymbol(list[0].symbol);
    }
  };

  // Fetch live quant analytics for single coin studio
  const fetchAnalytics = async (sym = selectedSymbol, tf = selectedTimeframe, ex = selectedExchange, method = selectedMethodology) => {
    try {
      setError('');
      const res = await api(`/predictive/analytics?symbol=${encodeURIComponent(sym)}&timeframe=${tf}&exchange=${ex}&method=${method}`);
      const data = res.data || res.analytics || (res.currentPrice ? res : null);

      if (res.success && data) {
        setAnalytics(data);
        setLastUpdated(new Date());

        if (data.agentDirective?.thought) {
          const newThought = {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            text: data.agentDirective.thought,
            action: data.agentDirective.action,
            regime: data.regime,
            method: data.methodology || method
          };
          setThoughtStream(prev => [newThought, ...prev.slice(0, 14)]);
        }
      } else {
        setError(res.error || res.message || 'Failed to load predictive analytics');
      }
    } catch (err) {
      setError(err.message || 'Connection error loading quant analytics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Multi-Coin Top Screener Opportunities
  const fetchScreener = async (ex = selectedExchange, tf = selectedTimeframe, count = screenerCount, method = selectedMethodology) => {
    setScreenerLoading(true);
    setScreenerError('');
    try {
      const res = await api(`/predictive/top-opportunities?exchange=${ex}&timeframe=${tf}&count=${count}&method=${method}`);
      if (res.success && Array.isArray(res.opportunities)) {
        setScreenerOpportunities(res.opportunities);
        setScreenerTimestamp(new Date());
      } else {
        setScreenerError(res.error || res.message || 'Failed to fetch screener results');
      }
    } catch (err) {
      setScreenerError(err.message || 'Connection error during quant screener scan');
    } finally {
      setScreenerLoading(false);
    }
  };

  // Run Monte Carlo Replay Simulation
  const runSimulation = async (inv = simInvestment, method = selectedMethodology) => {
    setSimLoading(true);
    try {
      const res = await api('/predictive/simulate', {
        method: 'POST',
        body: JSON.stringify({
          symbol: selectedSymbol,
          timeframe: selectedTimeframe,
          exchange: selectedExchange,
          investment: Number(inv) || 50,
          numSimulations: 1000,
          horizon: 48,
          method
        })
      });

      const sim = res.data?.simulation || res.simulation;
      if (res.success && sim) {
        setSimulationData(sim);
      }
    } catch (err) {
      console.warn('Simulation failed:', err.message);
    } finally {
      setSimLoading(false);
    }
  };

  // Fetch Saved Scripts from Vault
  const fetchVaultScripts = async () => {
    setVaultLoading(true);
    try {
      const params = new URLSearchParams();
      if (vaultSearch) params.set('search', vaultSearch);
      if (vaultFilterMethod) params.set('methodology', vaultFilterMethod);
      if (vaultFilterWinRate > 0) params.set('minWinRate', vaultFilterWinRate);

      const res = await api(`/predictive/scripts?${params.toString()}`);
      if (res.success && Array.isArray(res.scripts)) {
        setVaultScripts(res.scripts);
      }
    } catch (err) {
      console.warn('Failed to load vault scripts:', err);
    } finally {
      setVaultLoading(false);
    }
  };

  // Initial Load & Auto-Refresh for Studio & Screener
  useEffect(() => {
    if (viewMode === 'STUDIO') {
      setLoading(true);
      fetchAnalytics(selectedSymbol, selectedTimeframe, selectedExchange, selectedMethodology);
      runSimulation(simInvestment, selectedMethodology);
    } else {
      fetchScreener(selectedExchange, selectedTimeframe, screenerCount, selectedMethodology);
    }
    fetchVaultScripts();
  }, [viewMode, selectedSymbol, selectedTimeframe, selectedExchange, selectedMethodology, screenerCount]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (viewMode === 'STUDIO') {
        fetchAnalytics(selectedSymbol, selectedTimeframe, selectedExchange, selectedMethodology);
      } else {
        fetchScreener(selectedExchange, selectedTimeframe, screenerCount, selectedMethodology);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, viewMode, selectedSymbol, selectedTimeframe, selectedExchange, selectedMethodology, screenerCount]);

  // ══════════════════════════════════════════════════════════════════════════
  // 📷 VISION CHART SNAPSHOT CAPTURE & UPLOAD HANDLERS
  // ══════════════════════════════════════════════════════════════════════════
  const executeVisionAnalysis = async (imageDataUrl = '', promptNote = '') => {
    setIsVisionStudioOpen(true);
    setVisionAnalyzing(true);
    setVisionResult(null);
    setCapturedThumbnail(imageDataUrl);

    try {
      const res = await api('/predictive/vision-analyze', {
        method: 'POST',
        body: JSON.stringify({
          image: imageDataUrl || '',
          symbol: selectedSymbol,
          timeframe: selectedTimeframe,
          exchange: selectedExchange,
          methodology: selectedMethodology,
          promptNote
        })
      });

      if (res.success && res.script) {
        setVisionResult(res);
        fetchVaultScripts(); // Refresh vault count badge
      } else {
        alert(res.error || res.message || 'Vision analysis failed');
      }
    } catch (err) {
      alert(`Vision analysis error: ${err.message}`);
    } finally {
      setVisionAnalyzing(false);
    }
  };

  const handleTakeChartSnap = async () => {
    try {
      // High-res Canvas Capture of Chart DOM
      let dataUrl = '';
      const chartContainer = chartContainerRef.current;
      if (chartContainer) {
        const svgElem = chartContainer.querySelector('svg');
        if (svgElem) {
          const svgXml = new XMLSerializer().serializeToString(svgElem);
          const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          const img = new Image();
          const canvas = document.createElement('canvas');
          canvas.width = (svgElem.clientWidth || 800) * 2;
          canvas.height = (svgElem.clientHeight || 360) * 2;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await new Promise((resolve) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            img.src = url;
          });
          dataUrl = canvas.toDataURL('image/png');
        }
      }

      await executeVisionAnalysis(dataUrl, 'Native DOM Chart Snap Analysis');
    } catch (err) {
      console.warn('Canvas capture exception, proceeding with algorithmic vision:', err);
      await executeVisionAnalysis('', 'Direct algorithmic vision analysis');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result;
      await executeVisionAnalysis(dataUrl, `External uploaded chart snapshot: ${file.name}`);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Launch Autonomous Super Zee Bot from live studio
  const handleLaunchSuperZee = async (overrideSymbol = null, overrideKelly = null) => {
    setLaunching(true);
    setLaunchSuccess(null);
    const targetSym = overrideSymbol || selectedSymbol;
    const chosenKelly = overrideKelly || (customKelly ? Number(customKelly) : (analytics?.expectedValue?.kellyAllocationPercent || 35));

    try {
      const res = await api('/predictive/launch-super-zee', {
        method: 'POST',
        body: JSON.stringify({
          symbol: targetSym,
          exchange: selectedExchange,
          mode: botMode,
          investedAmount: Number(botInvestment) || 50,
          name: `Super Zee ${targetSym} (${selectedMethodology.replace('_', ' ')})`,
          method: selectedMethodology,
          kellyAllocPercent: chosenKelly
        })
      });

      if (res.success && (res.data?.bot || res.bot)) {
        const botObj = res.data?.bot || res.bot;
        setLaunchSuccess(botObj);
        setTimeout(() => {
          navigate(`/bots/${botObj.id || botObj.bot?.id}`);
        }, 1200);
      } else {
        alert(res.error || res.message || 'Failed to launch Super Zee Bot');
      }
    } catch (err) {
      alert(`Launch error: ${err.message}`);
    } finally {
      setLaunching(false);
    }
  };

  // 1-Click Launch Saved Script with Super Zee Bot
  const handleDeploySavedScript = async (script, capital = deployCapital, mode = deployMode) => {
    if (!script) return;
    setDeploying(true);
    try {
      const res = await api('/predictive/run-saved-script', {
        method: 'POST',
        body: JSON.stringify({
          scriptId: script.id,
          investedAmount: Number(capital) || 50,
          mode: mode || 'PAPER',
          exchange: script.exchange || selectedExchange
        })
      });

      if (res.success && (res.data?.bot || res.bot)) {
        const botObj = res.data?.bot || res.bot;
        setDeployModalScript(null);
        setIsVaultOpen(false);
        setIsVisionStudioOpen(false);
        navigate(`/bots/${botObj.id || botObj.bot?.id}`);
      } else {
        alert(res.error || res.message || 'Failed to deploy saved script');
      }
    } catch (err) {
      alert(`Deployment error: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  // Delete script from vault
  const handleDeleteVaultScript = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this strategy script from your Vault?')) return;
    try {
      const res = await api(`/predictive/scripts/${id}`, { method: 'DELETE' });
      if (res.success) {
        setVaultScripts(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      alert(`Failed to delete script: ${err.message}`);
    }
  };

  // Copy code helper
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'PINE') {
      setCopiedPine(true);
      setTimeout(() => setCopiedPine(false), 2000);
    } else {
      setCopiedPython(true);
      setTimeout(() => setCopiedPython(false), 2000);
    }
  };

  // Download code file helper
  const downloadCodeFile = (filename, content) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Transform candle series for chart rendering
  const chartData = (analytics?.series?.candles || []).map((c, idx) => {
    const v = analytics?.series?.vwapSeries?.[idx] || {};
    const cvd = analytics?.series?.cvdSeries?.[idx] || {};
    return {
      time: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      vwap: v.vwap,
      upper1Sigma: v.upper1Sigma,
      lower1Sigma: v.lower1Sigma,
      upper2Sigma: v.upper2Sigma,
      lower2Sigma: v.lower2Sigma,
      upper3Sigma: v.upper3Sigma,
      lower3Sigma: v.lower3Sigma,
      cvdDelta: cvd.delta || 0,
      cvdTotal: cvd.cvd || 0,
      divergence: cvd.divergence
    };
  });

  const regimeColors = {
    BULL_EXPANSION: '#10b981',
    BEAR_CONTRACTION: '#ef4444',
    VOLATILITY_COMPRESSION: '#f59e0b',
    RANGE_ACCUMULATION: '#06b6d4',
  };

  const currentRegime = analytics?.regime || 'RANGE_ACCUMULATION';
  const currentRegimeColor = regimeColors[currentRegime] || '#06b6d4';
  const activeMethodologyObj = QUANT_METHODOLOGIES.find(m => m.id === selectedMethodology) || QUANT_METHODOLOGIES[0];

  return (
    <div className="predictive-page" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#f8fafc' }}>
      
      {/* Hidden File Input for Chart Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* 🔮 TOP CONTROL HEADER */}
      <div className="quant-header-card" style={{
        position: 'relative',
        zIndex: 100,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.85) 100%)',
        border: '1px solid rgba(147, 51, 234, 0.35)',
        borderRadius: '18px',
        padding: '1.25rem 1.75rem',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)'
      }}>
        
        {/* Title & View Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(147, 51, 234, 0.55)'
          }}>
            <Sparkles size={24} color="#ffffff" />
          </div>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#f8fafc' }}>
                Predictive Analysis Studio
              </h1>
              <span style={{
                background: 'rgba(147, 51, 234, 0.25)',
                border: '1px solid rgba(147, 51, 234, 0.6)',
                color: '#c084fc',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '700'
              }}>
                QUANT ENGINE
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
              4 Quant Methodologies, Multimodal Vision Studio, Automated Backtests & Strategy Script Vault
            </p>
          </div>

          {/* VIEW MODE TOGGLE BUTTONS */}
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            marginLeft: '0.5rem'
          }}>
            <button
              onClick={() => setViewMode('STUDIO')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'STUDIO' ? 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)' : 'transparent',
                color: viewMode === 'STUDIO' ? '#ffffff' : '#94a3b8',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Eye size={15} />
              <span>Quant Studio</span>
            </button>
            <button
              onClick={() => setViewMode('SCREENER')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'SCREENER' ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' : 'transparent',
                color: viewMode === 'SCREENER' ? '#ffffff' : '#94a3b8',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Flame size={15} />
              <span>🔥 Top Quant Screener</span>
            </button>
          </div>
        </div>

        {/* CONTROLS BAR & ACTION BUTTONS */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* 📷 TAKE CHART SNAP BUTTON */}
          {viewMode === 'STUDIO' && (
            <button
              onClick={handleTakeChartSnap}
              disabled={loading}
              title="Capture live chart canvas and analyze with Multimodal Vision"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '8px 14px',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 14px rgba(56, 189, 248, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              <Camera size={15} />
              <span>Take Snap</span>
            </button>
          )}

          {/* 📁 UPLOAD EXTERNAL CHART BUTTON */}
          {viewMode === 'STUDIO' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload external screenshot (PNG/JPG) for Multimodal Vision Quant Analysis"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                color: '#38bdf8',
                padding: '8px 12px',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <UploadCloud size={15} />
              <span>Upload Chart</span>
            </button>
          )}

          {/* 📜 SCRIPT LIBRARY VAULT DRAWER TOGGLE */}
          <button
            onClick={() => {
              setIsVaultOpen(true);
              fetchVaultScripts();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #9333ea 0%, #6366f1 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 14px rgba(147, 51, 234, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <BookOpen size={15} />
            <span>Script Library</span>
            <span style={{
              background: 'rgba(255, 255, 255, 0.25)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: '800'
            }}>
              {vaultScripts.length}
            </span>
          </button>

          {/* 🧠 QUANT METHODOLOGY SELECTOR */}
          <div ref={methodologyRef} style={{ position: 'relative', zIndex: 120 }}>
            <button
              onClick={() => setIsMethodologyOpen(!isMethodologyOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(30, 27, 75, 0.85)',
                border: '1px solid rgba(147, 51, 234, 0.5)',
                color: '#f8fafc',
                padding: '8px 14px',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,0,0,0.35)'
              }}
            >
              <span>{activeMethodologyObj.icon}</span>
              <span>{activeMethodologyObj.shortName}</span>
              <ChevronDown size={14} color="#94a3b8" />
            </button>

            {isMethodologyOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '340px',
                maxWidth: 'min(340px, calc(100vw - 32px))',
                boxSizing: 'border-box',
                background: '#0f172a',
                border: '1px solid rgba(147, 51, 234, 0.5)',
                borderRadius: '12px',
                padding: '10px',
                zIndex: 9999,
                boxShadow: '0 16px 48px rgba(0, 0, 0, 0.9)',
                backdropFilter: 'blur(20px)'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select Predictive Quant Model
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {QUANT_METHODOLOGIES.map(m => {
                    const isSel = selectedMethodology === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedMethodology(m.id);
                          setIsMethodologyOpen(false);
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: isSel ? 'rgba(147, 51, 234, 0.25)' : 'rgba(30, 41, 59, 0.5)',
                          border: `1px solid ${isSel ? '#c084fc' : 'rgba(255, 255, 255, 0.05)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '1rem' }}>{m.icon}</span>
                            <span style={{ fontWeight: '700', fontSize: '0.85rem', color: isSel ? '#c084fc' : '#f8fafc' }}>{m.name}</span>
                          </div>
                          {isSel && <Check size={14} color="#c084fc" />}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px', lineHeight: '1.25' }}>
                          {m.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 🔍 SEARCHABLE COIN DROPDOWN (Shown in Studio Mode) */}
          {viewMode === 'STUDIO' && (
            <div ref={searchDropdownRef} style={{ position: 'relative', zIndex: 110 }}>
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(147, 51, 234, 0.5)',
                  color: '#f8fafc',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Search size={15} color="#c084fc" />
                <span>{selectedSymbol}</span>
                <ChevronDown size={14} color="#94a3b8" />
              </button>

              {/* SEARCH POPUP MODAL / DROPDOWN */}
              {isSearchOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: '320px',
                  maxWidth: 'min(320px, calc(100vw - 32px))',
                  boxSizing: 'border-box',
                  background: '#0f172a',
                  border: '1px solid rgba(147, 51, 234, 0.4)',
                  borderRadius: '12px',
                  padding: '12px',
                  zIndex: 9999,
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.9)',
                  backdropFilter: 'blur(16px)'
                }}>
                  <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      placeholder="Search coin (e.g. PEPE, SOL, BTC)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchQuery.trim()) {
                          handleSelectCoin(searchQuery);
                        }
                      }}
                      autoFocus
                      style={{
                        width: '100%',
                        background: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#f8fafc',
                        borderRadius: '8px',
                        padding: '8px 10px 8px 32px',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {searchQuery.trim() && (
                    <div
                      onClick={() => handleSelectCoin(searchQuery)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'rgba(147, 51, 234, 0.15)',
                        border: '1px dashed rgba(147, 51, 234, 0.4)',
                        borderRadius: '6px',
                        color: '#c084fc',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginBottom: '8px'
                      }}
                    >
                      <span>Analyze Custom: <strong>{searchQuery.toUpperCase()}</strong></span>
                      <CornerDownLeft size={12} />
                    </div>
                  )}

                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Popular {selectedExchange} Markets
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                    {(searchResults.length > 0 ? searchResults : (POPULAR_PAIRS_BY_EXCHANGE[selectedExchange] || POPULAR_PAIRS_BY_EXCHANGE.Binance)).map((coin) => {
                      const sym = coin.symbol || coin;
                      const isSel = selectedSymbol === sym;
                      return (
                        <button
                          key={sym}
                          onClick={() => handleSelectCoin(sym)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: isSel ? 'rgba(147, 51, 234, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${isSel ? '#9333ea' : 'transparent'}`,
                            color: isSel ? '#c084fc' : '#e2e8f0',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: isSel ? '700' : '500',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sym}</span>
                          {isSel && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeframe Selector */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                style={{
                  background: selectedTimeframe === tf ? '#9333ea' : 'transparent',
                  color: selectedTimeframe === tf ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* All Exchange & Broker Selector with Optgroups */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <select
              value={selectedExchange}
              onChange={(e) => handleExchangeChange(e.target.value)}
              style={{ background: 'transparent', color: '#38bdf8', border: 'none', padding: '6px 12px', fontWeight: '700', outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {EXCHANGE_GROUPS.map((grp) => (
                <optgroup key={grp.category} label={`━━ ${grp.category.toUpperCase()} ━━`} style={{ background: '#0f172a', color: '#c084fc', fontWeight: '800' }}>
                  {grp.exchanges.map((ex) => (
                    <option key={ex.id} value={ex.id} style={{ background: '#1e293b', color: '#f8fafc', fontWeight: '600' }}>
                      {ex.name} [{ex.badge}]
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Refresh Action */}
          <button
            onClick={() => {
              if (viewMode === 'STUDIO') fetchAnalytics();
              else fetchScreener();
            }}
            disabled={loading || screenerLoading}
            style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <RefreshCw size={14} className={(loading || screenerLoading) ? 'spin' : ''} />
            {(loading || screenerLoading) ? 'Scanning...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 📜 VIEW MODE 1: 🔥 TOP QUANT SCREENER (Multi-Coin Opportunities) */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'SCREENER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Screener Sub-Header & Controls */}
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Award size={22} color="#f59e0b" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>
                  Live Multi-Coin Quant Screener ({selectedExchange})
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                  Scanned 25+ liquid pairs against <strong>{activeMethodologyObj.name}</strong> to rank highest Positive Expected Return ($EV &gt; $0.00$) setups.
                </div>
              </div>
            </div>

            {/* Top Count Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>Display Ranks:</span>
              {[2, 5, 10].map(cnt => (
                <button
                  key={cnt}
                  onClick={() => setScreenerCount(cnt)}
                  style={{
                    background: screenerCount === cnt ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${screenerCount === cnt ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: screenerCount === cnt ? '#ffffff' : '#94a3b8',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Top {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Screener Loading State */}
          {screenerLoading && (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <RefreshCw size={32} className="spin" color="#c084fc" style={{ margin: '0 auto 1rem' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc' }}>Scanning {selectedExchange} pairs for statistical alpha...</div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>Calculating Gaussian deviation, CVD delta imbalances, and Fractional Kelly sizing...</div>
            </div>
          )}

          {/* Screener Table & Cards */}
          {!screenerLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {screenerOpportunities.map((opp) => {
                const rankColor = opp.rank === 1 ? '#f59e0b' : opp.rank <= 3 ? '#c084fc' : '#38bdf8';
                const isStrongBuy = opp.bias === 'STRONG_BUY';
                const isBuy = opp.bias === 'BUY';

                return (
                  <div
                    key={opp.symbol}
                    style={{
                      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.6) 100%)',
                      border: `1px solid ${opp.rank === 1 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: '16px',
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      boxShadow: opp.rank === 1 ? '0 8px 30px rgba(245, 158, 11, 0.15)' : '0 4px 20px rgba(0,0,0,0.3)',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    {/* Left: Rank & Symbol */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: `${rankColor}22`,
                        border: `1.5px solid ${rankColor}`,
                        color: rankColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        fontWeight: '900'
                      }}>
                        #{opp.rank}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#f8fafc' }}>
                            {opp.symbol}
                          </span>
                          <span style={{
                            background: isStrongBuy ? 'rgba(16, 185, 129, 0.2)' : isBuy ? 'rgba(56, 189, 248, 0.2)' : 'rgba(147, 51, 234, 0.2)',
                            border: `1px solid ${isStrongBuy ? '#10b981' : isBuy ? '#38bdf8' : '#c084fc'}`,
                            color: isStrongBuy ? '#10b981' : isBuy ? '#38bdf8' : '#c084fc',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '700'
                          }}>
                            {opp.bias.replace('_', ' ')}
                          </span>
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                          ${Number(opp.price).toFixed(4)}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Quant Score & Statistical Edge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Quant Score</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#f59e0b' }}>
                          {opp.score}/100
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Win Prob & EV</div>
                        <div style={{ fontSize: '1rem', fontWeight: '700', color: '#10b981' }}>
                          {opp.winProbability}% <span style={{ fontSize: '0.85rem', color: '#38bdf8' }}>(+${opp.expectedValueDollar})</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Kelly Sizing</div>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#c084fc' }}>
                          {opp.kellyAllocationPercent}%
                        </div>
                      </div>

                      <div style={{ maxWidth: '280px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Key Confluence</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                          {opp.reasons.map((r, i) => (
                            <span key={i} style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', color: '#e2e8f0' }}>
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        onClick={() => {
                          setSelectedSymbol(opp.symbol);
                          setViewMode('STUDIO');
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#f8fafc',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Eye size={14} />
                        <span>Studio</span>
                      </button>

                      <button
                        onClick={() => handleLaunchSuperZee(opp.symbol, opp.kellyAllocationPercent)}
                        style={{
                          background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
                          border: 'none',
                          color: '#ffffff',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 15px rgba(147, 51, 234, 0.4)'
                        }}
                      >
                        <Zap size={14} />
                        <span>Deploy Bot</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 🔮 VIEW MODE 2: QUANT STUDIO (Single Coin Deep Dive) */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'STUDIO' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: VISUAL CHARTS, CVD PANEL, & SIMULATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* 1. Price + Gaussian VWAP Bands Main Chart Container */}
            <div
              ref={chartContainerRef}
              className="quant-chart-container"
              style={{
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.25rem',
                position: 'relative',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* Chart Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>
                    {selectedSymbol}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#38bdf8' }}>
                    ${analytics?.currentPrice ? Number(analytics.currentPrice).toFixed(4) : '---'}
                  </div>
                  <span style={{
                    background: `${currentRegimeColor}22`,
                    border: `1px solid ${currentRegimeColor}`,
                    color: currentRegimeColor,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '700'
                  }}>
                    {currentRegime.replace('_', ' ')}
                  </span>
                </div>

                {/* Overlays Toggle Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    onClick={() => setShowVWAP(!showVWAP)}
                    style={{
                      background: showVWAP ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${showVWAP ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: showVWAP ? '#38bdf8' : '#94a3b8',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    VWAP Line
                  </button>
                  <button
                    onClick={() => setShowBands(!showBands)}
                    style={{
                      background: showBands ? 'rgba(147, 51, 234, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${showBands ? '#9333ea' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: showBands ? '#c084fc' : '#94a3b8',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    ±1σ, ±2σ, ±3σ Bands
                  </button>
                  <button
                    onClick={() => setShowCVD(!showCVD)}
                    style={{
                      background: showCVD ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${showCVD ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: showCVD ? '#10b981' : '#94a3b8',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    CVD Panel
                  </button>
                </div>
              </div>

              {/* Price + Gaussian Bands Area/Line Chart */}
              <div style={{ height: '320px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} stroke="#475569" fontSize={11} tickLine={false} orientation="right" />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontSize: '0.8rem' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />

                    {/* Gaussian Bands */}
                    {showBands && <Area type="monotone" dataKey="upper2Sigma" stroke="#a855f7" strokeWidth={1} strokeDasharray="4 4" fill="url(#bandGrad)" />}
                    {showBands && <Area type="monotone" dataKey="lower2Sigma" stroke="#a855f7" strokeWidth={1} strokeDasharray="4 4" fill="none" />}
                    {showBands && <Line type="monotone" dataKey="upper1Sigma" stroke="#c084fc" strokeWidth={1} strokeDasharray="2 2" dot={false} />}
                    {showBands && <Line type="monotone" dataKey="lower1Sigma" stroke="#c084fc" strokeWidth={1} strokeDasharray="2 2" dot={false} />}

                    {/* Anchored VWAP Central Line */}
                    {showVWAP && <Line type="monotone" dataKey="vwap" stroke="#f59e0b" strokeWidth={2} dot={false} />}

                    {/* Close Price Curve */}
                    <Area type="monotone" dataKey="close" stroke="#38bdf8" strokeWidth={2.5} fill="url(#priceGrad)" />

                    {/* Dynamic Lower/Upper Reference Lines */}
                    {analytics?.agentDirective?.dynamicLower && (
                      <ReferenceLine y={analytics.agentDirective.dynamicLower} stroke="#10b981" strokeDasharray="3 3" label={{ value: `Lower $${Number(analytics.agentDirective.dynamicLower).toFixed(2)}`, fill: '#10b981', fontSize: 10 }} />
                    )}
                    {analytics?.agentDirective?.dynamicUpper && (
                      <ReferenceLine y={analytics.agentDirective.dynamicUpper} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `Upper $${Number(analytics.agentDirective.dynamicUpper).toFixed(2)}`, fill: '#ef4444', fontSize: 10 }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. CVD (Cumulative Volume Delta) Sub-Panel */}
            {showCVD && (
              <div style={{
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={16} color="#10b981" />
                    <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#f8fafc' }}>
                      Cumulative Volume Delta (CVD) Order Flow
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {analytics?.cvd?.divergence && (
                      <span style={{
                        background: analytics.cvd.divergence === 'BULLISH_ABSORPTION' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        border: `1px solid ${analytics.cvd.divergence === 'BULLISH_ABSORPTION' ? '#10b981' : '#ef4444'}`,
                        color: analytics.cvd.divergence === 'BULLISH_ABSORPTION' ? '#10b981' : '#ef4444',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}>
                        ⚡ {analytics.cvd.divergence.replace('_', ' ')}
                      </span>
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Current CVD: <strong style={{ color: (analytics?.cvd?.currentCVD || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {(analytics?.cvd?.currentCVD || 0) >= 0 ? '+' : ''}{analytics?.cvd?.currentCVD !== undefined ? Number(analytics.cvd.currentCVD).toFixed(2) : '0.00'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* CVD Bar Sub-Chart */}
                <div style={{ height: '140px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                      <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} orientation="right" />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontSize: '0.75rem' }}
                      />
                      <Bar dataKey="cvdDelta" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 3. 1-Click Fast Monte Carlo Simulation Replay */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(17, 24, 39, 0.8) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Compass size={18} color="#06b6d4" />
                  <span style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>
                    Monte Carlo Probability Simulation (1,000 Iterations)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Test Capital:</span>
                  <input
                    type="number"
                    value={simInvestment}
                    onChange={(e) => setSimInvestment(e.target.value)}
                    style={{
                      width: '70px',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    onClick={() => runSimulation()}
                    disabled={simLoading}
                    style={{
                      background: 'rgba(6, 182, 212, 0.2)',
                      border: '1px solid #06b6d4',
                      color: '#06b6d4',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {simLoading ? 'Simulating...' : 'Re-Run'}
                  </button>
                </div>
              </div>

              {/* Sim Stats Badges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Simulated Win Rate</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                    {simulationData?.simulatedWinRate || 78.5}%
                  </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Max Drawdown Floor</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>
                    {simulationData?.maxDrawdownPercent || -2.3}%
                  </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Expected Profit / Run</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                    +${simulationData?.expectedProfitDollar || 2.45}
                  </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Est. Time to Target</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#c084fc', marginTop: '2px' }}>
                    {simulationData?.estTimeToTargetMinutes || 42} mins
                  </div>
                </div>
              </div>

              {/* Recharts Monte Carlo Equity Curve */}
              <div style={{ height: '180px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={simulationData?.equityCurve || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="simP50" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis dataKey="timeLabel" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} orientation="right" />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontSize: '0.75rem' }}
                    />
                    <Line type="monotone" dataKey="p95PnL" stroke="#a855f7" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                    <Area type="monotone" dataKey="expectedPnL" stroke="#10b981" strokeWidth={2} fill="url(#simP50)" />
                    <Line type="monotone" dataKey="p5PnL" stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: QUANT AGENT INTELLIGENCE & LAUNCH SUPER ZEE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* 🧠 1. QUANT AGENT INTELLIGENCE PANEL */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
              border: '1px solid rgba(147, 51, 234, 0.35)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Cpu size={20} color="#c084fc" />
                  <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc' }}>
                    Quant Statistical Edge
                  </span>
                </div>
                <span style={{
                  background: `${currentRegimeColor}22`,
                  border: `1px solid ${currentRegimeColor}`,
                  color: currentRegimeColor,
                  padding: '3px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: '700'
                }}>
                  {currentRegime.replace('_', ' ')}
                </span>
              </div>

              {/* Stat Matrix */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Quant Conviction Score</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#f59e0b' }}>
                    {analytics?.quantScore || 75}/100
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Expected Value (Law 1)</span>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: (analytics?.expectedValue?.expectedValueDollar || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                    {(analytics?.expectedValue?.expectedValueDollar || 0) >= 0 ? '+' : ''}${analytics?.expectedValue?.expectedValueDollar !== undefined ? analytics.expectedValue.expectedValueDollar : '0.64'} / run
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Fractional Kelly (Law 2)</span>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: '#c084fc' }}>
                    {analytics?.expectedValue?.kellyAllocationPercent !== undefined ? `${analytics.expectedValue.kellyAllocationPercent}% Sizing` : '35.0% Sizing'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Win Probability & R:R</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#38bdf8' }}>
                    {analytics?.expectedValue?.winProbability || 78.4}% (R:R {analytics?.expectedValue?.recommendedRR || '2.85'}:1)
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Target vs Invalidation (Law 3)</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f8fafc' }}>
                    <span style={{ color: '#10b981' }}>+${Number(analytics?.expectedValue?.targetPrice || 0).toFixed(2)}</span> / <span style={{ color: '#ef4444' }}>-${Number(analytics?.agentDirective?.emergencyFloorPrice || 0).toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 🧠 2. LIVE AI THOUGHT STREAM TERMINAL */}
            <div style={{
              background: '#0a0f1d',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Radio size={16} color="#38bdf8" className="pulse-glow" />
                  <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#38bdf8' }}>
                    Live AI Thought Stream
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Unfiltered Quant Feed
                </span>
              </div>

              <div style={{
                height: '160px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                paddingRight: '4px'
              }}>
                {thoughtStream.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', padding: '1rem 0' }}>
                    Awaiting real-time mathematical directives from Quant AI Agent...
                  </div>
                ) : (
                  thoughtStream.map(t => (
                    <div key={t.id} style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      borderLeft: `3px solid ${t.action === 'OPPORTUNISTIC_DIP_BUY' ? '#10b981' : t.action === 'HARVEST_PROFIT' ? '#f59e0b' : t.action === 'REFUSE_ENTRY_HOLD_CASH' ? '#ef4444' : '#38bdf8'}`,
                      padding: '8px 10px',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      lineHeight: '1.3'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.7rem', marginBottom: '2px' }}>
                        <span>{t.time}</span>
                        <strong style={{ color: '#38bdf8' }}>{t.action}</strong>
                      </div>
                      <div style={{ color: '#e2e8f0' }}>{t.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 🚀 3. LAUNCH SUPER ZEE BOT CARD */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: '2px solid rgba(147, 51, 234, 0.55)',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 0 30px rgba(147, 51, 234, 0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={20} color="#c084fc" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#f8fafc' }}>
                    Deploy Super Zee Bot
                  </h3>
                </div>
                <span style={{
                  background: 'linear-gradient(135deg, #9333ea, #06b6d4)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.05em'
                }}>
                  {activeMethodologyObj.shortName.toUpperCase()}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1' }}>
                Deploys autonomous quant bot using <strong>{activeMethodologyObj.name}</strong> with dynamic Fractional Kelly position sizing.
              </p>

              {/* Investment Input + Quick Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Total Investment ($ USDT)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={botInvestment}
                    onChange={(e) => setBotInvestment(e.target.value)}
                    style={{
                      flex: 1,
                      background: '#0f172a',
                      border: '1px solid rgba(147, 51, 234, 0.4)',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '1rem',
                      fontWeight: '700'
                    }}
                  />
                  {[25, 50, 100, 250].map(val => (
                    <button
                      key={val}
                      onClick={() => setBotInvestment(val)}
                      style={{
                        background: botInvestment === val ? 'rgba(147, 51, 234, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: botInvestment === val ? '#c084fc' : '#94a3b8',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trading Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  onClick={() => setBotMode('PAPER')}
                  style={{
                    background: botMode === 'PAPER' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid ${botMode === 'PAPER' ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: botMode === 'PAPER' ? '#38bdf8' : '#94a3b8',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🧪 Paper Simulation
                </button>
                <button
                  onClick={() => setBotMode('LIVE')}
                  style={{
                    background: botMode === 'LIVE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid ${botMode === 'LIVE' ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: botMode === 'LIVE' ? '#10b981' : '#94a3b8',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🔥 Live Exchange
                </button>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleLaunchSuperZee()}
                disabled={launching}
                style={{
                  background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '14px',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 20px rgba(147, 51, 234, 0.5)',
                  transition: 'transform 0.15s ease'
                }}
              >
                <Zap size={18} />
                {launching ? 'Calibrating & Launching...' : `🚀 LAUNCH WITH ${activeMethodologyObj.shortName.toUpperCase()}`}
              </button>

              {launchSuccess && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  color: '#10b981',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  ✅ Super Zee Bot successfully launched! Redirecting to Bot Terminal...
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 🌟 PILLAR 3: VISION QUANT STUDIO MODAL / DIALOG */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {isVisionStudioOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 22, 0.88)',
          backdropFilter: 'blur(20px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1a1635 100%)',
            border: '1px solid rgba(147, 51, 234, 0.5)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '1080px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85)'
          }}>
            
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.8)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #38bdf8 0%, #9333ea 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 16px rgba(56, 189, 248, 0.5)'
                }}>
                  <Camera size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#f8fafc' }}>
                      Vision Quant Studio & Strategy Generator
                    </h2>
                    <span style={{
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      {selectedSymbol} • {selectedTimeframe}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    Multimodal Vision Pattern Detection • Pine Script v5 Code • Automated Backtest
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsVisionStudioOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Scrollable Content */}
            <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
              
              {/* Vision Analyzing Loading State */}
              {visionAnalyzing && (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: '4px solid rgba(147, 51, 234, 0.2)',
                    borderTopColor: '#c084fc',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#f8fafc' }}>
                    Analyzing Chart Snapshot with Gemini 2.5 Flash Vision...
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '500px', lineHeight: '1.5' }}>
                    Identifying Fair Value Gaps (FVG), Order Blocks, Breakouts, and compiling syntactically valid TradingView Pine Script v5 & Python bot logic...
                  </div>
                </div>
              )}

              {/* Analyzed Result View */}
              {!visionAnalyzing && visionResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Top Bar: Strategy Title & Detected Patterns */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(147, 51, 234, 0.3)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Synthesized Strategy Name
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                        {visionResult.script?.name || `${selectedSymbol} Vision Quant Strategy`}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {(visionResult.patterns || []).map((pat, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.4)',
                              color: '#38bdf8',
                              padding: '3px 9px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '700'
                            }}
                          >
                            🎯 {pat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Auto-Saved in Vault Badge */}
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#10b981',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '700'
                    }}>
                      <CheckCircle2 size={16} />
                      <span>Saved to Script Vault</span>
                    </div>
                  </div>

                  {/* Summary Narrative */}
                  {visionResult.summary && (
                    <div style={{
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '1rem 1.25rem',
                      fontSize: '0.85rem',
                      color: '#cbd5e1',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-line'
                    }}>
                      {visionResult.summary}
                    </div>
                  )}

                  {/* Trading Parameters Grid */}
                  {visionResult.tradingParameters && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '0.75rem'
                    }}>
                      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '0.85rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Target Entry Zone</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                          ${Number(visionResult.tradingParameters.entryPrice).toFixed(4)}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '0.85rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Take Profit 1 (+50% Scale)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                          ${Number(visionResult.tradingParameters.takeProfit1).toFixed(4)}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '0.85rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Take Profit 2 (Full Runner)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                          ${Number(visionResult.tradingParameters.takeProfit2).toFixed(4)}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '0.85rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Invalidation Stop Loss</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>
                          ${Number(visionResult.tradingParameters.stopLoss).toFixed(4)}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '0.85rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fractional Kelly Alloc</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#c084fc', marginTop: '2px' }}>
                          {visionResult.tradingParameters.kellyAllocPercent}% Sizing
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Automated Backtest KPI Dashboard */}
                  {visionResult.backtest && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.5) 100%)',
                      border: '1px solid rgba(147, 51, 234, 0.3)',
                      borderRadius: '14px',
                      padding: '1.25rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <BarChart3 size={18} color="#10b981" />
                          <span style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>
                            Historical Replay Backtest Performance (150 Candles)
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          Initial Capital: $1,000.00
                        </span>
                      </div>

                      {/* KPI Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Win Rate %</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                            {visionResult.backtest.winRate}%
                          </div>
                        </div>

                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Profit Factor</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                            {visionResult.backtest.profitFactor}x
                          </div>
                        </div>

                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Expected Value (EV)</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#c084fc', marginTop: '2px' }}>
                            +${visionResult.backtest.expectedValue}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Max Drawdown</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>
                            {visionResult.backtest.maxDrawdown}%
                          </div>
                        </div>

                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Trades (W/L)</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                            {visionResult.backtest.totalTrades} ({visionResult.backtest.winningTrades}W / {visionResult.backtest.losingTrades}L)
                          </div>
                        </div>
                      </div>

                      {/* Equity Curve Area Chart */}
                      <div style={{ height: '180px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={visionResult.backtest.equityCurve || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                            <XAxis dataKey="candle" stroke="#475569" fontSize={10} tickLine={false} label={{ value: 'Candles', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
                            <YAxis domain={['auto', 'auto']} stroke="#475569" fontSize={10} tickLine={false} orientation="right" />
                            <Tooltip
                              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontSize: '0.75rem' }}
                              formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Equity']}
                            />
                            <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2.5} fill="url(#eqGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Code Synthesis Tabs Section */}
                  <div style={{
                    background: '#0a0f1d',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    overflow: 'hidden'
                  }}>
                    {/* Tabs Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(15, 23, 42, 0.9)',
                      padding: '8px 14px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setVisionActiveTab('PINE')}
                          style={{
                            background: visionActiveTab === 'PINE' ? 'rgba(147, 51, 234, 0.3)' : 'transparent',
                            border: `1px solid ${visionActiveTab === 'PINE' ? '#9333ea' : 'transparent'}`,
                            color: visionActiveTab === 'PINE' ? '#c084fc' : '#94a3b8',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <FileCode size={14} />
                          <span>TradingView Pine Script (v5)</span>
                        </button>
                        <button
                          onClick={() => setVisionActiveTab('PYTHON')}
                          style={{
                            background: visionActiveTab === 'PYTHON' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
                            border: `1px solid ${visionActiveTab === 'PYTHON' ? '#38bdf8' : 'transparent'}`,
                            color: visionActiveTab === 'PYTHON' ? '#38bdf8' : '#94a3b8',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Terminal size={14} />
                          <span>Python / Super Zee Bot Code</span>
                        </button>
                      </div>

                      {/* Copy & Download Actions */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {visionActiveTab === 'PINE' ? (
                          <>
                            <button
                              onClick={() => copyToClipboard(visionResult.pineScript || '', 'PINE')}
                              style={{
                                background: copiedPine ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                border: `1px solid ${copiedPine ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                                color: copiedPine ? '#10b981' : '#f8fafc',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {copiedPine ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedPine ? 'Copied!' : 'Copy Pine'}</span>
                            </button>
                            <button
                              onClick={() => downloadCodeFile(`${selectedSymbol.replace(/[\/\-_]/g, '_')}_strategy.pine`, visionResult.pineScript || '')}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#f8fafc',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Download size={12} />
                              <span>Download .pine</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => copyToClipboard(visionResult.pythonScript || '', 'PYTHON')}
                              style={{
                                background: copiedPython ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                border: `1px solid ${copiedPython ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                                color: copiedPython ? '#10b981' : '#f8fafc',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {copiedPython ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedPython ? 'Copied!' : 'Copy Python'}</span>
                            </button>
                            <button
                              onClick={() => downloadCodeFile(`super_zee_${selectedSymbol.replace(/[\/\-_]/g, '_')}.py`, visionResult.pythonScript || '')}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#f8fafc',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Download size={12} />
                              <span>Download .py</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Code Syntax Box */}
                    <pre style={{
                      margin: 0,
                      padding: '1rem',
                      fontFamily: '"Fira Code", "Courier New", monospace',
                      fontSize: '0.8rem',
                      color: '#38bdf8',
                      lineHeight: '1.5',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      background: '#070b14'
                    }}>
                      <code>
                        {visionActiveTab === 'PINE' ? visionResult.pineScript : visionResult.pythonScript}
                      </code>
                    </pre>
                  </div>

                </div>
              )}

            </div>

            {/* Modal Footer / 1-Click Action */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.95)'
            }}>
              <button
                onClick={() => {
                  setIsVisionStudioOpen(false);
                  setIsVaultOpen(true);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94a3b8',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <BookOpen size={15} />
                <span>Open Script Vault</span>
              </button>

              <button
                onClick={() => {
                  if (visionResult?.script) {
                    setDeployModalScript(visionResult.script);
                  } else {
                    handleLaunchSuperZee();
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 20px rgba(147, 51, 234, 0.5)'
                }}
              >
                <Zap size={18} />
                <span>🚀 1-Click Run Direct with Super Zee Bot</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 📜 PILLAR 4: STRATEGY SCRIPT VAULT & LIBRARY DRAWER */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {isVaultOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 22, 0.85)',
          backdropFilter: 'blur(20px)',
          zIndex: 99998,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            background: '#0f172a',
            borderLeft: '1px solid rgba(147, 51, 234, 0.4)',
            width: '100%',
            maxWidth: '680px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 50px rgba(0, 0, 0, 0.8)'
          }}>
            
            {/* Drawer Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(30, 27, 75, 0.6)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <BookOpen size={22} color="#c084fc" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>
                    Strategy Script Library & Vault
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    {vaultScripts.length} Saved Quant Strategies • 1-Click Re-Deploy to Super Zee
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsVaultOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter & Search Toolbar */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* Search input */}
              <div style={{ position: 'relative' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search scripts by symbol, name, or pattern..."
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    borderRadius: '8px',
                    padding: '8px 12px 8px 36px',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setVaultFilterWinRate(vaultFilterWinRate === 70 ? 0 : 70)}
                  style={{
                    background: vaultFilterWinRate === 70 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${vaultFilterWinRate === 70 ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: vaultFilterWinRate === 70 ? '#10b981' : '#94a3b8',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Win Rate &gt; 70%
                </button>

                {QUANT_METHODOLOGIES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setVaultFilterMethod(vaultFilterMethod === m.id ? '' : m.id)}
                    style={{
                      background: vaultFilterMethod === m.id ? 'rgba(147, 51, 234, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${vaultFilterMethod === m.id ? '#c084fc' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: vaultFilterMethod === m.id ? '#c084fc' : '#94a3b8',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {m.icon} {m.shortName}
                  </button>
                ))}
              </div>
            </div>

            {/* Script Cards List */}
            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              {vaultLoading && (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="spin" color="#c084fc" style={{ margin: '0 auto 0.5rem' }} />
                  <div>Loading Vault Scripts...</div>
                </div>
              )}

              {!vaultLoading && vaultScripts.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  <BookOpen size={36} color="#64748b" style={{ margin: '0 auto 0.75rem' }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc' }}>Your Script Vault is Empty</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                    Click <strong>"📷 Take Snap"</strong> or <strong>"📁 Upload Chart"</strong> in the studio to generate and auto-save your first strategy!
                  </div>
                </div>
              )}

              {!vaultLoading && vaultScripts.map((sc) => {
                const kpis = sc.backtestKpis || {};
                const tParams = sc.tradingParameters || {};

                return (
                  <div
                    key={sc.id}
                    style={{
                      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.6) 100%)',
                      border: '1px solid rgba(147, 51, 234, 0.25)',
                      borderRadius: '14px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Header: Title, Symbol, Timeframe & Date */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            background: 'rgba(56, 189, 248, 0.2)',
                            border: '1px solid #38bdf8',
                            color: '#38bdf8',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '800'
                          }}>
                            {sc.symbol}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {sc.timeframe} • {sc.exchange}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(sc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#f8fafc', marginTop: '4px' }}>
                          {sc.name}
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteVaultScript(sc.id, e)}
                        title="Delete from Vault"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* KPI Badges */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '4px 8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Win Rate: </span>
                        <strong style={{ fontSize: '0.8rem', color: '#10b981' }}>{kpis.winRate || 72.5}%</strong>
                      </div>

                      <div style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', padding: '4px 8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Profit Factor: </span>
                        <strong style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{kpis.profitFactor || 2.4}x</strong>
                      </div>

                      <div style={{ background: 'rgba(192, 132, 252, 0.15)', border: '1px solid rgba(192, 132, 252, 0.3)', borderRadius: '6px', padding: '4px 8px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Kelly Sizing: </span>
                        <strong style={{ fontSize: '0.8rem', color: '#c084fc' }}>{tParams.kellyAllocPercent || 35}%</strong>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setVisionResult({
                              script: sc,
                              patterns: sc.patternsDetected || [],
                              summary: sc.summary || '',
                              pineScript: sc.pineScript || '',
                              pythonScript: sc.pythonScript || '',
                              backtest: sc.backtestKpis || {},
                              tradingParameters: sc.tradingParameters || {}
                            });
                            setIsVisionStudioOpen(true);
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#e2e8f0',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={13} />
                          <span>View Code</span>
                        </button>

                        <button
                          onClick={() => copyToClipboard(sc.pineScript || '', 'PINE')}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#e2e8f0',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Copy size={13} />
                          <span>Copy Pine</span>
                        </button>

                        <button
                          onClick={() => downloadCodeFile(`${sc.symbol.replace(/[\/\-_]/g, '_')}_strategy.pine`, sc.pineScript || '')}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#e2e8f0',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Download size={13} />
                          <span>.pine</span>
                        </button>
                      </div>

                      {/* 1-Click Re-deploy to Super Zee */}
                      <button
                        onClick={() => setDeployModalScript(sc)}
                        style={{
                          background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
                          border: 'none',
                          color: '#ffffff',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 10px rgba(147, 51, 234, 0.4)'
                        }}
                      >
                        <Zap size={14} />
                        <span>Run Direct</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 🚀 1-CLICK SCRIPT RE-DEPLOY MODAL */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {deployModalScript && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            border: '2px solid rgba(147, 51, 234, 0.6)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            padding: '1.5rem',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={20} color="#c084fc" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#f8fafc' }}>
                  Run Strategy with Super Zee Bot
                </h3>
              </div>
              <button
                onClick={() => setDeployModalScript(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4', margin: '0 0 1rem 0' }}>
              Instantly deploy <strong>{deployModalScript.name}</strong> on {deployModalScript.symbol} with stored corridor boundaries and Fractional Kelly sizing.
            </p>

            {/* Capital selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                Allocated Capital ($ USDT)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  value={deployCapital}
                  onChange={(e) => setDeployCapital(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1px solid rgba(147, 51, 234, 0.4)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '1rem',
                    fontWeight: '700'
                  }}
                />
                {[25, 50, 100, 250].map(val => (
                  <button
                    key={val}
                    onClick={() => setDeployCapital(val)}
                    style={{
                      background: deployCapital === val ? 'rgba(147, 51, 234, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: deployCapital === val ? '#c084fc' : '#94a3b8',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Execution Mode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                onClick={() => setDeployMode('PAPER')}
                style={{
                  background: deployMode === 'PAPER' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${deployMode === 'PAPER' ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: deployMode === 'PAPER' ? '#38bdf8' : '#94a3b8',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                🧪 Paper Simulation
              </button>
              <button
                onClick={() => setDeployMode('LIVE')}
                style={{
                  background: deployMode === 'LIVE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${deployMode === 'LIVE' ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: deployMode === 'LIVE' ? '#10b981' : '#94a3b8',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                🔥 Live Exchange
              </button>
            </div>

            {/* Submit Action */}
            <button
              onClick={() => handleDeploySavedScript(deployModalScript, deployCapital, deployMode)}
              disabled={deploying}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(147, 51, 234, 0.5)'
              }}
            >
              <Zap size={18} />
              <span>{deploying ? 'Deploying Super Zee Bot...' : 'Confirm & Launch Bot'}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
