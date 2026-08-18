import { useState, useEffect } from 'react';
import { Info, Calendar, DollarSign, Target } from 'lucide-react';

const INTERVALS = [
  { value: 'hourly', label: 'Every Hour' },
  { value: 'every_4h', label: 'Every 4 Hours' },
  { value: 'every_12h', label: 'Every 12 Hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export default function DCABotForm({ params, onChange }) {
  const [localParams, setLocalParams] = useState({
    amountPerBuy: params.amountPerBuy || 10,
    interval: params.interval || 'daily',
    totalBudget: params.totalBudget || 500,
    takeProfitPercent: params.takeProfitPercent || '',
    stopLossPercent: params.stopLossPercent || '',
    enableTakeProfit: !!params.takeProfitPercent,
    enableStopLoss: !!params.stopLossPercent,
  });

  useEffect(() => {
    const { enableTakeProfit, enableStopLoss, ...cleanParams } = localParams;
    if (!enableTakeProfit || !cleanParams.takeProfitPercent) delete cleanParams.takeProfitPercent;
    if (!enableStopLoss || !cleanParams.stopLossPercent) delete cleanParams.stopLossPercent;
    onChange(cleanParams);
  }, [localParams]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  const estimatedBuys = Math.floor(localParams.totalBudget / localParams.amountPerBuy);

  const getIntervalDays = (interval) => {
    switch (interval) {
      case 'hourly': return 1/24;
      case 'every_4h': return 4/24;
      case 'every_12h': return 0.5;
      case 'daily': return 1;
      case 'weekly': return 7;
      default: return 1;
    }
  };

  const totalDays = estimatedBuys * getIntervalDays(localParams.interval);

  return (
    <div className="strategy-form dca-bot-form">
      <div className="form-row">
        <div className="form-group">
          <label>
            Amount Per Buy (USDT)
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">Fixed amount to buy on each interval</span>
            </span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={localParams.amountPerBuy}
            onChange={e => updateParam('amountPerBuy', Number(e.target.value))}
          />
          <small>Amount to invest each time</small>
        </div>

        <div className="form-group">
          <label>Buy Interval</label>
          <select
            value={localParams.interval}
            onChange={e => updateParam('interval', e.target.value)}
          >
            {INTERVALS.map(i => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
          <small>How often to make a purchase</small>
        </div>
      </div>

      <div className="form-group">
        <label>Total Budget (USDT)</label>
        <input
          type="number"
          min="10"
          step="10"
          value={localParams.totalBudget}
          onChange={e => updateParam('totalBudget', Number(e.target.value))}
        />
        <small>Maximum total investment for this bot</small>
      </div>

      <div className="optional-section">
        <div className="optional-toggle">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localParams.enableTakeProfit}
              onChange={e => updateParam('enableTakeProfit', e.target.checked)}
            />
            <span>Take Profit (%)</span>
          </label>
        </div>
        {localParams.enableTakeProfit && (
          <div className="form-group">
            <input
              type="number"
              min="1"
              max="1000"
              step="1"
              value={localParams.takeProfitPercent}
              onChange={e => updateParam('takeProfitPercent', Number(e.target.value))}
              placeholder="e.g. 25"
            />
            <small>Sell all when profit reaches this % above average cost</small>
          </div>
        )}
      </div>

      <div className="optional-section">
        <div className="optional-toggle">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localParams.enableStopLoss}
              onChange={e => updateParam('enableStopLoss', e.target.checked)}
            />
            <span>Stop Loss (%)</span>
          </label>
        </div>
        {localParams.enableStopLoss && (
          <div className="form-group">
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={localParams.stopLossPercent}
              onChange={e => updateParam('stopLossPercent', Number(e.target.value))}
              placeholder="e.g. 20"
            />
            <small>Sell all when loss reaches this % below average cost</small>
          </div>
        )}
      </div>

      {/* Preview Stats */}
      <div className="preview-stats">
        <div className="preview-card">
          <DollarSign size={18} />
          <div>
            <span className="stat-label">Estimated Buys</span>
            <span className="stat-value">{estimatedBuys}</span>
          </div>
        </div>
        <div className="preview-card">
          <Calendar size={18} />
          <div>
            <span className="stat-label">Timeline</span>
            <span className="stat-value">
              {totalDays < 1 ? `${Math.round(totalDays * 24)} hours` :
               totalDays < 30 ? `${Math.round(totalDays)} days` :
               `${Math.round(totalDays / 30)} months`}
            </span>
          </div>
        </div>
        <div className="preview-card">
          <Target size={18} />
          <div>
            <span className="stat-label">Per Buy</span>
            <span className="stat-value">${localParams.amountPerBuy}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
