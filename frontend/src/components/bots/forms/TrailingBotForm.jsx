import { useState, useEffect } from 'react';
import { Info, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';

export default function TrailingBotForm({ params, onChange, symbolInfo }) {
  const [localParams, setLocalParams] = useState({
    side: params.side || 'trailing_sell',
    triggerPrice: params.triggerPrice || '',
    trailingPercent: params.trailingPercent || 3,
    quantity: params.quantity || 100,
  });

  useEffect(() => {
    onChange(localParams);
  }, [localParams]);

  useEffect(() => {
    if (symbolInfo?.last && !localParams.triggerPrice) {
      const price = symbolInfo.last;
      const defaultTrigger = localParams.side === 'trailing_sell'
        ? price * 1.05
        : price * 0.95;
      setLocalParams(p => ({ ...p, triggerPrice: defaultTrigger.toFixed(6) }));
    }
  }, [symbolInfo, localParams.side]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  const currentPrice = symbolInfo?.last || 0;
  const triggerPrice = Number(localParams.triggerPrice) || 0;
  const isSell = localParams.side === 'trailing_sell';

  return (
    <div className="strategy-form trailing-bot-form">
      <div className="form-group">
        <label>Trailing Type</label>
        <div className="toggle-group">
          <button
            className={`toggle-btn ${localParams.side === 'trailing_sell' ? 'active' : ''}`}
            onClick={() => updateParam('side', 'trailing_sell')}
          >
            <TrendingUp size={16} /> Trailing Sell
          </button>
          <button
            className={`toggle-btn ${localParams.side === 'trailing_buy' ? 'active' : ''}`}
            onClick={() => updateParam('side', 'trailing_buy')}
          >
            <TrendingDown size={16} /> Trailing Buy
          </button>
        </div>
        <small>
          {isSell
            ? 'Wait for price to rise above trigger, then sell when it drops from peak'
            : 'Wait for price to fall below trigger, then buy when it rises from trough'}
        </small>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>
            Trigger Price ($)
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">
                {isSell
                  ? 'Trailing activates when price reaches or exceeds this level'
                  : 'Trailing activates when price falls to or below this level'}
              </span>
            </span>
          </label>
          <input
            type="number"
            step="0.000001"
            value={localParams.triggerPrice}
            onChange={e => updateParam('triggerPrice', e.target.value)}
            placeholder={`Current: ${currentPrice}`}
          />
          <small>
            {isSell ? 'Price must reach this to start trailing' : 'Price must drop to this to start trailing'}
          </small>
        </div>

        <div className="form-group">
          <label>
            Trailing Percentage
            <span className="value-badge">{localParams.trailingPercent}%</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="20"
            step="0.5"
            value={localParams.trailingPercent}
            onChange={e => updateParam('trailingPercent', Number(e.target.value))}
          />
          <small>
            {isSell
              ? `Sell when price drops ${localParams.trailingPercent}% from peak`
              : `Buy when price rises ${localParams.trailingPercent}% from trough`}
          </small>
        </div>
      </div>

      <div className="form-group">
        <label>Quantity (USDT)</label>
        <input
          type="number"
          min="1"
          step="1"
          value={localParams.quantity}
          onChange={e => updateParam('quantity', Number(e.target.value))}
        />
        <small>Amount to {isSell ? 'sell' : 'buy'} when trailing triggers</small>
      </div>

      {/* Visual Explanation */}
      <div className="trailing-visual">
        <div className="visual-header">
          <ArrowUpDown size={18} />
          <span>How Trailing {isSell ? 'Sell' : 'Buy'} Works</span>
        </div>
        <div className="visual-diagram">
          {isSell ? (
            <div className="diagram-sell">
              <div className="step">1. Price rises to trigger (${triggerPrice.toFixed(2)})</div>
              <div className="arrow">↓</div>
              <div className="step">2. Trailing starts, tracks highest price</div>
              <div className="arrow">↓</div>
              <div className="step">3. When price drops {localParams.trailingPercent}% from peak → SELL</div>
            </div>
          ) : (
            <div className="diagram-buy">
              <div className="step">1. Price drops to trigger (${triggerPrice.toFixed(2)})</div>
              <div className="arrow">↓</div>
              <div className="step">2. Trailing starts, tracks lowest price</div>
              <div className="arrow">↓</div>
              <div className="step">3. When price rises {localParams.trailingPercent}% from trough → BUY</div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Stats */}
      <div className="preview-stats">
        <div className="preview-card">
          <Info size={18} />
          <div>
            <span className="stat-label">Current Price</span>
            <span className="stat-value">${currentPrice.toFixed(4)}</span>
          </div>
        </div>
        <div className="preview-card">
          {isSell ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          <div>
            <span className="stat-label">Trigger At</span>
            <span className={`stat-value ${isSell ? 'positive' : 'negative'}`}>
              ${triggerPrice.toFixed(4)}
            </span>
          </div>
        </div>
        <div className="preview-card">
          <ArrowUpDown size={18} />
          <div>
            <span className="stat-label">Trail %</span>
            <span className="stat-value">{localParams.trailingPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
