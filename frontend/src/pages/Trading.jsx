import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, FlaskConical, TrendingUp, TrendingDown, RefreshCw,
  Search, Wallet, X, Clock, Activity, BarChart2,
  Target, XCircle, CheckCircle, Link2, Star, ArrowUpRight, ArrowDownRight,
  Plus, Minus, Eye, ExternalLink, Zap, KeyRound
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api, errorMessage } from '../api.js';
import Badge from '../components/Badge.jsx';
import InfoLabel from '../components/InfoLabel.jsx';

export default function Trading() {
  // Trading state
  const [mode, setMode] = useState('paper');
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [exchangeName, setExchangeName] = useState('NSE');
  const [symbol, setSymbol] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');

  // Data state
  const [session, setSession] = useState(null);
  const [connections, setConnections] = useState([]);
  const [quote, setQuote] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartInterval, setChartInterval] = useState('1h');
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState([]);
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [watchlist, setWatchlist] = useState([]);

  // UI state
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [activeTab, setActiveTab] = useState('chart');

  // Broker status
  const [brokerStatus, setBrokerStatus] = useState({});
  const [selectedIndianBroker, setSelectedIndianBroker] = useState('AngelOne'); // 'AngelOne' | 'Upstox'
  
  // Angel One State
  const [angeloneStatus, setAngeloneStatus] = useState({ configured: false, authenticated: false });
  const [angeloneFunds, setAngeloneFunds] = useState({ net: 0, availableCash: 0, collateral: 0, utilizedMargin: 0 });
  const [angelonePositions, setAngelonePositions] = useState([]);
  const [angeloneHoldings, setAngeloneHoldings] = useState([]);
  const [showAngelConnectModal, setShowAngelConnectModal] = useState(false);
  const [connectingAngel, setConnectingAngel] = useState(false);
  const [angelForm, setAngelForm] = useState({
    apiKey: 'AThErGZk',
    clientCode: '',
    password: '',
    totpSecret: '',
    totp: ''
  });

  // Upstox State
  const [upstoxStatus, setUpstoxStatus] = useState({ configured: false, authenticated: false, tokenExpired: false });
  const [upstoxFunds, setUpstoxFunds] = useState(null);
  const [upstoxPositions, setUpstoxPositions] = useState([]);
  const [upstoxHoldings, setUpstoxHoldings] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Pionex State
  const [pionexStatus, setPionexStatus] = useState({ configured: false, authenticated: false });
  const [pionexFunds, setPionexFunds] = useState(null);
  const [showPionexConnectModal, setShowPionexConnectModal] = useState(false);
  const [connectingPionex, setConnectingPionex] = useState(false);
  const [pionexForm, setPionexForm] = useState({
    apiKey: '',
    apiSecret: '',
    paperMode: false
  });

  // CoinDCX State
  const [coindcxStatus, setCoindcxStatus] = useState({ configured: false, authenticated: false });
  const [coindcxFunds, setCoindcxFunds] = useState(null);
  const [showCoindcxConnectModal, setShowCoindcxConnectModal] = useState(false);
  const [connectingCoindcx, setConnectingCoindcx] = useState(false);
  const [coindcxForm, setCoindcxForm] = useState({
    apiKey: '',
    apiSecret: '',
    paperMode: false
  });

  // Order confirmation modal
  const [showOrderConfirm, setShowOrderConfirm] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);

  // Supported exchanges (Only real exchanges, NOT brokers)
  const exchanges = [
    { name: 'NSE', type: 'stock', currency: 'INR', description: 'National Stock Exchange of India' },
    { name: 'BSE', type: 'stock', currency: 'INR', description: 'Bombay Stock Exchange' },
    { name: 'NASDAQ', type: 'stock', currency: 'USD', broker: 'Alpaca' },
    { name: 'NYSE', type: 'stock', currency: 'USD', broker: 'Alpaca' },
    { name: 'Binance', type: 'crypto', currency: 'USD', broker: 'Binance' },
    { name: 'Bybit', type: 'crypto', currency: 'USD', broker: 'Bybit' },
    { name: 'CoinDCX', type: 'crypto', currency: 'USD', broker: 'CoinDCX' },
    { name: 'Pionex', type: 'crypto', currency: 'USD', broker: 'Pionex' },
    { name: 'Kraken', type: 'crypto', currency: 'USD', broker: 'Kraken' },
    { name: 'Jupiter', type: 'dex', currency: 'USD', broker: 'Jupiter' }
  ];

  const currentExchange = exchanges.find(e => e.name === exchangeName) || exchanges[0];
  const isIndianExchange = ['NSE', 'BSE'].includes(exchangeName);
  const isPionexExchange = exchangeName.toLowerCase() === 'pionex';
  const isCoindcxExchange = exchangeName.toLowerCase() === 'coindcx';
  const currencySymbol = isIndianExchange ? '₹' : '$';

  const isAngelConnected = !!(angeloneStatus.authenticated || angeloneStatus.configured);
  const isUpstoxConnected = !!upstoxStatus.authenticated;
  const isPionexConnected = !!(pionexStatus.authenticated || pionexStatus.configured || brokerStatus.pionex?.connected);
  const isCoindcxConnected = !!(coindcxStatus.authenticated || coindcxStatus.configured || brokerStatus.coindcx?.connected);
  const isSelectedIndianBrokerConnected = isIndianExchange && (
    (selectedIndianBroker === 'AngelOne' && isAngelConnected) ||
    (selectedIndianBroker === 'Upstox' && isUpstoxConnected)
  );

  function isLiveBrokerConnected(exchange) {
    const ex = exchanges.find(e => e.name === exchange);
    if (!ex) return false;
    if (['NSE', 'BSE'].includes(exchange)) {
      return isSelectedIndianBrokerConnected || isAngelConnected || isUpstoxConnected;
    }
    if (exchange.toLowerCase() === 'pionex') {
      return isPionexConnected;
    }
    if (exchange.toLowerCase() === 'coindcx') {
      return isCoindcxConnected;
    }
    const broker = (ex.broker || ex.name).toLowerCase();
    if (broker === 'alpaca') {
      return !!brokerStatus.alpaca?.connected && !brokerStatus.alpaca?.paperMode;
    }
    if (broker === 'jupiter') {
      return !!brokerStatus.jupiterConfigured || !!brokerStatus.jupiter?.connected;
    }
    return !!brokerStatus[broker]?.connected;
  }

  const currentBrokerConnected = isLiveBrokerConnected(exchangeName);

  // Load initial data
  useEffect(() => {
    loadConnections();
    loadBrokerStatus();
    loadAngelOneStatus();
    loadUpstoxStatus();
    loadPionexStatus();
    loadCoindcxStatus();
    loadWallet();
    loadPositions();
    loadOpenOrders();
    loadWatchlist();

    // Check for Upstox callback results
    if (searchParams.get('upstox_connected') === 'true') {
      setMessage({ text: 'Successfully connected to Upstox! NSE/BSE live trading is now available.', type: 'success' });
      setSearchParams({});
      setSelectedIndianBroker('Upstox');
      loadUpstoxStatus();
    } else if (searchParams.get('upstox_error')) {
      setMessage({ text: `Upstox connection failed: ${searchParams.get('upstox_error')}`, type: 'error' });
      setSearchParams({});
    }
  }, []);

  // Auto-switch to connected broker if available
  useEffect(() => {
    if (isAngelConnected && !isUpstoxConnected) {
      setSelectedIndianBroker('AngelOne');
    } else if (!isAngelConnected && isUpstoxConnected) {
      setSelectedIndianBroker('Upstox');
    }
  }, [angeloneStatus.authenticated, angeloneStatus.configured, upstoxStatus.authenticated]);

  // Load Upstox data when authenticated
  useEffect(() => {
    if (upstoxStatus.authenticated) {
      loadUpstoxFunds();
      loadUpstoxPositions();
      loadUpstoxHoldings();
    }
  }, [upstoxStatus.authenticated]);

  // Load Angel One data when authenticated or configured
  useEffect(() => {
    if (angeloneStatus.authenticated || angeloneStatus.configured) {
      loadAngelOneFunds();
      loadAngelOnePositions();
      loadAngelOneHoldings();
    }
  }, [angeloneStatus.authenticated, angeloneStatus.configured]);

  // Load Pionex data when authenticated or configured
  useEffect(() => {
    if (pionexStatus.authenticated || pionexStatus.configured) {
      loadPionexFunds();
    }
  }, [pionexStatus.authenticated, pionexStatus.configured]);

  // Load CoinDCX data when authenticated or configured
  useEffect(() => {
    if (coindcxStatus.authenticated || coindcxStatus.configured) {
      loadCoindcxFunds();
    }
  }, [coindcxStatus.authenticated, coindcxStatus.configured]);

  // Load quote when symbol changes
  useEffect(() => {
    if (symbol) {
      loadQuote();
      loadChart();
      loadOrderBook();
      loadRecentTrades();
    }
  }, [symbol, exchangeName]);

  // Reload chart when interval changes
  useEffect(() => {
    if (symbol) {
      loadChart();
    }
  }, [chartInterval]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 1) {
        searchSymbols();
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, exchangeName]);

  // Auto-refresh
  useEffect(() => {
    if (!symbol) return;
    const interval = setInterval(() => {
      loadQuote();
      loadOrderBook();
      loadRecentTrades();
    }, 10000);
    return () => clearInterval(interval);
  }, [symbol, exchangeName]);

  async function loadConnections() {
    try {
      const response = await api.get('/api/exchanges/connected');
      setConnections(response.data.exchanges);
    } catch {
      setConnections([]);
    }
  }

  async function loadBrokerStatus() {
    try {
      const response = await api.get('/api/broker/status');
      const status = {};
      response.data.connectedBrokers?.forEach(b => {
        status[b.exchange.toLowerCase()] = { connected: true, paperMode: b.paperMode };
      });
      if (response.data.upstoxAuthenticated) {
        status.upstox = { connected: true };
      }
      if (response.data.angeloneAuthenticated || response.data.angeloneConfigured) {
        status.angelone = { connected: true };
      }
      try {
        const alpacaRes = await api.get('/api/broker/alpaca/status');
        if (alpacaRes.data.configured) {
          status.alpaca = { connected: true, paperMode: alpacaRes.data.paperMode };
        }
      } catch {}
      setBrokerStatus(status);
    } catch {
      setBrokerStatus({});
    }
  }

  // ============ ANGEL ONE METHODS ============
  async function loadAngelOneStatus() {
    try {
      const response = await api.get('/api/broker/angelone/status');
      setAngeloneStatus({
        configured: !!response.data.configured,
        authenticated: !!response.data.authenticated,
        source: response.data.source
      });
      if (response.data.authenticated || response.data.configured) {
        loadAngelOneFunds();
        loadAngelOneHoldings();
        loadAngelOnePositions();
      }
    } catch {
      setAngeloneStatus({ configured: false, authenticated: false });
    }
  }

  async function loadAngelOneFunds() {
    try {
      const response = await api.get('/api/angelone/funds');
      setAngeloneFunds(response.data.funds || { net: 0, availableCash: 0, collateral: 0, utilizedMargin: 0 });
    } catch (err) {
      console.error('Failed to load Angel One funds:', err);
    }
  }

  async function loadAngelOneHoldings() {
    try {
      const response = await api.get('/api/angelone/holdings');
      setAngeloneHoldings(response.data.holdings || []);
    } catch (err) {
      console.error('Failed to load Angel One holdings:', err);
    }
  }

  async function loadAngelOnePositions() {
    try {
      const response = await api.get('/api/angelone/positions');
      setAngelonePositions(response.data.positions || []);
    } catch (err) {
      console.error('Failed to load Angel One positions:', err);
    }
  }

  async function handleConnectAngelOne(e) {
    e.preventDefault();
    setConnectingAngel(true);
    setMessage({ text: '', type: '' });
    try {
      const payload = {
        exchange: 'AngelOne',
        apiKey: angelForm.apiKey,
        clientCode: angelForm.clientCode,
        password: angelForm.password,
        totpSecret: angelForm.totpSecret,
        totp: angelForm.totp
      };
      await api.post('/api/broker/connect', payload);
      setMessage({ text: 'Angel One SmartAPI connected successfully!', type: 'success' });
      setShowAngelConnectModal(false);
      setSelectedIndianBroker('AngelOne');
      loadAngelOneStatus();
      loadBrokerStatus();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    } finally {
      setConnectingAngel(false);
    }
  }

  async function disconnectAngelOne() {
    try {
      await api.delete('/api/broker/disconnect/AngelOne');
      setAngeloneStatus({ configured: false, authenticated: false });
      setAngeloneFunds({ net: 0, availableCash: 0, collateral: 0, utilizedMargin: 0 });
      setAngelonePositions([]);
      setAngeloneHoldings([]);
      setMessage({ text: 'Disconnected from Angel One', type: 'success' });
      loadBrokerStatus();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    }
  }

  // ============ UPSTOX METHODS ============
  async function loadUpstoxStatus() {
    try {
      const response = await api.get('/api/upstox/status');
      setUpstoxStatus(response.data);
    } catch {
      setUpstoxStatus({ configured: false, authenticated: false });
    }
  }

  async function connectUpstox() {
    try {
      const response = await api.get('/api/upstox/auth-url');
      window.location.href = response.data.authUrl;
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    }
  }

  async function disconnectUpstox() {
    try {
      await api.post('/api/upstox/disconnect');
      setUpstoxStatus({ ...upstoxStatus, authenticated: false });
      setUpstoxFunds(null);
      setUpstoxPositions([]);
      setUpstoxHoldings([]);
      setMessage({ text: 'Disconnected from Upstox', type: 'success' });
      loadBrokerStatus();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    }
  }

  function handleUpstoxTokenExpiry(error) {
    const code = error?.response?.data?.code;
    if (code === 'TOKEN_EXPIRED' || error?.response?.status === 401) {
      setUpstoxStatus(prev => ({ ...prev, authenticated: false, tokenExpired: true }));
      setMessage({ text: 'Upstox session expired. Please reconnect.', type: 'error' });
      return true;
    }
    return false;
  }

  async function loadUpstoxFunds() {
    if (!upstoxStatus.authenticated) return;
    try {
      const response = await api.get('/api/upstox/funds');
      setUpstoxFunds(response.data.funds);
    } catch (error) {
      if (!handleUpstoxTokenExpiry(error)) {
        console.error('Failed to load Upstox funds:', error);
      }
    }
  }

  async function loadUpstoxPositions() {
    if (!upstoxStatus.authenticated) return;
    try {
      const response = await api.get('/api/upstox/positions');
      setUpstoxPositions(response.data.positions || []);
    } catch (error) {
      if (!handleUpstoxTokenExpiry(error)) {
        console.error('Failed to load Upstox positions:', error);
      }
    }
  }

  async function loadUpstoxHoldings() {
    if (!upstoxStatus.authenticated) return;
    try {
      const response = await api.get('/api/upstox/holdings');
      setUpstoxHoldings(response.data.holdings || []);
    } catch (error) {
      if (!handleUpstoxTokenExpiry(error)) {
        console.error('Failed to load Upstox holdings:', error);
      }
    }
  }

  // ============ PIONEX METHODS ============
  async function loadPionexStatus() {
    try {
      const response = await api.get('/api/pionex/status');
      setPionexStatus({
        configured: !!response.data.configured,
        authenticated: !!response.data.authenticated,
        source: response.data.source
      });
      if (response.data.configured || response.data.authenticated) {
        loadPionexFunds();
      }
    } catch {
      setPionexStatus({ configured: false, authenticated: false });
    }
  }

  async function loadPionexFunds() {
    try {
      const response = await api.get('/api/pionex/funds');
      setPionexFunds(response.data);
    } catch (err) {
      console.error('Failed to load Pionex funds:', err);
    }
  }

  async function handleConnectPionex(e) {
    if (e) e.preventDefault();
    if (!pionexForm.apiKey || !pionexForm.apiSecret) {
      setMessage({ text: 'Please enter both API Key and API Secret', type: 'error' });
      return;
    }
    setConnectingPionex(true);
    setMessage({ text: '', type: '' });
    try {
      await api.post('/api/pionex/connect', {
        apiKey: pionexForm.apiKey,
        apiSecret: pionexForm.apiSecret,
        paperMode: pionexForm.paperMode
      });
      setMessage({ text: 'Pionex API connected successfully!', type: 'success' });
      setShowPionexConnectModal(false);
      loadPionexStatus();
      loadPionexFunds();
      loadBrokerStatus();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    } finally {
      setConnectingPionex(false);
    }
  }

  async function disconnectPionex() {
    try {
      await api.post('/api/pionex/disconnect');
      setPionexStatus({ configured: false, authenticated: false });
      setPionexFunds(null);
      setMessage({ text: 'Disconnected from Pionex', type: 'success' });
      loadBrokerStatus();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    }
  }

  async function pollPionexOrderStatus(orderId, orderSymbol) {
    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setOrderStatus(prev => ({ ...prev, status: 'unknown', message: 'Pionex order submitted (status check complete)' }));
        return;
      }
      attempts++;

      try {
        const response = await api.get(`/api/pionex/orders/${orderId}/status`, {
          params: { symbol: orderSymbol || symbol }
        });
        const order = response.data.order;
        const status = order?.status?.toLowerCase();

        if (['filled', 'complete', 'executed'].includes(status)) {
          setOrderStatus({ orderId, status: 'filled', message: 'Pionex order executed successfully!' });
          setMessage({ text: 'Pionex order executed successfully!', type: 'success' });
          loadPionexFunds();
          loadPositions();
        } else if (['rejected', 'cancelled', 'failed'].includes(status)) {
          setOrderStatus({ orderId, status: 'failed', message: 'Pionex order cancelled/rejected' });
          setMessage({ text: 'Pionex order was cancelled or rejected', type: 'error' });
        } else {
          setOrderStatus({ orderId, status: 'pending', message: `Order status: ${status || 'open'}...` });
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Pionex status poll error:', error);
      }
    };

    poll();
  }

  // ============ COINDCX METHODS ============
  async function loadCoindcxStatus() {
    try {
      const response = await api.get('/api/coindcx/status');
      setCoindcxStatus({
        configured: !!response.data.configured,
        authenticated: !!response.data.authenticated,
        source: response.data.source
      });
      if (response.data.configured || response.data.authenticated) {
        loadCoindcxFunds();
      }
    } catch {
      setCoindcxStatus({ configured: false, authenticated: false });
    }
  }

  async function loadCoindcxFunds() {
    try {
      const response = await api.get('/api/coindcx/funds');
      setCoindcxFunds(response.data);
    } catch (err) {
      console.error('Failed to load CoinDCX funds:', err);
    }
  }

  async function handleConnectCoindcx(e) {
    if (e) e.preventDefault();
    if (!coindcxForm.apiKey || !coindcxForm.apiSecret) {
      setMessage({ text: 'Please enter both CoinDCX API Key and API Secret', type: 'error' });
      return;
    }
    setConnectingCoindcx(true);
    setMessage({ text: '', type: '' });
    try {
      await api.post('/api/coindcx/connect', {
        apiKey: coindcxForm.apiKey,
        apiSecret: coindcxForm.apiSecret,
        paperMode: coindcxForm.paperMode
      });
      setMessage({ text: 'CoinDCX API connected successfully!', type: 'success' });
      setShowCoindcxConnectModal(false);
      loadCoindcxStatus();
      loadCoindcxFunds();
      loadBrokerStatus();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    } finally {
      setConnectingCoindcx(false);
    }
  }

  async function disconnectCoindcx() {
    try {
      await api.post('/api/coindcx/disconnect');
      setCoindcxStatus({ configured: false, authenticated: false });
      setCoindcxFunds(null);
      setMessage({ text: 'Disconnected from CoinDCX', type: 'success' });
      loadBrokerStatus();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    }
  }

  async function pollCoindcxOrderStatus(orderId, orderSymbol) {
    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setOrderStatus(prev => ({ ...prev, status: 'unknown', message: 'CoinDCX order submitted (status check complete)' }));
        return;
      }
      attempts++;

      try {
        const response = await api.get(`/api/coindcx/orders/${orderId}/status`, {
          params: { symbol: orderSymbol || symbol }
        });
        const order = response.data.order;
        const status = order?.status?.toLowerCase();

        if (['filled', 'complete', 'executed'].includes(status)) {
          setOrderStatus({ orderId, status: 'filled', message: 'CoinDCX order executed successfully!' });
          setMessage({ text: 'CoinDCX order executed successfully!', type: 'success' });
          loadCoindcxFunds();
          loadPositions();
        } else if (['rejected', 'cancelled', 'failed'].includes(status)) {
          setOrderStatus({ orderId, status: 'failed', message: 'CoinDCX order cancelled/rejected' });
          setMessage({ text: 'CoinDCX order was cancelled or rejected', type: 'error' });
        } else {
          setOrderStatus({ orderId, status: 'pending', message: `Order status: ${status || 'open'}...` });
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('CoinDCX status poll error:', error);
      }
    };

    poll();
  }

  // ============ GENERAL TRADING METHODS ============
  async function loadWallet() {
    try {
      const response = await api.get('/api/wallet/summary');
      setWallet(response.data);
    } catch {
      setWallet(null);
    }
  }

  async function loadWatchlist() {
    try {
      const response = await api.get('/api/watchlist');
      setWatchlist(response.data.items || []);
    } catch {
      setWatchlist([]);
    }
  }

  async function loadPositions() {
    setLoading(prev => ({ ...prev, positions: true }));
    try {
      const response = await api.get('/api/trading/positions');
      setPositions(response.data.positions || []);
    } catch {
      setPositions([]);
    } finally {
      setLoading(prev => ({ ...prev, positions: false }));
    }
  }

  async function loadOpenOrders() {
    try {
      const response = await api.get('/api/orders/open');
      setOpenOrders(response.data.orders || []);
    } catch {
      setOpenOrders([]);
    }
  }

  async function loadQuote() {
    if (!symbol) return;
    setLoading(prev => ({ ...prev, quote: true }));
    try {
      const response = await api.get('/api/market/quote', { params: { symbol, exchange: exchangeName } });
      setQuote(response.data.quote);
      if (orderType === 'market') {
        setPrice(String(Number(response.data.quote.price).toFixed(2)));
      }
    } catch {
      setQuote(null);
    } finally {
      setLoading(prev => ({ ...prev, quote: false }));
    }
  }

  async function loadChart() {
    if (!symbol) return;
    setLoading(prev => ({ ...prev, chart: true }));
    try {
      const response = await api.get('/api/market/history', {
        params: { symbol, exchange: exchangeName, interval: chartInterval, limit: 60 }
      });
      setChartData(response.data.candles || []);
    } catch {
      setChartData([]);
    } finally {
      setLoading(prev => ({ ...prev, chart: false }));
    }
  }

  async function loadOrderBook() {
    if (!symbol) return;
    try {
      const response = await api.get('/api/trading/orderbook', {
        params: { symbol, exchange: exchangeName, depth: 10 }
      });
      setOrderBook({ bids: response.data.bids || [], asks: response.data.asks || [] });
    } catch {
      setOrderBook({ bids: [], asks: [] });
    }
  }

  async function loadRecentTrades() {
    if (!symbol) return;
    try {
      const response = await api.get('/api/trading/trades', {
        params: { symbol, exchange: exchangeName, limit: 20 }
      });
      setRecentTrades(response.data.trades || []);
    } catch {
      setRecentTrades([]);
    }
  }

  async function searchSymbols() {
    setSearchLoading(true);
    try {
      const response = await api.get('/api/market/search', {
        params: { q: searchQuery, exchange: exchangeName }
      });
      setSearchResults(response.data.symbols || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function selectSymbol(sym) {
    setSymbol(sym.symbol);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  }

  async function addToWatchlist() {
    if (!symbol) return;
    try {
      await api.post('/api/watchlist', { symbol, exchangeName });
      setMessage({ text: `${symbol} added to watchlist`, type: 'success' });
      loadWatchlist();
    } catch (err) {
      setMessage({ text: errorMessage(err), type: 'error' });
    }
  }

  const isInWatchlist = watchlist.some(w => w.symbol === symbol && w.exchange_name === exchangeName);

  async function ensureSession() {
    if (session) return session;
    const matchingConnection = connections.find(c => c.exchangeName === exchangeName);
    const response = await api.post('/api/sessions/start', {
      exchangeId: matchingConnection?.id || null,
      exchangeName,
      symbol,
      mode
    });
    setSession(response.data.session);
    return response.data.session;
  }

  function initiateOrder() {
    if (!symbol) {
      setMessage({ text: 'Please select a symbol', type: 'error' });
      return;
    }

    if (mode === 'live' && isIndianExchange) {
      if (selectedIndianBroker === 'AngelOne' && !isAngelConnected) {
        setMessage({ text: 'Please connect Angel One SmartAPI for live trading on NSE/BSE', type: 'error' });
        setShowAngelConnectModal(true);
        return;
      }
      if (selectedIndianBroker === 'Upstox' && !isUpstoxConnected) {
        setMessage({ text: 'Please connect your Upstox account for live trading on NSE/BSE', type: 'error' });
        return;
      }
    }

    if (mode === 'live' && isPionexExchange) {
      if (!isPionexConnected) {
        setMessage({ text: 'Please connect Pionex API credentials for live spot trading', type: 'error' });
        setShowPionexConnectModal(true);
        return;
      }
    }

    const orderData = {
      symbol,
      exchangeName,
      orderType,
      side,
      quantity: Number(qty),
      mode,
      broker: isIndianExchange ? selectedIndianBroker : (isPionexExchange ? 'Pionex' : undefined),
      price: orderType !== 'market' ? Number(price) : quote?.price,
      stopPrice: (orderType === 'stop_loss' || orderType === 'stop_limit') ? Number(stopPrice) : undefined,
      takeProfitPrice: orderType === 'take_profit' ? Number(takeProfitPrice || price) : undefined
    };

    if (mode === 'live') {
      setPendingOrder(orderData);
      setShowOrderConfirm(true);
    } else {
      executeOrder(orderData);
    }
  }

  async function executeOrder(orderData) {
    setMessage({ text: '', type: '' });
    setPlacingOrder(true);
    setOrderStatus(null);

    try {
      const activeSession = await ensureSession();
      const payload = { ...orderData, sessionId: activeSession.id };

      let response;
      if (orderData.mode === 'live' && isIndianExchange) {
        if (selectedIndianBroker === 'AngelOne') {
          response = await api.post('/api/angelone/orders/place', {
            symbol: orderData.symbol,
            exchange: orderData.exchangeName,
            side: orderData.side,
            quantity: orderData.quantity,
            orderType: orderData.orderType,
            price: orderData.price,
            productType: 'DELIVERY'
          });
          const orderId = response.data.order?.orderId || response.data.order?.orderid;
          if (orderId) {
            setOrderStatus({ orderId, status: 'submitted', message: 'Order submitted to Angel One, checking status...' });
            pollAngelOrderStatus(orderId);
          }
        } else {
          response = await api.post('/api/upstox/orders/place', {
            symbol: orderData.symbol,
            exchange: orderData.exchangeName,
            side: orderData.side,
            quantity: orderData.quantity,
            orderType: orderData.orderType,
            price: orderData.price,
            stopPrice: orderData.stopPrice,
            product: 'D'
          });
          const orderId = response.data.order?.orderId || response.data.order?.order_id;
          if (orderId) {
            setOrderStatus({ orderId, status: 'submitted', message: 'Order submitted to Upstox, checking status...' });
            pollUpstoxOrderStatus(orderId);
          }
        }
      } else if (orderData.mode === 'live' && orderData.exchangeName?.toLowerCase() === 'pionex') {
        response = await api.post('/api/pionex/orders/place', {
          symbol: orderData.symbol,
          side: orderData.side,
          orderType: orderData.orderType,
          quantity: orderData.quantity,
          price: orderData.price
        });
        const orderId = response.data.order?.orderId;
        if (orderId) {
          setOrderStatus({ orderId, status: 'submitted', message: 'Order placed on Pionex! Checking execution...' });
          pollPionexOrderStatus(orderId, orderData.symbol);
        }
      } else if (orderData.mode === 'live' && orderData.exchangeName?.toLowerCase() === 'coindcx') {
        response = await api.post('/api/coindcx/orders/place', {
          symbol: orderData.symbol,
          side: orderData.side,
          orderType: orderData.orderType,
          quantity: orderData.quantity,
          price: orderData.price,
          stopPrice: orderData.stopPrice
        });
        const orderId = response.data.order?.orderId;
        if (orderId) {
          setOrderStatus({ orderId, status: 'submitted', message: 'Order placed on CoinDCX! Checking execution...' });
          pollCoindcxOrderStatus(orderId, orderData.symbol);
        }
      } else {
        response = await api.post('/api/orders/place', payload);
      }

      setMessage({ text: `${orderData.side.toUpperCase()} order placed successfully!`, type: 'success' });
      setShowOrderConfirm(false);
      setPendingOrder(null);

      loadWallet();
      loadPositions();
      loadOpenOrders();
      loadRecentTrades();
      if (isIndianExchange) {
        if (selectedIndianBroker === 'AngelOne') {
          loadAngelOneFunds();
          loadAngelOnePositions();
          loadAngelOneHoldings();
        } else if (upstoxStatus.authenticated) {
          loadUpstoxFunds();
          loadUpstoxPositions();
          loadUpstoxHoldings();
        }
      } else if (isPionexExchange) {
        loadPionexFunds();
      } else if (isCoindcxExchange) {
        loadCoindcxFunds();
      }
    } catch (error) {
      if (!handleUpstoxTokenExpiry(error)) {
        setMessage({ text: errorMessage(error), type: 'error' });
      }
      setShowOrderConfirm(false);
    } finally {
      setPlacingOrder(false);
    }
  }

  async function pollAngelOrderStatus(orderId) {
    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setOrderStatus(prev => ({ ...prev, status: 'unknown', message: 'Angel One order placed (status check complete)' }));
        return;
      }
      attempts++;

      try {
        const response = await api.get(`/api/angelone/orders/${orderId}/status`);
        const order = response.data.order;
        const status = order?.status?.toLowerCase();

        if (['complete', 'filled', 'executed'].includes(status)) {
          setOrderStatus({ orderId, status: 'filled', message: 'Angel One order executed successfully!' });
          setMessage({ text: 'Angel One order executed successfully!', type: 'success' });
          loadAngelOneFunds();
          loadAngelOnePositions();
        } else if (['rejected', 'cancelled', 'failed'].includes(status)) {
          setOrderStatus({ orderId, status: 'failed', message: order.rejectionReason || 'Order rejected' });
          setMessage({ text: `Angel One order failed: ${order.rejectionReason || 'Unknown error'}`, type: 'error' });
        } else {
          setOrderStatus({ orderId, status: 'pending', message: `Order ${status || 'placed'}...` });
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Angel One status poll error:', error);
      }
    };

    poll();
  }

  async function pollUpstoxOrderStatus(orderId) {
    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setOrderStatus(prev => ({ ...prev, status: 'unknown', message: 'Order status check timed out' }));
        return;
      }
      attempts++;

      try {
        const response = await api.get(`/api/upstox/orders/${orderId}/status`);
        const order = response.data.order;
        const status = order?.status?.toLowerCase() || order?.order_status?.toLowerCase();

        if (['complete', 'filled', 'executed'].includes(status)) {
          setOrderStatus({ orderId, status: 'filled', message: 'Order executed successfully!' });
          setMessage({ text: 'Order executed successfully!', type: 'success' });
        } else if (['rejected', 'cancelled', 'failed'].includes(status)) {
          setOrderStatus({ orderId, status: 'failed', message: order.rejection_reason || 'Order failed' });
          setMessage({ text: `Order failed: ${order.rejection_reason || 'Unknown error'}`, type: 'error' });
        } else {
          setOrderStatus({ orderId, status: 'pending', message: `Order ${status || 'pending'}...` });
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Order status poll failed:', error);
      }
    };

    poll();
  }

  async function placeOrder() {
    initiateOrder();
  }

  async function cancelOrder(orderId) {
    setLoading(prev => ({ ...prev, [`cancel_${orderId}`]: true }));
    try {
      await api.post(`/api/orders/${orderId}/cancel`);
      setMessage({ text: 'Order cancelled', type: 'success' });
      loadOpenOrders();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, [`cancel_${orderId}`]: false }));
    }
  }

  async function resetWallet() {
    if (!confirm('Reset paper wallet to $100,000? This will clear all positions and orders.')) return;
    setLoading(prev => ({ ...prev, resetWallet: true }));
    try {
      await api.post('/api/wallet/reset');
      setMessage({ text: 'Paper wallet reset to $100,000', type: 'success' });
      loadWallet();
      loadPositions();
      loadOpenOrders();
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' });
    } finally {
      setLoading(prev => ({ ...prev, resetWallet: false }));
    }
  }

  function formatPrice(val) {
    if (!val && val !== 0) return '-';
    const num = Number(val);
    if (num >= 1000) return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (num >= 1) return num.toFixed(2);
    return num.toFixed(6);
  }

  function formatTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatChartTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (chartInterval.includes('d') || chartInterval.includes('w')) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  const total = Number(qty || 0) * Number(price || quote?.price || 0);

  // Live funds based on active broker
  const isLiveIndian = mode === 'live' && isIndianExchange && isSelectedIndianBrokerConnected;
  const isLivePionex = mode === 'live' && isPionexExchange && isPionexConnected;
  const isLiveCoindcx = mode === 'live' && isCoindcxExchange && isCoindcxConnected;
  let buyingPower = wallet?.balance || 0;

  if (isLiveIndian) {
    if (selectedIndianBroker === 'AngelOne') {
      buyingPower = angeloneFunds?.availableCash || angeloneFunds?.net || 0;
    } else if (selectedIndianBroker === 'Upstox') {
      buyingPower = upstoxFunds?.equity?.availableMargin || upstoxFunds?.totalAvailable || 0;
    }
  } else if (isLivePionex) {
    buyingPower = pionexFunds?.buyingPower ?? (pionexFunds?.balances?.find(b => b.asset === 'USDT')?.free || 0);
  } else if (isLiveCoindcx) {
    buyingPower = coindcxFunds?.buyingPowerUSD ?? (coindcxFunds?.balances?.find(b => b.asset === 'USDT')?.free || 0);
  }

  const canAfford = side === 'buy' ? buyingPower >= total : true;
  const isPositive = quote?.change >= 0;
  const displayCurrency = isIndianExchange ? '₹' : '$';

  return (
    <div className="trading-page-v2">
      {/* Top Bar */}
      <div className="trading-topbar-v2">
        <div className="exchange-selector">
          {exchanges.map(ex => (
            <button
              key={ex.name}
              className={exchangeName === ex.name ? 'active' : ''}
              onClick={() => { setExchangeName(ex.name); setSymbol(''); setQuote(null); }}
            >
              {ex.name}
            </button>
          ))}
        </div>

        <div className="mode-switch">
          <button className={mode === 'paper' ? 'active paper' : ''} onClick={() => setMode('paper')}>
            <FlaskConical size={14} /> Paper
          </button>
          <button
            className={mode === 'live' ? 'active live' : ''}
            onClick={() => setMode('live')}
          >
            <Zap size={14} /> Live
          </button>
          {mode === 'live' && !currentBrokerConnected && !isIndianExchange && (
            <button className="connect-broker-btn" onClick={() => isPionexExchange ? setShowPionexConnectModal(true) : isCoindcxExchange ? setShowCoindcxConnectModal(true) : null}>
              <Link2 size={12} /> Connect
            </button>
          )}
        </div>
      </div>

      {/* CoinDCX Crypto Toolbar (Shown when CoinDCX exchange is selected) */}
      {isCoindcxExchange && (
        <div className="indian-broker-toolbar pionex-toolbar">
          <div className="broker-toolbar-label">
            <span>CoinDCX Spot Trading:</span>
          </div>

          <div className="broker-pills-list">
            <div
              className={`broker-pill-item ${isCoindcxConnected ? 'connected' : ''} active`}
              onClick={() => !isCoindcxConnected && setShowCoindcxConnectModal(true)}
            >
              <div className="broker-pill-header">
                <strong>CoinDCX API</strong>
                {coindcxStatus.authenticated ? (
                  <Badge tone="green" small><CheckCircle size={10} /> Active</Badge>
                ) : coindcxStatus.configured ? (
                  <Badge tone="blue" small><CheckCircle size={10} /> Configured</Badge>
                ) : (
                  <Badge tone="yellow" small><KeyRound size={10} /> Connect API</Badge>
                )}
              </div>
              <span className="broker-pill-desc">Indian & Global Spot Crypto Markets</span>
              <div className="broker-pill-actions" onClick={e => e.stopPropagation()}>
                {isCoindcxConnected ? (
                  <button className="btn-disconnect-small" onClick={disconnectCoindcx}>Disconnect</button>
                ) : (
                  <button className="btn-connect-pill pionex" onClick={() => setShowCoindcxConnectModal(true)}>
                    <KeyRound size={11} /> Connect
                  </button>
                )}
              </div>
            </div>

            {isCoindcxConnected && (
              <div className="broker-balance-chip">
                <span className="chip-label">USDT Available:</span>
                <span className="chip-val">${Number(coindcxFunds?.buyingPowerUSD || coindcxFunds?.balances?.find(b => b.asset === 'USDT')?.free || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          {/* Live warning banner if active broker is not connected */}
          {mode === 'live' && !isCoindcxConnected && (
            <div className="indian-broker-warning">
              <AlertTriangle size={15} />
              <span>
                Connect your <strong>CoinDCX API credentials</strong> for live crypto execution on CoinDCX.
              </span>
              <div className="warning-buttons">
                <button className="btn-action-warning pionex" onClick={() => setShowCoindcxConnectModal(true)}>
                  <KeyRound size={12} /> Connect CoinDCX API
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pionex Crypto Toolbar (Shown when Pionex exchange is selected) */}
      {isPionexExchange && (
        <div className="indian-broker-toolbar pionex-toolbar">
          <div className="broker-toolbar-label">
            <span>Pionex Spot & Bots:</span>
          </div>

          <div className="broker-pills-list">
            <div
              className={`broker-pill-item ${isPionexConnected ? 'connected' : ''} active`}
              onClick={() => !isPionexConnected && setShowPionexConnectModal(true)}
            >
              <div className="broker-pill-header">
                <strong>Pionex API</strong>
                {pionexStatus.authenticated ? (
                  <Badge tone="green" small><CheckCircle size={10} /> Active</Badge>
                ) : pionexStatus.configured ? (
                  <Badge tone="blue" small><CheckCircle size={10} /> Configured</Badge>
                ) : (
                  <Badge tone="yellow" small><KeyRound size={10} /> Connect API</Badge>
                )}
              </div>
              <span className="broker-pill-desc">Spot Trading & Native Grid Bots</span>
              <div className="broker-pill-actions" onClick={e => e.stopPropagation()}>
                {isPionexConnected ? (
                  <button className="btn-disconnect-small" onClick={disconnectPionex}>Disconnect</button>
                ) : (
                  <button className="btn-connect-pill pionex" onClick={() => setShowPionexConnectModal(true)}>
                    <KeyRound size={11} /> Connect
                  </button>
                )}
              </div>
            </div>

            {isPionexConnected && (
              <div className="broker-balance-chip">
                <span className="chip-label">USDT Available:</span>
                <span className="chip-val">${Number(pionexFunds?.buyingPower || pionexFunds?.balances?.find(b => b.asset === 'USDT')?.free || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          {/* Live warning banner if active broker is not connected */}
          {mode === 'live' && !isPionexConnected && (
            <div className="indian-broker-warning">
              <AlertTriangle size={15} />
              <span>
                Connect your <strong>Pionex API credentials</strong> for live crypto execution on Pionex.
              </span>
              <div className="warning-buttons">
                <button className="btn-action-warning pionex" onClick={() => setShowPionexConnectModal(true)}>
                  <KeyRound size={12} /> Connect Pionex API
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Indian Broker Selection Bar (Only shown for NSE & BSE) */}
      {isIndianExchange && (
        <div className="indian-broker-toolbar">
          <div className="broker-toolbar-label">
            <span>Trade on {exchangeName} via:</span>
          </div>

          <div className="broker-pills-list">
            {/* Angel One Broker Pill */}
            <div
              className={`broker-pill-item ${selectedIndianBroker === 'AngelOne' ? 'active' : ''} ${isAngelConnected ? 'connected' : ''}`}
              onClick={() => setSelectedIndianBroker('AngelOne')}
            >
              <div className="broker-pill-header">
                <strong>Angel One</strong>
                {angeloneStatus.authenticated ? (
                  <Badge tone="green" small><CheckCircle size={10} /> Active</Badge>
                ) : angeloneStatus.configured ? (
                  <Badge tone="blue" small><CheckCircle size={10} /> Configured</Badge>
                ) : (
                  <Badge tone="yellow" small><KeyRound size={10} /> Connect</Badge>
                )}
              </div>
              <span className="broker-pill-desc">SmartAPI (NSE/BSE)</span>
              <div className="broker-pill-actions" onClick={e => e.stopPropagation()}>
                {isAngelConnected ? (
                  <button className="btn-disconnect-small" onClick={disconnectAngelOne}>Disconnect</button>
                ) : (
                  <button className="btn-connect-pill angel" onClick={() => setShowAngelConnectModal(true)}>
                    <KeyRound size={11} /> Connect
                  </button>
                )}
              </div>
            </div>

            {/* Upstox Broker Pill */}
            <div
              className={`broker-pill-item ${selectedIndianBroker === 'Upstox' ? 'active' : ''} ${isUpstoxConnected ? 'connected' : ''}`}
              onClick={() => setSelectedIndianBroker('Upstox')}
            >
              <div className="broker-pill-header">
                <strong>Upstox</strong>
                {upstoxStatus.authenticated ? (
                  <Badge tone="green" small><CheckCircle size={10} /> Connected</Badge>
                ) : (
                  <Badge tone="yellow" small><KeyRound size={10} /> Connect</Badge>
                )}
              </div>
              <span className="broker-pill-desc">OAuth (NSE/BSE)</span>
              <div className="broker-pill-actions" onClick={e => e.stopPropagation()}>
                {isUpstoxConnected ? (
                  <button className="btn-disconnect-small" onClick={disconnectUpstox}>Disconnect</button>
                ) : (
                  <button className="btn-connect-pill upstox" onClick={connectUpstox}>
                    <ExternalLink size={11} /> Connect
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Live warning banner if active broker is not connected */}
          {mode === 'live' && !isSelectedIndianBrokerConnected && (
            <div className="indian-broker-warning">
              <AlertTriangle size={15} />
              <span>
                Connect <strong>{selectedIndianBroker === 'AngelOne' ? 'Angel One SmartAPI' : 'Upstox'}</strong> for live trading on {exchangeName}.
              </span>
              <div className="warning-buttons">
                {selectedIndianBroker === 'AngelOne' ? (
                  <button className="btn-action-warning angel" onClick={() => setShowAngelConnectModal(true)}>
                    <KeyRound size={12} /> Connect Angel One
                  </button>
                ) : (
                  <button className="btn-action-warning upstox" onClick={connectUpstox}>
                    <ExternalLink size={12} /> Connect Upstox
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Section */}
      <div className="search-section">
        <div className="search-wrapper" onClick={() => setShowSearch(true)}>
          <Search size={18} />
          <span className="search-text">
            {symbol ? (
              <>
                <strong>{symbol}</strong>
                <Badge small>{exchangeName}</Badge>
                {isIndianExchange && (
                  <span className="search-broker-tag">via {selectedIndianBroker === 'AngelOne' ? 'Angel One' : 'Upstox'}</span>
                )}
                {isPionexExchange && (
                  <span className="search-broker-tag">via Pionex</span>
                )}
              </>
            ) : (
              isPionexExchange
                ? 'Search Pionex crypto pairs (e.g. BTC/USDT, ETH/USDT, SOL/USDT)...'
                : `Search for ${exchangeName} stocks...`
            )}
          </span>
          {symbol && (
            <button className="clear-symbol" onClick={(e) => { e.stopPropagation(); setSymbol(''); setQuote(null); }}>
              <X size={14} />
            </button>
          )}
        </div>

        {symbol && !isInWatchlist && (
          <button className="btn-watchlist" onClick={addToWatchlist}>
            <Star size={14} /> Add to Watchlist
          </button>
        )}
        {symbol && isInWatchlist && (
          <span className="in-watchlist"><Star size={14} /> In Watchlist</span>
        )}
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div className="search-modal-overlay" onClick={() => setShowSearch(false)}>
          <div className="search-modal" onClick={e => e.stopPropagation()}>
            <div className="search-modal-header">
              <Search size={18} />
              <input
                type="text"
                placeholder={`Search ${exchangeName} stocks (e.g. RELIANCE, TCS, INFY)...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button onClick={() => setShowSearch(false)}><X size={18} /></button>
            </div>
            <div className="search-modal-results">
              {searchLoading ? (
                <div className="search-loading"><RefreshCw size={20} className="spin" /> Searching {exchangeName}...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(res => (
                  <div key={res.symbol} className="search-result-item" onClick={() => selectSymbol(res)}>
                    <div className="result-main">
                      <strong>{res.symbol}</strong>
                      <span>{res.name}</span>
                    </div>
                    <Badge small>{res.exchange || exchangeName}</Badge>
                  </div>
                ))
              ) : searchQuery.length >= 1 ? (
                <div className="search-empty">No results found for "{searchQuery}" on {exchangeName}</div>
              ) : (
                <div className="search-hints">
                  <span className="hints-title">Popular {exchangeName} Stocks:</span>
                  <div className="quick-tags">
                    {(isIndianExchange ? ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'TATAMOTORS', 'SBIN', 'ITC'] : ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA']).map(tag => (
                      <button key={tag} onClick={() => selectSymbol({ symbol: tag })}>{tag}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Symbol Loaded View */}
      {symbol ? (
        <div className="trading-content-grid">
          {/* Main Chart & Trading Panel */}
          <div className="trading-main">
            {/* Stock Header */}
            <div className="symbol-header-card">
              <div className="symbol-meta">
                <div className="title-row">
                  <h2>{symbol}</h2>
                  <Badge tone="blue">{exchangeName}</Badge>
                  {isIndianExchange && (
                    <Badge tone="neutral" small>{selectedIndianBroker}</Badge>
                  )}
                </div>
                <span className="company-name">{quote?.name || quote?.description || symbol}</span>
              </div>

              <div className="symbol-pricing">
                <div className="price-main">
                  <span className="current-price">
                    {currencySymbol}{formatPrice(quote?.price)}
                  </span>
                  {quote?.change !== undefined && (
                    <span className={`change-pill ${isPositive ? 'positive' : 'negative'}`}>
                      {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {isPositive ? '+' : ''}{formatPrice(quote.change)} ({quote.changePercent?.toFixed(2)}%)
                    </span>
                  )}
                </div>
                <div className="price-sub">
                  <span>Open: {currencySymbol}{formatPrice(quote?.open)}</span>
                  <span>High: {currencySymbol}{formatPrice(quote?.high)}</span>
                  <span>Low: {currencySymbol}{formatPrice(quote?.low)}</span>
                  <span>Prev Close: {currencySymbol}{formatPrice(quote?.close)}</span>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="chart-card">
              <div className="chart-controls">
                <div className="interval-buttons">
                  {['1m', '5m', '15m', '1h', '1d', '1w'].map(int => (
                    <button
                      key={int}
                      className={chartInterval === int ? 'active' : ''}
                      onClick={() => setChartInterval(int)}
                    >
                      {int.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button className="btn-refresh" onClick={loadChart} disabled={loading.chart}>
                  <RefreshCw size={14} className={loading.chart ? 'spin' : ''} />
                </button>
              </div>

              <div className="chart-wrapper">
                {loading.chart ? (
                  <div className="chart-loading"><RefreshCw size={24} className="spin" /> Loading chart...</div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isPositive ? '#00ff88' : '#ff4757'} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={isPositive ? '#00ff88' : '#ff4757'} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1d2938" />
                      <XAxis dataKey="time" tickFormatter={formatChartTime} stroke="#6b7a90" fontSize={11} />
                      <YAxis domain={['auto', 'auto']} stroke="#6b7a90" fontSize={11} tickFormatter={val => `${currencySymbol}${formatPrice(val)}`} />
                      <Tooltip
                        contentStyle={{ background: '#0a0f15', border: '1px solid #223044', borderRadius: '8px' }}
                        labelFormatter={formatChartTime}
                        formatter={val => [`${currencySymbol}${formatPrice(val)}`, 'Price']}
                      />
                      <Area type="monotone" dataKey="close" stroke={isPositive ? '#00ff88' : '#ff4757'} fillOpacity={1} fill="url(#colorPrice)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-empty">No historical candle data available for {symbol}</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Order Entry & Active Wallet */}
          <div className="trading-sidebar">
            {/* Order Placement Form */}
            <div className="order-entry-card">
              <div className="side-toggle">
                <button className={`buy-btn ${side === 'buy' ? 'active' : ''}`} onClick={() => setSide('buy')}>
                  BUY
                </button>
                <button className={`sell-btn ${side === 'sell' ? 'active' : ''}`} onClick={() => setSide('sell')}>
                  SELL
                </button>
              </div>

              <div className="order-types">
                {['market', 'limit', 'stop_loss'].map(t => (
                  <button
                    key={t}
                    className={orderType === t ? 'active' : ''}
                    onClick={() => setOrderType(t)}
                  >
                    {t.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="form-inputs">
                <div className="input-group">
                  <label>Quantity</label>
                  <div className="qty-control">
                    <button onClick={() => setQty(String(Math.max(1, Number(qty) - 1)))}><Minus size={12} /></button>
                    <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
                    <button onClick={() => setQty(String(Number(qty) + 1))}><Plus size={12} /></button>
                  </div>
                </div>

                {orderType !== 'market' && (
                  <div className="input-group">
                    <label>Limit Price ({currencySymbol})</label>
                    <input type="number" step="0.05" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
                  </div>
                )}

                {orderType === 'stop_loss' && (
                  <div className="input-group">
                    <label>Stop Price ({currencySymbol})</label>
                    <input type="number" step="0.05" value={stopPrice} onChange={e => setStopPrice(e.target.value)} placeholder="0.00" />
                  </div>
                )}

                {/* Order Summary */}
                <div className="order-summary">
                  <div className="summary-row">
                    <span>Estimated Total</span>
                    <strong>{currencySymbol}{formatPrice(total)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Available ({isIndianExchange ? (selectedIndianBroker === 'AngelOne' ? 'Angel One' : 'Upstox') : 'Wallet'})</span>
                    <span className={canAfford ? 'gain' : 'loss'}>
                      {displayCurrency}{formatPrice(buyingPower)}
                    </span>
                  </div>
                </div>

                {/* Place Order Button */}
                <button
                  className={`place-order-btn ${side}`}
                  onClick={placeOrder}
                  disabled={placingOrder || !symbol || (side === 'buy' && !canAfford && mode === 'live')}
                >
                  {placingOrder && <RefreshCw size={16} className="spin" />}
                  {mode === 'live' && isIndianExchange && !isSelectedIndianBrokerConnected
                    ? `Connect ${selectedIndianBroker === 'AngelOne' ? 'Angel One' : 'Upstox'} to Trade`
                    : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol} (${mode.toUpperCase()})`}
                </button>

                {message.text && (
                  <div className={`form-message ${message.type}`}>{message.text}</div>
                )}
              </div>
            </div>

            {/* Wallet & Balance Card */}
            <div className="wallet-card">
              <div className="wallet-header">
                <h4>
                  <Wallet size={14} />
                  {isLiveIndian
                    ? (selectedIndianBroker === 'AngelOne' ? 'Angel One Account (RMS)' : 'Upstox Account')
                    : mode === 'paper' ? 'Paper Wallet' : 'Live Wallet'}
                </h4>
                {mode === 'paper' && (
                  <button className="btn-reset" onClick={resetWallet} disabled={loading.resetWallet}>
                    <RefreshCw size={12} className={loading.resetWallet ? 'spin' : ''} />
                  </button>
                )}
                {isLiveIndian && (
                  <button
                    className="btn-refresh-small"
                    onClick={selectedIndianBroker === 'AngelOne' ? loadAngelOneFunds : loadUpstoxFunds}
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>

              {/* Live Indian Funds */}
              {isLiveIndian ? (
                selectedIndianBroker === 'AngelOne' ? (
                  <div className="wallet-body angel">
                    <div className="wallet-row">
                      <span>Available Cash</span>
                      <strong className="gain">₹{formatPrice(angeloneFunds?.availableCash || angeloneFunds?.net)}</strong>
                    </div>
                    <div className="wallet-row">
                      <span>Collateral Margin</span>
                      <strong>₹{formatPrice(angeloneFunds?.collateral)}</strong>
                    </div>
                    <div className="wallet-row">
                      <span>Utilized Margin</span>
                      <strong>₹{formatPrice(angeloneFunds?.utilizedMargin)}</strong>
                    </div>
                    <div className="wallet-row total">
                      <span>Net Available</span>
                      <strong className="gain">₹{formatPrice(angeloneFunds?.net || angeloneFunds?.availableCash)}</strong>
                    </div>
                  </div>
                ) : upstoxFunds ? (
                  <div className="wallet-body upstox">
                    <div className="wallet-row">
                      <span>Available Margin</span>
                      <strong className="gain">₹{formatPrice(upstoxFunds.equity?.availableMargin)}</strong>
                    </div>
                    <div className="wallet-row">
                      <span>Used Margin</span>
                      <strong>₹{formatPrice(upstoxFunds.equity?.usedMargin)}</strong>
                    </div>
                    <div className="wallet-row">
                      <span>Payin</span>
                      <strong>₹{formatPrice(upstoxFunds.equity?.payin)}</strong>
                    </div>
                    <div className="wallet-row total">
                      <span>Total Available</span>
                      <strong className="gain">₹{formatPrice(upstoxFunds.totalAvailable)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="wallet-loading">Loading Upstox funds...</div>
                )
              ) : (
                /* Paper/Other Wallet */
                wallet ? (
                  <div className="wallet-body">
                    <div className="wallet-row">
                      <span>Cash</span>
                      <strong>{displayCurrency}{formatPrice(wallet.balance)}</strong>
                    </div>
                    <div className="wallet-row">
                      <span>Portfolio</span>
                      <strong>{displayCurrency}{formatPrice(wallet.portfolioValue)}</strong>
                    </div>
                    <div className="wallet-row total">
                      <span>Total Equity</span>
                      <strong>{displayCurrency}{formatPrice(wallet.totalEquity)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="wallet-loading">Loading wallet...</div>
                )
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="no-symbol-state">
          <Search size={64} />
          <h2>Select a Stock to Trade on {exchangeName}</h2>
          <p>Search Indian stocks, ETFs, or crypto to view live charts and place orders</p>
          <button className="btn-search" onClick={() => setShowSearch(true)}>
            <Search size={16} /> Search Symbols
          </button>
        </div>
      )}

      {/* Bottom Section - Positions, Holdings, and Open Orders */}
      <div className="trading-bottom">
        <div className="bottom-panel">
          <div className="panel-header">
            <h3>
              <Activity size={14} />
              {isLiveIndian
                ? `${selectedIndianBroker === 'AngelOne' ? 'Angel One' : 'Upstox'} Holdings & Positions`
                : 'Positions'}
              ({isLiveIndian
                ? (selectedIndianBroker === 'AngelOne'
                  ? angeloneHoldings.length + angelonePositions.length
                  : upstoxHoldings.length + upstoxPositions.length)
                : positions.length})
            </h3>
            <button
              className="btn-refresh"
              onClick={
                isLiveIndian
                  ? (selectedIndianBroker === 'AngelOne'
                    ? () => { loadAngelOneHoldings(); loadAngelOnePositions(); }
                    : () => { loadUpstoxHoldings(); loadUpstoxPositions(); })
                  : loadPositions
              }
            >
              <RefreshCw size={12} className={loading.positions ? 'spin' : ''} />
            </button>
          </div>

          {isLiveIndian ? (
            selectedIndianBroker === 'AngelOne' ? (
              (angeloneHoldings.length > 0 || angelonePositions.length > 0) ? (
                <div className="positions-list">
                  {angeloneHoldings.map((h, idx) => (
                    <div key={`ah-${idx}`} className="position-row">
                      <div className="position-info">
                        <span className="symbol">{h.tradingsymbol || h.symbol}</span>
                        <span className="qty">{h.quantity} @ ₹{formatPrice(h.averageprice || h.avgPrice)}</span>
                        <Badge small tone="blue">Holding</Badge>
                      </div>
                      <div className={`position-pnl ${h.pnl >= 0 ? 'gain' : 'loss'}`}>
                        <span>{h.pnl >= 0 ? '+' : ''}₹{formatPrice(h.pnl)}</span>
                        <small>({h.pnlPercentage?.toFixed(2) || '0.00'}%)</small>
                      </div>
                    </div>
                  ))}
                  {angelonePositions.map((p, idx) => (
                    <div key={`ap-${idx}`} className="position-row">
                      <div className="position-info">
                        <span className="symbol">{p.tradingsymbol || p.symbol}</span>
                        <span className="qty">{p.netqty || p.quantity} @ ₹{formatPrice(p.ltp)}</span>
                        <Badge small tone="yellow">Position</Badge>
                      </div>
                      <div className={`position-pnl ${p.pnl >= 0 ? 'gain' : 'loss'}`}>
                        <span>{p.pnl >= 0 ? '+' : ''}₹{formatPrice(p.pnl)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No Angel One holdings or open positions</div>
              )
            ) : (
              (upstoxHoldings.length > 0 || upstoxPositions.length > 0) ? (
                <div className="positions-list">
                  {upstoxHoldings.map((h, idx) => (
                    <div key={`uh-${idx}`} className="position-row">
                      <div className="position-info">
                        <span className="symbol">{h.symbol}</span>
                        <span className="qty">{h.quantity} @ ₹{formatPrice(h.avgPrice)}</span>
                        <Badge small tone="blue">Holding</Badge>
                      </div>
                      <div className={`position-pnl ${h.pnl >= 0 ? 'gain' : 'loss'}`}>
                        <span>{h.pnl >= 0 ? '+' : ''}₹{formatPrice(h.pnl)}</span>
                      </div>
                    </div>
                  ))}
                  {upstoxPositions.map((p, idx) => (
                    <div key={`up-${idx}`} className="position-row">
                      <div className="position-info">
                        <span className="symbol">{p.symbol}</span>
                        <span className="qty">{p.quantity} @ ₹{formatPrice(p.avgPrice)}</span>
                        <Badge small tone="yellow">Intraday</Badge>
                      </div>
                      <div className={`position-pnl ${p.pnl >= 0 ? 'gain' : 'loss'}`}>
                        <span>{p.pnl >= 0 ? '+' : ''}₹{formatPrice(p.pnl)}</span>
                        <small>({p.pnlPercent?.toFixed(2)}%)</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No Upstox holdings or positions</div>
              )
            )
          ) : (
            /* Paper Positions */
            positions.length > 0 ? (
              <div className="positions-list">
                {positions.map(pos => (
                  <div key={pos.id} className="position-row">
                    <div className="position-info">
                      <span className="symbol">{pos.symbol}</span>
                      <span className="qty">{pos.quantity} @ {displayCurrency}{formatPrice(pos.avgPrice)}</span>
                    </div>
                    <div className={`position-pnl ${pos.unrealizedPnl >= 0 ? 'gain' : 'loss'}`}>
                      <span>{pos.unrealizedPnl >= 0 ? '+' : ''}{displayCurrency}{formatPrice(pos.unrealizedPnl)}</span>
                      <small>({pos.unrealizedPnlPercent?.toFixed(2)}%)</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No open positions</div>
            )
          )}
        </div>

        <div className="bottom-panel">
          <div className="panel-header">
            <h3><Target size={14} /> Open Orders ({openOrders.length})</h3>
            <button className="btn-refresh" onClick={loadOpenOrders}>
              <RefreshCw size={12} />
            </button>
          </div>
          {openOrders.length > 0 ? (
            <div className="orders-list">
              {openOrders.map(order => (
                <div key={order.id} className="order-row">
                  <div className="order-info">
                    <span className={`side ${order.side}`}>{order.side.toUpperCase()}</span>
                    <span className="symbol">{order.symbol}</span>
                    <Badge small>{order.order_type}</Badge>
                  </div>
                  <div className="order-details">
                    <span>{order.quantity} @ {displayCurrency}{formatPrice(order.price || order.stop_price)}</span>
                    <button className="btn-cancel" onClick={() => cancelOrder(order.id)}>
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No open orders</div>
          )}
        </div>
      </div>

      {/* Order Confirmation Modal for Live Trading */}
      {showOrderConfirm && pendingOrder && (
        <div className="modal-overlay" onClick={() => setShowOrderConfirm(false)}>
          <div className="order-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <AlertTriangle size={20} className="warning-icon" />
              <h3>Confirm Live Order</h3>
            </div>
            <div className="modal-content">
              <p className="warning-text">
                You are about to place a <strong>LIVE</strong> order on <strong>{pendingOrder.exchangeName}</strong> via <strong>{pendingOrder.broker || selectedIndianBroker}</strong> that will execute with real money.
              </p>
              <div className="order-details">
                <div className="detail-row">
                  <span>Action</span>
                  <span className={pendingOrder.side === 'buy' ? 'buy' : 'sell'}>
                    {pendingOrder.side.toUpperCase()}
                  </span>
                </div>
                <div className="detail-row">
                  <span>Symbol</span>
                  <span>{pendingOrder.symbol}</span>
                </div>
                <div className="detail-row">
                  <span>Exchange</span>
                  <span>{pendingOrder.exchangeName}</span>
                </div>
                <div className="detail-row">
                  <span>Broker</span>
                  <span>{pendingOrder.broker || selectedIndianBroker}</span>
                </div>
                <div className="detail-row">
                  <span>Quantity</span>
                  <span>{pendingOrder.quantity}</span>
                </div>
                <div className="detail-row">
                  <span>Order Type</span>
                  <span>{pendingOrder.orderType.toUpperCase()}</span>
                </div>
                <div className="detail-row">
                  <span>Est. Price</span>
                  <span>{displayCurrency}{formatPrice(pendingOrder.price)}</span>
                </div>
                <div className="detail-row total">
                  <span>Est. Total</span>
                  <span>{displayCurrency}{formatPrice(pendingOrder.quantity * pendingOrder.price)}</span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => { setShowOrderConfirm(false); setPendingOrder(null); }}
                disabled={placingOrder}
              >
                Cancel
              </button>
              <button
                className={`btn-confirm ${pendingOrder.side}`}
                onClick={() => executeOrder(pendingOrder)}
                disabled={placingOrder}
              >
                {placingOrder ? (
                  <><RefreshCw size={14} className="spin" /> Placing...</>
                ) : (
                  <>Confirm {pendingOrder.side.toUpperCase()}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Angel One Connect Modal */}
      {showAngelConnectModal && (
        <div className="modal-overlay" onClick={() => setShowAngelConnectModal(false)}>
          <div className="modal-content-box angel-connect-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <KeyRound size={20} className="text-primary" />
                <h3>Connect Angel One SmartAPI</h3>
              </div>
              <button className="btn-close" onClick={() => setShowAngelConnectModal(false)}>
                <XCircle size={20} />
              </button>
            </div>
            <p className="modal-hint">
              Enter your Angel One SmartAPI credentials to enable live trading on NSE & BSE.
            </p>
            <form onSubmit={handleConnectAngelOne} className="form">
              <div className="form-group">
                <label>SmartAPI Key</label>
                <input
                  type="password"
                  placeholder="Enter SmartAPI Key"
                  value={angelForm.apiKey}
                  onChange={e => setAngelForm({ ...angelForm, apiKey: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Client Code / User ID</label>
                <input
                  type="text"
                  placeholder="e.g. S1234567"
                  value={angelForm.clientCode}
                  onChange={e => setAngelForm({ ...angelForm, clientCode: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>PIN / Password</label>
                <input
                  type="password"
                  placeholder="Enter 4-digit PIN or password"
                  value={angelForm.password}
                  onChange={e => setAngelForm({ ...angelForm, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>TOTP Secret Key (or 6-digit TOTP)</label>
                <input
                  type="password"
                  placeholder="Base32 TOTP secret key for automatic 2FA"
                  value={angelForm.totpSecret}
                  onChange={e => setAngelForm({ ...angelForm, totpSecret: e.target.value, totp: e.target.value })}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={connectingAngel}>
                  {connectingAngel ? <><RefreshCw size={14} className="spin" /> Authenticating...</> : <><KeyRound size={14} /> Connect & Login</>}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowAngelConnectModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Pionex Connect Modal */}
      {showPionexConnectModal && (
        <div className="modal-overlay" onClick={() => setShowPionexConnectModal(false)}>
          <div className="modal-content-box angel-connect-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <KeyRound size={20} className="text-primary" />
                <h3>Connect Pionex API</h3>
              </div>
              <button className="btn-close" onClick={() => setShowPionexConnectModal(false)}>
                <XCircle size={20} />
              </button>
            </div>
            <p className="modal-hint">
              Enter your Pionex API Key and API Secret to enable live spot trading and bot execution.
            </p>
            <form onSubmit={handleConnectPionex} className="form">
              <div className="form-group">
                <label>Pionex API Key</label>
                <input
                  type="password"
                  placeholder="Enter Pionex API Key"
                  value={pionexForm.apiKey}
                  onChange={e => setPionexForm({ ...pionexForm, apiKey: e.target.value })}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label>Pionex API Secret</label>
                <input
                  type="password"
                  placeholder="Enter Pionex API Secret"
                  value={pionexForm.apiSecret}
                  onChange={e => setPionexForm({ ...pionexForm, apiSecret: e.target.value })}
                  required
                  autoComplete="off"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={connectingPionex}>
                  {connectingPionex ? <><RefreshCw size={14} className="spin" /> Verifying...</> : <><KeyRound size={14} /> Connect Pionex</>}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowPionexConnectModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline CoinDCX Connect Modal */}
      {showCoindcxConnectModal && (
        <div className="modal-overlay" onClick={() => setShowCoindcxConnectModal(false)}>
          <div className="modal-content-box angel-connect-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <KeyRound size={20} className="text-primary" />
                <h3>Connect CoinDCX API</h3>
              </div>
              <button className="btn-close" onClick={() => setShowCoindcxConnectModal(false)}>
                <XCircle size={20} />
              </button>
            </div>
            <p className="modal-hint">
              Enter your CoinDCX API Key and API Secret to enable live spot trading and automatic balance synchronization.
            </p>
            <form onSubmit={handleConnectCoindcx} className="form">
              <div className="form-group">
                <label>CoinDCX API Key</label>
                <input
                  type="password"
                  placeholder="Enter CoinDCX API Key"
                  value={coindcxForm.apiKey}
                  onChange={e => setCoindcxForm({ ...coindcxForm, apiKey: e.target.value })}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label>CoinDCX API Secret</label>
                <input
                  type="password"
                  placeholder="Enter CoinDCX API Secret"
                  value={coindcxForm.apiSecret}
                  onChange={e => setCoindcxForm({ ...coindcxForm, apiSecret: e.target.value })}
                  required
                  autoComplete="off"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={connectingCoindcx}>
                  {connectingCoindcx ? <><RefreshCw size={14} className="spin" /> Verifying...</> : <><KeyRound size={14} /> Connect CoinDCX</>}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowCoindcxConnectModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Status Toast */}
      {orderStatus && (
        <div className={`order-status-toast ${orderStatus.status}`}>
          {orderStatus.status === 'filled' && <CheckCircle size={16} />}
          {orderStatus.status === 'failed' && <XCircle size={16} />}
          {orderStatus.status === 'pending' && <RefreshCw size={16} className="spin" />}
          {orderStatus.status === 'submitted' && <Clock size={16} />}
          <span>{orderStatus.message}</span>
          <button onClick={() => setOrderStatus(null)}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
