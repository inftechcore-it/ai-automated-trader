import { useState, useEffect } from 'react';
import { Info, TrendingUp, Grid3X3, Zap, Crosshair, HelpCircle } from 'lucide-react';

export default function PrecisionGridForm({ params, onChange, symbolInfo }) {
  const [localParams, setLocalParams] = useState({
    lowerPrice: params.lowerPrice || '',
    upperPrice: params.upperPrice || '',
    gridCount: params.gridCount || 10,
    totalInvestment: params.totalInvestment || 100,
    priceTolerance: params.priceTolerance || '',
    toleranceDigits: params.toleranceDigits || 4,
    executionMode: params.executionMode || 'MARKET_ON_TOUCH',
    maxBuysPerLevel: params.maxBuysPerLevel || 1,
    stopLoss: params.stopLoss || '',
    takeProfit: params.takeProfit || '',
    enableStopLoss: !!params.stopLoss,
    enableTakeProfit: !!params.takeProfit,
    customTolerance: !!params.priceTolerance,
  });

  useEffect(() => {
    const { enableStopLoss, enableTakeProfit, customTolerance, ...cleanParams } = localParams;
    if (!enableStopLoss) delete cleanParams.stopLoss;
    if (!enableTakeProfit) delete cleanParams.takeProfit;
    if (cleanParams.stopLoss === '') delete cleanParams.stopLoss;
    if (cleanParams.takeProfit === '') delete cleanParams.takeProfit;
    if (!customTolerance) delete cleanParams.priceTolerance;
    onChange(cleanParams);
  }, [localParams]);

  useEffect(() => {
    if (symbolInfo?.last && !localParams.lowerPrice && !localParams.upperPrice) {
      const price = symbolInfo.last;
      const lower = price * 0.9;
      const upper = price * 1.1;
      const spacing = (upper - lower) / (localParams.gridCount || 10);
      const autoTol = Math.min(spacing * 0.20, price < 1.0 ? 0.0009 : price < 100 ? 0.05 : 1.0);

      setLocalParams(p => ({
        ...p,
        lowerPrice: lower < 1 ? lower.toFixed(6) : lower.toFixed(2),
        upperPrice: upper < 1 ? upper.toFixed(6) : upper.toFixed(2),
        priceTolerance: autoTol < 1 ? autoTol.toFixed(6) : autoTol.toFixed(2),
        toleranceDigits: price < 1.0 ? 4 : 2,
      }));
    }
  }, [symbolInfo]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  const gridSpacing = localParams.lowerPrice && localParams.upperPrice && localParams.gridCount
    ? ((Number(localParams.upperPrice) - Number(localParams.lowerPrice)) / localParams.gridCount).toFixed(6)
    : 0;

  const currentRefPrice = Number(symbolInfo?.last || localParams.lowerPrice || 1);
  const derivedTolerance = localParams.priceTolerance && localParams.customTolerance
    ? Number(localParams.priceTolerance)
    : Math.min(Number(gridSpacing) * 0.20, currentRefPrice < 1.0 ? 0.0009 : currentRefPrice < 100 ? 0.05 : 1.0);

  const profitPerGrid = gridSpacing && localParams.totalInvestment && Number(localParams.lowerPrice) > 0
    ? ((Number(gridSpacing) / Number(localParams.lowerPrice)) * (localParams.totalInvestment / localParams.gridCount)).toFixed(4)
    : 0;

  // Example corridor illustration
  const sampleTarget = Number(symbolInfo?.last || localParams.lowerPrice || 0.5823);
  const sampleLowBound = Math.max(0, sampleTarget - derivedTolerance);
  const sampleHighBound = sampleTarget + derivedTolerance;

  return (
    <div className="strategy-form precision-grid-form">
      {/* Precision Feature Highlight */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <Zap size={22} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px' }}>
            ⚡ Precision Corridor Execution Enabled
          </div>
          <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px', lineHeight: '1.4' }}>
            Eliminates slow execution and stranded orders. The bot detects when market price taps your decimal corridor (e.g. 0.5820 - 0.5829 for target 0.5823) and fills instantly.
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>
            Lower Price ($)
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">Bottom of trading range. Bot buys dips near this corridor.</span>
            </span>
          </label>
          <input
            type="number"
            step="0.000001"
            value={localParams.lowerPrice}
            onChange={e => updateParam('lowerPrice', e.target.value)}
            placeholder="e.g. 0.5000"
          />
          <small>Bottom of grid corridor</small>
        </div>

        <div className="form-group">
          <label>
            Upper Price ($)
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">Top of trading range. Bot takes profits near this corridor.</span>
            </span>
          </label>
          <input
            type="number"
            step="0.000001"
            value={localParams.upperPrice}
            onChange={e => updateParam('upperPrice', e.target.value)}
            placeholder="e.g. 0.7000"
          />
          <small>Top of grid corridor</small>
        </div>
      </div>

      <div className="form-group">
        <label>
          Number of Grids
          <span className="grid-count-value">{localParams.gridCount}</span>
        </label>
        <input
          type="range"
          min="2"
          max="50"
          value={localParams.gridCount}
          onChange={e => updateParam('gridCount', Number(e.target.value))}
        />
        <small>More grids = higher trading frequency across micro-oscillations</small>
      </div>

      {/* Decimal Tolerance Corridor Settings */}
      <div style={{
        background: '#131d2e',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontWeight: 600, fontSize: '13px' }}>
            <Crosshair size={16} style={{ color: '#38bdf8' }} />
            Decimal Tolerance Corridor
          </div>
          <label className="checkbox-label" style={{ margin: 0, fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={localParams.customTolerance}
              onChange={e => updateParam('customTolerance', e.target.checked)}
            />
            <span>Custom Tolerance</span>
          </label>
        </div>

        {localParams.customTolerance ? (
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px' }}>Price Tolerance Buffer (±$)</label>
              <input
                type="number"
                step="0.000001"
                value={localParams.priceTolerance}
                onChange={e => updateParam('priceTolerance', e.target.value)}
                placeholder="e.g. 0.0009"
              />
              <small>Tolerance radius around each grid level</small>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px' }}>Execution Mode</label>
              <select
                value={localParams.executionMode}
                onChange={e => updateParam('executionMode', e.target.value)}
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  width: '100%'
                }}
              >
                <option value="MARKET_ON_TOUCH">Market on Corridor Touch (Fastest)</option>
                <option value="TOLERANCE_LIMIT">Limit Orders in Corridor</option>
              </select>
              <small>Market on Touch ensures 100% fill rate</small>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
            Auto-tuned corridor: <strong>±${derivedTolerance.toFixed(6)}</strong> (fills any orders within decimal touch range).
          </div>
        )}

        {/* Live Corridor Example Visualizer */}
        <div style={{
          marginTop: '12px',
          padding: '10px 12px',
          background: 'rgba(15, 23, 42, 0.7)',
          borderRadius: '6px',
          borderLeft: '3px solid #38bdf8',
          fontSize: '11px',
          color: '#cbd5e1'
        }}>
          🎯 <strong>Corridor Preview:</strong> Target ${sampleTarget.toFixed(4)} triggers execution anywhere between <span style={{ color: '#38bdf8', fontWeight: 600 }}>${sampleLowBound.toFixed(4)}</span> and <span style={{ color: '#38bdf8', fontWeight: 600 }}>${sampleHighBound.toFixed(4)}</span>.
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>
            Max Buys Per Level
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">Limits repeated buying on the same grid level until sold.</span>
            </span>
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={localParams.maxBuysPerLevel}
            onChange={e => updateParam('maxBuysPerLevel', Number(e.target.value))}
          />
          <small>Default 1 (buy once per grid level)</small>
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
          <small>Total capital allocated to bot</small>
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
              placeholder="Stop loss price"
            />
            <small>Bot liquidates all holdings to cash if price drops below this level</small>
          </div>
        )}
      </div>

      <div className="optional-section">
        <div className="optional-toggle">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localParams.enableTakeProfit}
              onChange={e => updateParam('enableTakeProfit', e.target.checked)}
            />
            <span>Enable Take Profit</span>
          </label>
        </div>
        {localParams.enableTakeProfit && (
          <div className="form-group">
            <input
              type="number"
              step="0.000001"
              value={localParams.takeProfit}
              onChange={e => updateParam('takeProfit', e.target.value)}
              placeholder="Take profit price"
            />
            <small>Bot liquidates and locks total profit if price exceeds this level</small>
          </div>
        )}
      </div>

      {/* Preview Stats */}
      <div className="preview-stats">
        <div className="preview-card">
          <Grid3X3 size={18} />
          <div>
            <span className="stat-label">Grid Spacing</span>
            <span className="stat-value">${gridSpacing}</span>
          </div>
        </div>
        <div className="preview-card">
          <Crosshair size={18} />
          <div>
            <span className="stat-label">Tolerance Corridor</span>
            <span className="stat-value">±${derivedTolerance.toFixed(6)}</span>
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
