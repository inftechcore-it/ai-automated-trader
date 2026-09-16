import { useState, useEffect } from 'react';
import { Info, TrendingUp, Grid3X3, ArrowUpRight, Sparkles, AlertCircle } from 'lucide-react';

export default function JarvisForm({ params, onChange, symbolInfo }) {
  const [localParams, setLocalParams] = useState({
    lowerPrice: params.lowerPrice || '',
    upperPrice: params.upperPrice || '',
    gridCount: params.gridCount || 10,
    totalInvestment: params.totalInvestment || 100,
    maxBuysPerLevel: params.maxBuysPerLevel || 1,
    autoIncrementEnabled: params.autoIncrementEnabled !== false,
    incrementStepSpace: params.incrementStepSpace || '',
    stopLoss: params.stopLoss || '',
    enableStopLoss: !!params.stopLoss,
    customStepSpace: !!params.incrementStepSpace,
  });

  useEffect(() => {
    const { enableStopLoss, customStepSpace, ...cleanParams } = localParams;
    if (!enableStopLoss) delete cleanParams.stopLoss;
    if (cleanParams.stopLoss === '') delete cleanParams.stopLoss;
    if (!customStepSpace) delete cleanParams.incrementStepSpace;
    onChange(cleanParams);
  }, [localParams]);

  useEffect(() => {
    if (symbolInfo?.last && !localParams.lowerPrice && !localParams.upperPrice) {
      const price = symbolInfo.last;
      const lower = price * 0.9;
      const upper = price * 1.1;
      const count = localParams.gridCount || 10;
      const step = (upper - lower) / count;

      setLocalParams(p => ({
        ...p,
        lowerPrice: lower < 1 ? lower.toFixed(6) : lower.toFixed(2),
        upperPrice: upper < 1 ? upper.toFixed(6) : upper.toFixed(2),
        incrementStepSpace: step < 1 ? step.toFixed(6) : step.toFixed(4),
      }));
    }
  }, [symbolInfo]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  const calculatedStepSpace = localParams.lowerPrice && localParams.upperPrice && localParams.gridCount
    ? ((Number(localParams.upperPrice) - Number(localParams.lowerPrice)) / localParams.gridCount).toFixed(6)
    : 0;

  const effectiveStepSpace = localParams.customStepSpace && localParams.incrementStepSpace
    ? Number(localParams.incrementStepSpace)
    : Number(calculatedStepSpace);

  const profitPerGrid = effectiveStepSpace && localParams.totalInvestment && Number(localParams.lowerPrice) > 0
    ? ((effectiveStepSpace / Number(localParams.lowerPrice)) * (localParams.totalInvestment / localParams.gridCount)).toFixed(4)
    : 0;

  // Example simulation of upper price breakout
  const refUpper = Number(localParams.upperPrice || 1.4820);
  const sampleBreakoutPrice = Number((refUpper * 1.02).toFixed(4));
  const sampleNewUpper = Number((sampleBreakoutPrice + effectiveStepSpace).toFixed(4));

  return (
    <div className="strategy-form jarvis-form">
      {/* Dynamic Upper Expansion Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%)',
        border: '1px solid rgba(14, 165, 233, 0.35)',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <ArrowUpRight size={24} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px' }}>
            🚀 JARVIS Autonomous Upper Boundary Expansion Active
          </div>
          <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px', lineHeight: '1.4' }}>
            When price breaks out above upper bound, JARVIS automatically recalculates and shifts upper price: <code style={{ color: '#38bdf8', background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>newUpper = currentPrice + GridStepSpace</code> and continues trading seamlessly without manual intervention.
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>
            Lower Price ($)
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">Bottom of initial trading range.</span>
            </span>
          </label>
          <input
            type="number"
            step="0.000001"
            value={localParams.lowerPrice}
            onChange={e => updateParam('lowerPrice', e.target.value)}
            placeholder="e.g. 1.3100"
          />
          <small>Bottom boundary of grid range</small>
        </div>

        <div className="form-group">
          <label>
            Initial Upper Price ($)
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">Top of initial trading range. Expands automatically on breakout.</span>
            </span>
          </label>
          <input
            type="number"
            step="0.000001"
            value={localParams.upperPrice}
            onChange={e => updateParam('upperPrice', e.target.value)}
            placeholder="e.g. 1.4820"
          />
          <small>Initial top bound (auto-expands upward)</small>
        </div>
      </div>

      <div className="form-group">
        <label>
          Number of Initial Grids
          <span className="grid-count-value">{localParams.gridCount}</span>
        </label>
        <input
          type="range"
          min="2"
          max="50"
          value={localParams.gridCount}
          onChange={e => updateParam('gridCount', Number(e.target.value))}
        />
        <small>Step Space: ${(effectiveStepSpace || 0).toFixed(6)} per grid</small>
      </div>

      {/* Auto-Increment Settings Card */}
      <div style={{
        background: '#131d2e',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontWeight: 600, fontSize: '13px' }}>
            <Sparkles size={16} style={{ color: '#38bdf8' }} />
            JARVIS Autonomous Boundary Surge Behavior
          </div>
          <label className="checkbox-label" style={{ margin: 0, fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={localParams.autoIncrementEnabled}
              onChange={e => updateParam('autoIncrementEnabled', e.target.checked)}
            />
            <span>Auto-Increment Upper Price</span>
          </label>
        </div>

        {/* Live Formula Preview Example */}
        <div style={{
          marginTop: '6px',
          padding: '12px',
          background: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '6px',
          borderLeft: '3px solid #38bdf8',
          fontSize: '12px',
          color: '#cbd5e1',
          lineHeight: '1.5'
        }}>
          💡 <strong>Surge Simulation:</strong> If price surges to <span style={{ color: '#38bdf8', fontWeight: 600 }}>${sampleBreakoutPrice.toFixed(4)}</span> (above ${refUpper.toFixed(4)}), new Upper Price becomes: <br />
          <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>
            ${sampleBreakoutPrice.toFixed(4)} + ${effectiveStepSpace.toFixed(4)} (Step Space) = ${sampleNewUpper.toFixed(4)}
          </span>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>
            Max Buys Per Grid Level
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">Limits repeated dip buying on each level.</span>
            </span>
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={localParams.maxBuysPerLevel}
            onChange={e => updateParam('maxBuysPerLevel', Number(e.target.value))}
          />
          <small>Default 1 (buy once per grid level until sold)</small>
        </div>

        <div className="form-group">
          <label>Total Investment (USDT)</label>
          <input
            type="number"
            min="10"
            step="10"
            value={localParams.totalInvestment}
            onChange={e => updateParam('totalInvestment', Number(e.target.value))}
          />
          <small>Total amount to allocate</small>
        </div>
      </div>

      <div className="optional-section">
        <div className="optional-toggle">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localParams.enableStopLoss}
              onChange={e => updateParam('enableStopLoss', e.target.checked)}
            />
            <span>Enable Stop Loss</span>
          </label>
        </div>
        {localParams.enableStopLoss && (
          <div className="form-group">
            <input
              type="number"
              step="0.000001"
              value={localParams.stopLoss}
              onChange={e => updateParam('stopLoss', e.target.value)}
              placeholder="Stop loss price (below lower price)"
            />
            <small>JARVIS liquidates all holdings to cash if price drops below this level</small>
          </div>
        )}
      </div>

      {/* Preview Stats */}
      <div className="preview-stats">
        <div className="preview-card">
          <Grid3X3 size={18} />
          <div>
            <span className="stat-label">Grid Step Space</span>
            <span className="stat-value">${(effectiveStepSpace || 0).toFixed(6)}</span>
          </div>
        </div>
        <div className="preview-card">
          <ArrowUpRight size={18} />
          <div>
            <span className="stat-label">Upper Expansion</span>
            <span className="stat-value">Autonomous</span>
          </div>
        </div>
        <div className="preview-card">
          <TrendingUp size={18} />
          <div>
            <span className="stat-label">Est. Profit/Grid</span>
            <span className="stat-value">${profitPerGrid}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
