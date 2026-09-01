import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function Account() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAccountSummary();
  }, []);

  async function fetchAccountSummary() {
    setLoading(true);
    try {
      const res = await api.get('/api/account/summary');
      setSummary(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load account summary');
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount, currency = 'USD') {
    if (currency === 'INR') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
      }).format(amount || 0);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(amount || 0);
  }

  if (loading) {
    return (
      <div className="account-page">
        <div className="loading-spinner">Loading account data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="account-page">
        <div className="error-message">{error}</div>
        <button onClick={fetchAccountSummary} className="btn btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="page-header">
        <h1>My Account</h1>
        <button onClick={fetchAccountSummary} className="btn btn-secondary">
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="account-summary-grid">
        <div className="summary-card total-usd">
          <div className="card-icon">$</div>
          <div className="card-content">
            <span className="card-label">Total USD Funds</span>
            <span className="card-value">{formatCurrency(summary?.totalUSD)}</span>
          </div>
        </div>
        <div className="summary-card total-inr">
          <div className="card-icon">₹</div>
          <div className="card-content">
            <span className="card-label">Total INR Funds</span>
            <span className="card-value">{formatCurrency(summary?.totalINR, 'INR')}</span>
          </div>
        </div>
        <div className="summary-card paper-funds">
          <div className="card-icon">📝</div>
          <div className="card-content">
            <span className="card-label">Paper Trading</span>
            <span className="card-value">{formatCurrency(summary?.paperTrading?.totalEquity)}</span>
          </div>
        </div>
      </div>

      {/* Fund Categories */}
      <div className="funds-grid">
        {/* Paper Trading */}
        <div className="fund-card">
          <div className="fund-header">
            <h2>Paper Trading Funds</h2>
            <span className="badge badge-paper">Virtual</span>
          </div>
          <div className="fund-body">
            <div className="fund-row">
              <span>Available Balance</span>
              <span className="value">{formatCurrency(summary?.paperTrading?.balance)}</span>
            </div>
            <div className="fund-row">
              <span>Portfolio Value</span>
              <span className="value">{formatCurrency(summary?.paperTrading?.portfolioValue)}</span>
            </div>
            <div className="fund-row">
              <span>Locked in Orders</span>
              <span className="value">{formatCurrency(summary?.paperTrading?.lockedFunds)}</span>
            </div>
            <div className="fund-row total">
              <span>Total Equity</span>
              <span className="value">{formatCurrency(summary?.paperTrading?.totalEquity)}</span>
            </div>
          </div>
          <div className="fund-footer">
            <span className="status connected">Ready for Paper Trading</span>
          </div>
        </div>

        {/* Dollar Funds (Alpaca) */}
        <div className="fund-card">
          <div className="fund-header">
            <h2>Dollar Funds (US Stocks)</h2>
            <span className="badge badge-live">Live</span>
          </div>
          <div className="fund-body">
            {summary?.dollarFunds?.alpaca?.connected ? (
              <>
                <div className="fund-row">
                  <span>Cash Available</span>
                  <span className="value">{formatCurrency(summary.dollarFunds.alpaca.cash)}</span>
                </div>
                <div className="fund-row">
                  <span>Buying Power</span>
                  <span className="value">{formatCurrency(summary.dollarFunds.alpaca.buyingPower)}</span>
                </div>
                <div className="fund-row">
                  <span>Portfolio Value</span>
                  <span className="value">{formatCurrency(summary.dollarFunds.alpaca.portfolioValue)}</span>
                </div>
                <div className="fund-row total">
                  <span>Total Equity</span>
                  <span className="value">{formatCurrency(summary.dollarFunds.alpaca.equity)}</span>
                </div>
                <div className="fund-meta">
                  <span>Account: {summary.dollarFunds.alpaca.accountId?.slice(0, 8)}...</span>
                  <span>Status: {summary.dollarFunds.alpaca.status}</span>
                </div>
              </>
            ) : (
              <div className="fund-empty">
                <p>Alpaca not connected</p>
                <small>{summary?.dollarFunds?.alpaca?.error}</small>
              </div>
            )}
          </div>
          <div className="fund-footer">
            <span className={`status ${summary?.dollarFunds?.alpaca?.connected ? 'connected' : 'disconnected'}`}>
              {summary?.dollarFunds?.alpaca?.connected ? 'Connected to Alpaca' : 'Not Connected'}
            </span>
            <span className="exchanges">NASDAQ, NYSE</span>
          </div>
        </div>

        {/* Indian Rupee Funds (Upstox) */}
        <div className="fund-card">
          <div className="fund-header">
            <h2>Indian Rupee Funds</h2>
            <span className="badge badge-live">Live</span>
          </div>
          <div className="fund-body">
            {summary?.indianFunds?.upstox?.connected ? (
              <>
                <div className="fund-row">
                  <span>Positions Value</span>
                  <span className="value">{formatCurrency(summary.indianFunds.upstox.positionsValue, 'INR')}</span>
                </div>
                <div className="fund-row">
                  <span>Holdings Value</span>
                  <span className="value">{formatCurrency(summary.indianFunds.upstox.holdingsValue, 'INR')}</span>
                </div>
                <div className="fund-row total">
                  <span>Total Value</span>
                  <span className="value">{formatCurrency(summary.indianFunds.upstox.totalValue, 'INR')}</span>
                </div>
                <div className="fund-meta">
                  <span>Positions: {summary.indianFunds.upstox.positionsCount}</span>
                  <span>Holdings: {summary.indianFunds.upstox.holdingsCount}</span>
                </div>
              </>
            ) : (
              <div className="fund-empty">
                <p>Upstox not connected</p>
                <small>{summary?.indianFunds?.upstox?.error}</small>
                <a href="/api/upstox/auth" className="btn btn-sm btn-primary mt-2">Connect Upstox</a>
              </div>
            )}
          </div>
          <div className="fund-footer">
            <span className={`status ${summary?.indianFunds?.upstox?.connected ? 'connected' : 'disconnected'}`}>
              {summary?.indianFunds?.upstox?.connected ? 'Connected to Upstox' : 'Not Connected'}
            </span>
            <span className="exchanges">NSE, BSE</span>
          </div>
        </div>

        {/* Crypto Funds (Pionex) */}
        <div className="fund-card">
          <div className="fund-header">
            <h2>Pionex Funds</h2>
            <span className="badge badge-live">Live</span>
          </div>
          <div className="fund-body">
            {summary?.cryptoFunds?.pionex?.connected ? (
              <>
                {summary.cryptoFunds.pionex.assets?.length > 0 ? (
                  <>
                    <div className="crypto-assets">
                      {summary.cryptoFunds.pionex.assets.map((asset, idx) => (
                        <div key={idx} className="fund-row">
                          <span>{asset.asset}</span>
                          <span className="value">
                            {asset.total.toFixed(6)}
                            {asset.usdValue > 0 && (
                              <small className="usd-value"> ({formatCurrency(asset.usdValue)})</small>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="fund-row total">
                      <span>Total USD Value</span>
                      <span className="value">{formatCurrency(summary.cryptoFunds.pionex.totalUSD)}</span>
                    </div>
                  </>
                ) : (
                  <div className="fund-empty">
                    <p>No crypto assets</p>
                    <small>Deposit funds on Pionex to start trading</small>
                  </div>
                )}
              </>
            ) : (
              <div className="fund-empty">
                <p>Pionex not connected</p>
                <small>{summary?.cryptoFunds?.pionex?.error || 'Connect Pionex in Exchanges'}</small>
              </div>
            )}
          </div>
          <div className="fund-footer">
            <span className={`status ${summary?.cryptoFunds?.pionex?.connected ? 'connected' : 'disconnected'}`}>
              {summary?.cryptoFunds?.pionex?.connected ? 'Connected to Pionex' : 'Not Connected'}
            </span>
            <span className="exchanges">Pionex</span>
          </div>
        </div>

        {/* Crypto Funds (Binance) */}
        <div className="fund-card">
          <div className="fund-header">
            <h2>Binance Funds</h2>
            <span className="badge badge-live">Live</span>
          </div>
          <div className="fund-body">
            {summary?.cryptoFunds?.binance?.connected ? (
              <>
                {summary.cryptoFunds.binance.assets?.length > 0 ? (
                  <>
                    <div className="crypto-assets">
                      {summary.cryptoFunds.binance.assets.map((asset, idx) => (
                        <div key={idx} className="fund-row">
                          <span>{asset.asset}</span>
                          <span className="value">
                            {asset.total.toFixed(6)}
                            {asset.usdValue > 0 && (
                              <small className="usd-value"> ({formatCurrency(asset.usdValue)})</small>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="fund-row total">
                      <span>Total USD Value</span>
                      <span className="value">{formatCurrency(summary.cryptoFunds.binance.totalUSD)}</span>
                    </div>
                  </>
                ) : (
                  <div className="fund-empty">
                    <p>No crypto assets</p>
                    <small>Deposit funds to start trading</small>
                  </div>
                )}
              </>
            ) : (
              <div className="fund-empty">
                <p>Binance not connected</p>
                <small>{summary?.cryptoFunds?.binance?.error}</small>
              </div>
            )}
          </div>
          <div className="fund-footer">
            <span className={`status ${summary?.cryptoFunds?.binance?.connected ? 'connected' : 'disconnected'}`}>
              {summary?.cryptoFunds?.binance?.connected ? 'Connected to Binance' : 'Not Connected'}
            </span>
            <span className="exchanges">Binance</span>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="account-footer">
        <span>Last updated: {new Date(summary?.lastUpdated).toLocaleString()}</span>
      </div>
    </div>
  );
}
