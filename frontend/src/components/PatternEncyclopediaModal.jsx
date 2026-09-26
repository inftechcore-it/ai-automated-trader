import React, { useState } from 'react';
import {
  X, Search, BookOpen, Star, TrendingUp, TrendingDown,
  Layers, ShieldAlert, CheckCircle2, Lightbulb, Compass, Filter
} from 'lucide-react';
import { CANDLESTICK_PATTERNS_DB } from '../utils/candlestickPatterns.js';

export default function PatternEncyclopediaModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPattern, setSelectedPattern] = useState(null);

  if (!isOpen) return null;

  const patternsList = Object.values(CANDLESTICK_PATTERNS_DB);

  const filteredPatterns = patternsList.filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.psychology.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'bullish') return p.sentiment === 'bullish';
    if (selectedCategory === 'bearish') return p.sentiment === 'bearish';
    if (selectedCategory === 'neutral') return p.sentiment === 'neutral';
    if (selectedCategory === 'single') return p.candlesCount === 1;
    if (selectedCategory === 'multi') return p.candlesCount > 1;
    return true;
  });

  return (
    <div className="pattern-modal-overlay" onClick={onClose}>
      <div className="pattern-modal-container" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="pattern-modal-header">
          <div className="header-left">
            <div className="icon-badge">
              <BookOpen size={22} className="text-primary" />
            </div>
            <div>
              <h3>Candlestick Patterns Encyclopedia</h3>
              <p className="subtitle">38 Master Candlestick Patterns for Pro Traders (Bullish, Bearish & Continuation)</p>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="pattern-modal-toolbar">
          <div className="search-bar">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search patterns (e.g. Engulfing, Hammer, Morning Star, Marubozu)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-btn" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="category-pills">
            {[
              { id: 'all', label: `All Patterns (${patternsList.length})` },
              { id: 'bullish', label: '🟢 Bullish Reversals (18)' },
              { id: 'bearish', label: '🔴 Bearish Reversals (18)' },
              { id: 'neutral', label: '🟡 Indecision (4)' },
              { id: 'single', label: '1-Candle' },
              { id: 'multi', label: 'Multi-Candle' }
            ].map(cat => (
              <button
                key={cat.id}
                className={`cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Content Grid */}
        <div className="pattern-modal-body">
          <div className="patterns-grid">
            {filteredPatterns.map(p => {
              const isBullish = p.sentiment === 'bullish';
              const isBearish = p.sentiment === 'bearish';

              return (
                <div
                  key={p.id}
                  className={`pattern-encyclopedia-card ${isBullish ? 'bullish-border' : (isBearish ? 'bearish-border' : 'neutral-border')}`}
                  onClick={() => setSelectedPattern(p)}
                >
                  <div className="card-top">
                    <span className={`badge-sentiment ${p.sentiment}`}>
                      {isBullish ? <TrendingUp size={12} /> : (isBearish ? <TrendingDown size={12} /> : <Compass size={12} />)}
                      {p.sentiment === 'bullish' ? 'Bullish' : (p.sentiment === 'bearish' ? 'Bearish' : 'Neutral')}
                    </span>
                    <span className="badge-candles">{p.candlesCount} Candle{p.candlesCount > 1 ? 's' : ''}</span>
                    <span className="badge-stars">{'★'.repeat(p.reliability)}</span>
                  </div>

                  <h4 className="pattern-title">{p.name}</h4>
                  <p className="pattern-summary">{p.description}</p>

                  <div className="pattern-rules-preview">
                    <div className="rule-item">
                      <Lightbulb size={13} className="text-warning" />
                      <span>{p.psychology.slice(0, 110)}...</span>
                    </div>
                  </div>

                  <div className="card-footer">
                    <span className="trend-req">Trend: <strong>{p.trendRequired}</strong></span>
                    <span className="view-link">View Full Trading Plan →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pattern Detail Drawer Modal */}
        {selectedPattern && (
          <div className="pattern-detail-overlay" onClick={() => setSelectedPattern(null)}>
            <div className="pattern-detail-drawer" onClick={e => e.stopPropagation()}>
              <div className="drawer-header">
                <div className="header-info">
                  <span className={`badge-sentiment large ${selectedPattern.sentiment}`}>
                    {selectedPattern.sentiment === 'bullish' ? '🟢 Bullish Reversal / Signal' : (selectedPattern.sentiment === 'bearish' ? '🔴 Bearish Reversal / Signal' : '🟡 Neutral Consolidation')}
                  </span>
                  <h2>{selectedPattern.name}</h2>
                </div>
                <button className="btn-close-drawer" onClick={() => setSelectedPattern(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="drawer-content">
                <div className="drawer-section">
                  <h4><BookOpen size={16} /> Pattern Formation & Identification</h4>
                  <p className="desc-text">{selectedPattern.description}</p>
                  <div className="metrics-box">
                    <div className="metric">
                      <span className="lbl">Candles Required:</span>
                      <span className="val">{selectedPattern.candlesCount}</span>
                    </div>
                    <div className="metric">
                      <span className="lbl">Prior Trend Needed:</span>
                      <span className="val capitalize">{selectedPattern.trendRequired}</span>
                    </div>
                    <div className="metric">
                      <span className="lbl">Reliability Rating:</span>
                      <span className="val stars">{'★'.repeat(selectedPattern.reliability)} ({selectedPattern.reliability}/5)</span>
                    </div>
                  </div>
                </div>

                <div className="drawer-section">
                  <h4><Lightbulb size={16} /> Market Psychology & Buyer/Seller Battle</h4>
                  <div className="psychology-box">
                    {selectedPattern.psychology}
                  </div>
                </div>

                <div className="drawer-section">
                  <h4><CheckCircle2 size={16} /> Step-by-Step Actionable Trading Plan</h4>
                  <div className="trading-plan-box">
                    {selectedPattern.howToTrade}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
