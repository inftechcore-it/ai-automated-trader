import { useState } from 'react';
import {
  Brain, Sparkles, Shield, AlertTriangle, CheckCircle, ArrowRight,
  Copy, Check, ChevronDown, ChevronUp, Search, RefreshCw, Layers,
  ExternalLink, TrendingUp, TrendingDown, Minus, Sliders, Play,
  Zap, Database, FileText, Info
} from 'lucide-react';

const api = (path, opts = {}) =>
  fetch(`${import.meta.env.VITE_API || 'http://localhost:5000'}/api${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    ...opts
  }).then(r => r.json());

const PROMPT_PRESETS = [
  { label: '📈 Spot Grid Playbook', query: 'Recommend optimal arithmetic grid spacing, upper/lower bounds, and stop loss for BTC/USDT spot grid bot.', market: 'CRYPTO' },
  { label: '🛡️ SEBI Peak Margin', query: 'What are the SEBI upfront margin rules and peak margin penalties for intraday equity trading?', market: 'INDIA' },
  { label: '🔄 DCA Martingale Sizing', query: 'What is the optimal safety order volume multiplier and price deviation scale for Martingale dip buying?', market: 'CRYPTO' },
  { label: '🪐 Jupiter DEX MEV & Routing', query: 'Explain Jupiter DEX multi-hop split routing, dynamic slippage, and Jito MEV protection tips on Solana.', market: 'DEX' },
  { label: '⚡ Cross-Exchange Arbitrage', query: 'What is the minimum spread hurdle and fee model for spatial arbitrage between Binance and Kraken?', market: 'CRYPTO' },
  { label: '🔍 Angel One Token Error', query: 'How do I resolve Angel One SmartAPI error AB1004 session token expired?', market: 'INDIA' }
];

export default function RagTerminal() {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('CRYPTO');
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showCitations, setShowCitations] = useState(true);

  // Guardrail test state
  const [guardSymbol, setGuardSymbol] = useState('BTC/USDT');
  const [guardExchange, setGuardExchange] = useState('BINANCE');
  const [guardStrategy, setGuardStrategy] = useState('GRID');
  const [guardLoading, setGuardLoading] = useState(false);
  const [guardResult, setGuardResult] = useState(null);

  const handleQuery = async (searchQuery = query, targetMarket = market) => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api('/rag/query', {
        method: 'POST',
        body: JSON.stringify({
          query: searchQuery,
          market: targetMarket,
          symbol,
          top_k: topK
        })
      });
      if (res.success && res.data) {
        setResult(res.data);
      } else if (res.analysis) {
        setResult(res);
      } else {
        setError(res.message || 'Failed to retrieve RAG intelligence.');
      }
    } catch (err) {
      console.error('RAG query error:', err);
      setError('Network error connecting to RAG backend.');
    }
    setLoading(false);
  };

  const handleGuardrailCheck = async () => {
    setGuardLoading(true);
    try {
      const res = await api('/rag/guardrail-check', {
        method: 'POST',
        body: JSON.stringify({
          symbol: guardSymbol,
          exchange: guardExchange,
          strategy_type: guardStrategy,
          market: guardExchange === 'ANGEL_ONE' || guardExchange === 'UPSTOX' ? 'INDIA' : guardExchange === 'JUPITER' ? 'DEX' : 'CRYPTO'
        })
      });
      if (res.success && res.data) {
        setGuardResult(res.data);
      } else {
        setGuardResult(res);
      }
    } catch (err) {
      console.error('Guardrail error:', err);
    }
    setGuardLoading(false);
  };

  const copyParameters = (params) => {
    if (!params) return;
    navigator.clipboard.writeText(JSON.stringify(params, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSentimentInfo = (score) => {
    if (score >= 0.3) return { label: 'Bullish Bias', color: '#10b981', icon: TrendingUp };
    if (score <= -0.3) return { label: 'Bearish Bias', color: '#ef4444', icon: TrendingDown };
    return { label: 'Neutral / Ranging', color: '#f59e0b', icon: Minus };
  };

  return (
    <div className="rag-terminal-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Top Header / Search Box */}
      <div className="ai-controls-card" style={{ background: 'linear-gradient(135deg, rgba(20, 25, 40, 0.95), rgba(15, 20, 30, 0.98))', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' }}>
              <Brain size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                RAG Multi-Asset Intelligence Terminal
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
                  Dense + Sparse BM25 + Gemini
                </span>
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                Hybrid vector search across 8 Knowledge Base collections, real-time market feeds & SEBI/SEC RMS rules
              </p>
            </div>
          </div>

          {/* Market Selector */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
            {['CRYPTO', 'INDIA', 'US', 'DEX'].map(m => (
              <button
                key={m}
                onClick={() => setMarket(m)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: market === m ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent',
                  color: market === m ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.2s'
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Ask about strategy playbooks, RMS rules, broker diagnostics, indicator logic, or tokenomics..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              style={{
                width: '100%',
                padding: '14px 16px 14px 44px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '12px',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
              }}
            />
          </div>
          <button
            onClick={() => handleQuery()}
            disabled={loading || !query.trim()}
            style={{
              padding: '0 24px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.95rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              opacity: loading || !query.trim() ? 0.7 : 1
            }}
          >
            {loading ? <RefreshCw size={18} className="spin" /> : <Sparkles size={18} />}
            {loading ? 'Synthesizing...' : 'Query RAG'}
          </button>
        </div>

        {/* Prompt Presets */}
        <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>QUICK PRESETS:</span>
          {PROMPT_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(p.query);
                setMarket(p.market);
                handleQuery(p.query, p.market);
              }}
              style={{
                padding: '4px 10px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Analysis Display */}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Actionable Setup Card */}
          <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={20} color="#818cf8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 600 }}>Actionable Setup</h3>
              </div>
              {result.actionable_setup?.direction && (
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  background: result.actionable_setup.direction === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : result.actionable_setup.direction === 'SELL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: result.actionable_setup.direction === 'BUY' ? '#10b981' : result.actionable_setup.direction === 'SELL' ? '#ef4444' : '#f59e0b',
                  border: `1px solid ${result.actionable_setup.direction === 'BUY' ? '#10b981' : result.actionable_setup.direction === 'SELL' ? '#ef4444' : '#f59e0b'}`
                }}>
                  {result.actionable_setup.direction}
                </span>
              )}
            </div>

            {/* Sentiment Gauge */}
            {result.sentiment_score !== undefined && (
              <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  <span>Market Sentiment Bias</span>
                  <span style={{ fontWeight: 700, color: getSentimentInfo(result.sentiment_score).color }}>
                    {result.sentiment_score > 0 ? `+${result.sentiment_score}` : result.sentiment_score} ({getSentimentInfo(result.sentiment_score).label})
                  </span>
                </div>
                <div style={{ height: '8px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${((result.sentiment_score + 1.0) / 2.0) * 100}%`,
                    width: '12px',
                    marginLeft: '-6px',
                    background: getSentimentInfo(result.sentiment_score).color,
                    borderRadius: '50%',
                    boxShadow: `0 0 8px ${getSentimentInfo(result.sentiment_score).color}`
                  }} />
                </div>
              </div>
            )}

            {/* Strategy & Parameters */}
            {result.actionable_setup && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8' }}>Recommended Strategy:</span>
                  <span style={{ fontWeight: 600, color: '#38bdf8' }}>{result.actionable_setup.recommended_strategy || 'GRID'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8' }}>Execution Confidence:</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>{Math.round((result.actionable_setup.confidence || 0.8) * 100)}%</span>
                </div>

                {/* Parameters JSON */}
                {result.actionable_setup.suggested_parameters && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SUGGESTED PARAMETERS:</span>
                      <button
                        onClick={() => copyParameters(result.actionable_setup.suggested_parameters)}
                        style={{ background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre style={{ margin: 0, padding: '12px', background: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', fontSize: '0.75rem', color: '#cbd5e1', overflowX: 'auto', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                      {JSON.stringify(result.actionable_setup.suggested_parameters, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detailed Markdown Reasoning Card */}
          <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#818cf8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 600 }}>RAG Quantitative Analysis</h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{result.model_used || 'Gemini 1.5'}</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {result.analysis}
            </div>
          </div>
        </div>
      )}

      {/* Expandable Citations Drawer */}
      {result && result.citations && result.citations.length > 0 && (
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '14px', overflow: 'hidden' }}>
          <button
            onClick={() => setShowCitations(!showCitations)}
            style={{ width: '100%', padding: '14px 20px', background: 'rgba(30, 41, 59, 0.4)', border: 'none', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
              <Layers size={16} color="#818cf8" />
              <span>Referenced Knowledge Base Citations ({result.citations.length})</span>
            </div>
            {showCitations ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {showCitations && (
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {result.citations.map((c, i) => (
                <div key={c.id || i} style={{ padding: '12px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>{c.collection}</span>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
                      {Math.round((c.relevance_score || 0.85) * 100)}% match
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>{c.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pre-Trade Guardrail Check Tester Card */}
      <div style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(20, 30, 50, 0.95))', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '16px', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={22} color="#38bdf8" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 600 }}>Pre-Trade RAG Guardrail Validator</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Validates breaking market news (2h), macro calendar (1h), and SEBI/SEC circuit breakers</p>
            </div>
          </div>
          <button
            onClick={handleGuardrailCheck}
            disabled={guardLoading}
            style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {guardLoading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
            {guardLoading ? 'Validating...' : 'Run Guardrail Check'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
          <input
            type="text"
            placeholder="Symbol e.g. BTC/USDT"
            value={guardSymbol}
            onChange={(e) => setGuardSymbol(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
          />
          <select
            value={guardExchange}
            onChange={(e) => setGuardExchange(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
          >
            <option value="BINANCE">Binance</option>
            <option value="ANGEL_ONE">Angel One</option>
            <option value="UPSTOX">Upstox</option>
            <option value="JUPITER">Jupiter DEX</option>
            <option value="ALPACA">Alpaca</option>
            <option value="KRAKEN">Kraken</option>
          </select>
          <select
            value={guardStrategy}
            onChange={(e) => setGuardStrategy(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}
          >
            <option value="GRID">Spot Grid</option>
            <option value="INFINITY_GRID">Infinity Grid</option>
            <option value="DCA">DCA Bot</option>
            <option value="MARTINGALE">Martingale</option>
            <option value="ARBITRAGE">Arbitrage</option>
          </select>
        </div>

        {guardResult && (
          <div style={{
            padding: '14px 18px',
            borderRadius: '10px',
            background: guardResult.safe_to_trade ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${guardResult.safe_to_trade ? '#10b981' : '#ef4444'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {guardResult.safe_to_trade ? <CheckCircle size={20} color="#10b981" /> : <AlertTriangle size={20} color="#ef4444" />}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: guardResult.safe_to_trade ? '#10b981' : '#ef4444' }}>
                  {guardResult.safe_to_trade ? 'SAFE TO TRADE' : 'RISK CIRCUIT BREAKER TRIGGERED'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                  {guardResult.warning_reason || 'No volatile macro anomalies or exchange outages detected in the last 2 hours.'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, padding: '4px 12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)', color: '#38bdf8' }}>
              Action: {guardResult.suggested_action || 'PROCEED'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
