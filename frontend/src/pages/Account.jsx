import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, DollarSign, IndianRupee, RefreshCw, CheckCircle2,
  AlertCircle, ArrowUpRight, ArrowDownRight, ExternalLink,
  Copy, Check, Shield, TrendingUp, Layers, Coins, Globe,
  Sparkles, Zap, Lock, Eye, EyeOff, Radio
} from 'lucide-react';
import { api } from '../api.js';

export default function Account() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    fetchAccountSummary(true);

    // Auto-fetch balance every 10 seconds in real-time
    pollTimerRef.current = setInterval(() => {
      fetchAccountSummary(false);
    }, 10000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  async function fetchAccountSummary(showInitialLoading = false) {
    if (showInitialLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await api.get('/api/account/summary');
      if (res.data?.data || res.data) {
        setSummary(res.data?.data || res.data);
        setError(null);
        setLastRefreshTime(new Date());
      }
    } catch (err) {
      console.error('Failed to load account summary:', err);
      if (showInitialLoading) {
        setError(err.response?.data?.message || err.message || 'Failed to load account summary');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  }

  function formatUSD(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  }

  function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  }

  if (loading && !summary) {
    return (
      <div className="account-page">
        <div className="account-loading-container">
          <RefreshCw size={36} className="spin text-accent" />
          <h2>Syncing Connected Broker Balances...</h2>
          <p className="text-muted">Fetching real-time balances from Binance, Pionex, Jupiter, Angel One, Upstox, and Alpaca</p>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="account-page">
        <div className="account-error-container">
          <AlertCircle size={44} className="text-negative" />
          <h2>Failed to Load Account Balances</h2>
          <p className="error-text">{error}</p>
          <button onClick={() => fetchAccountSummary(true)} className="btn-action primary">
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const cryptoFunds = summary?.cryptoFunds || {};
  const indianFunds = summary?.indianFunds || {};
  const dollarFunds = summary?.dollarFunds || {};
  const paperTrading = summary?.paperTrading || {};

  const binance = cryptoFunds.binance || {};
  const coindcx = cryptoFunds.coindcx || {};
  const pionex = cryptoFunds.pionex || {};
  const jupiter = cryptoFunds.jupiter || {};
  const kraken = cryptoFunds.kraken || {};
  const angelone = indianFunds.angelone || {};
  const upstox = indianFunds.upstox || {};
  const alpaca = dollarFunds.alpaca || {};

  const totalConnected = summary?.connectedBrokersCount || 0;

  return (
    <div className="account-page">
      {/* Top Header */}
      <div className="account-header">
        <div className="header-info">
          <div className="header-title-row">
            <div className="account-icon-badge">
              <Wallet size={24} />
            </div>
            <div>
              <h1>My Account & Broker Balances</h1>
              <p className="subtitle">
                Live auto-synced wallet balances and positions across all connected exchanges, DEXs, and stock brokers.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <div className="sync-status-badge">
            <span className="sync-dot" />
            <span>Auto-synced every 10s</span>
          </div>

          <button
            onClick={() => fetchAccountSummary(false)}
            className="refresh-account-btn"
            disabled={refreshing}
            title="Refresh all wallet balances"
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <Link to="/exchanges" className="manage-exchanges-btn">
            <Globe size={15} />
            <span>Manage Brokers</span>
          </Link>
        </div>
      </div>

      {/* Top Executive Summary Metric Cards */}
      <div className="account-metrics-grid">
        <div className="account-metric-card live-usd">
          <div className="metric-header">
            <span className="metric-title">Live USD Balance</span>
            <span className="metric-tag live">Live Real Funds</span>
          </div>
          <div className="metric-body">
            <div className="metric-value font-mono">
              {formatUSD(summary?.liveEquityUSD)}
            </div>
            <div className="metric-caption">
              Across Crypto & US Stock Brokers
            </div>
          </div>
        </div>

        <div className="account-metric-card live-inr">
          <div className="metric-header">
            <span className="metric-title">Live INR Balance</span>
            <span className="metric-tag inr">Indian Brokers</span>
          </div>
          <div className="metric-body">
            <div className="metric-value font-mono text-inr">
              {formatINR(summary?.liveEquityINR)}
            </div>
            <div className="metric-caption">
              Angel One SmartAPI & Upstox Total
            </div>
          </div>
        </div>

        <div className="account-metric-card paper">
          <div className="metric-header">
            <span className="metric-title">Paper Trading Wallet</span>
            <span className="metric-tag virtual">Virtual Portfolio</span>
          </div>
          <div className="metric-body">
            <div className="metric-value font-mono text-paper">
              {formatUSD(paperTrading.totalEquity)}
            </div>
            <div className="metric-caption">
              Available Virtual Simulation Funds
            </div>
          </div>
        </div>

        <div className="account-metric-card brokers">
          <div className="metric-header">
            <span className="metric-title">Connected Brokers</span>
            <span className="metric-tag count">{totalConnected} Active</span>
          </div>
          <div className="metric-body">
            <div className="metric-value font-mono text-accent">
              {totalConnected} <span className="text-sub">/ 7 Supported</span>
            </div>
            <div className="metric-caption">
              <Link to="/exchanges" className="link-hover">
                + Connect additional brokers ↗
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. CRYPTO & DEX BROKER FUNDS (USD) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="broker-section">
        <div className="section-title-group">
          <div className="section-icon crypto">
            <Coins size={18} />
          </div>
          <div>
            <h2>Crypto Exchanges & Solana DEX Wallets</h2>
            <p className="section-desc">Spot crypto assets, trading balances, and on-chain liquidity</p>
          </div>
        </div>

        <div className="broker-cards-grid">
          {/* BINANCE */}
          <div className={`broker-card ${binance.connected ? 'connected' : 'disconnected'}`}>
            <div className="broker-card-header">
              <div className="broker-identity">
                <div className="broker-logo binance">
                  <span>BN</span>
                </div>
                <div>
                  <h3>Binance</h3>
                  <span className="broker-type">Crypto Spot & Derivatives</span>
                </div>
              </div>
              <span className={`status-pill ${binance.connected ? 'active' : 'inactive'}`}>
                {binance.connected ? '● Live Connected' : '○ Not Connected'}
              </span>
            </div>

            <div className="broker-card-body">
              {binance.connected ? (
                <>
                  <div className="broker-balance-row main">
                    <span className="label">Total USD Value</span>
                    <span className="val font-mono font-bold">{formatUSD(binance.totalUSD)}</span>
                  </div>
                  <div className="broker-balance-row">
                    <span className="label">Available Cash (USDT/USD)</span>
                    <span className="val font-mono text-accent">{formatUSD(binance.cash)}</span>
                  </div>

                  <div className="assets-breakdown">
                    <div className="assets-header">
                      <span>Coin Holdings ({binance.assets?.length || 0})</span>
                      <span>USD Value</span>
                    </div>
                    {binance.assets?.length > 0 ? (
                      <div className="assets-scroll-list">
                        {binance.assets.map((ast) => (
                          <div key={ast.asset} className="asset-item">
                            <div className="asset-name-col">
                              <span className="asset-sym">{ast.asset}</span>
                              <span className="asset-qty font-mono">
                                Free: {ast.free > 1 ? ast.free.toFixed(2) : ast.free.toFixed(5)}
                                {ast.locked > 0 && ` | In Orders: ${ast.locked.toFixed(2)}`}
                              </span>
                            </div>
                            <div className="asset-val-col font-mono">
                              {formatUSD(ast.usdValue)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-assets">
                        <span>No crypto balances deposited on this account.</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="broker-empty-state">
                  <p>Binance API keys not connected for this account.</p>
                  <small>Connect your API Key & Secret in Exchanges to auto-fetch your balance.</small>
                  <Link to="/exchanges" className="connect-btn">
                    Connect Binance
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* COINDCX */}
          <div className={`broker-card ${coindcx.connected ? 'connected' : 'disconnected'}`}>
            <div className="broker-card-header">
              <div className="broker-identity">
                <div className="broker-logo coindcx">
                  <span>DCX</span>
                </div>
                <div>
                  <h3>CoinDCX</h3>
                  <span className="broker-type">Crypto Spot & INR Markets</span>
                </div>
              </div>
              <span className={`status-pill ${coindcx.connected ? 'active' : 'inactive'}`}>
                {coindcx.connected ? '● Live Connected' : '○ Not Connected'}
              </span>
            </div>

            <div className="broker-card-body">
              {coindcx.connected ? (
                <>
                  <div className="broker-balance-row main">
                    <span className="label">Total Portfolio Value</span>
                    <div style={{ textAlign: 'right' }}>
                      <span className="val font-mono font-bold">{formatUSD(coindcx.totalUSD)}</span>
                      {coindcx.totalINR > 0 && (
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          ≈ ₹{Number(coindcx.totalINR).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="broker-balance-row">
                    <span className="label">Available Cash</span>
                    <div style={{ textAlign: 'right' }}>
                      <span className="val font-mono text-accent">{formatUSD(coindcx.cash)} USDT</span>
                      {coindcx.cashINR > 0 && (
                        <span className="val font-mono text-accent" style={{ marginLeft: 8 }}>
                          | ₹{Number(coindcx.cashINR).toLocaleString('en-IN', { maximumFractionDigits: 2 })} INR
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="assets-breakdown">
                    <div className="assets-header">
                      <span>Coin Holdings ({coindcx.assets?.length || 0})</span>
                      <span>USD / INR Value</span>
                    </div>
                    {coindcx.assets?.length > 0 ? (
                      <div className="assets-scroll-list">
                        {coindcx.assets.map((ast) => (
                          <div key={ast.asset} className="asset-item">
                            <div className="asset-name-col">
                              <span className="asset-sym">{ast.asset}</span>
                              <span className="asset-qty font-mono">
                                Free: {ast.free > 1 ? ast.free.toFixed(2) : ast.free.toFixed(5)}
                                {ast.locked > 0 && ` | In Orders: ${ast.locked.toFixed(2)}`}
                              </span>
                            </div>
                            <div className="asset-val-col font-mono" style={{ textAlign: 'right' }}>
                              <div>{formatUSD(ast.usdValue)}</div>
                              {ast.inrValue > 0 && (
                                <small style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                  ₹{Number(ast.inrValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </small>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-assets">
                        <span>No crypto balances deposited on CoinDCX.</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="broker-empty-state">
                  <p>CoinDCX API keys not configured.</p>
                  <small>Add your CoinDCX API Key & Secret in Exchanges to auto-fetch your wallet.</small>
                  <Link to="/exchanges" className="connect-btn">
                    Connect CoinDCX
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* PIONEX */}
          <div className={`broker-card ${pionex.connected ? 'connected' : 'disconnected'}`}>
            <div className="broker-card-header">
              <div className="broker-identity">
                <div className="broker-logo pionex">
                  <span>PX</span>
                </div>
                <div>
                  <h3>Pionex</h3>
                  <span className="broker-type">Automated Bot Exchange</span>
                </div>
              </div>
              <span className={`status-pill ${pionex.connected ? 'active' : 'inactive'}`}>
                {pionex.connected ? '● Live Connected' : '○ Not Connected'}
              </span>
            </div>

            <div className="broker-card-body">
              {pionex.connected ? (
                <>
                  <div className="broker-balance-row main">
                    <span className="label">Total USD Value</span>
                    <span className="val font-mono font-bold">{formatUSD(pionex.totalUSD)}</span>
                  </div>
                  <div className="broker-balance-row">
                    <span className="label">Available Cash (USDT)</span>
                    <span className="val font-mono text-accent">{formatUSD(pionex.cash)}</span>
                  </div>

                  <div className="assets-breakdown">
                    <div className="assets-header">
                      <span>Coin Holdings ({pionex.assets?.length || 0})</span>
                      <span>USD Value</span>
                    </div>
                    {pionex.assets?.length > 0 ? (
                      <div className="assets-scroll-list">
                        {pionex.assets.map((ast) => (
                          <div key={ast.asset} className="asset-item">
                            <div className="asset-name-col">
                              <span className="asset-sym">{ast.asset}</span>
                              <span className="asset-qty font-mono">
                                Free: {ast.free > 1 ? ast.free.toFixed(2) : ast.free.toFixed(5)}
                              </span>
                            </div>
                            <div className="asset-val-col font-mono">
                              {formatUSD(ast.usdValue)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-assets">
                        <span>No crypto balances found on Pionex.</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="broker-empty-state">
                  <p>Pionex API keys not configured.</p>
                  <small>Add your Pionex API credentials to view your bot wallet.</small>
                  <Link to="/exchanges" className="connect-btn">
                    Connect Pionex
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* JUPITER SOLANA DEX */}
          <div className={`broker-card ${jupiter.connected ? 'connected' : 'disconnected'}`}>
            <div className="broker-card-header">
              <div className="broker-identity">
                <div className="broker-logo jupiter">
                  <span>JUP</span>
                </div>
                <div>
                  <h3>Jupiter (Solana DEX)</h3>
                  <span className="broker-type">On-Chain Solana DEX Wallet</span>
                </div>
              </div>
              <span className={`status-pill ${jupiter.connected ? 'active' : 'inactive'}`}>
                {jupiter.connected ? '● Live On-Chain' : '○ Not Connected'}
              </span>
            </div>

            <div className="broker-card-body">
              {jupiter.connected ? (
                <>
                  {jupiter.walletAddress && (
                    <div className="wallet-address-bar">
                      <span className="label">Wallet:</span>
                      <span className="addr font-mono">
                        {jupiter.walletAddress.slice(0, 6)}...{jupiter.walletAddress.slice(-6)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(jupiter.walletAddress)}
                        className="copy-addr-btn"
                        title="Copy Solana Wallet Address"
                      >
                        {copiedWallet ? <Check size={13} className="text-positive" /> : <Copy size={13} />}
                      </button>
                      <a
                        href={`https://solscan.io/account/${jupiter.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="explorer-link"
                        title="View on Solscan Explorer"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  )}

                  <div className="broker-balance-row main">
                    <span className="label">Total Solana Value</span>
                    <span className="val font-mono font-bold">{formatUSD(jupiter.totalUSD)}</span>
                  </div>
                  <div className="broker-balance-row">
                    <span className="label">Native SOL Balance</span>
                    <span className="val font-mono text-accent">{jupiter.solBalance} SOL</span>
                  </div>

                  <div className="assets-breakdown">
                    <div className="assets-header">
                      <span>SPL Tokens ({jupiter.assets?.length || 0})</span>
                      <span>USD Value</span>
                    </div>
                    {jupiter.assets?.length > 0 ? (
                      <div className="assets-scroll-list">
                        {jupiter.assets.map((ast) => (
                          <div key={ast.asset} className="asset-item">
                            <div className="asset-name-col">
                              <span className="asset-sym">{ast.asset}</span>
                              <span className="asset-qty font-mono">
                                {ast.total > 1 ? ast.total.toFixed(2) : ast.total.toFixed(4)}
                              </span>
                            </div>
                            <div className="asset-val-col font-mono">
                              {formatUSD(ast.usdValue)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-assets">
                        <span>No on-chain token balances detected.</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="broker-empty-state">
                  <p>Solana wallet not connected for Jupiter DEX trading.</p>
                  <small>Add your Solana Private Key in Exchanges to trade on-chain with auto-fetched SOL & SPL balances.</small>
                  <Link to="/exchanges" className="connect-btn">
                    Connect Jupiter DEX
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* KRAKEN */}
          <div className={`broker-card ${kraken.connected ? 'connected' : 'disconnected'}`}>
            <div className="broker-card-header">
              <div className="broker-identity">
                <div className="broker-logo kraken">
                  <span>KR</span>
                </div>
                <div>
                  <h3>Kraken</h3>
                  <span className="broker-type">Global Crypto Exchange</span>
                </div>
              </div>
              <span className={`status-pill ${kraken.connected ? 'active' : 'inactive'}`}>
                {kraken.connected ? '● Live Connected' : '○ Not Connected'}
              </span>
            </div>

            <div className="broker-card-body">
              {kraken.connected ? (
                <>
                  <div className="broker-balance-row main">
                    <span className="label">Total USD Value</span>
                    <span className="val font-mono font-bold">{formatUSD(kraken.totalUSD)}</span>
                  </div>
                  <div className="broker-balance-row">
                    <span className="label">Available USD Cash</span>
                    <span className="val font-mono text-accent">{formatUSD(kraken.cash)}</span>
                  </div>
                  <div className="assets-breakdown">
                    <div className="assets-header">
                      <span>Assets ({kraken.assets?.length || 0})</span>
                      <span>USD Value</span>
                    </div>
                    {kraken.assets?.length > 0 ? (
                      <div className="assets-scroll-list">
                        {kraken.assets.map((ast) => (
                          <div key={ast.asset} className="asset-item">
                            <span className="asset-sym">{ast.asset}</span>
                            <span className="asset-val-col font-mono">{formatUSD(ast.usdValue)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-assets">
                        <span>No balances found on Kraken.</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="broker-empty-state">
                  <p>Kraken API credentials not configured.</p>
                  <small>Connect your Kraken API key to auto-sync portfolio funds.</small>
                  <Link to="/exchanges" className="connect-btn">
                    Connect Kraken
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. INDIAN STOCK BROKERS (INR) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="broker-section">
        <div className="section-title-group">
          <div className="section-icon indian">
            <IndianRupee size={18} />
          </div>
          <div>
            <h2>Indian Stock Brokers (NSE & BSE)</h2>
            <p className="section-desc">Real-time margin, demat stock holdings, and cash balances in Indian Rupees (₹)</p>
          </div>
        </div>

        <div className="broker-cards-grid two-col">
          {/* ANGEL ONE */}
          <div className={`broker-card large ${angelone.connected ? 'connected' : 'disconnected'}`}>
            <div className="broker-card-header">
              <div className="broker-identity">
                <div className="broker-logo angelone">
                  <span>AO</span>
                </div>
                <div>
                  <h3>Angel One SmartAPI</h3>
                  <span className="broker-type">NSE / BSE Equity & Derivatives</span>
                </div>
              </div>
              <span className={`status-pill ${angelone.connected ? 'active' : 'inactive'}`}>
                {angelone.connected ? '● Connected SmartAPI' : '○ Not Connected'}
              </span>
            </div>

            <div className="broker-card-body">
              {angelone.connected ? (
                <>
                  <div className="broker-stats-row">
                    <div className="mini-stat">
                      <span className="label">Available Cash</span>
                      <span className="val font-mono text-positive">{formatINR(angelone.cash)}</span>
                    </div>
                    <div className="mini-stat">
                      <span className="label">Utilized Margin</span>
                      <span className="val font-mono">{formatINR(angelone.utilizedMargin)}</span>
                    </div>
                    <div className="mini-stat">
                      <span className="label">Holdings Value</span>
                      <span className="val font-mono text-accent">{formatINR(angelone.holdingsValue)}</span>
                    </div>
                    <div className="mini-stat highlight">
                      <span className="label">Total Equity (INR)</span>
                      <span className="val font-mono font-bold text-inr">{formatINR(angelone.totalINR)}</span>
                    </div>
                  </div>

                  {angelone.positions?.length > 0 && (
                    <div className="holdings-table-container">
                      <h4>Demat Stock Holdings ({angelone.positions.length})</h4>
                      <table className="account-holdings-table">
                        <thead>
                          <tr>
                            <th>Stock</th>
                            <th>Quantity</th>
                            <th>LTP</th>
                            <th>Total Value</th>
                            <th>P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {angelone.positions.map((pos) => (
                            <tr key={pos.symbol || pos.tradingsymbol}>
                              <td className="font-semibold">{pos.symbol || pos.tradingsymbol}</td>
                              <td className="font-mono">{pos.qty || pos.quantity}</td>
                              <td className="font-mono">₹{Number(pos.currentPrice || pos.ltp || 0).toFixed(2)}</td>
                              <td className="font-mono font-semibold">{formatINR(pos.marketValue || pos.totalValue)}</td>
                              <td className={`font-mono ${Number(pos.pnl || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                                {Number(pos.pnl || 0) >= 0 ? '+' : ''}₹{Number(pos.pnl || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="broker-empty-state">
                  <p>Angel One SmartAPI is not configured.</p>
                  <small>Connect with your API Key, Client Code, MPIN/Password, and TOTP Secret for live NSE/BSE trading and auto-fetched wallet balances.</small>
                  <Link to="/exchanges" className="connect-btn">
                    Connect Angel One
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* UPSTOX */}
          <div className={`broker-card large ${upstox.connected ? 'connected' : 'disconnected'}`}>
            <div className="broker-card-header">
              <div className="broker-identity">
                <div className="broker-logo upstox">
                  <span>UP</span>
                </div>
                <div>
                  <h3>Upstox</h3>
                  <span className="broker-type">NSE / BSE Discount Brokerage</span>
                </div>
              </div>
              <span className={`status-pill ${upstox.connected ? 'active' : 'inactive'}`}>
                {upstox.connected ? '● Connected OAuth' : '○ Not Connected'}
              </span>
            </div>

            <div className="broker-card-body">
              {upstox.connected ? (
                <>
                  <div className="broker-stats-row">
                    <div className="mini-stat">
                      <span className="label">Available Margin</span>
                      <span className="val font-mono text-positive">{formatINR(upstox.cash)}</span>
                    </div>
                    <div className="mini-stat">
                      <span className="label">Used Margin</span>
                      <span className="val font-mono">{formatINR(upstox.utilizedMargin)}</span>
                    </div>
                    <div className="mini-stat">
                      <span className="label">Holdings Value</span>
                      <span className="val font-mono text-accent">{formatINR(upstox.holdingsValue)}</span>
                    </div>
                    <div className="mini-stat highlight">
                      <span className="label">Total Equity (INR)</span>
                      <span className="val font-mono font-bold text-inr">{formatINR(upstox.totalINR)}</span>
                    </div>
                  </div>

                  {upstox.positions?.length > 0 && (
                    <div className="holdings-table-container">
                      <h4>Stock Positions & Holdings ({upstox.positions.length})</h4>
                      <table className="account-holdings-table">
                        <thead>
                          <tr>
                            <th>Stock</th>
                            <th>Quantity</th>
                            <th>LTP</th>
                            <th>Total Value</th>
                            <th>P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upstox.positions.map((pos) => (
                            <tr key={pos.symbol}>
                              <td className="font-semibold">{pos.symbol}</td>
                              <td className="font-mono">{pos.qty}</td>
                              <td className="font-mono">₹{Number(pos.currentPrice || 0).toFixed(2)}</td>
                              <td className="font-mono font-semibold">{formatINR(pos.marketValue)}</td>
                              <td className={`font-mono ${Number(pos.pnl || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                                {Number(pos.pnl || 0) >= 0 ? '+' : ''}₹{Number(pos.pnl || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="broker-empty-state">
                  <p>Upstox OAuth connection not active.</p>
                  <small>Log in with Upstox OAuth to view your live margin and demat holdings.</small>
                  <a href="/api/upstox/auth" className="connect-btn">
                    Connect Upstox
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. US STOCK BROKERS (USD) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="broker-section">
        <div className="section-title-group">
          <div className="section-icon us-stocks">
            <DollarSign size={18} />
          </div>
          <div>
            <h2>US Stock Brokers (NASDAQ & NYSE)</h2>
            <p className="section-desc">Direct stock trading, buying power, and portfolio equity via Alpaca</p>
          </div>
        </div>

        <div className="broker-cards-grid">
          {/* ALPACA */}
          <div className={`broker-card large ${alpaca.connected ? 'connected' : 'disconnected'}`}>
            <div className="broker-card-header">
              <div className="broker-identity">
                <div className="broker-logo alpaca">
                  <span>ALP</span>
                </div>
                <div>
                  <h3>Alpaca Securities</h3>
                  <span className="broker-type">NASDAQ, NYSE Commission-Free Stocks</span>
                </div>
              </div>
              <span className={`status-pill ${alpaca.connected ? 'active' : 'inactive'}`}>
                {alpaca.connected ? '● Live Connected' : '○ Not Connected'}
              </span>
            </div>

            <div className="broker-card-body">
              {alpaca.connected ? (
                <>
                  <div className="broker-stats-row">
                    <div className="mini-stat">
                      <span className="label">Cash Available</span>
                      <span className="val font-mono text-positive">{formatUSD(alpaca.cash)}</span>
                    </div>
                    <div className="mini-stat">
                      <span className="label">Buying Power</span>
                      <span className="val font-mono text-accent">{formatUSD(alpaca.buyingPower)}</span>
                    </div>
                    <div className="mini-stat">
                      <span className="label">Portfolio Value</span>
                      <span className="val font-mono">{formatUSD(alpaca.portfolioValue)}</span>
                    </div>
                    <div className="mini-stat highlight">
                      <span className="label">Total Equity</span>
                      <span className="val font-mono font-bold">{formatUSD(alpaca.equity)}</span>
                    </div>
                  </div>

                  {alpaca.positions?.length > 0 && (
                    <div className="holdings-table-container">
                      <h4>Open Positions ({alpaca.positions.length})</h4>
                      <table className="account-holdings-table">
                        <thead>
                          <tr>
                            <th>Ticker</th>
                            <th>Quantity</th>
                            <th>Current Price</th>
                            <th>Market Value</th>
                            <th>Unrealized P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alpaca.positions.map((pos) => (
                            <tr key={pos.symbol}>
                              <td className="font-semibold">{pos.symbol}</td>
                              <td className="font-mono">{pos.qty}</td>
                              <td className="font-mono">${Number(pos.currentPrice || 0).toFixed(2)}</td>
                              <td className="font-mono font-semibold">{formatUSD(pos.marketValue)}</td>
                              <td className={`font-mono ${Number(pos.unrealizedPL || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                                {Number(pos.unrealizedPL || 0) >= 0 ? '+' : ''}{formatUSD(pos.unrealizedPL)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="broker-empty-state">
                  <p>Alpaca API credentials not connected.</p>
                  <small>Connect your Alpaca API key to trade US stocks with real-time equity tracking.</small>
                  <Link to="/exchanges" className="connect-btn">
                    Connect Alpaca
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. PAPER TRADING VIRTUAL WALLET */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="broker-section">
        <div className="section-title-group">
          <div className="section-icon paper">
            <Sparkles size={18} />
          </div>
          <div>
            <h2>Virtual Paper Trading Wallet</h2>
            <p className="section-desc">Zero-risk simulated environment for testing AI bots and algorithmic strategies</p>
          </div>
        </div>

        <div className="broker-card full-width paper-wallet-card">
          <div className="broker-card-header">
            <div className="broker-identity">
              <div className="broker-logo paper">
                <span>SIM</span>
              </div>
              <div>
                <h3>Paper Trading Simulation Engine</h3>
                <span className="broker-type">Virtual USD Wallet</span>
              </div>
            </div>
            <span className="status-pill virtual">
              ● Ready for Simulation
            </span>
          </div>

          <div className="broker-card-body">
            <div className="broker-stats-row">
              <div className="mini-stat">
                <span className="label">Available Virtual Cash</span>
                <span className="val font-mono text-paper">{formatUSD(paperTrading.balance)}</span>
              </div>
              <div className="mini-stat">
                <span className="label">Locked in Active Bot Grids</span>
                <span className="val font-mono">{formatUSD(paperTrading.lockedFunds)}</span>
              </div>
              <div className="mini-stat">
                <span className="label">Active Portfolio Value</span>
                <span className="val font-mono">{formatUSD(paperTrading.portfolioValue)}</span>
              </div>
              <div className="mini-stat highlight">
                <span className="label">Total Virtual Equity</span>
                <span className="val font-mono font-bold text-paper">{formatUSD(paperTrading.totalEquity)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="account-footer-bar">
        <div className="footer-left">
          <span className="footer-info-pill">
            <Shield size={13} className="text-positive" />
            <strong>Multi-Tenant Key Security:</strong> All API keys isolated per user
          </span>
          <span className="footer-info-pill">
            <Radio size={13} className="text-accent" />
            <strong>Real-Time Sync:</strong> Active on market ticks
          </span>
        </div>
        <div className="footer-right">
          <span className="last-synced-text">
            Last Synced: {lastRefreshTime ? lastRefreshTime.toLocaleTimeString() : 'Just now'}
          </span>
        </div>
      </div>
    </div>
  );
}
