import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, TrendingUp, TrendingDown, Bot, Activity, DollarSign,
  Sparkles, Target, Clock, RefreshCw, PieChart, Search, Filter,
  Layers, X, ExternalLink, ShieldCheck, CheckCircle2, AlertTriangle,
  Receipt, Wallet, Coins, ArrowUpRight, ArrowDownRight, Percent,
  ChevronRight, ArrowUpDown, ChevronDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart as RechartsPie, Pie, Cell, Legend
} from 'recharts';

const api = (path, opts = {}) =>
  fetch(`${import.meta.env.VITE_API || 'http://localhost:5000'}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    ...opts
  }).then(r => r.json());

const STRATEGY_COLORS = {
  SUPER_ZEE: '#a855f7',
  JARVIS: '#06b6d4',
  PRECISION_GRID: '#0ea5e9',
  GRID: '#3b82f6',
  INFINITY_GRID: '#8b5cf6',
  DCA: '#10b981',
  SMART_TRADE: '#f59e0b',
  TRAILING: '#ec4899',
  MARTINGALE: '#ef4444',
  REBALANCING: '#14b8a6',
  ARBITRAGE: '#6366f1',
  DYNAMIC_GRID: '#06b6d4',
};

const EXCHANGE_BADGES = {
  binance: { name: 'Binance', color: '#f0b90b', bg: 'rgba(240, 185, 11, 0.12)' },
  bybit: { name: 'Bybit', color: '#f7a600', bg: 'rgba(247, 166, 0, 0.12)' },
  pionex: { name: 'Pionex', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  coindcx: { name: 'CoinDCX', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)' },
  kraken: { name: 'Kraken', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)' },
  jupiter: { name: 'Jupiter (Solana)', color: '#14f195', bg: 'rgba(20, 241, 149, 0.12)' },
  angelone: { name: 'Angel One', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
  upstox: { name: 'Upstox', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  alpaca: { name: 'Alpaca', color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)' },
  demo: { name: 'Demo / Paper', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' },
};

function formatCurrency(val, currency = '$') {
  const num = Number(val || 0);
  const prefix = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  return `${prefix}${currency}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BotAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [bots, setBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [botPerformance, setBotPerformance] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('overview');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExchange, setSelectedExchange] = useState('ALL');
  const [selectedStrategy, setSelectedStrategy] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('profit_desc');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Try advanced summary endpoint
      const res = await api('/bots/analytics/summary');
      if (res?.success && res?.summary) {
        setSummaryData(res.summary);
        setBots(res.bots || []);
      } else {
        // Fallback to basic bots endpoint
        const fallbackRes = await api('/bots');
        if (fallbackRes?.success) {
          const rawBots = fallbackRes.bots || [];
          setBots(rawBots.map(b => ({
            ...b,
            financials: {
              totalInvestmentWithoutFee: Number(b.investedAmount || 0),
              totalInvestmentWithFee: Number(b.investedAmount || 0),
              totalFeeDeducted: 0,
              totalGrossProfit: Math.max(0, Number(b.totalProfit || 0)),
              totalGrossLoss: Math.abs(Math.min(0, Number(b.totalProfit || 0))),
              netRealizedProfit: Number(b.totalProfit || 0),
              totalUnrealizedPnl: Number(b.unrealizedPnl || 0),
              currentValue: Number(b.currentValue || b.investedAmount || 0),
              holdings: b.holdings || [],
              currencySymbol: '$',
              winRate: 0,
              profitFactor: 1,
              totalTrades: b.totalTrades || 0,
            }
          })));
        }
      }
    } catch (e) {
      console.error('Failed to load bot analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  // Open modal and load deep drilldown performance
  const handleOpenBotDetail = async (bot) => {
    setSelectedBotId(bot.id);
    setPerfLoading(true);
    setActiveModalTab('overview');
    try {
      const res = await api(`/bots/${bot.id}/performance`);
      if (res?.success) {
        setBotPerformance(res);
      } else {
        // Fallback using enriched bot from list
        setBotPerformance({
          bot,
          financials: bot.financials,
          holdings: bot.financials?.holdings || [],
          feeBreakdown: bot.financials?.feeBreakdown || {
            totalFee: bot.financials?.totalFeeDeducted || 0,
            feeRate: 0.1,
            feeAsset: 'USDT',
            feeType: 'Standard'
          },
          recentOrders: [],
          snapshots: [],
        });
      }
    } catch (err) {
      console.error(`Error loading performance for bot ${bot.id}:`, err);
    } finally {
      setPerfLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedBotId(null);
    setBotPerformance(null);
  };

  // Filtered & Sorted Bots
  const filteredBots = useMemo(() => {
    return bots.filter(b => {
      const matchesSearch = searchQuery === '' ||
        b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.exchangeName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesExchange = selectedExchange === 'ALL' ||
        b.exchangeName?.toLowerCase() === selectedExchange.toLowerCase();

      const matchesStrategy = selectedStrategy === 'ALL' ||
        b.strategyType === selectedStrategy;

      const matchesStatus = selectedStatus === 'ALL' ||
        b.status === selectedStatus;

      return matchesSearch && matchesExchange && matchesStrategy && matchesStatus;
    }).sort((a, b) => {
      const aProfit = a.financials?.netRealizedProfit ?? Number(a.totalProfit || 0);
      const bProfit = b.financials?.netRealizedProfit ?? Number(b.totalProfit || 0);
      const aInvested = a.financials?.totalInvestmentWithoutFee ?? Number(a.investedAmount || 0);
      const bInvested = b.financials?.totalInvestmentWithoutFee ?? Number(b.investedAmount || 0);
      const aRoi = aInvested > 0 ? (aProfit / aInvested) * 100 : 0;
      const bRoi = bInvested > 0 ? (bProfit / bInvested) * 100 : 0;

      if (sortBy === 'profit_desc') return bProfit - aProfit;
      if (sortBy === 'profit_asc') return aProfit - bProfit;
      if (sortBy === 'roi_desc') return bRoi - aRoi;
      if (sortBy === 'invested_desc') return bInvested - aInvested;
      if (sortBy === 'trades_desc') return (b.financials?.totalTrades || 0) - (a.financials?.totalTrades || 0);
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
  }, [bots, searchQuery, selectedExchange, selectedStrategy, selectedStatus, sortBy]);

  // Aggregated totals
  const totalBots = bots.length;
  const activeBots = bots.filter(b => b.status === 'RUNNING').length;
  const pausedBots = bots.filter(b => b.status === 'PAUSED').length;
  const stoppedBots = bots.filter(b => b.status === 'STOPPED' || b.status === 'CREATED').length;

  const totalInvestedWithoutFee = summaryData?.totalInvestedWithoutFee ??
    bots.reduce((sum, b) => sum + (b.financials?.totalInvestmentWithoutFee ?? Number(b.investedAmount || 0)), 0);

  const totalInvestedWithFee = summaryData?.totalInvestedWithFee ??
    bots.reduce((sum, b) => sum + (b.financials?.totalInvestmentWithFee ?? Number(b.investedAmount || 0)), 0);

  const totalFeesDeducted = summaryData?.totalFeesDeducted ??
    bots.reduce((sum, b) => sum + (b.financials?.totalFeeDeducted || 0), 0);

  const totalGrossProfit = summaryData?.totalGrossProfit ??
    bots.reduce((sum, b) => sum + (b.financials?.totalGrossProfit || Math.max(0, Number(b.totalProfit || 0))), 0);

  const totalGrossLoss = summaryData?.totalGrossLoss ??
    bots.reduce((sum, b) => sum + (b.financials?.totalGrossLoss || Math.abs(Math.min(0, Number(b.totalProfit || 0)))), 0);

  const netRealizedProfit = summaryData?.netRealizedProfit ??
    (totalGrossProfit - totalGrossLoss - totalFeesDeducted);

  const totalUnrealizedPnl = summaryData?.totalUnrealizedPnl ??
    bots.reduce((sum, b) => sum + (b.financials?.totalUnrealizedPnl || 0), 0);

  const totalCurrentValue = summaryData?.totalCurrentValue ??
    bots.reduce((sum, b) => sum + (b.financials?.currentValue || Number(b.investedAmount || 0)), 0);

  const totalTrades = summaryData?.totalTrades ??
    bots.reduce((sum, b) => sum + (b.financials?.totalTrades || b.totalTrades || 0), 0);

  const overallWinRate = summaryData?.overallWinRate ??
    (bots.length > 0 ? (bots.reduce((s, b) => s + (b.financials?.winRate || 0), 0) / bots.length) : 0);

  const overallProfitFactor = summaryData?.overallProfitFactor ??
    (totalGrossLoss > 0 ? (totalGrossProfit / totalGrossLoss) : (totalGrossProfit > 0 ? 99.9 : 1.0));

  // Strategy Chart Data
  const strategyData = useMemo(() => {
    const stats = {};
    bots.forEach(b => {
      const type = b.strategyType || 'UNKNOWN';
      if (!stats[type]) {
        stats[type] = {
          name: type.replace(/_/g, ' '),
          profit: 0,
          fees: 0,
          invested: 0,
          bots: 0,
          color: STRATEGY_COLORS[type] || '#718096',
        };
      }
      stats[type].bots++;
      stats[type].profit += (b.financials?.netRealizedProfit ?? Number(b.totalProfit || 0));
      stats[type].fees += (b.financials?.totalFeeDeducted || 0);
      stats[type].invested += (b.financials?.totalInvestmentWithoutFee ?? Number(b.investedAmount || 0));
    });
    return Object.values(stats);
  }, [bots]);

  // Exchange Chart Data
  const exchangePieData = useMemo(() => {
    const map = {};
    bots.forEach(b => {
      const ex = b.exchangeName || 'Other';
      if (!map[ex]) {
        const info = EXCHANGE_BADGES[ex.toLowerCase()] || { name: ex, color: '#63b3ed' };
        map[ex] = { name: info.name, value: 0, color: info.color };
      }
      map[ex].value += (b.financials?.totalInvestmentWithoutFee ?? Number(b.investedAmount || 0));
    });
    return Object.values(map);
  }, [bots]);

  // Unique lists for filters
  const exchangeList = useMemo(() => {
    const set = new Set(bots.map(b => b.exchangeName?.toLowerCase()).filter(Boolean));
    return Array.from(set);
  }, [bots]);

  const strategyList = useMemo(() => {
    const set = new Set(bots.map(b => b.strategyType).filter(Boolean));
    return Array.from(set);
  }, [bots]);

  return (
    <div className="bot-analytics-page advanced">
      {/* ══════════════════ HEADER ══════════════════ */}
      <div className="analytics-header">
        <div className="header-left">
          <div className="title-row">
            <h1><BarChart3 size={30} className="header-icon" /> Advanced Bot Analytics</h1>
            <span className="live-pill"><span className="pulse-dot"></span> Multi-Exchange Audited</span>
          </div>
          <p>Real-time holdings, accurate exchange trading fees, and audited gross profit vs loss across all connected exchanges</p>
        </div>
        <div className="header-actions">
          <button className="refresh-btn" onClick={loadAnalytics} disabled={loading} title="Refresh Analytics">
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ══════════════════ EXECUTIVE KPI RIBBON ══════════════════ */}
      <div className="advanced-kpi-ribbon">
        {/* Total Bots */}
        <div className="kpi-box">
          <div className="kpi-icon-wrap blue"><Bot size={22} /></div>
          <div className="kpi-details">
            <span className="kpi-label">Active Bots</span>
            <div className="kpi-val-row">
              <span className="kpi-val">{totalBots}</span>
              <span className="kpi-badge running">{activeBots} RUNNING</span>
            </div>
            <div className="kpi-sub-row">
              <span className="sub-stat">{pausedBots} paused</span>
              <span className="dot-divider">•</span>
              <span className="sub-stat">{stoppedBots} stopped</span>
            </div>
          </div>
        </div>

        {/* Total Invested (With & Without Fee) */}
        <div className="kpi-box highlight-purple">
          <div className="kpi-icon-wrap purple"><Wallet size={22} /></div>
          <div className="kpi-details">
            <div className="label-with-tip">
              <span className="kpi-label">Total Invested</span>
              <span className="metric-tag">Capital Base</span>
            </div>
            <div className="kpi-val-row">
              <span className="kpi-val">{formatCurrency(totalInvestedWithoutFee)}</span>
            </div>
            <div className="kpi-sub-row fee-adjusted">
              <span>With Fees: <strong>{formatCurrency(totalInvestedWithFee)}</strong></span>
            </div>
          </div>
        </div>

        {/* Portfolio Equity */}
        <div className="kpi-box">
          <div className="kpi-icon-wrap cyan"><Coins size={22} /></div>
          <div className="kpi-details">
            <span className="kpi-label">Current Equity</span>
            <div className="kpi-val-row">
              <span className="kpi-val">{formatCurrency(totalCurrentValue)}</span>
              {totalUnrealizedPnl !== 0 && (
                <span className={`kpi-badge ${totalUnrealizedPnl >= 0 ? 'positive' : 'negative'}`}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl)} uPnL
                </span>
              )}
            </div>
            <div className="kpi-sub-row">
              <span>Mark-to-Market Live Value</span>
            </div>
          </div>
        </div>

        {/* Net Realized Profit */}
        <div className="kpi-box highlight-emerald">
          <div className={`kpi-icon-wrap ${netRealizedProfit >= 0 ? 'emerald' : 'rose'}`}>
            {netRealizedProfit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Net Realized Profit</span>
            <div className="kpi-val-row">
              <span className={`kpi-val ${netRealizedProfit >= 0 ? 'positive' : 'negative'}`}>
                {netRealizedProfit >= 0 ? '+' : ''}{formatCurrency(netRealizedProfit)}
              </span>
            </div>
            <div className="kpi-sub-row">
              <span className={netRealizedProfit >= 0 ? 'positive' : 'negative'}>
                {totalInvestedWithoutFee > 0
                  ? `${((netRealizedProfit / totalInvestedWithoutFee) * 100).toFixed(2)}% ROI`
                  : '0.00% ROI'}
              </span>
              <span className="dot-divider">•</span>
              <span>Net of all fees</span>
            </div>
          </div>
        </div>

        {/* Total Fee Deducted */}
        <div className="kpi-box fee-box">
          <div className="kpi-icon-wrap amber"><Receipt size={22} /></div>
          <div className="kpi-details">
            <div className="label-with-tip">
              <span className="kpi-label">Total Fee Deducted</span>
              <span className="metric-tag fee-tag">Audited</span>
            </div>
            <div className="kpi-val-row">
              <span className="kpi-val fee-color">-{formatCurrency(totalFeesDeducted)}</span>
            </div>
            <div className="kpi-sub-row">
              <span>Fee Drag: {totalInvestedWithoutFee > 0 ? `${((totalFeesDeducted / totalInvestedWithoutFee) * 100).toFixed(2)}%` : '0.00%'}</span>
            </div>
          </div>
        </div>

        {/* Gross Profit vs Gross Loss */}
        <div className="kpi-box split-box">
          <div className="split-cell">
            <span className="split-label">Total Gross Profit</span>
            <span className="split-val positive">+{formatCurrency(totalGrossProfit)}</span>
          </div>
          <div className="split-separator"></div>
          <div className="split-cell">
            <span className="split-label">Total Gross Loss</span>
            <span className="split-val negative">-{formatCurrency(totalGrossLoss)}</span>
          </div>
        </div>

        {/* Win Rate & Trades */}
        <div className="kpi-box">
          <div className="kpi-icon-wrap indigo"><Target size={22} /></div>
          <div className="kpi-details">
            <span className="kpi-label">Win Rate & Trades</span>
            <div className="kpi-val-row">
              <span className="kpi-val">{overallWinRate.toFixed(1)}%</span>
              <span className="kpi-badge neutral">{totalTrades} Fills</span>
            </div>
            <div className="kpi-sub-row">
              <span>Profit Factor: <strong>{overallProfitFactor.toFixed(2)}x</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════ FILTER & TOOLBAR BAR ══════════════════ */}
      <div className="analytics-toolbar">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search bot name, symbol (BTC, SOL, ETH), exchange..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Exchange Filter */}
        <div className="filter-group">
          <span className="filter-label"><Layers size={14} /> Exchange:</span>
          <select
            value={selectedExchange}
            onChange={(e) => setSelectedExchange(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Exchanges ({bots.length})</option>
            {exchangeList.map(ex => (
              <option key={ex} value={ex}>
                {(EXCHANGE_BADGES[ex]?.name || ex.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Strategy Filter */}
        <div className="filter-group">
          <span className="filter-label"><Bot size={14} /> Strategy:</span>
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Strategies</option>
            {strategyList.map(st => (
              <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-group">
          <span className="filter-label"><Activity size={14} /> Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Status</option>
            <option value="RUNNING">Running</option>
            <option value="PAUSED">Paused</option>
            <option value="STOPPED">Stopped</option>
          </select>
        </div>

        {/* Sort */}
        <div className="filter-group">
          <span className="filter-label"><ArrowUpDown size={14} /> Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="profit_desc">Highest Profit</option>
            <option value="profit_asc">Lowest Profit</option>
            <option value="roi_desc">Highest ROI %</option>
            <option value="invested_desc">Largest Investment</option>
            <option value="trades_desc">Most Trades</option>
            <option value="newest">Newest Created</option>
          </select>
        </div>
      </div>

      {/* ══════════════════ BOTS PERFORMANCE MATRIX TABLE ══════════════════ */}
      <div className="bot-matrix-section">
        <div className="section-header-row">
          <div>
            <h3><ShieldCheck size={20} /> Bot Financials Matrix</h3>
            <p className="section-subtitle">Click any bot row to inspect exact holdings, fee audit log, and gross profit/loss breakdown</p>
          </div>
          <span className="count-pill">Showing {filteredBots.length} of {bots.length} Bots</span>
        </div>

        <div className="table-wrapper">
          <table className="advanced-bot-table">
            <thead>
              <tr>
                <th>Bot / Strategy</th>
                <th>Exchange</th>
                <th>Symbol / Mode</th>
                <th>Holdings</th>
                <th>Investment (w/o fee)</th>
                <th>Total Fee</th>
                <th>Investment (w/ fee)</th>
                <th>Gross P / L</th>
                <th>Net Profit</th>
                <th>Win Rate</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBots.length > 0 ? (
                filteredBots.map((bot) => {
                  const fin = bot.financials || {};
                  const exBadge = EXCHANGE_BADGES[bot.exchangeName?.toLowerCase()] || {
                    name: bot.exchangeName || 'Demo',
                    color: '#94a3b8',
                    bg: 'rgba(148, 163, 184, 0.12)'
                  };
                  const curr = fin.currencySymbol || '$';
                  const holdingCount = fin.holdings?.length || 0;
                  const primaryHolding = fin.holdings?.[0];

                  return (
                    <tr
                      key={bot.id}
                      className="interactive-bot-row"
                      onClick={() => handleOpenBotDetail(bot)}
                    >
                      <td>
                        <div className="bot-cell-name">
                          <span className="bot-name">{bot.name}</span>
                          <div className="bot-tags-row">
                            <span
                              className="strategy-badge"
                              style={{ borderColor: STRATEGY_COLORS[bot.strategyType] || '#718096' }}
                            >
                              <span
                                className="strategy-indicator"
                                style={{ background: STRATEGY_COLORS[bot.strategyType] || '#718096' }}
                              ></span>
                              {bot.strategyType?.replace(/_/g, ' ')}
                            </span>
                            <span className={`status-pill ${bot.status?.toLowerCase()}`}>
                              {bot.status}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className="exchange-badge"
                          style={{ color: exBadge.color, backgroundColor: exBadge.bg }}
                        >
                          {exBadge.name}
                        </span>
                      </td>
                      <td>
                        <div className="symbol-cell">
                          <span className="symbol-text">{bot.symbol}</span>
                          <span className={`mode-badge ${bot.mode === 'LIVE' ? 'live' : 'paper'}`}>
                            {bot.mode}
                          </span>
                        </div>
                      </td>
                      <td>
                        {primaryHolding ? (
                          <div className="holding-summary-cell">
                            <span className="holding-qty">
                              {Number(primaryHolding.quantity).toFixed(4)} {primaryHolding.asset}
                            </span>
                            <span className="holding-val">
                              {formatCurrency(primaryHolding.marketValue, curr)}
                            </span>
                          </div>
                        ) : (
                          <span className="holding-none">0 {bot.symbol?.split('/')?.[0] || 'Holding'}</span>
                        )}
                      </td>
                      <td>
                        <span className="invested-val">
                          {formatCurrency(fin.totalInvestmentWithoutFee, curr)}
                        </span>
                      </td>
                      <td>
                        <span className="fee-deducted-cell">
                          -{formatCurrency(fin.totalFeeDeducted, curr)}
                        </span>
                      </td>
                      <td>
                        <span className="invested-with-fee-val">
                          {formatCurrency(fin.totalInvestmentWithFee, curr)}
                        </span>
                      </td>
                      <td>
                        <div className="gross-pl-cell">
                          <span className="gross-p">+{formatCurrency(fin.totalGrossProfit, curr)}</span>
                          <span className="gross-l">-{formatCurrency(fin.totalGrossLoss, curr)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="net-profit-cell">
                          <span className={`net-pnl-val ${(fin.netRealizedProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
                            {(fin.netRealizedProfit || 0) >= 0 ? '+' : ''}{formatCurrency(fin.netRealizedProfit, curr)}
                          </span>
                          <span className="roi-small">
                            {fin.roiWithoutFee ? `${fin.roiWithoutFee.toFixed(1)}%` : '0%'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="winrate-cell">
                          <span className="winrate-num">{(fin.winRate || 0).toFixed(1)}%</span>
                          <span className="trades-sub">{fin.totalTrades || 0} trades</span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="inspect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBotDetail(bot);
                          }}
                        >
                          <span>Inspect</span>
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="no-data-cell">
                    <div className="empty-state">
                      <Bot size={32} />
                      <p>No trading bots match your search criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════ CHARTS ROW ══════════════════ */}
      <div className="charts-row">
        {/* Profit & Fee by Strategy */}
        <div className="chart-card">
          <div className="chart-title-row">
            <h3><BarChart3 size={18} /> Net Profit & Fees by Strategy</h3>
          </div>
          <div className="chart-container">
            {strategyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={strategyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2938" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#718096' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#718096' }} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1d2938', borderRadius: 8 }}
                    formatter={(val, name) => [
                      `$${Number(val).toFixed(2)}`,
                      name === 'profit' ? 'Net Profit' : 'Fees Incurred'
                    ]}
                  />
                  <Bar dataKey="profit" name="profit">
                    {strategyData.map((entry, index) => (
                      <Cell key={index} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                  <Bar dataKey="fees" fill="#f59e0b" name="fees" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-data">No strategy data</div>
            )}
          </div>
        </div>

        {/* Capital Allocation by Exchange */}
        <div className="chart-card">
          <div className="chart-title-row">
            <h3><PieChart size={18} /> Capital Allocation by Exchange</h3>
          </div>
          <div className="chart-container pie-chart">
            {exchangePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <RechartsPie>
                  <Pie
                    data={exchangePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {exchangePieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend formatter={(value) => <span style={{ color: '#e7edf5', fontSize: '12px' }}>{value}</span>} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1d2938', borderRadius: 8 }}
                    formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Invested']}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="no-data">No exchange allocation</div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════ BOT DRILLDOWN MODAL ══════════════════ */}
      {selectedBotId && (
        <div className="bot-modal-backdrop" onClick={handleCloseModal}>
          <div className="bot-drilldown-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-bot-name-row">
                  <h2>{botPerformance?.bot?.name || 'Bot Drilldown'}</h2>
                  <span className={`status-pill ${botPerformance?.bot?.status?.toLowerCase()}`}>
                    {botPerformance?.bot?.status}
                  </span>
                  <span className="mode-badge live">{botPerformance?.bot?.mode}</span>
                </div>
                <div className="modal-meta-row">
                  <span className="meta-item">
                    <strong>Exchange:</strong> {botPerformance?.bot?.exchangeName}
                  </span>
                  <span className="meta-item">
                    <strong>Symbol:</strong> {botPerformance?.bot?.symbol}
                  </span>
                  <span className="meta-item">
                    <strong>Strategy:</strong> {botPerformance?.bot?.strategyType?.replace(/_/g, ' ')}
                  </span>
                  {botPerformance?.financials?.livePrice > 0 && (
                    <span className="meta-item live-price-pill">
                      <strong>Market Price:</strong> {formatCurrency(botPerformance.financials.livePrice, botPerformance.financials.currencySymbol)}
                    </span>
                  )}
                </div>
              </div>
              <div className="modal-top-actions">
                <button
                  className="terminal-link-btn"
                  onClick={() => navigate(`/bots/${selectedBotId}`)}
                  title="Open live control terminal"
                >
                  <ExternalLink size={16} />
                  <span>Open Full Terminal</span>
                </button>
                <button className="modal-close-btn" onClick={handleCloseModal}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Financials Overview Ribbon */}
            {botPerformance && (
              <div className="modal-kpi-grid">
                {/* Holdings Value */}
                <div className="m-kpi-card">
                  <span className="m-kpi-label">Holdings & Equity</span>
                  <span className="m-kpi-val highlight-blue">
                    {formatCurrency(botPerformance.financials?.currentValue, botPerformance.financials?.currencySymbol)}
                  </span>
                  <span className="m-kpi-sub">
                    Available cash: {formatCurrency(botPerformance.financials?.availableCash, botPerformance.financials?.currencySymbol)}
                  </span>
                </div>

                {/* Investment Without Fee */}
                <div className="m-kpi-card">
                  <span className="m-kpi-label">Total Invested (w/o fee)</span>
                  <span className="m-kpi-val">
                    {formatCurrency(botPerformance.financials?.totalInvestmentWithoutFee, botPerformance.financials?.currencySymbol)}
                  </span>
                  <span className="m-kpi-sub">Base deployed capital</span>
                </div>

                {/* Total Fee Deducted */}
                <div className="m-kpi-card fee-highlight">
                  <span className="m-kpi-label">Total Fee Deducted</span>
                  <span className="m-kpi-val fee-color">
                    -{formatCurrency(botPerformance.financials?.totalFeeDeducted, botPerformance.financials?.currencySymbol)}
                  </span>
                  <span className="m-kpi-sub">
                    {botPerformance.feeBreakdown?.feeType || 'Exchange Fee'}
                  </span>
                </div>

                {/* Investment With Fee */}
                <div className="m-kpi-card">
                  <span className="m-kpi-label">Total Invested (with fee)</span>
                  <span className="m-kpi-val purple-color">
                    {formatCurrency(botPerformance.financials?.totalInvestmentWithFee, botPerformance.financials?.currencySymbol)}
                  </span>
                  <span className="m-kpi-sub">Capital + All Incurred Fees</span>
                </div>

                {/* Gross Profit */}
                <div className="m-kpi-card">
                  <span className="m-kpi-label">Total Profit (Gross)</span>
                  <span className="m-kpi-val positive">
                    +{formatCurrency(botPerformance.financials?.totalGrossProfit, botPerformance.financials?.currencySymbol)}
                  </span>
                  <span className="m-kpi-sub">{botPerformance.financials?.winningTrades || 0} winning fills</span>
                </div>

                {/* Gross Loss */}
                <div className="m-kpi-card">
                  <span className="m-kpi-label">Total Loss (Gross)</span>
                  <span className="m-kpi-val negative">
                    -{formatCurrency(botPerformance.financials?.totalGrossLoss, botPerformance.financials?.currencySymbol)}
                  </span>
                  <span className="m-kpi-sub">{botPerformance.financials?.losingTrades || 0} losing fills</span>
                </div>

                {/* Net Realized Profit */}
                <div className="m-kpi-card net-card">
                  <span className="m-kpi-label">Net Realized Profit</span>
                  <span className={`m-kpi-val ${(botPerformance.financials?.netRealizedProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {(botPerformance.financials?.netRealizedProfit || 0) >= 0 ? '+' : ''}
                    {formatCurrency(botPerformance.financials?.netRealizedProfit, botPerformance.financials?.currencySymbol)}
                  </span>
                  <span className="m-kpi-sub">
                    ROI w/o fee: {botPerformance.financials?.roiWithoutFee?.toFixed(2)}% | w/ fee: {botPerformance.financials?.roiWithFee?.toFixed(2)}%
                  </span>
                </div>

                {/* Win Rate & Factor */}
                <div className="m-kpi-card">
                  <span className="m-kpi-label">Win Rate & Factor</span>
                  <span className="m-kpi-val">
                    {(botPerformance.financials?.winRate || 0).toFixed(1)}%
                  </span>
                  <span className="m-kpi-sub">
                    Profit Factor: {Number(botPerformance.financials?.profitFactor || 1).toFixed(2)}x
                  </span>
                </div>
              </div>
            )}

            {/* Modal Tabs Navigation */}
            <div className="modal-tabs">
              <button
                className={`tab-btn ${activeModalTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('overview')}
              >
                <Coins size={16} />
                <span>Holdings Breakdown ({botPerformance?.holdings?.length || 0})</span>
              </button>
              <button
                className={`tab-btn ${activeModalTab === 'fees' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('fees')}
              >
                <Receipt size={16} />
                <span>Fee & Capital Audit</span>
              </button>
              <button
                className={`tab-btn ${activeModalTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('orders')}
              >
                <Activity size={16} />
                <span>Recent Orders & Fills ({botPerformance?.recentOrders?.length || 0})</span>
              </button>
              <button
                className={`tab-btn ${activeModalTab === 'equity' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('equity')}
              >
                <TrendingUp size={16} />
                <span>Equity Curve</span>
              </button>
            </div>

            {/* Modal Tab Content */}
            <div className="modal-tab-content">
              {perfLoading ? (
                <div className="loading-state">
                  <RefreshCw size={24} className="spinning" />
                  <span>Loading audited performance parameters...</span>
                </div>
              ) : (
                <>
                  {/* TAB 1: HOLDINGS BREAKDOWN */}
                  {activeModalTab === 'overview' && (
                    <div className="holdings-tab-pane">
                      <div className="pane-summary-card">
                        <div className="summary-col">
                          <span className="col-label">Base Asset Allocation</span>
                          <span className="col-val">
                            {botPerformance?.holdings?.length > 0
                              ? `${botPerformance.holdings.map(h => `${h.quantity.toFixed(4)} ${h.asset}`).join(', ')}`
                              : '0.00 Base Assets (All Quote Cash)'}
                          </span>
                        </div>
                        <div className="summary-col">
                          <span className="col-label">Unrealized PnL</span>
                          <span className={`col-val ${(botPerformance?.financials?.totalUnrealizedPnl || 0) >= 0 ? 'positive' : 'negative'}`}>
                            {(botPerformance?.financials?.totalUnrealizedPnl || 0) >= 0 ? '+' : ''}
                            {formatCurrency(botPerformance?.financials?.totalUnrealizedPnl, botPerformance?.financials?.currencySymbol)}
                          </span>
                        </div>
                        <div className="summary-col">
                          <span className="col-label">Available Quote Cash</span>
                          <span className="col-val">
                            {formatCurrency(botPerformance?.financials?.availableCash, botPerformance?.financials?.currencySymbol)} {botPerformance?.financials?.quoteAsset}
                          </span>
                        </div>
                      </div>

                      <table className="modal-data-table">
                        <thead>
                          <tr>
                            <th>Asset</th>
                            <th>Quantity Held</th>
                            <th>Avg Entry Price</th>
                            <th>Live Market Price</th>
                            <th>Current Market Value</th>
                            <th>Unrealized PnL ($)</th>
                            <th>Unrealized PnL (%)</th>
                            <th>Portfolio Allocation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {botPerformance?.holdings && botPerformance.holdings.length > 0 ? (
                            botPerformance.holdings.map((h, i) => (
                              <tr key={i}>
                                <td>
                                  <span className="asset-pill">{h.asset}</span>
                                </td>
                                <td>
                                  <strong className="mono">{Number(h.quantity).toFixed(6)}</strong>
                                </td>
                                <td className="mono">
                                  {formatCurrency(h.avgEntryPrice, botPerformance.financials?.currencySymbol)}
                                </td>
                                <td className="mono highlight-price">
                                  {formatCurrency(h.currentPrice, botPerformance.financials?.currencySymbol)}
                                </td>
                                <td className="mono">
                                  {formatCurrency(h.marketValue, botPerformance.financials?.currencySymbol)}
                                </td>
                                <td className={`mono ${h.unrealizedPnl >= 0 ? 'positive' : 'negative'}`}>
                                  {h.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(h.unrealizedPnl, botPerformance.financials?.currencySymbol)}
                                </td>
                                <td className={`mono ${h.unrealizedPnlPercent >= 0 ? 'positive' : 'negative'}`}>
                                  {h.unrealizedPnlPercent >= 0 ? '+' : ''}{h.unrealizedPnlPercent.toFixed(2)}%
                                </td>
                                <td>
                                  <div className="alloc-bar-wrap">
                                    <div
                                      className="alloc-bar"
                                      style={{ width: `${Math.min(100, Math.max(5, h.allocationPercent || 0))}%` }}
                                    ></div>
                                    <span className="alloc-text">{(h.allocationPercent || 0).toFixed(1)}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} className="empty-row">
                                Currently holding 100% Quote Cash ({formatCurrency(botPerformance?.financials?.availableCash, botPerformance?.financials?.currencySymbol)} {botPerformance?.financials?.quoteAsset}). No open base asset inventory.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 2: FEE & CAPITAL BREAKDOWN */}
                  {activeModalTab === 'fees' && (
                    <div className="fees-tab-pane">
                      <div className="fee-cards-row">
                        <div className="fee-audit-card">
                          <h4><Receipt size={18} /> Exchange Fee Schedule</h4>
                          <div className="audit-line">
                            <span>Exchange Platform:</span>
                            <strong>{botPerformance?.bot?.exchangeName}</strong>
                          </div>
                          <div className="audit-line">
                            <span>Fee Structure:</span>
                            <span className="highlight-pill">{botPerformance?.feeBreakdown?.feeType || 'Spot Standard'}</span>
                          </div>
                          <div className="audit-line">
                            <span>Standard Maker / Taker Rate:</span>
                            <strong>{botPerformance?.feeBreakdown?.feeRate?.toFixed(3)}%</strong>
                          </div>
                          <div className="audit-line">
                            <span>Settlement Currency:</span>
                            <strong>{botPerformance?.feeBreakdown?.feeAsset}</strong>
                          </div>
                        </div>

                        <div className="fee-audit-card highlight">
                          <h4><DollarSign size={18} /> Investment with Fee vs without Fee</h4>
                          <div className="audit-line">
                            <span>Total Investment (Without Fee):</span>
                            <strong>{formatCurrency(botPerformance?.financials?.totalInvestmentWithoutFee, botPerformance?.financials?.currencySymbol)}</strong>
                          </div>
                          <div className="audit-line">
                            <span>Cumulative Trading Fees Incurred:</span>
                            <strong className="fee-color">+{formatCurrency(botPerformance?.financials?.totalFeeDeducted, botPerformance?.financials?.currencySymbol)}</strong>
                          </div>
                          <div className="audit-separator"></div>
                          <div className="audit-line total-line">
                            <span>Total Investment (With Fee):</span>
                            <strong className="purple-color">{formatCurrency(botPerformance?.financials?.totalInvestmentWithFee, botPerformance?.financials?.currencySymbol)}</strong>
                          </div>
                          <div className="audit-line">
                            <span>Fee Drag on Initial Capital:</span>
                            <span className="drag-percent">
                              {botPerformance?.financials?.totalInvestmentWithoutFee > 0
                                ? `${((botPerformance.financials.totalFeeDeducted / botPerformance.financials.totalInvestmentWithoutFee) * 100).toFixed(2)}%`
                                : '0.00%'}
                            </span>
                          </div>
                        </div>

                        <div className="fee-audit-card">
                          <h4><ShieldCheck size={18} /> Profit Quality Audit</h4>
                          <div className="audit-line">
                            <span>Total Gross Profit:</span>
                            <strong className="positive">+{formatCurrency(botPerformance?.financials?.totalGrossProfit, botPerformance?.financials?.currencySymbol)}</strong>
                          </div>
                          <div className="audit-line">
                            <span>Total Gross Loss:</span>
                            <strong className="negative">-{formatCurrency(botPerformance?.financials?.totalGrossLoss, botPerformance?.financials?.currencySymbol)}</strong>
                          </div>
                          <div className="audit-line">
                            <span>Fees Deducted:</span>
                            <strong className="fee-color">-{formatCurrency(botPerformance?.financials?.totalFeeDeducted, botPerformance?.financials?.currencySymbol)}</strong>
                          </div>
                          <div className="audit-separator"></div>
                          <div className="audit-line total-line">
                            <span>Audited Net Realized Profit:</span>
                            <strong className={(botPerformance?.financials?.netRealizedProfit || 0) >= 0 ? 'positive' : 'negative'}>
                              {formatCurrency(botPerformance?.financials?.netRealizedProfit, botPerformance?.financials?.currencySymbol)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: ORDER AUDIT LOG */}
                  {activeModalTab === 'orders' && (
                    <div className="orders-tab-pane">
                      <table className="modal-data-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Side</th>
                            <th>Type</th>
                            <th>Filled Qty</th>
                            <th>Filled Price</th>
                            <th>Total Value</th>
                            <th>Fee Deducted</th>
                            <th>Realized Profit</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {botPerformance?.recentOrders && botPerformance.recentOrders.length > 0 ? (
                            botPerformance.recentOrders.map((ord, idx) => {
                              const orderVal = (ord.filledQuantity || ord.quantity) * (ord.filledPrice || ord.price);
                              return (
                                <tr key={idx}>
                                  <td className="time-cell">
                                    {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    <span className="date-sub">{new Date(ord.createdAt).toLocaleDateString()}</span>
                                  </td>
                                  <td>
                                    <span className={`side-pill ${ord.side?.toLowerCase()}`}>
                                      {ord.side}
                                    </span>
                                  </td>
                                  <td>{ord.type}</td>
                                  <td className="mono">{Number(ord.filledQuantity || ord.quantity).toFixed(4)}</td>
                                  <td className="mono">{formatCurrency(ord.filledPrice || ord.price, botPerformance.financials?.currencySymbol)}</td>
                                  <td className="mono">{formatCurrency(orderVal, botPerformance.financials?.currencySymbol)}</td>
                                  <td className="mono fee-color">
                                    -{formatCurrency(ord.fee, botPerformance.financials?.currencySymbol)}
                                  </td>
                                  <td className={`mono ${ord.profit > 0 ? 'positive' : ord.profit < 0 ? 'negative' : ''}`}>
                                    {ord.profit != null
                                      ? `${ord.profit >= 0 ? '+' : ''}${formatCurrency(ord.profit, botPerformance.financials?.currencySymbol)}`
                                      : '-'}
                                  </td>
                                  <td>
                                    <span className={`order-status ${ord.status?.toLowerCase()}`}>
                                      {ord.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={9} className="empty-row">No orders executed yet for this bot.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 4: EQUITY CURVE */}
                  {activeModalTab === 'equity' && (
                    <div className="equity-tab-pane">
                      {botPerformance?.snapshots && botPerformance.snapshots.length > 1 ? (
                        <div className="chart-container-large">
                          <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={botPerformance.snapshots}>
                              <defs>
                                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1d2938" />
                              <XAxis
                                dataKey="time"
                                tickFormatter={(t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                tick={{ fontSize: 11, fill: '#718096' }}
                              />
                              <YAxis tick={{ fontSize: 11, fill: '#718096' }} />
                              <Tooltip
                                contentStyle={{ background: '#0d1117', border: '1px solid #1d2938', borderRadius: 8 }}
                                formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Equity']}
                                labelFormatter={(t) => new Date(t).toLocaleString()}
                              />
                              <Area type="monotone" dataKey="equity" stroke="#10b981" fillOpacity={1} fill="url(#equityGrad)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="equity-fallback-card">
                          <Activity size={32} />
                          <h4>Equity Snapshot Curve</h4>
                          <p>Bot initialized with capital of {formatCurrency(botPerformance?.financials?.totalInvestmentWithoutFee, botPerformance?.financials?.currencySymbol)}. Current mark-to-market equity is {formatCurrency(botPerformance?.financials?.currentValue, botPerformance?.financials?.currencySymbol)}.</p>
                          <div className="pnl-summary-pills">
                            <span className="summary-pill">Net Realized: {formatCurrency(botPerformance?.financials?.netRealizedProfit, botPerformance?.financials?.currencySymbol)}</span>
                            <span className="summary-pill">Unrealized: {formatCurrency(botPerformance?.financials?.totalUnrealizedPnl, botPerformance?.financials?.currencySymbol)}</span>
                            <span className="summary-pill fee-pill">Fees Deducted: -{formatCurrency(botPerformance?.financials?.totalFeeDeducted, botPerformance?.financials?.currencySymbol)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
