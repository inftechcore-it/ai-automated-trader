import { useState, useEffect } from 'react';
import { Info, Plus, X, Search, PieChart } from 'lucide-react';

const INTERVALS = [
  { value: '1h', label: 'Every Hour' },
  { value: '4h', label: 'Every 4 Hours' },
  { value: '12h', label: 'Every 12 Hours' },
  { value: '24h', label: 'Daily' },
];

const PRESET_ALLOCATIONS = [
  { name: '60/40 BTC/ETH', allocations: [{ symbol: 'BTC/USDT', targetPercent: 60 }, { symbol: 'ETH/USDT', targetPercent: 40 }] },
  { name: 'Top 3', allocations: [{ symbol: 'BTC/USDT', targetPercent: 50 }, { symbol: 'ETH/USDT', targetPercent: 30 }, { symbol: 'SOL/USDT', targetPercent: 20 }] },
  { name: 'Equal 5', allocations: [{ symbol: 'BTC/USDT', targetPercent: 20 }, { symbol: 'ETH/USDT', targetPercent: 20 }, { symbol: 'SOL/USDT', targetPercent: 20 }, { symbol: 'XRP/USDT', targetPercent: 20 }, { symbol: 'ADA/USDT', targetPercent: 20 }] },
];

export default function RebalancingForm({ params, onChange }) {
  const [localParams, setLocalParams] = useState({
    allocations: params.allocations || [{ symbol: '', targetPercent: 50 }, { symbol: '', targetPercent: 50 }],
    totalInvestment: params.totalInvestment || 500,
    rebalanceThreshold: params.rebalanceThreshold || 5,
    rebalanceInterval: params.rebalanceInterval || '24h',
  });
  const [symbolSearch, setSymbolSearch] = useState('');

  useEffect(() => {
    const validAllocations = localParams.allocations.filter(a => a.symbol && a.targetPercent > 0);
    onChange({
      ...localParams,
      allocations: validAllocations,
    });
  }, [localParams]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  const updateAllocation = (index, field, value) => {
    setLocalParams(p => ({
      ...p,
      allocations: p.allocations.map((a, i) =>
        i === index ? { ...a, [field]: value } : a
      ),
    }));
  };

  const addAllocation = () => {
    if (localParams.allocations.length >= 10) return;
    setLocalParams(p => ({
      ...p,
      allocations: [...p.allocations, { symbol: '', targetPercent: 0 }],
    }));
  };

  const removeAllocation = (index) => {
    if (localParams.allocations.length <= 2) return;
    setLocalParams(p => ({
      ...p,
      allocations: p.allocations.filter((_, i) => i !== index),
    }));
  };

  const applyPreset = (preset) => {
    setLocalParams(p => ({
      ...p,
      allocations: preset.allocations,
    }));
  };

  const totalPercent = localParams.allocations.reduce((sum, a) => sum + Number(a.targetPercent || 0), 0);
  const isValid = Math.abs(totalPercent - 100) < 0.01;

  // Generate pie chart data
  const pieData = localParams.allocations
    .filter(a => a.symbol && a.targetPercent > 0)
    .map((a, i) => ({
      symbol: a.symbol.split('/')[0],
      percent: a.targetPercent,
      color: `hsl(${(i * 360) / localParams.allocations.length}, 70%, 50%)`,
    }));

  return (
    <div className="strategy-form rebalancing-form">
      <div className="presets-section">
        <label>Quick Presets</label>
        <div className="preset-buttons">
          {PRESET_ALLOCATIONS.map(preset => (
            <button
              key={preset.name}
              className="preset-btn"
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="allocations-section">
        <div className="section-header">
          <label>Portfolio Allocations</label>
          <span className={`total-percent ${isValid ? 'valid' : 'invalid'}`}>
            Total: {totalPercent.toFixed(1)}%
          </span>
        </div>

        <div className="allocations-list">
          {localParams.allocations.map((alloc, index) => (
            <div key={index} className="allocation-row">
              <div className="symbol-input">
                <input
                  type="text"
                  value={alloc.symbol}
                  onChange={e => updateAllocation(index, 'symbol', e.target.value.toUpperCase())}
                  placeholder="BTC/USDT"
                />
              </div>
              <div className="percent-input">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={alloc.targetPercent}
                  onChange={e => updateAllocation(index, 'targetPercent', Number(e.target.value))}
                />
                <span className="suffix">%</span>
              </div>
              <button
                className="remove-btn"
                onClick={() => removeAllocation(index)}
                disabled={localParams.allocations.length <= 2}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <button
          className="add-allocation-btn"
          onClick={addAllocation}
          disabled={localParams.allocations.length >= 10}
        >
          <Plus size={16} /> Add Asset
        </button>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Total Investment (USDT)</label>
          <input
            type="number"
            min="100"
            step="100"
            value={localParams.totalInvestment}
            onChange={e => updateParam('totalInvestment', Number(e.target.value))}
          />
          <small>Initial capital to distribute</small>
        </div>

        <div className="form-group">
          <label>
            Rebalance Threshold
            <span className="value-badge">{localParams.rebalanceThreshold}%</span>
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={localParams.rebalanceThreshold}
            onChange={e => updateParam('rebalanceThreshold', Number(e.target.value))}
          />
          <small>Trigger rebalance when any asset deviates by this %</small>
        </div>
      </div>

      <div className="form-group">
        <label>Check Interval</label>
        <div className="interval-buttons">
          {INTERVALS.map(i => (
            <button
              key={i.value}
              className={`interval-btn ${localParams.rebalanceInterval === i.value ? 'active' : ''}`}
              onClick={() => updateParam('rebalanceInterval', i.value)}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pie Chart Preview */}
      {pieData.length >= 2 && (
        <div className="pie-preview">
          <h4><PieChart size={16} /> Target Allocation</h4>
          <div className="pie-chart-container">
            <svg viewBox="0 0 100 100" className="pie-chart">
              {(() => {
                let cumulativePercent = 0;
                return pieData.map((slice, i) => {
                  const startAngle = cumulativePercent * 3.6 * (Math.PI / 180);
                  cumulativePercent += slice.percent;
                  const endAngle = cumulativePercent * 3.6 * (Math.PI / 180);

                  const x1 = 50 + 40 * Math.cos(startAngle - Math.PI / 2);
                  const y1 = 50 + 40 * Math.sin(startAngle - Math.PI / 2);
                  const x2 = 50 + 40 * Math.cos(endAngle - Math.PI / 2);
                  const y2 = 50 + 40 * Math.sin(endAngle - Math.PI / 2);

                  const largeArcFlag = slice.percent > 50 ? 1 : 0;

                  return (
                    <path
                      key={i}
                      d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                      fill={slice.color}
                    />
                  );
                });
              })()}
            </svg>
            <div className="pie-legend">
              {pieData.map((slice, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-color" style={{ background: slice.color }} />
                  <span className="legend-label">{slice.symbol}</span>
                  <span className="legend-percent">{slice.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isValid && (
        <div className="validation-warning">
          <Info size={16} />
          <span>Allocations must total exactly 100% (currently {totalPercent.toFixed(1)}%)</span>
        </div>
      )}
    </div>
  );
}
