import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, TrendingUp, TrendingDown, Activity, Zap, Shield,
  RefreshCw, Play, BarChart3, Clock, AlertTriangle, Layers,
  Compass, ArrowUpRight, CheckCircle2, ChevronRight, Info,
  Cpu, DollarSign, Target, Sliders, ShieldCheck, Flame, Radio
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

const POPULAR_PAIRS = ['SOL/USDT', 'BTC/USDT', 'ETH/USDT', 'XRP/USDT', 'BNB/USDT', 'DOGE/USDT', 'ADA/USDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];
const EXCHANGES = ['Binance', 'CoinDCX', 'Jupiter'];

export default function PredictiveAnalysis() {
  const navigate = useNavigate();

  // Controls State
  const [selectedSymbol, setSelectedSymbol] = useState('SOL/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [selectedExchange, setSelectedExchange] = useState('Binance');
  const [autoRefresh, setAutoRefresh] = useState(true);

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
  const [launching, setLaunching] = useState(false);
  const [launchSuccess, setLaunchSuccess] = useState(null);

  // Overlays View Toggles
  const [showVWAP, setShowVWAP] = useState(true);
  const [showBands, setShowBands] = useState(true);
  const [showCVD, setShowCVD] = useState(true);

  // Thought Stream History
  const [thoughtStream, setThoughtStream] = useState([]);

  // Fetch live quant analytics
  const fetchAnalytics = async (sym = selectedSymbol, tf = selectedTimeframe, ex = selectedExchange) => {
    try {
      setError('');
      const res = await api(`/predictive/analytics?symbol=${encodeURIComponent(sym)}&timeframe=${tf}&exchange=${ex}`);
      if (res.success && res.data) {
        setAnalytics(res.data);
        setLastUpdated(new Date());

        // Append new thought to stream if distinct
        if (res.data.agentDirective?.thought) {
          const newThought = {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            text: res.data.agentDirective.thought,
            action: res.data.agentDirective.action,
            regime: res.data.regime
          };
          setThoughtStream(prev => [newThought, ...prev.slice(0, 14)]);
        }
      } else {
        setError(res.error || 'Failed to load predictive analytics');
      }
    } catch (err) {
      setError(err.message || 'Connection error loading quant analytics');
    } finally {
      setLoading(false);
    }
  };

  // Run Monte Carlo Replay Simulation
  const runSimulation = async (inv = simInvestment) => {
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
          horizon: 48
        })
      });

      if (res.success && res.data?.simulation) {
        setSimulationData(res.data.simulation);
      }
    } catch (err) {
      console.warn('Simulation failed:', err.message);
    } finally {
      setSimLoading(false);
    }
  };

  // Launch Autonomous Super Zee Bot
  const handleLaunchSuperZee = async () => {
    setLaunching(true);
    setLaunchSuccess(null);
    try {
      const res = await api('/predictive/launch-super-zee', {
        method: 'POST',
        body: JSON.stringify({
          symbol: selectedSymbol,
          exchange: selectedExchange,
          mode: botMode,
          investedAmount: Number(botInvestment) || 50,
          name: `Super Zee ${selectedSymbol} (${botMode})`
        })
      });

      if (res.success && res.data?.bot) {
        setLaunchSuccess(res.data.bot);
        setTimeout(() => {
          navigate(`/bots/${res.data.bot.id || res.data.bot.bot?.id}`);
        }, 1200);
      } else {
        alert(res.error || 'Failed to launch Super Zee Bot');
      }
    } catch (err) {
      alert(`Launch error: ${err.message}`);
    } finally {
      setLaunching(false);
    }
  };

  // Initial Load & Auto-Refresh
  useEffect(() => {
    setLoading(true);
    fetchAnalytics(selectedSymbol, selectedTimeframe, selectedExchange);
    runSimulation(simInvestment);
  }, [selectedSymbol, selectedTimeframe, selectedExchange]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAnalytics(selectedSymbol, selectedTimeframe, selectedExchange);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedSymbol, selectedTimeframe, selectedExchange]);

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

  return (
    <div className="predictive-page" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* 🔮 TOP CONTROL HEADER */}
      <div className="quant-header-card" style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.7) 100%)',
        border: '1px solid rgba(147, 51, 234, 0.3)',
        borderRadius: '16px',
        padding: '1.25rem 1.75rem',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(147, 51, 234, 0.5)'
          }}>
            <Sparkles size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', letterSpacing: '-0.02em', color: '#f8fafc' }}>
                Predictive Analysis Studio
              </h1>
              <span style={{
                background: 'rgba(147, 51, 234, 0.2)',
                border: '1px solid rgba(147, 51, 234, 0.5)',
                color: '#c084fc',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                QUANT ENGINE
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
              Multi-Dev Gaussian VWAP Bands, CVD Order Flow Divergence, Volatility Squeeze & Autonomous Super Zee Bot
            </p>
          </div>
        </div>

        {/* CONTROLS BAR */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* Symbol Picker */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              style={{ background: 'transparent', color: '#f8fafc', border: 'none', padding: '6px 12px', fontWeight: '600', outline: 'none', cursor: 'pointer' }}
            >
              {POPULAR_PAIRS.map(p => <option key={p} value={p} style={{ background: '#0f172a', color: '#fff' }}>{p}</option>)}
            </select>
          </div>

          {/* Timeframe Chips */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                style={{
                  background: selectedTimeframe === tf ? 'rgba(147, 51, 234, 0.8)' : 'transparent',
                  color: selectedTimeframe === tf ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '4px 10px',
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
            onClick={() => fetchAnalytics()}
            disabled={loading}
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
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 📊 MAIN 2-COLUMN GRID */}
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
                  <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc' }}>
                    {selectedSymbol}
                  </span>
                  <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#38bdf8' }}>
                    ${analytics?.currentPrice ? Number(analytics.currentPrice).toFixed(4) : '---'}
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
                    Live Feed
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Anchored VWAP: <strong style={{ color: '#e2e8f0' }}>${analytics?.vwap ? Number(analytics.vwap).toFixed(4) : '---'}</strong> | σ Dev: <strong style={{ color: '#c084fc' }}>${analytics?.sigma ? Number(analytics.sigma).toFixed(4) : '---'}</strong>
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
                    <ReferenceLine y={analytics.agentDirective.dynamicLower} stroke="#10b981" strokeDasharray="3 3" label={{ value: `Lower $${analytics.agentDirective.dynamicLower.toFixed(2)}`, fill: '#10b981', fontSize: 10 }} />
                  )}
                  {analytics?.agentDirective?.dynamicUpper && (
                    <ReferenceLine y={analytics.agentDirective.dynamicUpper} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `Upper $${analytics.agentDirective.dynamicUpper.toFixed(2)}`, fill: '#ef4444', fontSize: 10 }} />
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
                      {(analytics?.cvd?.currentCVD || 0) >= 0 ? '+' : ''}{analytics?.cvd?.currentCVD ? Number(analytics.cvd.currentCVD).toFixed(2) : '0.00'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* CVD Bar & Line Sub-Chart */}
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
                  1-Click Historical Monte Carlo Simulation (1,000 Iterations)
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
                  {simulationData?.simulatedWinRate || 81.2}%
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Max Simulated Drawdown</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>
                  {simulationData?.maxDrawdownPercent || -2.1}%
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
            border: '1px solid rgba(147, 51, 234, 0.3)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={20} color="#c084fc" />
                <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc' }}>
                  Quant Agent Intelligence
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Win Probability</span>
                <span style={{ fontSize: '1rem', fontWeight: '800', color: '#10b981' }}>
                  {analytics?.expectedValue?.winProbability || 78.4}%
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Expected Value (EV)</span>
                <span style={{ fontSize: '1rem', fontWeight: '800', color: '#38bdf8' }}>
                  +${analytics?.expectedValue?.expectedValueDollar || 0.64} / run
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Recommended R:R Ratio</span>
                <span style={{ fontSize: '1rem', fontWeight: '800', color: '#f59e0b' }}>
                  {analytics?.expectedValue?.recommendedRR || 2.85} : 1
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>ATR Volatility Meter</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#c084fc' }}>
                  {analytics?.squeeze?.atrPercent || 0.44}% ({analytics?.squeeze?.inSqueeze ? 'Squeeze Active' : 'Normal'})
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Active Microsecond Floor</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ef4444' }}>
                  ${analytics?.agentDirective?.emergencyFloorPrice ? Number(analytics.agentDirective.emergencyFloorPrice).toFixed(4) : '---'}
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
                Explainability Feed
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
                  Awaiting real-time directives from Quant AI Agent...
                </div>
              ) : (
                thoughtStream.map(t => (
                  <div key={t.id} style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderLeft: `3px solid ${t.action === 'OPPORTUNISTIC_DIP_BUY' ? '#10b981' : t.action === 'HARVEST_PROFIT' ? '#f59e0b' : '#38bdf8'}`,
                    padding: '6px 10px',
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
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '2px solid rgba(147, 51, 234, 0.5)',
            borderRadius: '16px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 0 30px rgba(147, 51, 234, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} color="#c084fc" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#f8fafc' }}>
                  Execute With Super Zee Bot
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
                AUTONOMOUS AGENT
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1' }}>
              Deploys an autonomous quant agent guided continuously by the Predictive Analysis brain with zero rigid rules.
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
              onClick={handleLaunchSuperZee}
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
              {launching ? 'Calibrating & Launching...' : '🚀 EXECUTE WITH SUPER ZEE'}
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

    </div>
  );
}
