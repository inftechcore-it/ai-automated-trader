import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Brain, TrendingUp, TrendingDown, Activity, Search, Target,
  Clock, AlertTriangle, CheckCircle, XCircle, BarChart3, Lock,
  ChevronDown, ChevronUp, Loader2, RefreshCw, Zap, FlaskConical,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles, Cpu, Shield,
  DollarSign, Percent, Eye, TrendingUp as Trend, BarChart2,
  MessageCircle, Send, Bot, User, Lightbulb, History, X,
  ExternalLink, ChevronRight, Star, Bookmark, Copy, Check,
  Radio, CircleDot
} from 'lucide-react';
import Badge from '../components/Badge.jsx';
import RagTerminal from '../components/rag/RagTerminal.jsx';

const api = (path, opts = {}) =>
  fetch(`${import.meta.env.VITE_API || 'http://localhost:5000'}/api${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    ...opts
  }).then(r => r.json());

const EXCHANGES = [
  { id: 'pionex', name: 'Pionex', type: 'crypto', icon: '⚡', currency: '$' },
  { id: 'coindcx', name: 'CoinDCX', type: 'crypto', icon: '⚡', currency: '$' },
  { id: 'jupiter', name: 'Jupiter (Solana DEX)', type: 'dex', icon: '🪐', currency: '$' },
  { id: 'binance', name: 'Binance', type: 'crypto', icon: '₿', currency: '$' },
  { id: 'bybit', name: 'Bybit', type: 'crypto', icon: '🔶', currency: '$' },
  { id: 'kraken', name: 'Kraken', type: 'crypto', icon: '🐙', currency: '$' },
  { id: 'nasdaq', name: 'NASDAQ', type: 'stock', icon: '📈', currency: '$' },
  { id: 'nyse', name: 'NYSE', type: 'stock', icon: '🏛️', currency: '$' },
  { id: 'nse', name: 'NSE (India)', type: 'stock', icon: '🇮🇳', currency: '₹' },
  { id: 'bse', name: 'BSE (India)', type: 'stock', icon: '🇮🇳', currency: '₹' }
];

const POPULAR_SYMBOLS = {
  pionex: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT'],
  coindcx: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BTC/INR', 'USDT/INR', 'XRP/INR', 'DOGE/INR'],
  jupiter: ['SOL/USDC', 'JUP/USDC', 'RAY/USDC', 'BONK/USDC', 'WIF/USDC', 'PYTH/USDC', 'JTO/USDC'],
  binance: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT'],
  bybit: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'MNT/USDT'],
  kraken: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'DOT/USD', 'XRP/USD'],
  nasdaq: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD'],
  nyse: ['JPM', 'V', 'WMT', 'DIS', 'KO', 'PFE', 'IBM', 'BA'],
  nse: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN'],
  bse: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATASTEEL']
};

export default function AiAnalysis() {
  const [activeChip, setActiveChip] = useState('prediction');
  const [exchange, setExchange] = useState('pionex');
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [researchResult, setResearchResult] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const chatEndRef = useRef(null);

  // Arbitrage state
  const [arbStatus, setArbStatus] = useState({ status: 'stopped', cyclesScanned: 0, opportunitiesFound: 0 });
  const [arbOpportunities, setArbOpportunities] = useState([]);
  const [arbCrossOpportunities, setArbCrossOpportunities] = useState([]);
  const [arbLoading, setArbLoading] = useState(false);
  const [arbMode, setArbMode] = useState('both'); // triangular, cross-exchange, both
  const [arbConfig, setArbConfig] = useState({ minSpread: 0.1, maxTradeSize: 100, autoExecute: false, dryRun: true });
  const [arbConnectedExchanges, setArbConnectedExchanges] = useState([]);
  const [arbExecutions, setArbExecutions] = useState([]);
  const arbRefreshInterval = useRef(null);

  // Execution modal state
  const [execModal, setExecModal] = useState({ show: false, opportunity: null, type: null });
  const [execSteps, setExecSteps] = useState([]);
  const [execStatus, setExecStatus] = useState('idle'); // idle, executing, completed, failed
  const [execResult, setExecResult] = useState(null);
  const [arbBalances, setArbBalances] = useState({});
  const [execSessionId, setExecSessionId] = useState(null);
  const [showAllOpps, setShowAllOpps] = useState(false);
  const socketRef = useRef(null);

  // Power Engine state
  const [powerMode, setPowerMode] = useState(false);
  const [powerStatus, setPowerStatus] = useState(null);
  const [powerOpportunities, setPowerOpportunities] = useState({ all: [], profitable: [], highConfidence: [] });
  const [powerCapital, setPowerCapital] = useState(null);
  const [powerRisk, setPowerRisk] = useState(null);
  const [powerLoading, setPowerLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (activeChip === 'arbitrage') {
      loadArbStatus();
      loadArbOpportunities();
      loadArbExecutions();
      arbRefreshInterval.current = setInterval(() => {
        loadArbOpportunities();
        loadArbStatus();
      }, 15000);
    } else {
      if (arbRefreshInterval.current) {
        clearInterval(arbRefreshInterval.current);
      }
    }
    return () => {
      if (arbRefreshInterval.current) {
        clearInterval(arbRefreshInterval.current);
      }
    };
  }, [activeChip, showAllOpps]);

  const loadArbStatus = async () => {
    try {
      const res = await api('/arbitrage/status');
      if (res.success) {
        setArbStatus({
          status: res.isRunning ? 'running' : 'stopped',
          cyclesScanned: res.triangularStats?.scansCompleted || 0,
          opportunitiesFound: res.executionStats?.totalExecutions || 0,
          mode: res.mode || 'both',
          dryRun: res.dryRun,
          autoExecute: res.autoExecute,
        });
        setArbConnectedExchanges(res.connectedExchanges || []);
        setArbMode(res.mode || 'both');
        setArbConfig(prev => ({ ...prev, dryRun: res.dryRun, autoExecute: res.autoExecute }));
      }
    } catch (e) {
      console.error('Failed to load arb status:', e);
    }
  };

  const loadArbOpportunities = async () => {
    try {
      const res = await api(`/arbitrage/opportunities?showAll=${showAllOpps}`);
      if (res.success) {
        // Triangular opportunities
        if (res.triangular) {
          const formatted = res.triangular.map(opp => ({
            id: opp.id || `tri_${Date.now()}`,
            type: 'triangular',
            exchange: 'Binance',
            assets: opp.cycle?.assets || [],
            symbols: opp.cycle?.symbols || [],
            spreadPercent: opp.grossProfitPercent,
            netProfitPercent: opp.netProfitPercent,
            profitable: opp.profitable,
            legs: opp.legs || [],
            timestamp: opp.timestamp,
          }));
          setArbOpportunities(formatted);
        }
        // Cross-exchange opportunities
        if (res.crossExchange) {
          setArbCrossOpportunities(res.crossExchange);
        }
      }
    } catch (e) {
      console.error('Failed to load opportunities:', e);
    }
  };

  const loadArbExecutions = async () => {
    try {
      const res = await api('/arbitrage/executions');
      if (res.success) {
        setArbExecutions([...res.active, ...res.history.slice(0, 5)]);
      }
    } catch (e) {
      console.error('Failed to load executions:', e);
    }
  };

  const changeArbMode = async (mode) => {
    setArbLoading(true);
    try {
      const res = await api('/arbitrage/mode', {
        method: 'POST',
        body: JSON.stringify({ mode })
      });
      if (res.success) {
        setArbMode(mode);
        loadArbStatus();
      }
    } catch (e) {
      console.error('Failed to change mode:', e);
    } finally {
      setArbLoading(false);
    }
  };

  const toggleDryRun = async () => {
    try {
      const res = await api('/arbitrage/dry-run', {
        method: 'POST',
        body: JSON.stringify({ enabled: !arbConfig.dryRun })
      });
      if (res.success) {
        setArbConfig(prev => ({ ...prev, dryRun: res.dryRun }));
      }
    } catch (e) {
      console.error('Failed to toggle dry run:', e);
    }
  };

  const loadBalances = async () => {
    try {
      const res = await api('/arbitrage/balances');
      if (res.success) {
        setArbBalances(res.balances || {});
      }
    } catch (e) {
      console.error('Failed to load balances:', e);
    }
  };

  const connectSocket = (sessionId) => {
    const socket = io(import.meta.env.VITE_API || 'http://localhost:5000');
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('execution:subscribe', { sessionId });
    });

    socket.on('execution:step_update', (data) => {
      if (data.sessionId === sessionId) {
        setExecSteps(prev => prev.map(s => {
          if (s.id === data.step) {
            return {
              ...s,
              status: data.status === 'running' ? 'active' : data.status,
              detail: data.data ? formatStepData(data.data) : s.detail,
            };
          }
          return s;
        }));
      }
    });

    socket.on('execution:complete', (data) => {
      if (data.sessionId === sessionId) {
        setExecStatus('completed');
        setExecResult({
          success: true,
          netProfit: data.summary?.netProfit || 0,
          finalAmount: data.summary?.finalAmount || 0,
          duration: data.summary?.duration,
        });
        loadBalances();
        loadArbExecutions();
      }
    });

    socket.on('execution:failed', (data) => {
      if (data.sessionId === sessionId) {
        setExecStatus('failed');
        setExecResult({ success: false, error: data.error });
      }
    });

    return socket;
  };

  const formatStepData = (data) => {
    if (data.filledQty && data.filledPrice) {
      return `Filled ${data.filledQty.toFixed(6)} @ $${data.filledPrice.toFixed(2)}`;
    }
    if (data.confirmations !== undefined) {
      return `${data.confirmations}/${data.totalConfirmations || '?'} confirmations`;
    }
    if (data.balance) {
      return `Balance: $${data.balance.toFixed(2)}`;
    }
    return null;
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      if (execSessionId) {
        socketRef.current.emit('execution:unsubscribe', { sessionId: execSessionId });
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const openExecutionModal = (opp, type) => {
    const steps = type === 'cross-exchange' ? [
      { id: 1, title: 'Validating', detail: 'Checking balances and permissions', status: 'pending' },
      { id: 2, title: `Buy on ${opp.buyExchange}`, detail: `Purchase ${opp.asset} at $${opp.buyPrice?.toFixed(2)}`, status: 'pending' },
      { id: 3, title: 'Transfer', detail: `${opp.buyExchange} → ${opp.sellExchange}`, status: 'pending' },
      { id: 4, title: `Sell on ${opp.sellExchange}`, detail: `Sell at $${opp.sellPrice?.toFixed(2)}`, status: 'pending' },
      { id: 5, title: 'Complete', detail: 'Trade summary', status: 'pending' },
    ] : [
      { id: 1, title: 'Validating', detail: 'Checking balance', status: 'pending' },
      { id: 2, title: 'Leg 1', detail: opp.legs?.[0]?.symbol || 'First trade', status: 'pending' },
      { id: 3, title: 'Leg 2', detail: opp.legs?.[1]?.symbol || 'Second trade', status: 'pending' },
      { id: 4, title: 'Leg 3', detail: opp.legs?.[2]?.symbol || 'Final trade', status: 'pending' },
      { id: 5, title: 'Complete', detail: 'Trade summary', status: 'pending' },
    ];

    setExecSteps(steps);
    setExecStatus('idle');
    setExecResult(null);
    setExecSessionId(null);
    setExecModal({ show: true, opportunity: opp, type });
    loadBalances();
  };

  const closeExecutionModal = () => {
    disconnectSocket();
    setExecModal({ show: false, opportunity: null, type: null });
    setExecSteps([]);
    setExecStatus('idle');
    setExecResult(null);
    setExecSessionId(null);
  };

  const executeOpportunity = async (opp, type) => {
    openExecutionModal(opp, type);
  };

  const confirmExecution = async () => {
    const { opportunity, type } = execModal;
    if (!opportunity) return;

    setExecStatus('executing');
    setExecSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'active' } : s));

    try {
      const endpoint = type === 'triangular' ? '/arbitrage/execute/triangular' : '/arbitrage/execute/cross-exchange';
      const res = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ opportunityId: opportunity.id, amount: arbConfig.maxTradeSize })
      });

      if (res.success && res.sessionId) {
        setExecSessionId(res.sessionId);
        connectSocket(res.sessionId);
      } else {
        throw new Error(res.message || 'Failed to start execution');
      }
    } catch (e) {
      setExecSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'failed' } : s));
      setExecResult({ success: false, error: e.message });
      setExecStatus('failed');
    }
  };

  const getPriceAgeStatus = (ageMs) => {
    if (!ageMs || ageMs < 3000) return { label: 'Live', color: '#4fd1c5' };
    if (ageMs < 10000) return { label: 'Delayed', color: '#ed8936' };
    return { label: 'Stale', color: '#718096' };
  };

  const startScanner = async () => {
    setArbLoading(true);
    try {
      const res = await api('/arbitrage/start', { method: 'POST' });
      if (res.success) {
        setArbStatus(prev => ({ ...prev, status: 'running' }));
      }
    } catch (e) {
      console.error('Failed to start scanner:', e);
    } finally {
      setArbLoading(false);
    }
  };

  const stopScanner = async () => {
    setArbLoading(true);
    try {
      const res = await api('/arbitrage/stop', { method: 'POST' });
      if (res.success) {
        setArbStatus(prev => ({ ...prev, status: 'stopped' }));
      }
    } catch (e) {
      console.error('Failed to stop scanner:', e);
    } finally {
      setArbLoading(false);
    }
  };

  // Power Engine Functions
  const loadPowerStatus = async () => {
    try {
      const res = await api('/arbitrage/power/status');
      if (res.success) {
        setPowerStatus(res);
      }
    } catch (e) {
      console.error('Failed to load power status:', e);
    }
  };

  const loadPowerOpportunities = async () => {
    try {
      const res = await api('/arbitrage/power/opportunities');
      if (res.success) {
        setPowerOpportunities({
          all: res.all || [],
          profitable: res.profitable || [],
          highConfidence: res.highConfidence || []
        });
      }
    } catch (e) {
      console.error('Failed to load power opportunities:', e);
    }
  };

  const loadPowerCapital = async () => {
    try {
      const res = await api('/arbitrage/power/capital');
      if (res.success) {
        setPowerCapital(res.capital);
      }
    } catch (e) {
      console.error('Failed to load power capital:', e);
    }
  };

  const loadPowerRisk = async () => {
    try {
      const res = await api('/arbitrage/power/risk');
      if (res.success) {
        setPowerRisk(res.risk);
      }
    } catch (e) {
      console.error('Failed to load power risk:', e);
    }
  };

  const startPowerEngine = async () => {
    setPowerLoading(true);
    try {
      const res = await api('/arbitrage/power/start', { method: 'POST' });
      if (res.success) {
        await loadPowerStatus();
        await loadPowerCapital();
      }
    } catch (e) {
      console.error('Failed to start power engine:', e);
    } finally {
      setPowerLoading(false);
    }
  };

  const stopPowerEngine = async () => {
    setPowerLoading(true);
    try {
      const res = await api('/arbitrage/power/stop', { method: 'POST' });
      if (res.success) {
        await loadPowerStatus();
      }
    } catch (e) {
      console.error('Failed to stop power engine:', e);
    } finally {
      setPowerLoading(false);
    }
  };

  const executePowerOpportunity = async (opportunityId, amount) => {
    setPowerLoading(true);
    try {
      const res = await api('/arbitrage/power/execute', {
        method: 'POST',
        body: JSON.stringify({ opportunityId, amount })
      });
      if (res.success) {
        alert(`Execution ${res.execution?.status}: ${res.message}`);
        await loadPowerOpportunities();
        await loadPowerCapital();
        await loadPowerRisk();
      } else {
        alert(`Execution failed: ${res.error || res.message}`);
      }
    } catch (e) {
      console.error('Failed to execute:', e);
      alert('Execution failed: ' + e.message);
    } finally {
      setPowerLoading(false);
    }
  };

  const togglePowerDryRun = async () => {
    try {
      const currentDryRun = powerStatus?.execution?.dryRun ?? true;
      const res = await api('/arbitrage/power/dry-run', {
        method: 'POST',
        body: JSON.stringify({ enabled: !currentDryRun })
      });
      if (res.success) {
        await loadPowerStatus();
      }
    } catch (e) {
      console.error('Failed to toggle dry run:', e);
    }
  };

  const unlockPowerTrading = async () => {
    try {
      const res = await api('/arbitrage/power/unlock', { method: 'POST' });
      if (res.success) {
        await loadPowerRisk();
      }
    } catch (e) {
      console.error('Failed to unlock:', e);
    }
  };

  const toggleDemoMode = async () => {
    setPowerLoading(true);
    try {
      const currentDemo = powerStatus?.demoMode ?? true;
      const res = await api('/arbitrage/power/demo', {
        method: 'POST',
        body: JSON.stringify({ enabled: !currentDemo })
      });
      if (res.success) {
        await loadPowerStatus();
        await loadPowerOpportunities();
      }
    } catch (e) {
      console.error('Failed to toggle demo mode:', e);
    } finally {
      setPowerLoading(false);
    }
  };

  // Load Power Engine data when in power mode
  useEffect(() => {
    if (powerMode && activeChip === 'arbitrage') {
      loadPowerStatus();
      loadPowerOpportunities();
      loadPowerCapital();
      loadPowerRisk();
      const interval = setInterval(() => {
        loadPowerOpportunities();
        loadPowerRisk();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [powerMode, activeChip]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadHistory = async () => {
    const res = await api('/ai/history');
    if (res.success && res.logs) setHistory(res.logs);
  };

  const sendChat = async (directMessage = null) => {
    const messageToSend = directMessage || chatInput;
    if (!messageToSend.trim() || chatLoading) return;

    const userMessage = { type: 'user', text: messageToSend };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: messageToSend, exchange })
      });

      if (res.success && res.response) {
        setChatMessages(prev => [...prev, { type: 'bot', data: res.response }]);
      } else {
        setChatMessages(prev => [...prev, { type: 'bot', data: { type: 'error', message: res.message || 'Failed to get response' } }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { type: 'bot', data: { type: 'error', message: 'Network error. Please try again.' } }]);
    }
    setChatLoading(false);
  };

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  const analyzeFromChat = (stockSymbol, stockExchange) => {
    setSymbol(stockSymbol);
    if (stockExchange) {
      setExchange(stockExchange.toLowerCase());
    }
    setActiveChip('prediction');
    setTimeout(() => runPrediction(), 100);
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const rerunHistoryItem = (item) => {
    if (item.symbol === 'MARKET_SCAN' || item.symbol === 'AI_CHAT') return;
    setSymbol(item.symbol);
    setExchange(item.exchange?.toLowerCase() || 'nasdaq');
    setActiveChip('prediction');
    setShowHistoryPanel(false);
    setTimeout(() => runPrediction(), 100);
  };

  const runPrediction = async () => {
    setLoading(true);
    setPredictionResult(null);
    setError(null);
    try {
      const res = await api('/ai/prediction', {
        method: 'POST',
        body: JSON.stringify({ symbol, exchange })
      });
      console.log('Prediction response:', res);
      if (res.success && res.analysis) {
        setPredictionResult(res.analysis);
        loadHistory();
      } else {
        setError(res.message || 'Analysis failed. Please try again.');
      }
    } catch (err) {
      console.error('Prediction error:', err);
      setError('Network error. Please check your connection.');
    }
    setLoading(false);
  };

  const runResearch = async () => {
    setLoading(true);
    setResearchResult(null);
    setError(null);
    try {
      const res = await api('/ai/research', {
        method: 'POST',
        body: JSON.stringify({ exchange, criteria: { minRSI: 20, maxRSI: 50 } })
      });
      console.log('Research response:', res);
      if (res.success && res.analysis) {
        setResearchResult(res.analysis);
        loadHistory();
      } else {
        setError(res.message || 'Research failed. Please try again.');
      }
    } catch (err) {
      console.error('Research error:', err);
      setError('Network error. Please check your connection.');
    }
    setLoading(false);
  };

  const selectSymbol = (sym) => {
    setSymbol(sym);
    setShowSearch(false);
  };

  const getDecisionColor = (decision) => {
    if (decision?.includes('STRONG_BUY')) return '#00ff88';
    if (decision?.includes('BUY')) return '#4ade80';
    if (decision?.includes('STRONG_SELL')) return '#ff4757';
    if (decision?.includes('SELL')) return '#f87171';
    return '#fbbf24';
  };

  const getDecisionBg = (decision) => {
    if (decision?.includes('BUY')) return 'linear-gradient(135deg, rgba(0, 255, 136, 0.15) 0%, rgba(0, 180, 100, 0.1) 100%)';
    if (decision?.includes('SELL')) return 'linear-gradient(135deg, rgba(255, 71, 87, 0.15) 0%, rgba(200, 50, 60, 0.1) 100%)';
    return 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(200, 150, 30, 0.1) 100%)';
  };

  const getDecisionIcon = (decision) => {
    if (decision?.includes('BUY')) return <TrendingUp size={20} />;
    if (decision?.includes('SELL')) return <TrendingDown size={20} />;
    return <Minus size={20} />;
  };

  const getRiskColor = (risk) => {
    if (risk === 'LOW') return '#00ff88';
    if (risk === 'HIGH') return '#ff4757';
    return '#fbbf24';
  };

  const formatPrice = (price) => {
    if (!price) return '$0.00';
    return `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (pct) => {
    if (!pct) return '0.00%';
    const num = Number(pct);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  return (
    <div className="ai-analysis-page">
      {/* Header */}
      <div className="ai-page-header">
        <div className="ai-header-content">
          <div className="ai-header-icon">
            <Brain size={32} />
          </div>
          <div>
            <h1>AI Trading Analysis</h1>
            <p>Powered by Google Gemini AI for intelligent market predictions</p>
          </div>
        </div>
      </div>

      {/* Chip Selector */}
      <div className="ai-chips" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <button
          className={`ai-chip ${activeChip === 'rag' ? 'active' : ''}`}
          onClick={() => setActiveChip('rag')}
        >
          <div className="chip-icon-wrap" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))', color: '#818cf8' }}>
            <Brain size={24} />
          </div>
          <div className="chip-content">
            <span className="chip-title">RAG Terminal</span>
            <span className="chip-desc">Multi-asset KB & news engine</span>
          </div>
          {activeChip === 'rag' && <CheckCircle size={18} className="chip-check" />}
        </button>

        <button
          className={`ai-chip ${activeChip === 'prediction' ? 'active' : ''}`}
          onClick={() => setActiveChip('prediction')}
        >
          <div className="chip-icon-wrap">
            <Brain size={24} />
          </div>
          <div className="chip-content">
            <span className="chip-title">AI Prediction</span>
            <span className="chip-desc">Price forecasting & signals</span>
          </div>
          {activeChip === 'prediction' && <CheckCircle size={18} className="chip-check" />}
        </button>

        <button
          className={`ai-chip ${activeChip === 'research' ? 'active' : ''}`}
          onClick={() => setActiveChip('research')}
        >
          <div className="chip-icon-wrap research">
            <FlaskConical size={24} />
          </div>
          <div className="chip-content">
            <span className="chip-title">Market R&D</span>
            <span className="chip-desc">Find buying opportunities</span>
          </div>
          {activeChip === 'research' && <CheckCircle size={18} className="chip-check" />}
        </button>

        <button
          className={`ai-chip ${activeChip === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveChip('chat')}
        >
          <div className="chip-icon-wrap chat">
            <MessageCircle size={24} />
          </div>
          <div className="chip-content">
            <span className="chip-title">AI Assistant</span>
            <span className="chip-desc">Ask about stocks & trading</span>
          </div>
          {activeChip === 'chat' && <CheckCircle size={18} className="chip-check" />}
        </button>

        <button
          className={`ai-chip ${activeChip === 'arbitrage' ? 'active' : ''}`}
          onClick={() => setActiveChip('arbitrage')}
        >
          <div className="chip-icon-wrap arbitrage">
            <Zap size={24} />
          </div>
          <div className="chip-content">
            <span className="chip-title">Arbitrage Trading</span>
            <span className="chip-desc">Cross-exchange opportunities</span>
          </div>
          {activeChip === 'arbitrage' && <CheckCircle size={18} className="chip-check" />}
        </button>
      </div>

      {/* RAG Intelligence Terminal Panel */}
      {activeChip === 'rag' && (
        <div className="ai-panel rag-panel">
          <RagTerminal />
        </div>
      )}

      {/* Prediction Panel */}
      {activeChip === 'prediction' && (
        <div className="ai-panel prediction-panel">
          {/* Controls */}
          <div className="ai-controls-card">
            <div className="controls-header">
              <Brain size={20} />
              <span>Configure Analysis</span>
            </div>

            <div className="controls-body">
              <div className="control-section">
                <label>Select Exchange</label>
                <div className="exchange-selector">
                  {EXCHANGES.map(ex => (
                    <button
                      key={ex.id}
                      className={`exchange-btn ${exchange === ex.id ? 'active' : ''}`}
                      onClick={() => {
                        setExchange(ex.id);
                        setSymbol(POPULAR_SYMBOLS[ex.id][0]);
                        setPredictionResult(null);
                      }}
                    >
                      <span className="ex-icon">{ex.icon}</span>
                      <span className="ex-name">{ex.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-section">
                <label>Select Symbol</label>
                <div className="symbol-selector">
                  <div className="symbol-input-group">
                    <Search size={18} />
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="Enter symbol..."
                      onFocus={() => setShowSearch(true)}
                      onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                    />
                  </div>
                  {showSearch && (
                    <div className="symbol-suggestions">
                      <span className="suggestions-label">Popular on {EXCHANGES.find(e => e.id === exchange)?.name}</span>
                      <div className="suggestions-list">
                        {POPULAR_SYMBOLS[exchange].map(sym => (
                          <button
                            key={sym}
                            className={`suggestion-btn ${symbol === sym ? 'active' : ''}`}
                            onMouseDown={() => selectSymbol(sym)}
                          >
                            {sym}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                className="run-analysis-btn"
                onClick={runPrediction}
                disabled={loading || !symbol}
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    <span>Analyzing with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>Run AI Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="ai-error-card">
              <AlertTriangle size={20} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <XCircle size={18} />
              </button>
            </div>
          )}

          {/* Results */}
          {predictionResult && (
            <div className="prediction-results">
              {/* AI Status */}
              <div className={`ai-powered-banner ${predictionResult.mlPowered ? 'ml' : predictionResult.aiPowered ? 'gemini' : 'technical'}`}>
                {predictionResult.mlPowered ? (
                  <>
                    <Brain size={18} />
                    <span>Prediction powered by <strong>ML Model (XGBoost)</strong></span>
                    <small style={{ marginLeft: 8, opacity: 0.8 }}>
                      {predictionResult.prediction?.mlPatterns?.length || 0} patterns detected
                    </small>
                  </>
                ) : predictionResult.aiPowered ? (
                  <>
                    <Sparkles size={18} />
                    <span>Analysis powered by <strong>Google Gemini AI</strong></span>
                  </>
                ) : (
                  <>
                    <Cpu size={18} />
                    <span>Technical Analysis Mode</span>
                    <small>Configure GEMINI_API_KEY for AI-powered insights</small>
                  </>
                )}
              </div>

              {/* Main Decision Card */}
              <div
                className="decision-hero-card"
                style={{
                  background: getDecisionBg(predictionResult.prediction?.decision),
                  borderColor: getDecisionColor(predictionResult.prediction?.decision)
                }}
              >
                <div className="hero-header">
                  <div className="hero-symbol">
                    <h2>{predictionResult.symbol}</h2>
                    <span className="hero-exchange">{predictionResult.exchange?.toUpperCase()}</span>
                  </div>
                  <div
                    className="hero-decision"
                    style={{ background: getDecisionColor(predictionResult.prediction?.decision) }}
                  >
                    {getDecisionIcon(predictionResult.prediction?.decision)}
                    <span>{predictionResult.prediction?.decision?.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="hero-price-row">
                  <div className="hero-current-price">
                    <span className="price-label">Current Price</span>
                    <span className="price-value">{formatPrice(predictionResult.currentPrice)}</span>
                  </div>
                  <div className={`hero-change ${predictionResult.dayChangePercent >= 0 ? 'positive' : 'negative'}`}>
                    {predictionResult.dayChangePercent >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    <span>{formatPercent(predictionResult.dayChangePercent)}</span>
                  </div>
                </div>

                <div className="hero-metrics">
                  <div className="metric-item">
                    <div className="metric-icon confidence">
                      <Target size={18} />
                    </div>
                    <div className="metric-content">
                      <span className="metric-label">Confidence</span>
                      <span className="metric-value">{predictionResult.prediction?.confidence || 0}%</span>
                    </div>
                    <div className="metric-bar">
                      <div
                        className="metric-fill"
                        style={{
                          width: `${predictionResult.prediction?.confidence || 0}%`,
                          background: getDecisionColor(predictionResult.prediction?.decision)
                        }}
                      />
                    </div>
                  </div>

                  <div className="metric-item">
                    <div className="metric-icon risk" style={{ background: `${getRiskColor(predictionResult.prediction?.riskLevel)}20` }}>
                      <Shield size={18} style={{ color: getRiskColor(predictionResult.prediction?.riskLevel) }} />
                    </div>
                    <div className="metric-content">
                      <span className="metric-label">Risk Level</span>
                      <span className="metric-value" style={{ color: getRiskColor(predictionResult.prediction?.riskLevel) }}>
                        {predictionResult.prediction?.riskLevel || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="metric-item">
                    <div className="metric-icon sentiment">
                      <Activity size={18} />
                    </div>
                    <div className="metric-content">
                      <span className="metric-label">Sentiment</span>
                      <span className="metric-value">{predictionResult.prediction?.sentiment || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* AI Summary */}
                {predictionResult.prediction?.summary && (
                  <div className="hero-summary">
                    <p>{predictionResult.prediction.summary}</p>
                  </div>
                )}
              </div>

              {/* Price Targets */}
              <div className="section-card">
                <div className="section-header">
                  <Target size={18} />
                  <h3>Price Targets</h3>
                </div>
                <div className="price-targets-grid">
                  {predictionResult.prediction?.predictions && Object.entries(predictionResult.prediction.predictions).map(([period, data]) => (
                    <div key={period} className="target-card">
                      <span className="target-period">
                        {period === '3d' ? '3 Days' : period === '1w' ? '1 Week' : '4 Weeks'}
                      </span>
                      <span className="target-price">{formatPrice(data?.price)}</span>
                      <span className={`target-change ${(data?.changePercent || data?.change || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {formatPercent(data?.changePercent || data?.change)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Stop Loss / Take Profit */}
                {(predictionResult.prediction?.stopLoss || predictionResult.prediction?.takeProfit) && (
                  <div className="sl-tp-row">
                    {predictionResult.prediction?.stopLoss && (
                      <div className="sl-tp-item stop-loss">
                        <span className="sl-tp-label">Stop Loss</span>
                        <span className="sl-tp-value">{formatPrice(predictionResult.prediction.stopLoss)}</span>
                      </div>
                    )}
                    {predictionResult.prediction?.takeProfit && (
                      <div className="sl-tp-item take-profit">
                        <span className="sl-tp-label">Take Profit</span>
                        <span className="sl-tp-value">{formatPrice(predictionResult.prediction.takeProfit)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Key Reasons */}
              {predictionResult.prediction?.reasoning && predictionResult.prediction.reasoning.length > 0 && (
                <div className="section-card">
                  <div className="section-header">
                    <BarChart2 size={18} />
                    <h3>Key Analysis Points</h3>
                  </div>
                  <div className="reasoning-list">
                    {predictionResult.prediction.reasoning.map((reason, idx) => (
                      <div key={idx} className="reasoning-item">
                        <div className="reasoning-number">{idx + 1}</div>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable Insight */}
              {predictionResult.prediction?.actionableInsight && (
                <div className="insight-card">
                  <div className="insight-icon">
                    <Zap size={20} />
                  </div>
                  <div className="insight-content">
                    <span className="insight-label">Actionable Insight</span>
                    <p>{predictionResult.prediction.actionableInsight}</p>
                  </div>
                </div>
              )}

              {/* Technical Indicators */}
              <div className="section-card">
                <div className="section-header">
                  <Activity size={18} />
                  <h3>Technical Indicators</h3>
                </div>
                <div className="indicators-grid">
                  <div className="indicator-card">
                    <span className="ind-name">RSI (14)</span>
                    <span className={`ind-value ${predictionResult.indicators?.rsi < 30 ? 'oversold' : predictionResult.indicators?.rsi > 70 ? 'overbought' : ''}`}>
                      {predictionResult.indicators?.rsi?.toFixed(1) || 'N/A'}
                    </span>
                    <span className="ind-signal">
                      {predictionResult.indicators?.rsi < 30 ? 'Oversold' : predictionResult.indicators?.rsi > 70 ? 'Overbought' : 'Neutral'}
                    </span>
                  </div>

                  <div className="indicator-card">
                    <span className="ind-name">MACD</span>
                    <span className={`ind-value ${predictionResult.indicators?.macd?.histogram > 0 ? 'bullish' : 'bearish'}`}>
                      {predictionResult.indicators?.macd?.histogram?.toFixed(4) || 'N/A'}
                    </span>
                    <span className="ind-signal">
                      {predictionResult.indicators?.macd?.histogram > 0 ? 'Bullish' : 'Bearish'}
                    </span>
                  </div>

                  <div className="indicator-card">
                    <span className="ind-name">EMA Cross</span>
                    <span className={`ind-value ${predictionResult.indicators?.ema?.cross === 'bullish' ? 'bullish' : 'bearish'}`}>
                      {predictionResult.indicators?.ema?.cross?.toUpperCase() || 'N/A'}
                    </span>
                    <span className="ind-signal">
                      EMA 9 vs EMA 21
                    </span>
                  </div>

                  <div className="indicator-card">
                    <span className="ind-name">Stochastic</span>
                    <span className={`ind-value ${predictionResult.indicators?.stochastic?.k < 20 ? 'oversold' : predictionResult.indicators?.stochastic?.k > 80 ? 'overbought' : ''}`}>
                      {predictionResult.indicators?.stochastic?.k?.toFixed(1) || 'N/A'}
                    </span>
                    <span className="ind-signal">
                      {predictionResult.indicators?.stochastic?.k < 20 ? 'Oversold' : predictionResult.indicators?.stochastic?.k > 80 ? 'Overbought' : 'Neutral'}
                    </span>
                  </div>

                  <div className="indicator-card">
                    <span className="ind-name">Momentum</span>
                    <span className={`ind-value ${predictionResult.indicators?.momentum > 0 ? 'bullish' : 'bearish'}`}>
                      {predictionResult.indicators?.momentum?.toFixed(2) || 'N/A'}%
                    </span>
                    <span className="ind-signal">10-day</span>
                  </div>

                  <div className="indicator-card">
                    <span className="ind-name">Volatility</span>
                    <span className="ind-value">
                      {predictionResult.indicators?.volatility?.toFixed(2) || 'N/A'}%
                    </span>
                    <span className="ind-signal">
                      {predictionResult.indicators?.volatility > 3 ? 'High' : 'Normal'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trading Signals */}
              {predictionResult.signals && predictionResult.signals.length > 0 && (
                <div className="section-card">
                  <div className="section-header">
                    <Zap size={18} />
                    <h3>Trading Signals ({predictionResult.signals.length})</h3>
                  </div>
                  <div className="signals-grid">
                    {predictionResult.signals.map((signal, idx) => (
                      <div key={idx} className={`signal-card ${signal.type}`}>
                        <div className="signal-type">
                          {signal.type === 'buy' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          <span>{signal.type.toUpperCase()}</span>
                        </div>
                        <div className="signal-info">
                          <span className="signal-indicator">{signal.indicator}</span>
                          <span className="signal-reason">{signal.reason}</span>
                        </div>
                        <Badge tone={signal.strength === 'strong' ? 'green' : 'yellow'}>
                          {signal.strength}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Research Panel */}
      {activeChip === 'research' && (
        <div className="ai-panel research-panel">
          {/* Controls */}
          <div className="ai-controls-card research">
            <div className="controls-header">
              <FlaskConical size={20} />
              <span>Market Research</span>
            </div>

            <div className="controls-body">
              <div className="control-section">
                <label>Select Market to Scan</label>
                <div className="exchange-selector">
                  {EXCHANGES.map(ex => (
                    <button
                      key={ex.id}
                      className={`exchange-btn ${exchange === ex.id ? 'active' : ''}`}
                      onClick={() => {
                        setExchange(ex.id);
                        setResearchResult(null);
                      }}
                    >
                      <span className="ex-icon">{ex.icon}</span>
                      <span className="ex-name">{ex.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="run-analysis-btn research"
                onClick={runResearch}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    <span>Scanning Market...</span>
                  </>
                ) : (
                  <>
                    <FlaskConical size={20} />
                    <span>Start Market Research</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="ai-error-card">
              <AlertTriangle size={20} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <XCircle size={18} />
              </button>
            </div>
          )}

          {/* Research Results */}
          {researchResult && (
            <div className="research-results">
              {/* AI Status */}
              <div className={`ai-powered-banner ${researchResult.aiPowered ? 'gemini' : 'technical'}`}>
                {researchResult.aiPowered ? (
                  <>
                    <Sparkles size={18} />
                    <span>Research powered by <strong>Google Gemini AI</strong></span>
                  </>
                ) : (
                  <>
                    <Cpu size={18} />
                    <span>Technical Analysis Mode</span>
                  </>
                )}
              </div>

              {/* Summary Stats */}
              <div className="research-summary-grid">
                <div className="summary-stat">
                  <Eye size={20} />
                  <div>
                    <span className="stat-value">{researchResult.summary?.totalScanned || 0}</span>
                    <span className="stat-label">Scanned</span>
                  </div>
                </div>
                <div className="summary-stat">
                  <Target size={20} />
                  <div>
                    <span className="stat-value">{researchResult.summary?.opportunities || 0}</span>
                    <span className="stat-label">Opportunities</span>
                  </div>
                </div>
                <div className="summary-stat highlight">
                  <TrendingUp size={20} />
                  <div>
                    <span className="stat-value">{researchResult.summary?.strongBuys || 0}</span>
                    <span className="stat-label">Strong Buys</span>
                  </div>
                </div>
                <div className="summary-stat">
                  <Percent size={20} />
                  <div>
                    <span className="stat-value">{researchResult.summary?.averageConfidence || 0}%</span>
                    <span className="stat-label">Avg Confidence</span>
                  </div>
                </div>
              </div>

              {/* Market Sentiment */}
              {researchResult.marketSummary && (
                <div className="market-sentiment-card">
                  <div className="sentiment-header">
                    <Activity size={18} />
                    <span>Market Sentiment: </span>
                    <Badge tone={researchResult.marketSentiment === 'BULLISH' ? 'green' : researchResult.marketSentiment === 'BEARISH' ? '' : 'yellow'}>
                      {researchResult.marketSentiment}
                    </Badge>
                  </div>
                  <p>{researchResult.marketSummary}</p>
                </div>
              )}

              {/* Top Picks */}
              {researchResult.recommendations && researchResult.recommendations.length > 0 && (
                <div className="section-card">
                  <div className="section-header">
                    <TrendingUp size={18} />
                    <h3>Top Recommendations</h3>
                  </div>
                  <div className="recommendations-list">
                    {researchResult.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className={`recommendation-card ${expandedCard === idx ? 'expanded' : ''}`}
                        onClick={() => setExpandedCard(expandedCard === idx ? null : idx)}
                      >
                        <div className="rec-main">
                          <div className="rec-rank">#{idx + 1}</div>
                          <div className="rec-symbol">
                            <strong>{rec.symbol}</strong>
                            <span>{rec.name}</span>
                          </div>
                          <div className="rec-price">{formatPrice(rec.currentPrice)}</div>
                          <div className="rec-decision">
                            <Badge tone={rec.decision?.includes('BUY') ? 'green' : 'yellow'}>
                              {rec.decision?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="rec-confidence">{rec.confidence}%</div>
                          <ChevronDown size={18} className="expand-icon" />
                        </div>
                        {expandedCard === idx && (
                          <div className="rec-details">
                            <div className="rec-detail-grid">
                              <div>
                                <span className="detail-label">RSI</span>
                                <span className="detail-value">{rec.rsi?.toFixed(1)}</span>
                              </div>
                              <div>
                                <span className="detail-label">Trend</span>
                                <span className="detail-value">{rec.trend?.trend || rec.trend}</span>
                              </div>
                              <div>
                                <span className="detail-label">3D Potential</span>
                                <span className={`detail-value ${rec.potential3d >= 0 ? 'positive' : 'negative'}`}>
                                  {formatPercent(rec.potential3d)}
                                </span>
                              </div>
                              <div>
                                <span className="detail-label">Risk</span>
                                <span className="detail-value" style={{ color: getRiskColor(rec.riskLevel) }}>
                                  {rec.riskLevel}
                                </span>
                              </div>
                            </div>
                            {rec.reasoning && (
                              <div className="rec-reasoning">
                                <p>{rec.reasoning}</p>
                              </div>
                            )}
                            <div className="rec-actions">
                              <button
                                className="rec-action-btn analyze"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveChip('prediction');
                                  setSymbol(rec.symbol);
                                }}
                              >
                                <Brain size={16} /> Analyze
                              </button>
                              <button
                                className="rec-action-btn trade"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/trading?symbol=${rec.symbol}&exchange=${exchange}`;
                                }}
                              >
                                <Activity size={16} /> Trade
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trading Tips */}
              {researchResult.tradingTips && researchResult.tradingTips.length > 0 && (
                <div className="section-card">
                  <div className="section-header">
                    <Zap size={18} />
                    <h3>AI Trading Tips</h3>
                  </div>
                  <div className="tips-list">
                    {researchResult.tradingTips.map((tip, idx) => (
                      <div key={idx} className="tip-item">
                        <div className="tip-number">{idx + 1}</div>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Chat Panel */}
      {activeChip === 'chat' && (
        <div className="ai-panel chat-panel">
          <div className="chat-container">
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-info">
                <Bot size={24} />
                <div>
                  <h3>AI Trading Assistant</h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                    Live Web Grounding & Real-Time Data Active
                  </span>
                </div>
              </div>
              <div className="chat-exchange-control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Exchange:</span>
                <select
                  className="chat-exchange-select"
                  value={exchange}
                  onChange={(e) => {
                    const newEx = e.target.value;
                    setExchange(newEx);
                    if (POPULAR_SYMBOLS[newEx]) {
                      setSymbol(POPULAR_SYMBOLS[newEx][0]);
                    }
                  }}
                  style={{
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  {EXCHANGES.map(ex => (
                    <option key={ex.id} value={ex.id} style={{ background: '#0f172a', color: '#f8fafc' }}>
                      {ex.icon} {ex.name} ({ex.type === 'crypto' ? 'Crypto' : 'Stock'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <div className="chat-welcome">
                  <div className="welcome-icon">
                    <Sparkles size={32} />
                  </div>
                  <h4>AI Trading & Market Assistant</h4>
                  <p>
                    Currently analyzing <strong>{EXCHANGES.find(e => e.id === exchange)?.name}</strong> with real-time Google Search grounding for live market data, news, prices, and analysis.
                  </p>
                  <div className="chat-suggestions">
                    <span className="suggestion-label">Try asking about {EXCHANGES.find(e => e.id === exchange)?.name}:</span>
                    <div className="suggestion-chips">
                      {EXCHANGES.find(e => e.id === exchange)?.type === 'crypto' ? (
                        <>
                          <button onClick={() => { setChatInput(`What are the top trending crypto coins on ${EXCHANGES.find(e => e.id === exchange)?.name} today?`); }}>
                            Trending on {EXCHANGES.find(e => e.id === exchange)?.name}
                          </button>
                          <button onClick={() => { setChatInput('What is the current price and market situation for Bitcoin and Ethereum?'); }}>
                            BTC & ETH Live Analysis
                          </button>
                          <button onClick={() => { setChatInput(`Best trading bot crypto pairs on ${EXCHANGES.find(e => e.id === exchange)?.name}`); }}>
                            Best Bot Trading Pairs
                          </button>
                          <button onClick={() => { setChatInput('Top altcoins with bullish breakout momentum'); }}>
                            Bullish Altcoins
                          </button>
                        </>
                      ) : ['nse', 'bse'].includes(exchange) ? (
                        <>
                          <button onClick={() => { setChatInput('Top Nifty 50 gainers and Indian market outlook today'); }}>
                            Top Indian Gainers
                          </button>
                          <button onClick={() => { setChatInput('Best dividend stocks under ₹1000 on NSE/BSE'); }}>
                            Dividend Stocks under ₹1000
                          </button>
                          <button onClick={() => { setChatInput('Reliance Industries vs TCS technical analysis'); }}>
                            Reliance vs TCS Setup
                          </button>
                          <button onClick={() => { setChatInput('Banking sector stocks outlook for this week'); }}>
                            Banking Sector Outlook
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setChatInput(`Best tech stocks to buy on ${EXCHANGES.find(e => e.id === exchange)?.name} this week`); }}>
                            Best Tech Stocks
                          </button>
                          <button onClick={() => { setChatInput('Apple & Nvidia latest earnings and stock price targets'); }}>
                            AAPL & NVDA Targets
                          </button>
                          <button onClick={() => { setChatInput('High growth AI stocks under $50'); }}>
                            AI Stocks under $50
                          </button>
                          <button onClick={() => { setChatInput('S&P 500 market trends and Fed rate expectations'); }}>
                            S&P 500 Market Trends
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.type}`}>
                  {msg.type === 'user' ? (
                    <div className="message-content user">
                      <div className="message-avatar">
                        <User size={18} />
                      </div>
                      <div className="message-bubble">
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="message-content bot">
                      <div className="message-avatar bot">
                        <Sparkles size={18} />
                      </div>
                      <div className="message-bubble bot enhanced">
                        {msg.data?.type === 'error' ? (
                          <div className="bot-error">
                            <AlertTriangle size={16} />
                            <p>{msg.data.message}</p>
                          </div>
                        ) : (
                          <>
                            {/* AI Response Header */}
                            <div className="ai-response-header">
                              <span className="ai-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Sparkles size={12} /> Gemini Live
                              </span>
                              <button
                                className="copy-response-btn"
                                onClick={() => copyToClipboard(msg.data?.message || '', idx)}
                                title="Copy response"
                              >
                                {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>

                            {/* Main Message */}
                            <div className="bot-message-content">
                              <p className="bot-message" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '14px' }}>
                                {msg.data?.message}
                              </p>
                            </div>

                            {/* Stock Recommendations - Enhanced */}
                            {msg.data?.stocks && msg.data.stocks.length > 0 && (
                              <div className="chat-stocks enhanced">
                                <div className="stocks-header">
                                  <span className="stocks-label">
                                    <TrendingUp size={16} /> Recommended Stocks
                                  </span>
                                  <span className="stocks-count">{msg.data.stocks.length} found</span>
                                </div>
                                <div className="stocks-grid enhanced">
                                  {msg.data.stocks.map((stock, sIdx) => {
                                    const currencySymbol = stock.currency === 'INR' ? '₹' : '$';
                                    const stockExchange = stock.exchange || exchange;
                                    return (
                                      <div key={sIdx} className="chat-stock-card enhanced">
                                        <div className="stock-card-header">
                                          <div className="stock-identity">
                                            <span className="stock-symbol">{stock.symbol}</span>
                                            <span className="stock-exchange-badge">{stockExchange?.toUpperCase()}</span>
                                          </div>
                                          <div className="stock-price-tag">
                                            <span className="currency">{currencySymbol}</span>
                                            <span className="price">{stock.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                          </div>
                                        </div>
                                        <div className="stock-name-row">
                                          <span className="stock-name">{stock.name}</span>
                                        </div>
                                        <div className="stock-reason-box">
                                          <p>{stock.reason}</p>
                                        </div>
                                        <div className="stock-actions">
                                          <button
                                            className="stock-action-btn primary"
                                            onClick={() => analyzeFromChat(stock.symbol, stockExchange)}
                                          >
                                            <Brain size={14} /> Deep Analysis
                                          </button>
                                          <button
                                            className="stock-action-btn secondary"
                                            onClick={() => sendChat(`Tell me more about ${stock.symbol}`)}
                                            title="Ask more about this stock"
                                          >
                                            <MessageCircle size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Tips - Enhanced */}
                            {msg.data?.tips && msg.data.tips.length > 0 && (
                              <div className="chat-tips enhanced">
                                <div className="tips-header">
                                  <Lightbulb size={16} />
                                  <span>Pro Tips</span>
                                </div>
                                <div className="tips-list">
                                  {msg.data.tips.map((tip, tIdx) => (
                                    <div key={tIdx} className="tip-item">
                                      <span className="tip-number">{tIdx + 1}</span>
                                      <span className="tip-text">{tip}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Follow Up - Enhanced */}
                            {msg.data?.followUp && (
                              <div className="chat-followup enhanced">
                                <span className="followup-label">Continue exploring:</span>
                                <button onClick={() => setChatInput(msg.data.followUp)}>
                                  <ChevronRight size={14} />
                                  {msg.data.followUp}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="chat-message bot">
                  <div className="message-content bot">
                    <div className="message-avatar bot">
                      <Bot size={18} />
                    </div>
                    <div className="message-bubble bot typing">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleChatKeyPress}
                  placeholder="Ask about stocks, trading strategies, market analysis..."
                  disabled={chatLoading}
                />
                <button
                  className="send-btn"
                  onClick={sendChat}
                  disabled={!chatInput.trim() || chatLoading}
                >
                  {chatLoading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
                </button>
              </div>
              <span className="chat-hint">Press Enter to send</span>
            </div>
          </div>
        </div>
      )}

      {/* Arbitrage Trading Panel */}
      {activeChip === 'arbitrage' && (
        <div className="ai-panel arbitrage-panel">
          <div className="arbitrage-container">
            {/* Arbitrage Header */}
            <div className="arbitrage-header">
              <div className="arbitrage-title">
                <Zap size={24} />
                <div>
                  <h2>Arbitrage Scanner</h2>
                  <p>Find price inefficiencies across exchanges and trading pairs</p>
                </div>
              </div>
              <div className="arbitrage-controls">
                {/* Power Mode Toggle */}
                <button
                  className={`scanner-btn ${powerMode ? 'active' : ''}`}
                  onClick={() => setPowerMode(!powerMode)}
                  style={{
                    background: powerMode ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#2d3748',
                    marginRight: 8
                  }}
                >
                  <Brain size={16} />
                  {powerMode ? 'Power Mode ON' : 'Power Mode'}
                </button>

                {powerMode ? (
                  // Power Engine Controls
                  <>
                    {powerStatus?.isRunning ? (
                      <button className="scanner-btn stop" onClick={stopPowerEngine} disabled={powerLoading}>
                        {powerLoading ? <Loader2 size={16} className="spin" /> : <XCircle size={16} />}
                        Stop Power Engine
                      </button>
                    ) : (
                      <button className="scanner-btn start" onClick={startPowerEngine} disabled={powerLoading}>
                        {powerLoading ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                        Start Power Engine
                      </button>
                    )}
                    <button
                      className={`scanner-btn ${powerStatus?.demoMode ? 'demo' : 'live'}`}
                      onClick={toggleDemoMode}
                      disabled={powerLoading}
                      style={{
                        marginLeft: 8,
                        background: powerStatus?.demoMode ? '#6366f1' : '#dc2626',
                      }}
                    >
                      <FlaskConical size={16} />
                      {powerStatus?.demoMode ? 'Demo Mode' : 'Live Mode'}
                    </button>
                  </>
                ) : (
                  // Standard Scanner Controls
                  arbStatus.status === 'running' ? (
                    <button className="scanner-btn stop" onClick={stopScanner} disabled={arbLoading}>
                      {arbLoading ? <Loader2 size={16} className="spin" /> : <XCircle size={16} />}
                      Stop Scanner
                    </button>
                  ) : (
                    <button className="scanner-btn start" onClick={startScanner} disabled={arbLoading}>
                      {arbLoading ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                      Start Scanner
                    </button>
                  )
                )}
                <div className={`arbitrage-status ${arbStatus.status}`}>
                  <span className={`status-dot ${arbStatus.status}`}></span>
                  <span>{arbStatus.status === 'running' ? 'Live Scanning' : 'Stopped'}</span>
                </div>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="arbitrage-mode-selector">
              <span className="mode-label">Arbitrage Mode:</span>
              <div className="mode-buttons">
                <button
                  className={`mode-btn ${arbMode === 'triangular' ? 'active' : ''}`}
                  onClick={() => changeArbMode('triangular')}
                  disabled={arbLoading}
                >
                  <Activity size={16} />
                  Triangular
                </button>
                <button
                  className={`mode-btn ${arbMode === 'cross-exchange' ? 'active' : ''}`}
                  onClick={() => changeArbMode('cross-exchange')}
                  disabled={arbLoading}
                >
                  <RefreshCw size={16} />
                  Cross-Exchange
                </button>
                <button
                  className={`mode-btn ${arbMode === 'both' ? 'active' : ''}`}
                  onClick={() => changeArbMode('both')}
                  disabled={arbLoading}
                >
                  <Zap size={16} />
                  Both
                </button>
              </div>
              <div className="mode-toggle">
                <button
                  className={`toggle-btn ${arbConfig.dryRun ? 'active' : 'live'}`}
                  onClick={toggleDryRun}
                  title={arbConfig.dryRun ? 'Dry Run Mode - No real trades' : 'LIVE MODE - Real trades!'}
                >
                  {arbConfig.dryRun ? <Eye size={14} /> : <AlertTriangle size={14} />}
                  {arbConfig.dryRun ? 'Dry Run' : 'LIVE'}
                </button>
              </div>
            </div>

            {/* Connected Exchanges */}
            <div className="connected-exchanges">
              <span className="exchanges-label">Connected Exchanges:</span>
              <div className="exchanges-list">
                {arbConnectedExchanges.length > 0 ? arbConnectedExchanges.map(ex => (
                  <span key={ex} className="exchange-badge connected">
                    <CheckCircle size={12} /> {ex.charAt(0).toUpperCase() + ex.slice(1)}
                  </span>
                )) : (
                  <span className="exchange-badge disconnected">No exchanges connected</span>
                )}
              </div>
            </div>

            {/* Scanner Stats */}
            {powerMode ? (
              /* Power Engine Stats */
              <div className="scanner-stats power-stats">
                <div className="stat-card">
                  <span className="stat-label">Engine</span>
                  <span className={`stat-value ${powerStatus?.isRunning ? 'running' : 'stopped'}`}>
                    {powerStatus?.isRunning ? 'RUNNING' : 'STOPPED'}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Capital</span>
                  <span className="stat-value">${(powerCapital?.totalUSD || 0).toFixed(2)}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">High Confidence</span>
                  <span className="stat-value highlight">{powerOpportunities.highConfidence?.length || 0}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Profitable</span>
                  <span className="stat-value">{powerOpportunities.profitable?.length || 0}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Daily P&L</span>
                  <span className={`stat-value ${(powerRisk?.dailyPnL || 0) >= 0 ? 'positive' : 'negative'}`}>
                    ${(powerRisk?.dailyPnL || 0).toFixed(2)}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Win Rate</span>
                  <span className="stat-value">{(powerRisk?.winRate || 0).toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              /* Standard Scanner Stats */
              <div className="scanner-stats">
                <div className="stat-card">
                  <span className="stat-label">Status</span>
                  <span className={`stat-value ${arbStatus.status}`}>{arbStatus.status?.toUpperCase()}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Mode</span>
                  <span className="stat-value">{arbMode?.replace('-', ' ').toUpperCase()}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Triangular Opps</span>
                  <span className="stat-value highlight">{arbOpportunities.length || 0}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Cross-Exchange Opps</span>
                  <span className="stat-value highlight">{arbCrossOpportunities.length || 0}</span>
                </div>
              </div>
            )}

            {/* Risk Alert for Power Mode */}
            {powerMode && powerRisk?.isLocked && (
              <div className="risk-alert">
                <AlertTriangle size={20} />
                <span>Trading Locked: {powerRisk.lockReason}</span>
                <button onClick={unlockPowerTrading}>Unlock</button>
              </div>
            )}

            {/* Power Engine Opportunities */}
            {powerMode && (
              <div className="arbitrage-opportunities power-opportunities">
                <div className="opportunities-header">
                  <h3><Brain size={18} /> Power Engine Opportunities</h3>
                  <div className="header-controls">
                    <button
                      className={`toggle-btn ${powerStatus?.execution?.dryRun !== false ? 'active' : 'live'}`}
                      onClick={togglePowerDryRun}
                      style={{ marginRight: 8 }}
                    >
                      {powerStatus?.execution?.dryRun !== false ? <Eye size={14} /> : <AlertTriangle size={14} />}
                      {powerStatus?.execution?.dryRun !== false ? 'Dry Run' : 'LIVE'}
                    </button>
                    <span className="opp-count">
                      {powerOpportunities.highConfidence?.length || 0} high confidence
                    </span>
                  </div>
                </div>

                <div className="opportunities-list">
                  {powerOpportunities.highConfidence?.length === 0 && powerOpportunities.profitable?.length === 0 ? (
                    <div className="no-opportunities clean">
                      {powerStatus?.isRunning ? (
                        <>
                          <div className="scanning-indicator">
                            <Brain size={24} className="pulse" />
                          </div>
                          <p>Power Engine scanning for opportunities...</p>
                          <small>Looking for high-confidence arbitrage</small>
                        </>
                      ) : (
                        <>
                          <div className="start-indicator">
                            <Zap size={24} />
                          </div>
                          <p>Click "Start Power Engine" to begin</p>
                          <small>Simultaneous execution with risk management</small>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* High Confidence Opportunities */}
                      {powerOpportunities.highConfidence?.map((opp, idx) => (
                        <div key={opp.id || idx} className="opportunity-card cross profitable high-confidence">
                          <div className="opp-header">
                            <div className="opp-asset">
                              <div className="asset-icon" style={{ background: '#22c55e' }}>{opp.asset?.slice(0, 2)}</div>
                              {opp.symbol || `${opp.asset}/USDT`}
                            </div>
                            <div className="opp-badges">
                              <span className="confidence-badge high">
                                <Star size={10} /> HIGH
                              </span>
                              <span className="score-badge">
                                Score: {opp.score?.total || 0}
                              </span>
                            </div>
                            <div className="profit-indicator positive">
                              <TrendingUp size={14} />
                              +{opp.netProfitPercent?.toFixed(3)}%
                            </div>
                          </div>

                          <div className="opp-route">
                            <div className="route-exchange buy">
                              <span className="route-action">Buy on</span>
                              <span className="route-name">{opp.buyExchange}</span>
                              <span className="route-price">${opp.buyPrice?.toFixed(6)}</span>
                            </div>
                            <div className="route-arrow-container">
                              <div className="route-arrow">
                                <ChevronRight size={16} />
                              </div>
                            </div>
                            <div className="route-exchange sell">
                              <span className="route-action">Sell on</span>
                              <span className="route-name">{opp.sellExchange}</span>
                              <span className="route-price">${opp.sellPrice?.toFixed(6)}</span>
                            </div>
                          </div>

                          <div className="opp-metrics">
                            <div className="metric">
                              <span className="metric-label">Spread</span>
                              <span className="metric-value">{opp.spreadPercent?.toFixed(4)}%</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Net Profit</span>
                              <span className="metric-value positive">${opp.netProfitUSDT?.toFixed(4)}</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Confidence</span>
                              <span className="metric-value">{opp.confidence}</span>
                            </div>
                          </div>

                          <div className="opp-footer">
                            <small style={{ color: '#9ca3af' }}>{opp.executionRecommendation}</small>
                            <button
                              className="execute-btn"
                              onClick={() => executePowerOpportunity(opp.id, 100)}
                              disabled={powerLoading}
                            >
                              {powerLoading ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
                              Execute ${opp.tradeSize || 100}
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Profitable (non-high-confidence) */}
                      {powerOpportunities.profitable?.filter(o => o.confidence !== 'high').slice(0, 5).map((opp, idx) => (
                        <div key={opp.id || idx} className="opportunity-card cross profitable">
                          <div className="opp-header">
                            <div className="opp-asset">
                              <div className="asset-icon">{opp.asset?.slice(0, 2)}</div>
                              {opp.symbol || `${opp.asset}/USDT`}
                            </div>
                            <div className="opp-badges">
                              <span className={`confidence-badge ${opp.confidence}`}>
                                {opp.confidence?.toUpperCase()}
                              </span>
                            </div>
                            <div className="profit-indicator positive">
                              +{opp.netProfitPercent?.toFixed(3)}%
                            </div>
                          </div>
                          <div className="opp-route">
                            <span>{opp.buyExchange} → {opp.sellExchange}</span>
                          </div>
                          <div className="opp-footer">
                            <small>${opp.netProfitUSDT?.toFixed(4)} profit on ${opp.tradeSize}</small>
                            <button
                              className="execute-btn secondary"
                              onClick={() => executePowerOpportunity(opp.id, 100)}
                              disabled={powerLoading}
                            >
                              Execute
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Cross-Exchange Opportunities (Standard Mode) */}
            {!powerMode && (arbMode === 'cross-exchange' || arbMode === 'both') && (
              <div className="arbitrage-opportunities cross-exchange">
                <div className="opportunities-header">
                  <h3><RefreshCw size={18} /> Cross-Exchange Opportunities</h3>
                  <div className="header-controls">
                    <label className="debug-toggle">
                      <input
                        type="checkbox"
                        checked={showAllOpps}
                        onChange={(e) => setShowAllOpps(e.target.checked)}
                      />
                      <span>Show All (Debug)</span>
                    </label>
                    <span className="opp-count">{arbCrossOpportunities.length} found</span>
                  </div>
                </div>

                <div className="opportunities-list">
                  {arbCrossOpportunities.length === 0 ? (
                    <div className="no-opportunities clean">
                      {arbStatus.status === 'running' ? (
                        <>
                          <div className="scanning-indicator">
                            <Activity size={24} className="pulse" />
                          </div>
                          <p>Analyzing price differences across exchanges...</p>
                          <small>Binance • Bybit • Kraken</small>
                        </>
                      ) : (
                        <>
                          <div className="start-indicator">
                            <Zap size={24} />
                          </div>
                          <p>Click "Start Scanner" to find opportunities</p>
                          <small>Automatically finds the best buy/sell routes</small>
                        </>
                      )}
                    </div>
                  ) : (
                    arbCrossOpportunities.slice(0, 10).map((opp, idx) => (
                      <div key={opp.id || idx} className={`opportunity-card cross ${opp.profitable ? 'profitable' : ''} ${!opp.liquidityOk ? 'low-liquidity' : ''}`}>
                        <div className="opp-header">
                          <div className="opp-asset">
                            <div className="asset-icon">{opp.asset?.slice(0, 2)}</div>
                            {opp.asset}/USDT
                          </div>
                          <div className="opp-badges">
                            {(() => {
                              const priceAge = getPriceAgeStatus(opp.priceAge?.maxAgeMs);
                              return (
                                <span className="price-age-badge" style={{ background: priceAge.color }}>
                                  <Radio size={10} />
                                  {priceAge.label}
                                </span>
                              );
                            })()}
                            {opp.liquidityOk === false && (
                              <span className="liquidity-badge warning">
                                <CircleDot size={10} />
                                Low Liq
                              </span>
                            )}
                          </div>
                          <div className={`profit-indicator ${opp.netProfitPercent > 0 ? 'positive' : 'negative'}`}>
                            {opp.netProfitPercent > 0 ? <TrendingUp size={14} /> : <Minus size={14} />}
                            {opp.netProfitPercent > 0 ? '+' : ''}{opp.netProfitPercent?.toFixed(3)}%
                          </div>
                        </div>

                        <div className="opp-route">
                          <div className="route-exchange buy">
                            <span className="route-action">Buy on</span>
                            <span className="route-name">{opp.buyExchange}</span>
                            <span className="route-price">${opp.buyPrice?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                          <div className="route-arrow-container">
                            <div className="route-arrow">
                              <ChevronRight size={16} />
                            </div>
                          </div>
                          <div className="route-exchange sell">
                            <span className="route-action">Sell on</span>
                            <span className="route-name">{opp.sellExchange}</span>
                            <span className="route-price">${opp.sellPrice?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                        </div>

                        <div className="opp-metrics">
                          <div className="metric">
                            <span className="metric-label">Spread</span>
                            <span className="metric-value">{opp.spreadPercent?.toFixed(3)}%</span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Fees</span>
                            <span className="metric-value">
                              ${(opp.fees?.totalFeeUSDT || (opp.tradingFees + opp.withdrawalFee))?.toFixed(2)}
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Net Profit</span>
                            <span className={`metric-value ${(opp.netProfitUSDT || opp.netProfit) > 0 ? 'positive' : 'negative'}`}>
                              ${(opp.netProfitUSDT || opp.netProfit)?.toFixed(2)}
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Trade Size</span>
                            <span className="metric-value">${opp.tradeSize || 100}</span>
                          </div>
                        </div>

                        <div className="opp-footer">
                          <div className="opp-status">
                            <span className={`status-dot ${opp.priceAge?.maxAgeMs < 3000 ? 'live' : opp.priceAge?.maxAgeMs < 10000 ? 'delayed' : 'stale'}`}></span>
                            {new Date(opp.timestamp).toLocaleTimeString()}
                          </div>
                          <button
                            className={`execute-btn ${!opp.profitable || !opp.liquidityOk ? 'not-profitable' : ''}`}
                            onClick={() => executeOpportunity(opp, 'cross-exchange')}
                            disabled={!opp.profitable || !opp.liquidityOk}
                          >
                            {opp.profitable && opp.liquidityOk ? (
                              <>
                                <Zap size={14} />
                                {arbConfig.dryRun ? 'Simulate' : 'Execute'}
                              </>
                            ) : !opp.liquidityOk ? 'Low Liquidity' : 'Spread Too Low'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Triangular Opportunities */}
            {(arbMode === 'triangular' || arbMode === 'both') && (
              <div className="arbitrage-opportunities triangular">
                <div className="opportunities-header">
                  <h3><Target size={18} /> Triangular Opportunities</h3>
                  <button className="refresh-btn" onClick={loadArbOpportunities}>
                    <RefreshCw size={16} className={arbLoading ? 'spin' : ''} />
                  </button>
                </div>

                <div className="opportunities-list">
                  {arbOpportunities.length === 0 ? (
                    <div className="no-opportunities">
                      {arbStatus.status === 'running' ? (
                        <>
                          <Loader2 size={32} className="spin" />
                          <p>Scanning for profitable arbitrage cycles...</p>
                          <small>Triangular paths: USDT → X → Y → USDT</small>
                        </>
                      ) : (
                        <>
                          <Target size={32} />
                          <p>Start the scanner to find triangular opportunities</p>
                        </>
                      )}
                    </div>
                  ) : (
                    arbOpportunities.slice(0, 10).map((opp, idx) => (
                      <div key={opp.id || idx} className={`opportunity-card ${opp.profitable ? 'profitable' : ''}`}>
                        <div className="opp-pair">
                          <span className="opp-symbol">{opp.assets?.join(' → ') || opp.symbol}</span>
                          <Badge tone={opp.netProfitPercent > 0.1 ? 'green' : 'yellow'} small>
                            {opp.netProfitPercent > 0 ? '+' : ''}{opp.netProfitPercent?.toFixed(3)}%
                          </Badge>
                        </div>
                        <div className="opp-legs">
                          {opp.legs?.slice(0, 3).map((leg, i) => (
                            <div key={i} className="leg-item">
                              <span className="leg-direction">{leg.direction?.toUpperCase()}</span>
                              <span className="leg-symbol">{leg.symbol}</span>
                              <span className="leg-price">${leg.price?.toFixed(6)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="opp-profit">
                          <div className="profit-details">
                            <span>Gross: <strong>{opp.spreadPercent?.toFixed(4)}%</strong></span>
                            <span>Net: <strong className={opp.netProfitPercent > 0 ? 'gain' : 'loss'}>
                              {opp.netProfitPercent?.toFixed(4)}%
                            </strong></span>
                          </div>
                          <button
                            className="execute-btn"
                            onClick={() => executeOpportunity(opp, 'triangular')}
                            disabled={!opp.profitable}
                          >
                            {opp.profitable ? (arbConfig.dryRun ? 'Simulate' : 'Execute') : 'Low Profit'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Arbitrage Settings */}
            <div className="arbitrage-settings">
              <h3><Shield size={18} /> Scanner Settings</h3>
              <div className="settings-grid">
                <div className="setting-item">
                  <label>Min Profit %</label>
                  <input
                    type="number"
                    value={arbConfig.minSpread}
                    onChange={(e) => setArbConfig(prev => ({...prev, minSpread: parseFloat(e.target.value)}))}
                    step="0.05"
                    min="-1"
                  />
                </div>
                <div className="setting-item">
                  <label>Max Trade Size (USDT)</label>
                  <input
                    type="number"
                    value={arbConfig.maxTradeSize}
                    onChange={(e) => setArbConfig(prev => ({...prev, maxTradeSize: parseInt(e.target.value)}))}
                    step="50"
                    min="10"
                  />
                </div>
                <div className="setting-item">
                  <label>Trading Fee (%)</label>
                  <input type="number" defaultValue="0.1" step="0.01" min="0" />
                </div>
                <div className="setting-item">
                  <label>Execution Mode</label>
                  <select value={arbConfig.dryRun ? 'dry' : 'live'} onChange={(e) => toggleDryRun()}>
                    <option value="dry">Dry Run (Simulation)</option>
                    <option value="live">Live Trading</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="arbitrage-info">
              <h3><Lightbulb size={18} /> How Arbitrage Works</h3>
              <div className="info-grid">
                <div className="info-card">
                  <h4>Triangular Arbitrage</h4>
                  <p>Exploits price differences between three trading pairs on the <strong>same exchange</strong>.</p>
                  <code>USDT → BTC → ETH → USDT</code>
                </div>
                <div className="info-card">
                  <h4>Cross-Exchange Arbitrage</h4>
                  <p>Buy an asset on one exchange where it's <strong>cheaper</strong>, transfer it, and sell on another where it's <strong>more expensive</strong>.</p>
                  <code>Buy BTC @Binance → Transfer → Sell @Kraken</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Floating Chip */}
      {history.length > 0 && (
        <button
          className="history-fab"
          onClick={() => setShowHistoryPanel(true)}
        >
          <History size={20} />
          <span>History</span>
          <span className="history-count">{history.length}</span>
        </button>
      )}

      {/* Floating History Panel */}
      <div className={`history-slide-panel ${showHistoryPanel ? 'open' : ''}`}>
        <div className="history-panel-header">
          <div className="history-panel-title">
            <History size={20} />
            <h3>Recent Analyses</h3>
          </div>
          <button className="history-close-btn" onClick={() => setShowHistoryPanel(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="history-panel-content">
          {history.map((log, idx) => (
            <div
              key={idx}
              className={`history-panel-item ${log.symbol === 'AI_CHAT' ? 'chat' : log.symbol === 'MARKET_SCAN' ? 'scan' : ''}`}
              onClick={() => rerunHistoryItem(log)}
            >
              <div className="history-item-icon">
                {log.symbol === 'AI_CHAT' ? <MessageCircle size={18} /> :
                 log.symbol === 'MARKET_SCAN' ? <FlaskConical size={18} /> :
                 <Brain size={18} />}
              </div>
              <div className="history-item-content">
                <div className="history-item-top">
                  <span className="history-item-symbol">{log.symbol}</span>
                  <span className="history-item-exchange">{log.exchange?.toUpperCase()}</span>
                </div>
                <div className="history-item-bottom">
                  <span className={`history-item-decision ${log.decision?.includes('BUY') ? 'buy' : log.decision?.includes('SELL') ? 'sell' : ''}`}>
                    {log.decision}
                  </span>
                  <span className="history-item-date">
                    {new Date(log.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {log.symbol !== 'AI_CHAT' && log.symbol !== 'MARKET_SCAN' && (
                <ChevronRight size={16} className="history-item-arrow" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Overlay */}
      {showHistoryPanel && (
        <div className="history-overlay" onClick={() => setShowHistoryPanel(false)} />
      )}

      {/* Execution Modal */}
      {execModal.show && (
        <div className="execution-modal-overlay" onClick={closeExecutionModal}>
          <div className="execution-modal" onClick={e => e.stopPropagation()}>
            <div className="execution-modal-header">
              <h3>
                <Zap size={20} />
                {execStatus === 'idle' ? 'Confirm Trade Execution' :
                 execStatus === 'executing' ? 'Executing Trade...' :
                 execStatus === 'completed' ? 'Trade Completed' : 'Trade Failed'}
              </h3>
              <button className="close-btn" onClick={closeExecutionModal}>
                <X size={18} />
              </button>
            </div>

            <div className="execution-modal-body">
              {/* Live Warning */}
              {!arbConfig.dryRun && execStatus === 'idle' && (
                <div className="live-warning">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Live Trading Mode</strong>
                    <p style={{ margin: '4px 0 0', opacity: 0.9 }}>
                      Real funds will be used. This action cannot be undone.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="execution-summary">
                <div className="asset-info">
                  <div className="asset-icon">
                    {execModal.opportunity?.asset?.slice(0, 2) || '??'}
                  </div>
                  <div>
                    <div className="asset-name">{execModal.opportunity?.asset}/USDT</div>
                    <div style={{ fontSize: 12, color: '#718096' }}>
                      {execModal.type === 'cross-exchange'
                        ? `${execModal.opportunity?.buyExchange} → ${execModal.opportunity?.sellExchange}`
                        : 'Triangular Arbitrage'}
                    </div>
                  </div>
                </div>
                <div className="expected-profit">
                  <div className="profit-label">Expected Profit</div>
                  <div className="profit-value">
                    {execModal.opportunity?.netProfitPercent > 0 ? '+' : ''}
                    {execModal.opportunity?.netProfitPercent?.toFixed(3)}%
                  </div>
                </div>
              </div>

              {/* Execution Steps */}
              <div className="execution-steps">
                {execSteps.map((step, idx) => (
                  <div key={step.id} className={`execution-step ${step.status}`}>
                    <div className="step-number">
                      {step.status === 'completed' ? <Check size={16} /> :
                       step.status === 'active' ? <Loader2 size={16} className="spin" /> : idx + 1}
                    </div>
                    <div className="step-content">
                      <div className="step-title">{step.title}</div>
                      <div className="step-detail">{step.detail}</div>
                    </div>
                    <div className={`step-status ${step.status}`}>
                      {step.status === 'pending' && 'Pending'}
                      {step.status === 'active' && 'Processing...'}
                      {step.status === 'completed' && 'Done'}
                      {step.status === 'failed' && 'Failed'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Result */}
              {execStatus === 'completed' && execResult?.success && (
                <div className="execution-result">
                  <div className="result-label">Net Profit</div>
                  <div className="result-value">
                    +${execResult.netProfit?.toFixed(2) || '0.00'}
                  </div>
                </div>
              )}

              {execStatus === 'failed' && (
                <div className="execution-result failed">
                  <div className="result-label">Error</div>
                  <div className="result-value" style={{ fontSize: 16 }}>
                    {execResult?.error || 'Execution failed'}
                  </div>
                </div>
              )}

              {/* Updated Balances */}
              {execStatus === 'completed' && Object.keys(arbBalances).length > 0 && (
                <div className="updated-balances">
                  <div className="balances-header">Updated Balances</div>
                  {Object.entries(arbBalances).map(([exchange, balances]) => {
                    const usdtBalance = balances?.find?.(b => b.asset === 'USDT');
                    if (!usdtBalance) return null;
                    return (
                      <div key={exchange} className="balance-row">
                        <span className="balance-exchange">{exchange}</span>
                        <span className="balance-amount">
                          ${usdtBalance.free?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="execution-actions">
                {execStatus === 'idle' && (
                  <>
                    <button className="btn-cancel" onClick={closeExecutionModal}>
                      Cancel
                    </button>
                    <button className="btn-execute" onClick={confirmExecution}>
                      <Zap size={16} />
                      Execute Trade
                    </button>
                  </>
                )}
                {execStatus === 'executing' && (
                  <button className="btn-execute" disabled style={{ flex: 1 }}>
                    <Loader2 size={16} className="spin" />
                    Executing...
                  </button>
                )}
                {(execStatus === 'completed' || execStatus === 'failed') && (
                  <button className="btn-close" onClick={closeExecutionModal} style={{ flex: 1 }}>
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
