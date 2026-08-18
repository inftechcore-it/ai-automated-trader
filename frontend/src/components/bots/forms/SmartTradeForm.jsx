import { useState, useEffect } from 'react';
import { Info, TrendingUp, TrendingDown, Target, AlertTriangle } from 'lucide-react';

export default function SmartTradeForm({ params, onChange, symbolInfo }) {
  const [localParams, setLocalParams] = useState({
    side: params.side || 'long',
    entryType: params.entryType || 'market',
    entryPrice: params.entryPrice || '',
    quantity: params.quantity || 50,
    takeProfit: params.takeProfit || '',
    takeProfitPercent: params.takeProfitPercent || '',
    stopLoss: params.stopLoss || '',
    stopLossPercent: params.stopLossPercent || '',
    trailingTakeProfit: params.trailingTakeProfit || '',
    usePriceTP: params.takeProfit ? true : false,
    usePriceSL: params.stopLoss ? true : false,
    enableTrailing: !!params.trailingTakeProfit,
  });

  useEffect(() => {
    const cleanParams = {
      side: localParams.side,
      entryType: localParams.entryType,
      quantity: localParams.quantity,
    };

    if (localParams.entryType === 'limit' && localParams.entryPrice) {
      cleanParams.entryPrice = Number(localParams.entryPrice);
    }

    if (localParams.usePriceTP && localParams.takeProfit) {
      cleanParams.takeProfit = Number(localParams.takeProfit);
    } else if (!localParams.usePriceTP && localParams.takeProfitPercent) {
      cleanParams.takeProfitPercent = Number(localParams.takeProfitPercent);
    }

    if (localParams.usePriceSL && localParams.stopLoss) {
      cleanParams.stopLoss = Number(localParams.stopLoss);
    } else if (!localParams.usePriceSL && localParams.stopLossPercent) {
      cleanParams.stopLossPercent = Number(localParams.stopLossPercent);
    }

    if (localParams.enableTrailing && localParams.trailingTakeProfit) {
      cleanParams.trailingTakeProfit = Number(localParams.trailingTakeProfit);
    }

    onChange(cleanParams);
  }, [localParams]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  const currentPrice = symbolInfo?.last || 0;
  const entryPrice = localParams.entryType === 'limit' ? Number(localParams.entryPrice) || currentPrice : currentPrice;

  const tpPrice = localParams.usePriceTP
    ? Number(localParams.takeProfit)
    : entryPrice * (1 + (Number(localParams.takeProfitPercent) || 0) / 100);

  const slPrice = localParams.usePriceSL
    ? Number(localParams.stopLoss)
    : entryPrice * (1 - (Number(localParams.stopLossPercent) || 0) / 100);

  const riskReward = slPrice && tpPrice && entryPrice
    ? ((tpPrice - entryPrice) / (entryPrice - slPrice)).toFixed(2)
    : '-';

  return (
    <div className="strategy-form smart-trade-form">
      <div className="form-row">
        <div className="form-group">
          <label>Position Side</label>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${localParams.side === 'long' ? 'active long' : ''}`}
              onClick={() => updateParam('side', 'long')}
            >
              <TrendingUp size={16} /> Long
            </button>
            <button
              className={`toggle-btn ${localParams.side === 'short' ? 'active short' : ''}`}
              onClick={() => updateParam('side', 'short')}
            >
              <TrendingDown size={16} /> Short
            </button>
          </div>
          <small>{localParams.side === 'long' ? 'Buy first, sell later' : 'Sell first, buy later'}</small>
        </div>

        <div className="form-group">
          <label>Entry Type</label>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${localParams.entryType === 'market' ? 'active' : ''}`}
              onClick={() => updateParam('entryType', 'market')}
            >
              Market
            </button>
            <button
              className={`toggle-btn ${localParams.entryType === 'limit' ? 'active' : ''}`}
              onClick={() => updateParam('entryType', 'limit')}
            >
              Limit
            </button>
          </div>
        </div>
      </div>

      {localParams.entryType === 'limit' && (
        <div className="form-group">
          <label>Entry Price ($)</label>
          <input
            type="number"
            step="0.000001"
            value={localParams.entryPrice}
            onChange={e => updateParam('entryPrice', e.target.value)}
            placeholder={`Current: ${currentPrice}`}
          />
        </div>
      )}

      <div className="form-group">
        <label>Amount (USDT)</label>
        <input
          type="number"
          min="1"
          step="1"
          value={localParams.quantity}
          onChange={e => updateParam('quantity', Number(e.target.value))}
        />
        <small>Total investment for this trade</small>
      </div>

      <div className="exit-section">
        <h4><Target size={16} /> Take Profit</h4>
        <div className="form-row">
          <div className="form-group">
            <div className="toggle-group small">
              <button
                className={`toggle-btn ${localParams.usePriceTP ? 'active' : ''}`}
                onClick={() => updateParam('usePriceTP', true)}
              >
                Price
              </button>
              <button
                className={`toggle-btn ${!localParams.usePriceTP ? 'active' : ''}`}
                onClick={() => updateParam('usePriceTP', false)}
              >
                Percent
              </button>
            </div>
          </div>
          <div className="form-group">
            {localParams.usePriceTP ? (
              <input
                type="number"
                step="0.000001"
                value={localParams.takeProfit}
                onChange={e => updateParam('takeProfit', e.target.value)}
                placeholder="Target price"
              />
            ) : (
              <div className="input-with-suffix">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={localParams.takeProfitPercent}
                  onChange={e => updateParam('takeProfitPercent', e.target.value)}
                  placeholder="e.g. 5"
                />
                <span className="suffix">%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="exit-section">
        <h4><AlertTriangle size={16} /> Stop Loss</h4>
        <div className="form-row">
          <div className="form-group">
            <div className="toggle-group small">
              <button
                className={`toggle-btn ${localParams.usePriceSL ? 'active' : ''}`}
                onClick={() => updateParam('usePriceSL', true)}
              >
                Price
              </button>
              <button
                className={`toggle-btn ${!localParams.usePriceSL ? 'active' : ''}`}
                onClick={() => updateParam('usePriceSL', false)}
              >
                Percent
              </button>
            </div>
          </div>
          <div className="form-group">
            {localParams.usePriceSL ? (
              <input
                type="number"
                step="0.000001"
                value={localParams.stopLoss}
                onChange={e => updateParam('stopLoss', e.target.value)}
                placeholder="Stop price"
              />
            ) : (
              <div className="input-with-suffix">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={localParams.stopLossPercent}
                  onChange={e => updateParam('stopLossPercent', e.target.value)}
                  placeholder="e.g. 3"
                />
                <span className="suffix">%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="optional-section">
        <div className="optional-toggle">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localParams.enableTrailing}
              onChange={e => updateParam('enableTrailing', e.target.checked)}
            />
            <span>Enable Trailing Take Profit</span>
          </label>
        </div>
        {localParams.enableTrailing && (
          <div className="form-group">
            <div className="input-with-suffix">
              <input
                type="number"
                min="0.5"
                max="20"
                step="0.5"
                value={localParams.trailingTakeProfit}
                onChange={e => updateParam('trailingTakeProfit', e.target.value)}
                placeholder="e.g. 2"
              />
              <span className="suffix">%</span>
            </div>
            <small>Exit when price drops this % from its peak</small>
          </div>
        )}
      </div>

      {/* Risk/Reward Preview */}
      <div className="preview-stats">
        <div className="preview-card">
          <TrendingUp size={18} />
          <div>
            <span className="stat-label">Take Profit</span>
            <span className="stat-value positive">${tpPrice?.toFixed(4) || '-'}</span>
          </div>
        </div>
        <div className="preview-card">
          <TrendingDown size={18} />
          <div>
            <span className="stat-label">Stop Loss</span>
            <span className="stat-value negative">${slPrice?.toFixed(4) || '-'}</span>
          </div>
        </div>
        <div className="preview-card">
          <Target size={18} />
          <div>
            <span className="stat-label">Risk/Reward</span>
            <span className={`stat-value ${Number(riskReward) >= 2 ? 'positive' : Number(riskReward) >= 1 ? '' : 'negative'}`}>
              1:{riskReward}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
