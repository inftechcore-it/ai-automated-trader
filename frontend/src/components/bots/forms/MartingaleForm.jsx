import { useState, useEffect } from 'react';
import { Info, AlertTriangle, TrendingDown, DollarSign, Target } from 'lucide-react';

export default function MartingaleForm({ params, onChange }) {
  const [localParams, setLocalParams] = useState({
    initialBuyAmount: params.initialBuyAmount || 10,
    priceDropPercent: params.priceDropPercent || 5,
    takeProfitPercent: params.takeProfitPercent || 3,
    maxSafetyOrders: params.maxSafetyOrders || 5,
    multiplier: params.multiplier || 2,
    maxTotalInvestment: params.maxTotalInvestment || 200,
  });

  useEffect(() => {
    onChange(localParams);
  }, [localParams]);

  const updateParam = (key, value) => {
    setLocalParams(p => ({ ...p, [key]: value }));
  };

  // Calculate safety order table
  const safetyOrders = [];
  let amount = localParams.initialBuyAmount;
  let totalInvestment = amount;
  safetyOrders.push({ order: 'Initial', amount, total: totalInvestment });

  for (let i = 1; i <= localParams.maxSafetyOrders; i++) {
    amount = amount * localParams.multiplier;
    totalInvestment += amount;
    safetyOrders.push({
      order: `Safety ${i}`,
      amount: amount.toFixed(2),
      total: totalInvestment.toFixed(2),
      drop: (localParams.priceDropPercent * i).toFixed(1),
    });
  }

  const maxRequired = totalInvestment;
  const isOverBudget = maxRequired > localParams.maxTotalInvestment;

  return (
    <div className="strategy-form martingale-form">
      <div className="warning-banner">
        <AlertTriangle size={20} />
        <div>
          <strong>High Risk Strategy</strong>
          <p>Martingale increases position size after losses. Risk of significant loss in sustained downtrends.</p>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Initial Buy (USDT)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={localParams.initialBuyAmount}
            onChange={e => updateParam('initialBuyAmount', Number(e.target.value))}
          />
          <small>First purchase amount</small>
        </div>

        <div className="form-group">
          <label>
            Price Drop Trigger
            <span className="value-badge">{localParams.priceDropPercent}%</span>
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={localParams.priceDropPercent}
            onChange={e => updateParam('priceDropPercent', Number(e.target.value))}
          />
          <small>Buy again when price drops this much</small>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>
            Take Profit
            <span className="value-badge">{localParams.takeProfitPercent}%</span>
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={localParams.takeProfitPercent}
            onChange={e => updateParam('takeProfitPercent', Number(e.target.value))}
          />
          <small>Sell all when avg price + this % reached</small>
        </div>

        <div className="form-group">
          <label>
            Max Safety Orders
            <span className="value-badge">{localParams.maxSafetyOrders}</span>
          </label>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={localParams.maxSafetyOrders}
            onChange={e => updateParam('maxSafetyOrders', Number(e.target.value))}
          />
          <small>Maximum additional buys allowed</small>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>
            Multiplier
            <span className="value-badge">{localParams.multiplier}x</span>
          </label>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={localParams.multiplier}
            onChange={e => updateParam('multiplier', Number(e.target.value))}
          />
          <small>Each safety order is multiplier × previous</small>
        </div>

        <div className="form-group">
          <label>Max Investment (USDT)</label>
          <input
            type="number"
            min="10"
            step="10"
            value={localParams.maxTotalInvestment}
            onChange={e => updateParam('maxTotalInvestment', Number(e.target.value))}
          />
          <small>Absolute cap on total investment</small>
        </div>
      </div>

      {/* Safety Orders Table */}
      <div className="safety-orders-preview">
        <h4><TrendingDown size={16} /> Safety Orders Schedule</h4>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Price Drop</th>
              <th>Amount</th>
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {safetyOrders.map((so, i) => (
              <tr key={i} className={Number(so.total) > localParams.maxTotalInvestment ? 'over-budget' : ''}>
                <td>{so.order}</td>
                <td>{so.drop ? `-${so.drop}%` : '-'}</td>
                <td>${so.amount}</td>
                <td>${so.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isOverBudget && (
        <div className="budget-warning">
          <AlertTriangle size={16} />
          <span>
            Full safety orders require ${maxRequired.toFixed(2)} but max is ${localParams.maxTotalInvestment}.
            Later orders may be skipped.
          </span>
        </div>
      )}

      {/* Preview Stats */}
      <div className="preview-stats">
        <div className="preview-card">
          <DollarSign size={18} />
          <div>
            <span className="stat-label">Max Required</span>
            <span className={`stat-value ${isOverBudget ? 'negative' : ''}`}>
              ${maxRequired.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="preview-card">
          <TrendingDown size={18} />
          <div>
            <span className="stat-label">Max Drawdown</span>
            <span className="stat-value negative">
              -{(localParams.priceDropPercent * localParams.maxSafetyOrders).toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="preview-card">
          <Target size={18} />
          <div>
            <span className="stat-label">Take Profit</span>
            <span className="stat-value positive">+{localParams.takeProfitPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
