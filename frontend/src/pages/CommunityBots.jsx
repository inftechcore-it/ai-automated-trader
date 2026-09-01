import { useState, useEffect } from 'react';
import {
  Users, Star, Copy, TrendingUp, Grid3X3, Repeat, Target,
  ArrowUpDown, BarChart3, Scale, Shuffle, Search, Filter,
  ChevronRight, Award, Download, Clock, User, MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const api = (path, opts = {}) =>
  fetch(`${import.meta.env.VITE_API || 'http://localhost:5000'}/api${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    ...opts
  }).then(r => r.json());

const STRATEGY_ICONS = {
  GRID: Grid3X3,
  INFINITY_GRID: Grid3X3,
  DCA: Repeat,
  SMART_TRADE: Target,
  TRAILING: ArrowUpDown,
  MARTINGALE: BarChart3,
  REBALANCING: Scale,
  ARBITRAGE: Shuffle,
};

const STRATEGY_COLORS = {
  GRID: '#3b82f6',
  INFINITY_GRID: '#8b5cf6',
  DCA: '#10b981',
  SMART_TRADE: '#f59e0b',
  TRAILING: '#ec4899',
  MARTINGALE: '#ef4444',
  REBALANCING: '#06b6d4',
  ARBITRAGE: '#6366f1',
};

function StarRating({ rating, count }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        size={14}
        fill={i <= Math.round(rating) ? '#f59e0b' : 'transparent'}
        stroke={i <= Math.round(rating) ? '#f59e0b' : '#4a5568'}
      />
    );
  }
  return (
    <div className="star-rating">
      {stars}
      <span className="rating-count">({count})</span>
    </div>
  );
}

function CommunityBotCard({ bot, onCopy, onView }) {
  const Icon = STRATEGY_ICONS[bot.strategyType] || Grid3X3;
  const profit = Number(bot.totalProfit || 0);
  const isPositive = profit >= 0;

  return (
    <div className="community-bot-card">
      <div className="community-bot-header">
        <div className="bot-icon-wrap" style={{ background: `${STRATEGY_COLORS[bot.strategyType]}20` }}>
          <Icon size={20} style={{ color: STRATEGY_COLORS[bot.strategyType] }} />
        </div>
        <div className="bot-info">
          <h3>{bot.name}</h3>
          <div className="bot-meta">
            <span className="author">
              <User size={12} />
              {bot.authorName}
            </span>
            <span className="symbol">{bot.symbol}</span>
          </div>
        </div>
        <div className="bot-badges">
          <span className="strategy-badge" style={{ color: STRATEGY_COLORS[bot.strategyType] }}>
            {bot.strategyType.replace('_', ' ')}
          </span>
        </div>
      </div>

      {bot.description && (
        <p className="bot-description">{bot.description}</p>
      )}

      <div className="bot-stats">
        <div className="stat">
          <TrendingUp size={14} className={isPositive ? 'positive' : 'negative'} />
          <span className={isPositive ? 'positive' : 'negative'}>
            {isPositive ? '+' : ''}{profit.toFixed(2)}%
          </span>
          <label>Profit</label>
        </div>
        <div className="stat">
          <Award size={14} />
          <span>{(Number(bot.winRate) || 0).toFixed(0)}%</span>
          <label>Win Rate</label>
        </div>
        <div className="stat">
          <Copy size={14} />
          <span>{bot.copyCount || 0}</span>
          <label>Copies</label>
        </div>
      </div>

      <div className="bot-rating-row">
        <StarRating rating={Number(bot.rating) || 0} count={bot.ratingCount || 0} />
      </div>

      {bot.tags && bot.tags.length > 0 && (
        <div className="bot-tags">
          {bot.tags.slice(0, 4).map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}

      <div className="bot-actions">
        <button className="view-btn" onClick={() => onView(bot)}>
          <ChevronRight size={16} />
          View Details
        </button>
        <button className="copy-btn" onClick={() => onCopy(bot)}>
          <Download size={16} />
          Copy Bot
        </button>
      </div>
    </div>
  );
}

function CopyBotModal({ bot, onClose, onConfirm }) {
  const [exchangeName, setExchangeName] = useState('Demo');
  const [mode, setMode] = useState('PAPER');
  const [investedAmount, setInvestedAmount] = useState(100);
  const [exchanges, setExchanges] = useState([]);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    api('/bots/exchanges').then(res => {
      if (res.success && res.exchanges) {
        setExchanges([{ name: 'Demo', label: 'Demo Exchange' }, ...res.exchanges]);
      }
    });
  }, []);

  const handleCopy = async () => {
    setCopying(true);
    try {
      const res = await api(`/bots/copy/${bot.id}`, {
        method: 'POST',
        body: JSON.stringify({ exchangeName, mode, investedAmount }),
      });
      if (res.success) {
        onConfirm(res.bot);
      } else {
        alert(res.message || 'Failed to copy bot');
      }
    } catch (e) {
      alert('Error copying bot');
    }
    setCopying(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal copy-bot-modal" onClick={e => e.stopPropagation()}>
        <h2>Copy Bot Configuration</h2>
        <p className="modal-subtitle">
          You're copying <strong>{bot.name}</strong> by {bot.authorName}
        </p>

        <div className="form-group">
          <label>Exchange</label>
          <select value={exchangeName} onChange={e => setExchangeName(e.target.value)}>
            {exchanges.map(ex => (
              <option key={ex.name} value={ex.name}>{ex.label || ex.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Trading Mode</label>
          <div className="mode-selector">
            <button
              className={mode === 'PAPER' ? 'active' : ''}
              onClick={() => setMode('PAPER')}
            >
              Paper Trading
            </button>
            <button
              className={mode === 'LIVE' ? 'active' : ''}
              onClick={() => setMode('LIVE')}
            >
              Live Trading
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Investment Amount ($)</label>
          <input
            type="number"
            value={investedAmount}
            onChange={e => setInvestedAmount(Number(e.target.value))}
            min={10}
          />
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="confirm-btn" onClick={handleCopy} disabled={copying}>
            {copying ? 'Copying...' : 'Copy & Create Bot'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BotDetailModal({ bot, onClose, onCopy }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRate = async () => {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      await api(`/bots/community/${bot.id}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      });
      alert('Rating submitted!');
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const params = typeof bot.params === 'string' ? JSON.parse(bot.params) : bot.params;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bot-detail-modal" onClick={e => e.stopPropagation()}>
        <h2>{bot.name}</h2>
        <p className="author-line">
          <User size={14} /> by {bot.authorName}
        </p>

        {bot.description && <p className="description">{bot.description}</p>}

        <div className="detail-section">
          <h4>Strategy</h4>
          <p>{bot.strategyType.replace('_', ' ')} on {bot.symbol}</p>
        </div>

        <div className="detail-section">
          <h4>Parameters</h4>
          <div className="params-grid">
            {Object.entries(params).map(([key, value]) => (
              <div key={key} className="param-item">
                <span className="param-label">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="param-value">{typeof value === 'number' ? value.toLocaleString() : String(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h4>Performance</h4>
          <div className="perf-grid">
            <div className="perf-item">
              <label>Total Profit</label>
              <span className={Number(bot.totalProfit) >= 0 ? 'positive' : 'negative'}>
                {Number(bot.totalProfit) >= 0 ? '+' : ''}{Number(bot.totalProfit).toFixed(2)}%
              </span>
            </div>
            <div className="perf-item">
              <label>Win Rate</label>
              <span>{Number(bot.winRate).toFixed(0)}%</span>
            </div>
            <div className="perf-item">
              <label>Copies</label>
              <span>{bot.copyCount}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Rate this Bot</h4>
          <div className="rating-input">
            {[1,2,3,4,5].map(i => (
              <Star
                key={i}
                size={24}
                fill={i <= rating ? '#f59e0b' : 'transparent'}
                stroke={i <= rating ? '#f59e0b' : '#4a5568'}
                onClick={() => setRating(i)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </div>
          <textarea
            placeholder="Optional comment..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <button onClick={handleRate} disabled={rating < 1 || submitting}>
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Close</button>
          <button className="confirm-btn" onClick={() => onCopy(bot)}>
            <Download size={16} /> Copy this Bot
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommunityBots() {
  const navigate = useNavigate();
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [copyModal, setCopyModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);

  const loadBots = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: sortBy });
      if (strategyFilter) params.append('strategy', strategyFilter);
      if (search) params.append('symbol', search);

      const res = await api(`/bots/community?${params}`);
      if (res.success) {
        setBots(res.bots || []);
      }
    } catch (e) {
      console.error('Failed to load community bots:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBots();
  }, [sortBy, strategyFilter]);

  const handleCopyComplete = (newBot) => {
    setCopyModal(null);
    setDetailModal(null);
    navigate('/bots');
  };

  return (
    <div className="community-bots-page">
      <div className="page-header">
        <div className="header-left">
          <Users size={24} />
          <div>
            <h1>Community Bots</h1>
            <p>Discover and copy trading bots shared by the community</p>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by symbol..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadBots()}
          />
        </div>

        <select value={strategyFilter} onChange={e => setStrategyFilter(e.target.value)}>
          <option value="">All Strategies</option>
          <option value="GRID">Grid</option>
          <option value="DCA">DCA</option>
          <option value="SMART_TRADE">Smart Trade</option>
          <option value="INFINITY_GRID">Infinity Grid</option>
          <option value="TRAILING">Trailing</option>
          <option value="MARTINGALE">Martingale</option>
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="popular">Most Copied</option>
          <option value="rating">Highest Rated</option>
          <option value="profit">Most Profitable</option>
          <option value="new">Newest</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading community bots...</p>
        </div>
      ) : bots.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>No community bots yet</h3>
          <p>Be the first to share your trading bot with the community!</p>
        </div>
      ) : (
        <div className="bots-grid">
          {bots.map(bot => (
            <CommunityBotCard
              key={bot.id}
              bot={bot}
              onCopy={() => setCopyModal(bot)}
              onView={() => setDetailModal(bot)}
            />
          ))}
        </div>
      )}

      {copyModal && (
        <CopyBotModal
          bot={copyModal}
          onClose={() => setCopyModal(null)}
          onConfirm={handleCopyComplete}
        />
      )}

      {detailModal && (
        <BotDetailModal
          bot={detailModal}
          onClose={() => setDetailModal(null)}
          onCopy={() => {
            setDetailModal(null);
            setCopyModal(detailModal);
          }}
        />
      )}
    </div>
  );
}
