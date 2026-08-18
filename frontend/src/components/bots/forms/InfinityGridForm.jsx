import { useState, useEffect } from 'react';
import { Info, TrendingUp, Grid3X3, Infinity } from 'lucide-react';

export default function InfinityGridForm({ params, onChange, symbolInfo }) {
  const [localParams, setLocalParams] = useState({
    lowerPrice: params.lowerPrice || '',
    gridSpacingPercent: params.gridSpacingPercent || 1,
    totalInvestment: params.totalInvestment || 200,
    stopLoss: params.stopLoss || '',
    enableStopLoss: !!params.stopLoss,
  });

  useEffect(() => {
    const { enableStopLoss, ...cleanParams } = localParams;
    if (!enableStopLoss || !cleanParams.stopLoss) delete cleanParams.stopLoss;
    onChange(cleanParams);
  }, [localParams]);

  useEffect(() => {
    if (symbolInfo?.last && !localParams.lowerPrice) {
      const price = symbolInfo.last;
      setLocalParams(p => ({
        ...p,
        lowerPrice: (price * 0.7).toFixed(6),
      }));
    }
  }, [symbolInfo]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  const currentPrice = symbolInfo?.last || 0;
  const lowerPrice = Number(localParams.lowerPrice) || 0;

  // Calculate grid preview
  const gridPrices = [];
  if (lowerPrice > 0) {
    let price = lowerPrice;
    for (let i = 0; i < 10; i++) {
      gridPrices.push(price);
      price = price * (1 + localParams.gridSpacingPercent / 100);
    }
  }

  const distanceToLower = currentPrice > 0 && lowerPrice > 0
    ? (((currentPrice - lowerPrice) / currentPrice) * 100).toFixed(1)
    : 0;

  return (
    <div className="strategy-form infinity-grid-form">
      <div className="info-banner">
        <Infinity size={18} />
        <div>
          <strong>Infinity Grid</strong>
          <p>Unlike standard grid, this has no upper limit. Grids extend upward as price rises. Best for assets you believe will grow long-term.</p>
        </div>
      </div>

      <div className="form-group">
        <label>
          Lower Price ($)
          <span className="tooltip">
            <Info size={14} />
            <span className="tooltip-text">The lowest price for the grid. Bot won't trade below this.</span>
          </span>
        </label>
        <input
          type="number"
          step="0.000001"
          value={localParams.lowerPrice}
          onChange={e => updateParam('lowerPrice', e.target.value)}
          placeholder={`Current price: ${currentPrice.toFixed(4)}`}
        />
        <small>Bottom boundary (no upper limit - grid extends infinitely upward)</small>
      </div>

      <div className="form-group">
        <label>
          Grid Spacing
          <span className="value-badge">{localParams.gridSpacingPercent}%</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.1"
          value={localParams.gridSpacingPercent}
          onChange={e => updateParam('gridSpacingPercent', Number(e.target.value))}
        />
        <small>Percentage gap between each grid level</small>
      </div>

      <div className="form-group">
        <label>Total Investment (USDT)</label>
        <input
          type="number"
          min="50"
          step="10"
          value={localParams.totalInvestment}
          onChange={e => updateParam('totalInvestment', Number(e.target.value))}
        />
        <small>Initial capital allocation</small>
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
            <small>Must be below lower price</small>
          </div>
        )}
      </div>

      {/* Grid Preview */}
      {gridPrices.length > 0 && (
        <div className="grid-preview">
          <h4><Grid3X3 size={16} /> Grid Level Preview (first 10)</h4>
          <div className="grid-levels">
            {gridPrices.map((price, i) => (
              <div
                key={i}
                className={`grid-level ${price <= currentPrice ? 'below-price' : 'above-price'}`}
              >
                <span className="level-num">L{i + 1}</span>
                <span className="level-price">${price.toFixed(4)}</span>
                {i < gridPrices.length - 1 && (
                  <span className="level-diff">+{localParams.gridSpacingPercent}%</span>
                )}
              </div>
            ))}
            <div className="grid-level infinity">
              <span className="level-num">...</span>
              <span className="level-price">
                <Infinity size={14} /> continues upward
              </span>
            </div>
          </div>
          {currentPrice > 0 && (
            <div className="current-price-marker">
              Current price: ${currentPrice.toFixed(4)}
            </div>
          )}
        </div>
      )}

      {/* Preview Stats */}
      <div className="preview-stats">
        <div className="preview-card">
          <TrendingUp size={18} />
          <div>
            <span className="stat-label">Distance to Lower</span>
            <span className="stat-value">{distanceToLower}%</span>
          </div>
        </div>
        <div className="preview-card">
          <Grid3X3 size={18} />
          <div>
            <span className="stat-label">Grid Spacing</span>
            <span className="stat-value">{localParams.gridSpacingPercent}%</span>
          </div>
        </div>
        <div className="preview-card">
          <Info size={18} />
          <div>
            <span className="stat-label">Profit/Grid</span>
            <span className="stat-value">~{localParams.gridSpacingPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
