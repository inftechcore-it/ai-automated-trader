import { useState, useEffect } from 'react';
import { Info, Radar, Search, TrendingUp, Zap, Shield, AlertTriangle } from 'lucide-react';

export default function DynamicGridForm({ params, onChange }) {
  const [localParams, setLocalParams] = useState({
    // Price range to scan for coins
    priceRangeLow: params.priceRangeLow || '',
    priceRangeHigh: params.priceRangeHigh || '',
    // Scanning
    scanPoolSize: params.scanPoolSize || 20,
    // Trade limits
    maxActiveCoins: params.maxActiveCoins || 10,
    maxBuysPerCoin: params.maxBuysPerCoin || 3,
    maxTotalBuys: params.maxTotalBuys || 30,
    // Grid config
    gridCount: params.gridCount || 5,
    totalInvestment: params.totalInvestment || 100,
    // Risk management
    profitTargetPercent: params.profitTargetPercent || 5,
    stopLossPercent: params.stopLossPercent || '',
    overallStopLossPercent: params.overallStopLossPercent || '',
    dailyLossLimitPercent: params.dailyLossLimitPercent || '',
    // Toggles
    enableStopLoss: !!params.stopLossPercent,
    enableOverallStopLoss: !!params.overallStopLossPercent,
    enableDailyLimit: !!params.dailyLossLimitPercent,
  });

  useEffect(() => {
    const { enableStopLoss, enableOverallStopLoss, enableDailyLimit, ...cleanParams } = localParams;

    // Clean up disabled options
    if (!enableStopLoss || cleanParams.stopLossPercent === '') {
      delete cleanParams.stopLossPercent;
    }
    if (!enableOverallStopLoss || cleanParams.overallStopLossPercent === '') {
      delete cleanParams.overallStopLossPercent;
    }
    if (!enableDailyLimit || cleanParams.dailyLossLimitPercent === '') {
      delete cleanParams.dailyLossLimitPercent;
    }

    // Always set auto mode
    cleanParams.coinSelectionMode = 'AUTO';
    onChange(cleanParams);
  }, [localParams]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  // Calculate investment breakdown
  const investmentPerCoin = localParams.totalInvestment / localParams.maxActiveCoins;
  const investmentPerGrid = investmentPerCoin / localParams.gridCount;
  const isValidInvestment = investmentPerGrid >= 1.10;

  // Calculate max exposure
  const maxExposure = localParams.maxTotalBuys * investmentPerGrid;

  return (
    <div className="strategy-form dynamic-grid-form">
      {/* Auto-Discovery Banner */}
      <div className="info-banner featured">
        <Radar size={20} />
        <div>
          <strong>Automatic Coin Discovery</strong>
          <p>Scans top coins by volume and trades those within your price range. No manual selection needed.</p>
        </div>
      </div>

      {/* Price Range Section */}
      <div className="form-section">
        <h4>
          <Search size={16} />
          Price Range Filter
        </h4>
        <p className="section-desc">Bot finds and trades coins priced within this range</p>

        <div className="form-row">
          <div className="form-group">
            <label>
              Minimum Price ($)
              <span className="tooltip">
                <Info size={14} />
                <span className="tooltip-text">Find coins priced above this amount</span>
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.001"
              value={localParams.priceRangeLow}
              onChange={e => updateParam('priceRangeLow', e.target.value)}
              placeholder="e.g. 0.05"
            />
          </div>

          <div className="form-group">
            <label>
              Maximum Price ($)
              <span className="tooltip">
                <Info size={14} />
                <span className="tooltip-text">Find coins priced below this amount</span>
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={localParams.priceRangeHigh}
              onChange={e => updateParam('priceRangeHigh', e.target.value)}
              placeholder="e.g. 1.00"
            />
          </div>
        </div>

        {/* Quick presets */}
        <div className="price-presets">
          <span>Presets:</span>
          <button type="button" onClick={() => { updateParam('priceRangeLow', '0.001'); updateParam('priceRangeHigh', '0.10'); }}>
            Micro ($0.001-$0.10)
          </button>
          <button type="button" onClick={() => { updateParam('priceRangeLow', '0.10'); updateParam('priceRangeHigh', '1.00'); }}>
            Small ($0.10-$1)
          </button>
          <button type="button" onClick={() => { updateParam('priceRangeLow', '1'); updateParam('priceRangeHigh', '10'); }}>
            Mid ($1-$10)
          </button>
          <button type="button" onClick={() => { updateParam('priceRangeLow', '10'); updateParam('priceRangeHigh', '100'); }}>
            Large ($10-$100)
          </button>
        </div>
      </div>

      <hr className="form-divider" />

      {/* Trade Limits Section */}
      <div className="form-section">
        <h4>
          <AlertTriangle size={16} />
          Trade Limits
        </h4>
        <p className="section-desc">Control exposure and prevent over-trading</p>

        <div className="form-row three-col">
          <div className="form-group">
            <label>
              Max Active Coins
              <span className="tooltip">
                <Info size={14} />
                <span className="tooltip-text">Maximum coins to trade simultaneously</span>
              </span>
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={localParams.maxActiveCoins}
              onChange={e => updateParam('maxActiveCoins', Number(e.target.value))}
            />
            <small>Coins traded at once</small>
          </div>

          <div className="form-group">
            <label>
              Max Buys / Coin
              <span className="tooltip">
                <Info size={14} />
                <span className="tooltip-text">Maximum buy orders per individual coin</span>
              </span>
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={localParams.maxBuysPerCoin}
              onChange={e => updateParam('maxBuysPerCoin', Number(e.target.value))}
            />
            <small>Buys per coin</small>
          </div>

          <div className="form-group">
            <label>
              Max Total Buys
              <span className="tooltip">
                <Info size={14} />
                <span className="tooltip-text">Maximum total buy orders across ALL coins. Bot stops buying when reached.</span>
              </span>
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={localParams.maxTotalBuys}
              onChange={e => updateParam('maxTotalBuys', Number(e.target.value))}
            />
            <small>Total buys allowed</small>
          </div>
        </div>

        {/* Limits Summary */}
        <div className="limits-summary">
          <div className="limit-item">
            <span>Max coins:</span>
            <strong>{localParams.maxActiveCoins}</strong>
          </div>
          <div className="limit-item">
            <span>Buys per coin:</span>
            <strong>{localParams.maxBuysPerCoin}</strong>
          </div>
          <div className="limit-item">
            <span>Total buys cap:</span>
            <strong>{localParams.maxTotalBuys}</strong>
          </div>
          <div className="limit-item highlight">
            <span>Max exposure:</span>
            <strong>${maxExposure.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <hr className="form-divider" />

      {/* Grid & Investment Section */}
      <div className="form-section">
        <h4>
          <Zap size={16} />
          Grid Configuration
        </h4>

        <div className="form-row">
          <div className="form-group">
            <label>Grid Levels</label>
            <input
              type="number"
              min="2"
              max="20"
              value={localParams.gridCount}
              onChange={e => updateParam('gridCount', Number(e.target.value))}
            />
            <small>Levels per coin</small>
          </div>

          <div className="form-group">
            <label>Total Investment ($)</label>
            <input
              type="number"
              min="20"
              step="10"
              value={localParams.totalInvestment}
              onChange={e => updateParam('totalInvestment', Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>Profit Target (%)</label>
            <input
              type="number"
              min="1"
              max="50"
              step="0.5"
              value={localParams.profitTargetPercent}
              onChange={e => updateParam('profitTargetPercent', Number(e.target.value))}
            />
            <small>Per-coin take profit</small>
          </div>
        </div>
      </div>

      {/* Investment Breakdown */}
      <div className={`investment-breakdown ${!isValidInvestment ? 'warning' : ''}`}>
        <div className="breakdown-title">Investment Breakdown</div>
        <div className="breakdown-grid">
          <div className="breakdown-item">
            <span>Total:</span>
            <strong>${localParams.totalInvestment}</strong>
          </div>
          <div className="breakdown-item">
            <span>Per Coin ({localParams.maxActiveCoins} coins):</span>
            <strong>${investmentPerCoin.toFixed(2)}</strong>
          </div>
          <div className="breakdown-item">
            <span>Per Grid Order:</span>
            <strong>${investmentPerGrid.toFixed(2)}</strong>
          </div>
        </div>
        {!isValidInvestment && (
          <div className="breakdown-warning">
            Min $1.10 per order required. Increase investment or reduce grid count/coins.
          </div>
        )}
      </div>

      <hr className="form-divider" />

      {/* Risk Management Section */}
      <div className="form-section">
        <h4>
          <Shield size={16} />
          Risk Management
        </h4>
        <p className="section-desc">Protect your portfolio with automatic stops</p>

        <div className="risk-options">
          {/* Per-Coin Stop Loss */}
          <div className="risk-option">
            <label className="risk-toggle">
              <input
                type="checkbox"
                checked={localParams.enableStopLoss}
                onChange={e => updateParam('enableStopLoss', e.target.checked)}
              />
              <span>Per-Coin Stop Loss</span>
            </label>
            {localParams.enableStopLoss && (
              <div className="risk-input">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="50"
                  placeholder="10"
                  value={localParams.stopLossPercent}
                  onChange={e => updateParam('stopLossPercent', e.target.value)}
                />
                <span>%</span>
              </div>
            )}
            <small>Exit individual coin if it drops X% from entry</small>
          </div>

          {/* Overall Portfolio Stop Loss */}
          <div className="risk-option featured">
            <label className="risk-toggle">
              <input
                type="checkbox"
                checked={localParams.enableOverallStopLoss}
                onChange={e => updateParam('enableOverallStopLoss', e.target.checked)}
              />
              <span>Overall Stop Loss (Drawdown)</span>
            </label>
            {localParams.enableOverallStopLoss && (
              <div className="risk-input">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="50"
                  placeholder="15"
                  value={localParams.overallStopLossPercent}
                  onChange={e => updateParam('overallStopLossPercent', e.target.value)}
                />
                <span>%</span>
              </div>
            )}
            <small>Stop entire bot if portfolio drops X% from peak value</small>
          </div>

          {/* Daily Loss Limit */}
          <div className="risk-option">
            <label className="risk-toggle">
              <input
                type="checkbox"
                checked={localParams.enableDailyLimit}
                onChange={e => updateParam('enableDailyLimit', e.target.checked)}
              />
              <span>Daily Loss Limit</span>
            </label>
            {localParams.enableDailyLimit && (
              <div className="risk-input">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="30"
                  placeholder="5"
                  value={localParams.dailyLossLimitPercent}
                  onChange={e => updateParam('dailyLossLimitPercent', e.target.value)}
                />
                <span>%</span>
              </div>
            )}
            <small>Pause trading for the day if losses exceed X%</small>
          </div>
        </div>
      </div>

      {/* Scan Pool Size (collapsed) */}
      <div className="form-group scan-pool">
        <label>
          Scan Pool Size
          <span className="tooltip">
            <Info size={14} />
            <span className="tooltip-text">How many top coins (by volume) to scan for matches</span>
          </span>
        </label>
        <div className="pool-size-selector">
          {[10, 20, 30, 50].map(size => (
            <button
              key={size}
              type="button"
              className={`pool-btn ${localParams.scanPoolSize === size ? 'active' : ''}`}
              onClick={() => updateParam('scanPoolSize', size)}
            >
              Top {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
