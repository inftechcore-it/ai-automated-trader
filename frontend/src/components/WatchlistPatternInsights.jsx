import React from 'react';
import {
  Activity, TrendingUp, TrendingDown, ShieldAlert, Target,
  Zap, BookOpen, Compass, ChevronRight, CheckCircle2, ArrowRight
} from 'lucide-react';
import Badge from './Badge.jsx';

export default function WatchlistPatternInsights({
  analysisData,
  loading,
  onSelectStock,
  onOpenEncyclopedia,
  selectedPatternFilter,
  onFilterChange
}) {
  const summary = analysisData?.summary || {
    total: 0,
    bullish: 0,
    bearish: 0,
    neutral: 0,
    sentimentScore: 0,
    topBullish: [],
    topBearish: [],
    activePatternsCount: 0
  };

  const isBullishSentiment = summary.sentimentScore >= 10;
  const isBearishSentiment = summary.sentimentScore <= -10;

  return (
    <div className="watchlist-pattern-insights-panel">
      {/* Top Banner: Market Sentiment Gauge & Pattern Summary */}
      <div className="insights-header-banner">
        <div className="sentiment-column">
          <div className="sentiment-title">
            <Activity size={18} className="text-primary" />
            <span>Live Watchlist Market Behavior</span>
          </div>
          <div className="sentiment-meter-wrap">
            <div className="sentiment-gauge-bar">
              <div
                className="gauge-fill bullish"
                style={{ width: `${summary.total > 0 ? (summary.bullish / summary.total) * 100 : 50}%` }}
                title={`Bullish: ${summary.bullish}`}
              />
              <div
                className="gauge-fill bearish"
                style={{ width: `${summary.total > 0 ? (summary.bearish / summary.total) * 100 : 50}%` }}
                title={`Bearish: ${summary.bearish}`}
              />
            </div>
            <div className="gauge-labels">
              <span className="gain">🟢 {summary.bullish} Bullish</span>
              <span className="sentiment-score-badge">
                {isBullishSentiment ? '⚡ Bullish Edge' : (isBearishSentiment ? '⚠️ Bearish Pressure' : '⚖️ Market Neutral')}
              </span>
              <span className="loss">🔴 {summary.bearish} Bearish</span>
            </div>
          </div>
        </div>

        <div className="insights-actions-column">
          <div className="quick-stats">
            <div className="stat-box">
              <span className="val">{summary.activePatternsCount || 0}</span>
              <span className="lbl">Active Patterns</span>
            </div>
            <div className="stat-box">
              <span className="val">{summary.total || 0}</span>
              <span className="lbl">Assets Tracked</span>
            </div>
          </div>
          <button className="btn-encyclopedia" onClick={onOpenEncyclopedia}>
            <BookOpen size={15} /> 38 Patterns Guide
          </button>
        </div>
      </div>

      {/* Pattern Quick Filters */}
      <div className="pattern-filter-bar">
        <span className="filter-title"><Compass size={14} /> Pattern Filters:</span>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${selectedPatternFilter === 'all' ? 'active' : ''}`}
            onClick={() => onFilterChange('all')}
          >
            All ({summary.total})
          </button>
          <button
            className={`filter-btn gain-filter ${selectedPatternFilter === 'bullish' ? 'active' : ''}`}
            onClick={() => onFilterChange('bullish')}
          >
            🟢 Bullish Signals ({summary.bullish})
          </button>
          <button
            className={`filter-btn loss-filter ${selectedPatternFilter === 'bearish' ? 'active' : ''}`}
            onClick={() => onFilterChange('bearish')}
          >
            🔴 Bearish Signals ({summary.bearish})
          </button>
          <button
            className={`filter-btn ${selectedPatternFilter === 'neutral' ? 'active' : ''}`}
            onClick={() => onFilterChange('neutral')}
          >
            🟡 Neutral / Doji ({summary.neutral})
          </button>
        </div>
      </div>

      {/* High-Probability Pattern Cards Preview */}
      {summary.topBullish?.length > 0 && selectedPatternFilter !== 'bearish' && (
        <div className="top-setups-section">
          <div className="section-title">
            <Zap size={15} className="text-warning" />
            <span>High-Probability Bullish Candlestick Setups</span>
          </div>
          <div className="setup-cards-row">
            {summary.topBullish.map(item => (
              <div
                key={`bull-${item.id}`}
                className="setup-card bullish"
                onClick={() => onSelectStock(item)}
              >
                <div className="setup-card-top">
                  <div className="symbol-info">
                    <span className="symbol">{item.symbol}</span>
                    <Badge small>{item.exchange_name}</Badge>
                  </div>
                  {item.latestPattern && (
                    <span className="pattern-badge bullish">
                      🎯 {item.latestPattern.name}
                    </span>
                  )}
                </div>
                <p className="setup-summary">{item.summary || item.latestPattern?.description || 'Bullish momentum indicated.'}</p>
                <div className="setup-targets">
                  <span className="target-pill">Target: <strong>${item.targetPrice}</strong></span>
                  <span className="sl-pill">Stop: <strong>${item.stopLoss}</strong></span>
                  <span className="rr-pill">R:R <strong>{item.riskReward}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.topBearish?.length > 0 && selectedPatternFilter !== 'bullish' && (
        <div className="top-setups-section">
          <div className="section-title loss">
            <ShieldAlert size={15} className="text-danger" />
            <span>Bearish Reversal / Distribution Warnings</span>
          </div>
          <div className="setup-cards-row">
            {summary.topBearish.map(item => (
              <div
                key={`bear-${item.id}`}
                className="setup-card bearish"
                onClick={() => onSelectStock(item)}
              >
                <div className="setup-card-top">
                  <div className="symbol-info">
                    <span className="symbol">{item.symbol}</span>
                    <Badge small>{item.exchange_name}</Badge>
                  </div>
                  {item.latestPattern && (
                    <span className="pattern-badge bearish">
                      ⚠️ {item.latestPattern.name}
                    </span>
                  )}
                </div>
                <p className="setup-summary">{item.summary || item.latestPattern?.description || 'Bearish distribution indicated.'}</p>
                <div className="setup-targets">
                  <span className="target-pill">Target: <strong>${item.targetPrice}</strong></span>
                  <span className="sl-pill">Stop: <strong>${item.stopLoss}</strong></span>
                  <span className="rr-pill">R:R <strong>{item.riskReward}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
