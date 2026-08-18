import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Bot, Plus, TrendingUp, TrendingDown, DollarSign, Activity,
  Play, Pause, Square, Eye, Grid3X3, Repeat, Target, ArrowUpDown,
  BarChart3, Shuffle, Scale, RefreshCw, Search, Filter, Clock,
  Zap, FlaskConical, Wallet, ChevronRight, Sparkles, X, Share2, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import BotCreationWizard from '../components/bots/BotCreationWizard.jsx';

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

const formatDuration = (startedAt) => {
  if (!startedAt) return '-';
  const ms = Date.now() - new Date(startedAt).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

function BotCard({ bot, onAction, onClick, onShare }) {
  const Icon = STRATEGY_ICONS[bot.strategyType] || Bot;
  const profit = Number(bot.totalProfit || 0);
  const profitPercent = bot.investedAmount > 0
    ? (profit / Number(bot.investedAmount)) * 100
    : 0;
  const isPositive = profit >= 0;

  const sparklineData = (bot.snapshots || []).slice(-24).map((s, i) => ({
    value: Number(s.equity || 0)
  }));

  return (
    <div
      className="bot-card"
      onClick={onClick}
    >
      <div className="bot-card-header">
        <div className="bot-name-row">
          <div
            className="bot-icon"
            style={{ background: `${STRATEGY_COLORS[bot.strategyType]}20`, color: STRATEGY_COLORS[bot.strategyType] }}
          >
            <Icon size={18} />
          </div>
          <div className="bot-name-info">
            <h3>{bot.name}</h3>
            <span className="bot-symbol">{bot.exchangeName} · {bot.symbol}</span>
          </div>
        </div>
        <div className="bot-badges">
          <span
            className="strategy-badge"
            style={{ background: `${STRATEGY_COLORS[bot.strategyType]}15`, color: STRATEGY_COLORS[bot.strategyType] }}
          >
            {bot.strategyType.replace('_', ' ')}
          </span>
          <span className={`mode-badge ${bot.mode?.toLowerCase()}`}>
            {bot.mode === 'PAPER' ? <FlaskConical size={10} /> : <Wallet size={10} />}
            {bot.mode}
          </span>
        </div>
      </div>

      <div className="bot-status-row">
        <span className={`status-indicator ${bot.status?.toLowerCase()}`}>
          <span className="status-dot" />
          {bot.status}
        </span>
        <span className="bot-runtime">
          <Clock size={12} />
          {formatDuration(bot.startedAt)}
        </span>
      </div>

      <div className="bot-metrics">
        <div className="metric">
          <span className="metric-label">Invested</span>
          <span className="metric-value">${Number(bot.investedAmount || 0).toFixed(2)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Current</span>
          <span className="metric-value">${Number(bot.currentValue || 0).toFixed(2)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Profit</span>
          <span className={`metric-value ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '+' : ''}{profit.toFixed(2)}
            <small> ({profitPercent.toFixed(2)}%)</small>
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Trades</span>
          <span className="metric-value">{bot.totalTrades || 0}</span>
        </div>
      </div>

      {sparklineData.length > 2 && (
        <div className="bot-sparkline">
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bot-actions" onClick={e => e.stopPropagation()}>
        {bot.status === 'RUNNING' && (
          <button className="action-btn pause" onClick={() => onAction(bot.id, 'pause')}>
            <Pause size={14} /> Pause
          </button>
        )}
        {bot.status === 'PAUSED' && (
          <button className="action-btn resume" onClick={() => onAction(bot.id, 'resume')}>
            <Play size={14} /> Resume
          </button>
        )}
        {(bot.status === 'RUNNING' || bot.status === 'PAUSED') && (
          <button className="action-btn stop" onClick={() => onAction(bot.id, 'stop')}>
            <Square size={14} /> Stop
          </button>
        )}
        {(bot.status === 'CREATED' || bot.status === 'STOPPED') && (
          <button className="action-btn start" onClick={() => onAction(bot.id, 'start')}>
            <Play size={14} /> {bot.status === 'STOPPED' ? 'Restart' : 'Start'}
          </button>
        )}
        <button className="action-btn view" onClick={onClick}>
          <Eye size={14} /> View
        </button>
        <button className="action-btn share" onClick={() => onShare(bot)}>
          <Share2 size={14} /> Share
        </button>
      </div>
    </div>
  );
}

function ShareBotModal({ bot, onClose, onSuccess }) {
  const [name, setName] = useState(bot.name);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await api(`/bots/${bot.id}/share`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        }),
      });
      if (res.success) {
        onSuccess();
      } else {
        alert(res.message || 'Failed to share bot');
      }
    } catch (e) {
      alert('Error sharing bot');
    }
    setSharing(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-bot-modal" onClick={e => e.stopPropagation()}>
        <h2>Share to Community</h2>
        <p className="modal-subtitle">Share your bot configuration with other traders</p>

        <div className="form-group">
          <label>Bot Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            placeholder="Describe your strategy and what makes it effective..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Tags (comma separated)</label>
          <input
            type="text"
            placeholder="e.g. scalping, low-risk, btc"
            value={tags}
            onChange={e => setTags(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="confirm-btn" onClick={handleShare} disabled={sharing || !name}>
            {sharing ? 'Sharing...' : 'Share Bot'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Bots() {
  const navigate = useNavigate();
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [engineStats, setEngineStats] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedBot, setSelectedBot] = useState(null);
  const [shareModal, setShareModal] = useState(null);
  const [filter, setFilter] = useState({ strategy: '', exchange: '', mode: '', status: '' });
  const [sortBy, setSortBy] = useState('profit');
  const [searchQuery, setSearchQuery] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    loadBots();
    loadEngineStats();

    // Socket connection for real-time updates
    const socket = io(import.meta.env.VITE_API || 'http://localhost:5000');
    socketRef.current = socket;

    socket.on('bot:status', (data) => {
      setBots(prev => prev.map(b =>
        b.id === data.botId ? { ...b, status: data.status, currentValue: data.currentValue, totalProfit: data.totalProfit } : b
      ));
    });

    socket.on('bot:trade', (data) => {
      setBots(prev => prev.map(b =>
        b.id === data.botId ? { ...b, totalTrades: (b.totalTrades || 0) + 1 } : b
      ));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const loadBots = async () => {
    try {
      const res = await api('/bots');
      if (res.success) {
        setBots(res.bots || []);
      }
    } catch (e) {
      console.error('Failed to load bots:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadEngineStats = async () => {
    try {
      const res = await api('/bots/engine/stats');
      if (res.success) {
        setEngineStats(res.stats);
      }
    } catch (e) {
      console.error('Failed to load engine stats:', e);
    }
  };

  const handleBotAction = async (botId, action) => {
    try {
      const res = await api(`/bots/${botId}/${action}`, { method: 'POST' });
      if (res.success) {
        loadBots();
      }
    } catch (e) {
      console.error(`Failed to ${action} bot:`, e);
    }
  };

  const handleBotCreated = () => {
    setShowWizard(false);
    loadBots();
  };

  // Filter and sort bots
  const filteredBots = bots
    .filter(b => {
      if (filter.strategy && b.strategyType !== filter.strategy) return false;
      if (filter.exchange && b.exchangeName !== filter.exchange) return false;
      if (filter.mode && b.mode !== filter.mode) return false;
      if (filter.status && b.status !== filter.status) return false;
      if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'profit': return Number(b.totalProfit || 0) - Number(a.totalProfit || 0);
        case 'runtime': return new Date(b.startedAt || 0) - new Date(a.startedAt || 0);
        case 'trades': return (b.totalTrades || 0) - (a.totalTrades || 0);
        default: return 0;
      }
    });

  // Calculate totals
  const totalInvested = bots.reduce((sum, b) => sum + Number(b.investedAmount || 0), 0);
  const totalProfit = bots.reduce((sum, b) => sum + Number(b.totalProfit || 0), 0);
  const activeBots = bots.filter(b => b.status === 'RUNNING').length;
  const bestBot = bots.reduce((best, b) =>
    Number(b.totalProfit || 0) > Number(best?.totalProfit || 0) ? b : best
  , null);

  const uniqueExchanges = [...new Set(bots.map(b => b.exchangeName))];
  const strategies = ['GRID', 'INFINITY_GRID', 'DCA', 'SMART_TRADE', 'TRAILING', 'MARTINGALE', 'REBALANCING', 'ARBITRAGE'];

  return (
    <div className="bots-page">
      <div className="bots-header">
        <div className="header-left">
          <h1><Bot size={28} /> Trading Bots</h1>
          <p>Automated trading strategies running 24/7</p>
        </div>
        <div className="header-actions">
          <button className="community-btn" onClick={() => navigate('/community-bots')}>
            <Users size={18} />
            Community Bots
          </button>
          <button className="create-bot-btn" onClick={() => setShowWizard(true)}>
            <Plus size={18} />
            Create Bot
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bots-stats-bar">
        <div className="stat-card">
          <div className="stat-icon active">
            <Activity size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{activeBots}</span>
            <span className="stat-label">Active Bots</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon invested">
            <DollarSign size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">${totalInvested.toFixed(2)}</span>
            <span className="stat-label">Total Invested</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon profit">
            {totalProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div className="stat-info">
            <span className={`stat-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
              {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
            </span>
            <span className="stat-label">Total Profit</span>
          </div>
        </div>
        {bestBot && (
          <div className="stat-card best-bot">
            <div className="stat-icon sparkle">
              <Sparkles size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{bestBot.name}</span>
              <span className="stat-label">
                Best Performer (+${Number(bestBot.totalProfit || 0).toFixed(2)})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bots-filters">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search bots..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={14} />
          <select value={filter.strategy} onChange={e => setFilter(f => ({ ...f, strategy: e.target.value }))}>
            <option value="">All Strategies</option>
            {strategies.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select value={filter.exchange} onChange={e => setFilter(f => ({ ...f, exchange: e.target.value }))}>
            <option value="">All Exchanges</option>
            {uniqueExchanges.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filter.mode} onChange={e => setFilter(f => ({ ...f, mode: e.target.value }))}>
            <option value="">All Modes</option>
            <option value="PAPER">Paper</option>
            <option value="LIVE">Live</option>
          </select>
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Status</option>
            <option value="RUNNING">Running</option>
            <option value="PAUSED">Paused</option>
            <option value="STOPPED">Stopped</option>
            <option value="CREATED">Created</option>
          </select>
        </div>

        <div className="sort-group">
          <span>Sort by:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="profit">Profit</option>
            <option value="runtime">Runtime</option>
            <option value="trades">Trades</option>
          </select>
        </div>

        <button className="refresh-btn" onClick={loadBots}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Bots Grid */}
      <div className="bots-grid">
        {loading ? (
          <div className="loading-state">
            <RefreshCw size={32} className="spin" />
            <p>Loading bots...</p>
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="empty-state">
            <Bot size={48} />
            <h3>No bots found</h3>
            <p>{bots.length === 0 ? 'Create your first trading bot to get started' : 'Try adjusting your filters'}</p>
            {bots.length === 0 && (
              <button className="create-btn" onClick={() => setShowWizard(true)}>
                <Plus size={16} /> Create Bot
              </button>
            )}
          </div>
        ) : (
          filteredBots.map(bot => (
            <BotCard
              key={bot.id}
              bot={bot}
              onAction={handleBotAction}
              onClick={() => navigate(`/bots/${bot.id}`)}
              onShare={setShareModal}
            />
          ))
        )}
      </div>

      {/* Creation Wizard Modal */}
      {showWizard && (
        <BotCreationWizard
          onClose={() => setShowWizard(false)}
          onCreated={handleBotCreated}
        />
      )}

      {/* Share Bot Modal */}
      {shareModal && (
        <ShareBotModal
          bot={shareModal}
          onClose={() => setShareModal(null)}
          onSuccess={() => {
            setShareModal(null);
            alert('Bot shared to community!');
          }}
        />
      )}
    </div>
  );
}
