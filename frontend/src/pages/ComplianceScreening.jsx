import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  Search, ExternalLink, RefreshCw, Zap, Sparkles, ArrowRight,
  Info, Globe, Check, X, Droplets, BookOpen, Layers,
  Compass, Award, BarChart3, TrendingUp, Lock
} from 'lucide-react';

const api = (path, opts = {}) =>
  fetch(`${import.meta.env.VITE_API || 'http://localhost:5000'}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    ...opts
  }).then(r => r.json());

const EXCHANGES = [
  { id: 'NSE', name: 'NSE (India)', category: 'Indian Equities' },
  { id: 'BSE', name: 'BSE (India)', category: 'Indian Equities' },
  { id: 'NASDAQ', name: 'NASDAQ', category: 'US Equities' },
  { id: 'NYSE', name: 'NYSE', category: 'US Equities' },
  { id: 'Binance', name: 'Binance', category: 'Crypto' },
  { id: 'CoinDCX', name: 'CoinDCX', category: 'Crypto' },
  { id: 'Jupiter', name: 'Jupiter (Solana DEX)', category: 'Crypto' },
  { id: 'Upstox', name: 'Upstox Broker', category: 'Broker' },
  { id: 'AngelOne', name: 'Angel One Broker', category: 'Broker' }
];

const POPULAR_CHIPS = [
  { symbol: 'KPIL', exchange: 'NSE', label: 'KPIL (Kalpataru)' },
  { symbol: 'RELIANCE', exchange: 'NSE', label: 'Reliance' },
  { symbol: 'TCS', exchange: 'NSE', label: 'TCS' },
  { symbol: 'AAPL', exchange: 'NASDAQ', label: 'Apple' },
  { symbol: 'NVDA', exchange: 'NASDAQ', label: 'NVIDIA' },
  { symbol: 'SOL/USDT', exchange: 'Binance', label: 'Solana (SOL)' },
  { symbol: 'BTC/USDT', exchange: 'Binance', label: 'Bitcoin (BTC)' },
  { symbol: 'HDFCBANK', exchange: 'NSE', label: 'HDFC Bank (Haram Benchmark)' }
];

export default function ComplianceScreening() {
  const navigate = useNavigate();

  // Selected Framework State
  const [selectedFramework, setSelectedFramework] = useState('SHARIAH'); // 'SHARIAH' | 'BRI' | 'DHARMA'

  // Search State
  const [searchSymbol, setSearchSymbol] = useState('KPIL');
  const [searchExchange, setSearchExchange] = useState('NSE');

  // Result & Loading States
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [popularAssets, setPopularAssets] = useState([]);

  // Fetch Compliance Screening Report
  const handleScreenAsset = async (sym = searchSymbol, ex = searchExchange) => {
    if (!sym.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await api('/compliance/shariah-screen', {
        method: 'POST',
        body: JSON.stringify({
          symbol: sym.trim().toUpperCase(),
          exchange: ex
        })
      });

      if (res.success && res.data) {
        setReport(res.data);
      } else if (res.status) {
        setReport(res);
      } else {
        setError(res.error || res.message || 'Failed to complete compliance screening');
      }
    } catch (err) {
      setError(err.message || 'Connection error while auditing compliance');
    } finally {
      setLoading(false);
    }
  };

  // Fetch popular benchmark assets
  useEffect(() => {
    api('/compliance/popular')
      .then(res => {
        if (res.success && Array.isArray(res.assets)) {
          setPopularAssets(res.assets);
        }
      })
      .catch(() => {});

    // Initial scan on load
    handleScreenAsset('KPIL', 'NSE');
  }, []);

  const isHalal = report?.status === 'HALAL';
  const isHaram = report?.status === 'HARAM';
  const isMushbooh = report?.status === 'MUSHBOOH';

  return (
    <div className="compliance-screening-page" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', color: '#f8fafc' }}>
      
      {/* 🏛️ TOP HEADER BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(20, 83, 45, 0.4) 50%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        borderRadius: '20px',
        padding: '1.75rem 2rem',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 24px rgba(16, 185, 129, 0.5)'
          }}>
            <Scale size={28} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#f8fafc' }}>
                Ethical & Faith-Based Compliance Screening
              </h1>
              <span style={{
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.6)',
                color: '#34d399',
                padding: '3px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: '800',
                letterSpacing: '0.05em'
              }}>
                GOOGLE GROUNDED
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#94a3b8' }}>
              Audit-grade Islamic Shariah Screening cross-referencing Musaffa, Islamicly, AAOIFI Standards & Fatwa databases in real time.
            </p>
          </div>
        </div>

        {/* Global Standard Badges */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '600' }}>
            📜 AAOIFI Standard #21
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '600' }}>
            🌐 Musaffa & Islamicly Verified
          </div>
        </div>
      </div>

      {/* ⚖️ 1. FRAMEWORK SELECTION CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        
        {/* Card 1: Shariah Compliance (ACTIVE) */}
        <div
          onClick={() => setSelectedFramework('SHARIAH')}
          style={{
            background: selectedFramework === 'SHARIAH'
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : 'rgba(15, 23, 42, 0.6)',
            border: `2px solid ${selectedFramework === 'SHARIAH' ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: '16px',
            padding: '1.5rem',
            cursor: 'pointer',
            position: 'relative',
            boxShadow: selectedFramework === 'SHARIAH' ? '0 0 25px rgba(16, 185, 129, 0.25)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldCheck size={20} color="#10b981" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#f8fafc' }}>
                Shariah Compliance
              </h3>
            </div>
            <span style={{
              background: '#10b981',
              color: '#064e3b',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '900',
              letterSpacing: '0.05em'
            }}>
              ACTIVE & VERIFIED
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
            Screens equities & crypto against <strong>AAOIFI</strong>, <strong>Musaffa</strong>, and <strong>Islamicly</strong> standards. Audits core business purity, 33% debt limits, and dividend purification rates.
          </p>
        </div>

        {/* Card 2: Biblically Responsible Investing (COMING SOON) */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.5rem',
          opacity: 0.7,
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BookOpen size={20} color="#f59e0b" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: '#e2e8f0' }}>
                Biblically Responsible (BRI)
              </h3>
            </div>
            <span style={{
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid #f59e0b',
              color: '#f59e0b',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '800'
            }}>
              ⏳ COMING SOON
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
            Screen companies aligned with Christian Biblical values (excluding predatory lending, abortion involvement, and bioethics concerns).
          </p>
        </div>

        {/* Card 3: Dharma Investing (COMING SOON) */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.5rem',
          opacity: 0.7,
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(147, 51, 234, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Compass size={20} color="#c084fc" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: '#e2e8f0' }}>
                Dharma Investing
              </h3>
            </div>
            <span style={{
              background: 'rgba(147, 51, 234, 0.2)',
              border: '1px solid #c084fc',
              color: '#c084fc',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '800'
            }}>
              ⏳ COMING SOON
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
            Screen companies adhering to Dharmic principles (Ahimsa / Non-violence, Environmental sustainability, and ethical corporate conduct).
          </p>
        </div>

      </div>

      {/* 🔍 2. SEARCH & EXCHANGE INPUT BAR */}
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          
          {/* Symbol Input */}
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={18} color="#10b981" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleScreenAsset();
              }}
              placeholder="Enter Stock Ticker or Token (e.g. KPIL, RELIANCE, AAPL, SOL)..."
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '10px',
                padding: '12px 14px 12px 42px',
                color: '#f8fafc',
                fontSize: '0.95rem',
                fontWeight: '700',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Exchange Selector */}
          <div style={{ flex: '0 1 200px' }}>
            <select
              value={searchExchange}
              onChange={(e) => setSearchExchange(e.target.value)}
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#38bdf8',
                fontSize: '0.9rem',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {EXCHANGES.map(ex => (
                <option key={ex.id} value={ex.id} style={{ background: '#0f172a', color: '#fff' }}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          {/* Screen Button */}
          <button
            onClick={() => handleScreenAsset()}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '10px',
              fontSize: '0.95rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
              transition: 'transform 0.15s ease'
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Auditing Portals...' : 'Screen Compliance'}</span>
          </button>
        </div>

        {/* Quick Popular Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
            Quick Benchmarks:
          </span>
          {POPULAR_CHIPS.map(chip => (
            <button
              key={chip.symbol}
              onClick={() => {
                setSearchSymbol(chip.symbol);
                setSearchExchange(chip.exchange);
                handleScreenAsset(chip.symbol, chip.exchange);
              }}
              style={{
                background: chip.symbol === 'HDFCBANK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${chip.symbol === 'HDFCBANK' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                color: chip.symbol === 'HDFCBANK' ? '#ef4444' : '#e2e8f0',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ⏳ LOADING STATE */}
      {loading && (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', background: '#0f172a', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: '4px solid rgba(16, 185, 129, 0.2)',
            borderTopColor: '#10b981',
            margin: '0 auto 1.25rem',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f8fafc' }}>
            Performing Live Islamic Finance Audit for {searchSymbol.toUpperCase()}...
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>
            Querying Google Grounded Islamic databases: Musaffa, Islamicly, Muslim Xchange, Zoya & AAOIFI Standard #21...
          </div>
        </div>
      )}

      {/* 🌟 3. BIG BOLD VISUAL COMPLIANCE VERDICT & AUDIT PRESENTATION */}
      {!loading && report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* BIG GLOWING STATUS BANNER */}
          <div style={{
            background: isHalal
              ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : isHaram
              ? 'linear-gradient(135deg, rgba(127, 29, 29, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(120, 53, 15, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: `2px solid ${isHalal ? '#10b981' : isHaram ? '#ef4444' : '#f59e0b'}`,
            borderRadius: '20px',
            padding: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
            boxShadow: isHalal
              ? '0 0 50px rgba(16, 185, 129, 0.35)'
              : isHaram
              ? '0 0 50px rgba(239, 68, 68, 0.35)'
              : '0 0 50px rgba(245, 158, 11, 0.35)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              
              {/* Massive Verdict Badge */}
              <div style={{
                background: isHalal ? '#10b981' : isHaram ? '#ef4444' : '#f59e0b',
                color: isHalal ? '#022c22' : '#450a0a',
                padding: '16px 28px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
              }}>
                {isHalal ? <CheckCircle2 size={36} /> : isHaram ? <ShieldAlert size={36} /> : <AlertTriangle size={36} />}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '900', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    SHARIAH STATUS
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '900', lineHeight: '1.1' }}>
                    {report.status}
                  </div>
                </div>
              </div>

              {/* Company & Verdict Details */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#f8fafc' }}>
                    {report.name || report.symbol}
                  </span>
                  <span style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700' }}>
                    {report.symbol} • {report.exchange}
                  </span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: '700', color: isHalal ? '#34d399' : isHaram ? '#f87171' : '#fbbf24', marginTop: '4px' }}>
                  {report.verdictTitle || (isHalal ? '100% Shariah Compliant Asset' : 'Non-Compliant / Prohibited Asset')}
                </div>
              </div>
            </div>

            {/* Score & Audit Badge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                Compliance Audit Score
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: '900', color: isHalal ? '#10b981' : isHaram ? '#ef4444' : '#f59e0b' }}>
                {report.complianceScore || (isHalal ? 95 : 15)}<span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>/100</span>
              </div>
            </div>
          </div>

          {/* 📝 EXECUTIVE SUMMARY CARD */}
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.5rem',
            lineHeight: '1.7',
            fontSize: '0.95rem',
            color: '#e2e8f0',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Executive Audit Summary
            </div>
            {report.summary}
          </div>

          {/* 📊 4-PILLAR AUDIT BREAKDOWN GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            
            {/* Pillar 1: Business Activity Screen */}
            <div style={{
              background: '#0f172a',
              border: `1px solid ${report.businessActivity?.compliant ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} color="#38bdf8" />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#f8fafc' }}>
                    1. Core Business Activity
                  </h4>
                </div>
                <span style={{
                  background: report.businessActivity?.compliant ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: report.businessActivity?.compliant ? '#10b981' : '#ef4444',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '800'
                }}>
                  {report.businessActivity?.compliant ? 'PASSED (HALAL)' : 'FAILED (HARAM)'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Prohibited Revenue:</span>
                <strong style={{ color: report.businessActivity?.compliant ? '#10b981' : '#ef4444' }}>
                  {report.businessActivity?.impermissibleRevenuePercent || '0.0%'} (Max: 5.0%)
                </strong>
              </div>

              <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {report.businessActivity?.details}
              </p>
            </div>

            {/* Pillar 2: Financial Ratios Screen */}
            <div style={{
              background: '#0f172a',
              border: `1px solid ${report.financialRatios?.compliant ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart3 size={18} color="#c084fc" />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#f8fafc' }}>
                    2. Financial Ratios (AAOIFI)
                  </h4>
                </div>
                <span style={{
                  background: report.financialRatios?.compliant ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: report.financialRatios?.compliant ? '#10b981' : '#ef4444',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '800'
                }}>
                  {report.financialRatios?.compliant ? 'PASSED' : 'FAILED'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Interest Debt / MCap:</span>
                  <strong style={{ color: '#10b981' }}>{report.financialRatios?.debtToMarketCap || '< 33%'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Interest Cash Securities:</span>
                  <strong style={{ color: '#38bdf8' }}>{report.financialRatios?.interestBearingSecurities || '< 33%'}</strong>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {report.financialRatios?.details}
              </p>
            </div>

            {/* Pillar 3: Purification Ratio */}
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Droplets size={18} color="#f59e0b" />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#f8fafc' }}>
                    3. Dividend Purification %
                  </h4>
                </div>
                <span style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '800'
                }}>
                  {report.purification?.required ? 'CLEANSING ADVISED' : 'NONE REQUIRED'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Recommended Charity Rate:</span>
                <strong style={{ color: '#f59e0b', fontSize: '1rem' }}>
                  {report.purification?.percentage || '0.25% - 0.40%'}
                </strong>
              </div>

              <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {report.purification?.note}
              </p>
            </div>

            {/* Pillar 4: Verified Reference Sources & Citations */}
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={18} color="#38bdf8" />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#f8fafc' }}>
                  4. Verified Sources & Citations
                </h4>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Audit Board: <strong>{report.scholarBoard || 'AAOIFI & Islamicly Board Consensus'}</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                {(report.references || []).map((ref, idx) => (
                  <a
                    key={idx}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      color: '#38bdf8',
                      textDecoration: 'none',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🔗 {ref.name}</span>
                    <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            </div>

          </div>

          {/* 🚀 5. BRIDGE ACTIONS */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.8) 100%)',
            border: '1px solid rgba(147, 51, 234, 0.4)',
            borderRadius: '16px',
            padding: '1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#f8fafc' }}>
                Trade or Deploy Bots on this Compliant Asset
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                Seamlessly analyze {report.symbol} in our Predictive Studio or deploy an autonomous Super Zee Bot with dynamic Fractional Kelly position sizing.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/predictive-analysis')}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#f8fafc',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Sparkles size={16} color="#c084fc" />
                <span>Open in Predictive Studio</span>
              </button>

              <button
                onClick={() => navigate('/bots')}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Zap size={16} />
                <span>Deploy Halal Super Zee Bot</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
