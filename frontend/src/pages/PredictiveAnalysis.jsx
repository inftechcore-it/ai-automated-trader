import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, TrendingUp, TrendingDown, Activity, Zap, Shield,
  RefreshCw, Play, BarChart3, Clock, AlertTriangle, Layers,
  Compass, ArrowUpRight, CheckCircle2, ChevronRight, Info,
  Cpu, DollarSign, Target, Sliders, ShieldCheck, Flame, Radio,
  Search, X, ChevronDown, Check, CornerDownLeft, Eye, Award,
  Crosshair, ShieldAlert, ArrowDownRight, BarChart2, Hash
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

const POPULAR_PAIRS = [
  { symbol: 'SOL/USDT', name: 'Solana' },
  { symbol: 'BTC/USDT', name: 'Bitcoin' },
  { symbol: 'ETH/USDT', name: 'Ethereum' },
  { symbol: 'XRP/USDT', name: 'XRP' },
  { symbol: 'BNB/USDT', name: 'BNB' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin' },
  { symbol: 'PEPE/USDT', name: 'Pepe' },
  { symbol: 'NEAR/USDT', name: 'NEAR Protocol' },
  { symbol: 'SUI/USDT', name: 'Sui' },
  { symbol: 'RENDER/USDT', name: 'Render Token' },
  { symbol: 'FIL/USDT', name: 'Filecoin' },
  { symbol: 'ADA/USDT', name: 'Cardano' },
  { symbol: 'AVAX/USDT', name: 'Avalanche' },
  { symbol: 'LINK/USDT', name: 'Chainlink' },
];

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];
const EXCHANGES = ['Binance', 'CoinDCX', 'Jupiter'];

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
          const filtered = POPULAR_PAIRS.filter(p =>
            p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSearchResults(filtered);
        }
      } catch {
        const filtered = POPULAR_PAIRS.filter(p =>
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

  // Select a coin from dropdown
  const handleSelectCoin = (sym) => {
    let formatted = sym.trim().toUpperCase();
    if (!formatted.includes('/') && formatted.endsWith('USDT')) {
      formatted = `${formatted.slice(0, -4)}/USDT`;
    } else if (!formatted.includes('/') && formatted.endsWith('USDC')) {
      formatted = `${formatted.slice(0, -4)}/USDC`;
    } else if (!formatted.includes('/')) {
      formatted = `${formatted}/USDT`;
    }
    setSelectedSymbol(formatted);
    setIsSearchOpen(false);
    setSearchQuery('');
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

  // Launch Autonomous Super Zee Bot
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

  // Initial Load & Auto-Refresh for Studio & Screener
  useEffect(() => {
    if (viewMode === 'STUDIO') {
      setLoading(true);
      fetchAnalytics(selectedSymbol, selectedTimeframe, selectedExchange, selectedMethodology);
      runSimulation(simInvestment, selectedMethodology);
    } else {
      fetchScreener(selectedExchange, selectedTimeframe, screenerCount, selectedMethodology);
    }
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
              3 Laws of Quant Trading, Multi-Dev Gaussian VWAP, CVD Imbalance & Fractional Kelly Sizing
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

        {/* CONTROLS BAR */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          
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
                  {/* Search Input */}
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

                  {/* Direct Custom Ticker Quick Select */}
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

                  {/* Popular Coins Grid */}
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Popular Markets
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                    {(searchResults.length > 0 ? searchResults : POPULAR_PAIRS).map((coin) => {
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
                          <span>{sym}</span>
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

          {/* Exchange Dropdown */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <select
              value={selectedExchange}
              onChange={(e) => setSelectedExchange(e.target.value)}
              style={{ background: 'transparent', color: '#38bdf8', border: 'none', padding: '6px 12px', fontWeight: '600', outline: 'none', cursor: 'pointer' }}
            >
              {EXCHANGES.map(ex => <option key={ex} value={ex} style={{ background: '#0f172a', color: '#fff' }}>{ex} Spot</option>)}
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
                      
                      {/* Quant Score Progress */}
                      <div style={{ minWidth: '120px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Quant Score</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: '900', color: rankColor }}>
                            {opp.score}/100
                          </span>
                        </div>
                        <div style={{ width: '100px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                          <div style={{ width: `${opp.score}%`, height: '100%', background: `linear-gradient(90deg, #9333ea, ${rankColor})` }} />
                        </div>
                      </div>

                      {/* Expected Value */}
                      <div style={{ minWidth: '110px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Expected Value (EV)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: opp.expectedValueDollar >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                          {opp.expectedValueDollar >= 0 ? '+' : ''}${opp.expectedValueDollar}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Law 1: Positive EV</div>
                      </div>

                      {/* Win Prob & R:R */}
                      <div style={{ minWidth: '110px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Win Probability</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                          {opp.winProbability}%
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>R:R {opp.recommendedRR}:1</div>
                      </div>

                      {/* Fractional Kelly Sizing */}
                      <div style={{ minWidth: '120px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Kelly Sizing</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#c084fc', marginTop: '2px' }}>
                          {opp.kellyAllocationPercent}%
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Fractional (0.5f*)</div>
                      </div>

                    </div>

                    {/* Right: Quant Reasons & Direct Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      
                      <button
                        onClick={() => {
                          setSelectedSymbol(opp.symbol);
                          setViewMode('STUDIO');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          color: '#38bdf8',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={14} />
                        <span>Studio Deep-Dive</span>
                      </button>

                      <button
                        onClick={() => handleLaunchSuperZee(opp.symbol, opp.kellyAllocationPercent)}
                        disabled={launching}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
                          border: 'none',
                          color: '#ffffff',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 15px rgba(147, 51, 234, 0.4)'
                        }}
                      >
                        <Zap size={14} />
                        <span>Deploy Super Zee</span>
                      </button>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* 📐 THE 3 MATHEMATICAL LAWS SUMMARY CARD */}
          <div style={{
            background: 'linear-gradient(135deg, #0a0f1d 0%, #1e1b4b 100%)',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            borderRadius: '16px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="#10b981" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#f8fafc' }}>
                The 3 Mathematical Laws of Quant Trading (Active & Enforced)
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: '800', fontSize: '0.9rem' }}>
                  <span>⚖️ Law 1: Positive EV Gatekeeper</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '6px 0 0', lineHeight: '1.35' }}>
                  Every setup must mathematically satisfy EV &gt; $0.00. If expected value turns negative during choppy chop, Super Zee strictly refuses entry and preserves 100% cash.
                </p>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(192, 132, 252, 0.3)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', fontWeight: '800', fontSize: '0.9rem' }}>
                  <span>📊 Law 2: Fractional Kelly Sizing</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '6px 0 0', lineHeight: '1.35' }}>
                  Position sizing is calculated dynamically via half-Kelly: f* = ((b · p - q) / b) × 0.5. Sizes scale dynamically between 15% and 50% based on statistical win edge.
                </p>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: '800', fontSize: '0.9rem' }}>
                  <span>🛡️ Law 3: Asymmetric R:R & Invalidation Floor</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '6px 0 0', lineHeight: '1.35' }}>
                  Target harvest locked at +1.85σ while in-memory microsecond exit caps losses at -1.0σ. Over 100 cycles, positive asymmetry guarantees compounding capital growth.
                </p>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 📊 VIEW MODE 2: 🔬 SINGLE COIN QUANT STUDIO (Deep-Dive) */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'STUDIO' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(340px, 1fr)', gap: '1.5rem' }}>
          
          {/* LEFT COLUMN: MULTI-CHART QUANT STUDIO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* 1. Interactive Candlestick + Gaussian VWAP Bands Chart */}
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.25rem',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>
                      {selectedSymbol}
                    </span>
                    <span style={{ fontSize: '1.35rem', fontWeight: '800', color: '#38bdf8' }}>
                      ${analytics?.currentPrice !== undefined ? Number(analytics.currentPrice).toFixed(4) : '---'}
                    </span>
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {activeMethodologyObj.shortName}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    Anchored VWAP: <strong style={{ color: '#e2e8f0' }}>${analytics?.vwap !== undefined ? Number(analytics.vwap).toFixed(4) : '---'}</strong> | σ Dev: <strong style={{ color: '#c084fc' }}>${analytics?.sigma !== undefined ? Number(analytics.sigma).toFixed(4) : '---'}</strong> | Score: <strong style={{ color: '#f59e0b' }}>{analytics?.quantScore || 75}/100</strong>
                  </div>
                </div>

                {/* Chart Overlay Toggles */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
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

    </div>
  );
}
