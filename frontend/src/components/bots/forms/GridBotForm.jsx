import { useState, useEffect } from 'react';
import { Info, TrendingUp, Grid3X3 } from 'lucide-react';

export default function GridBotForm({ params, onChange, symbolInfo }) {
  const [localParams, setLocalParams] = useState({
    lowerPrice: params.lowerPrice || '',
    upperPrice: params.upperPrice || '',
    gridCount: params.gridCount || 10,
    totalInvestment: params.totalInvestment || 100,
    maxBuysPerLevel: params.maxBuysPerLevel || 1,
    stopLoss: params.stopLoss || '',
    takeProfit: params.takeProfit || '',
    enableStopLoss: !!params.stopLoss,
    enableTakeProfit: !!params.takeProfit,
  });

  useEffect(() => {
    const { enableStopLoss, enableTakeProfit, ...cleanParams } = localParams;
    if (!enableStopLoss) delete cleanParams.stopLoss;
    if (!enableTakeProfit) delete cleanParams.takeProfit;
    if (cleanParams.stopLoss === '') delete cleanParams.stopLoss;
    if (cleanParams.takeProfit === '') delete cleanParams.takeProfit;
    onChange(cleanParams);
  }, [localParams]);

  useEffect(() => {
    if (symbolInfo?.last && !localParams.lowerPrice && !localParams.upperPrice) {
      const price = symbolInfo.last;
      setLocalParams(p => ({
        ...p,
        lowerPrice: (price * 0.9).toFixed(6),
        upperPrice: (price * 1.1).toFixed(6),
      }));
    }
  }, [symbolInfo]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  const gridSpacing = localParams.lowerPrice && localParams.upperPrice && localParams.gridCount
    ? ((Number(localParams.upperPrice) - Number(localParams.lowerPrice)) / localParams.gridCount).toFixed(6)
    : 0;

  const profitPerGrid = gridSpacing && localParams.totalInvestment
    ? ((Number(gridSpacing) / Number(localParams.lowerPrice)) * (localParams.totalInvestment / localParams.gridCount)).toFixed(4)
    : 0;

  return (
    <div className="strategy-form grid-bot-form">
      <div className="form-row">
        <div className="form-group">
          <label>
            Lower Price ($)
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">Bottom of your trading range. Bot places buy orders here.</span>
            </span>
          </label>
          <input
            type="number"
            step="0.000001"
            value={localParams.lowerPrice}
            onChange={e => updateParam('lowerPrice', e.target.value)}
            placeholder="e.g. 60000"
          />
          <small>Bottom of grid range</small>
        </div>

        <div className="form-group">
          <label>
            Upper Price ($)
            <span className="tooltip">
              <Info size={14} />
              <span className="tooltip-text">Top of your trading range. Bot places sell orders here.</span>
            </span>
          </label>
          <input
            type="number"
            step="0.000001"
            value={localParams.upperPrice}
            onChange={e => updateParam('upperPrice', e.target.value)}
            placeholder="e.g. 70000"
          />
          <small>Top of grid range</small>
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
        <small>More grids = more trades with smaller profit each</small>
      </div>

      <div className="form-group">
        <label>
          Max Buys Per Grid Level
          <span className="tooltip">
            <Info size={14} />
            <span className="tooltip-text">Limit how many times a grid level can buy. After reaching this limit, the grid level is skipped.</span>
          </span>
        </label>
        <input
          type="number"
          min="1"
          max="10"
          value={localParams.maxBuysPerLevel}
          onChange={e => updateParam('maxBuysPerLevel', Number(e.target.value))}
        />
        <small>Set to 1 to buy once per level, higher for repeated buys</small>
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
        <small>Total amount to allocate to this bot</small>
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
            <small>Bot stops and sells all if price drops to this level</small>
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
            <small>Bot stops and sells all if price rises to this level</small>
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
          <TrendingUp size={18} />
          <div>
            <span className="stat-label">Est. Profit/Grid</span>
            <span className="stat-value">${profitPerGrid}</span>
          </div>
        </div>
        <div className="preview-card">
          <Info size={18} />
          <div>
            <span className="stat-label">Investment/Grid</span>
            <span className="stat-value">${(localParams.totalInvestment / localParams.gridCount).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
