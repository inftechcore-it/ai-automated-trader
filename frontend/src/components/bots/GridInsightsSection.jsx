import { useState } from 'react';
import {
  Grid3X3, Layers, DollarSign, TrendingUp, Shield, Target,
  Info, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle,
  HelpCircle, ChevronDown, ChevronUp, Zap, Coins, Calculator
} from 'lucide-react';

export default function GridInsightsSection({ bot }) {
  const [showFormulas, setShowFormulas] = useState(false);
  const [expandedView, setExpandedView] = useState(true);

  if (!bot) return null;

  // Safe JSON/Object parser for bot.params
  let params = {};
  try {
    params = typeof bot.params === 'string' ? JSON.parse(bot.params) : (bot.params || {});
  } catch (e) {
    params = {};
  }

  const strategyType = bot.strategyType || 'GRID';
  const symbol = bot.symbol || 'ASSET/USDT';
  const [baseAsset = 'COINS', quoteAsset = 'USDT'] = symbol.split('/');

  // ─────────────────────────────────────────────────────────────
  // 1. GRID BOT / INFINITY GRID INSIGHTS
  // ─────────────────────────────────────────────────────────────
  if (strategyType === 'GRID' || strategyType === 'INFINITY_GRID') {
    const lowerPrice = Number(params.lowerPrice || bot.strategyStatus?.metrics?.lowerPrice || 0);
    const upperPrice = Number(params.upperPrice || bot.strategyStatus?.metrics?.upperPrice || 0);
    const gridCount = Number(params.gridCount || bot.strategyStatus?.metrics?.gridCount || 3);
    const totalInvestment = Number(params.totalInvestment || bot.investedAmount || bot.invested || 0);
    const maxBuysPerLevel = Number(params.maxBuysPerLevel || bot.strategyStatus?.metrics?.maxBuysPerLevel || 1);
    const stopLoss = Number(params.stopLoss || 0);
    const takeProfit = Number(params.takeProfit || 0);

    // Current price from open orders, metrics, or current value estimation
    const metricPrice = Number(bot.strategyStatus?.metrics?.currentPrice || 0);
    const openOrderPrice = bot.openOrders?.[0]?.price ? Number(bot.openOrders[0].price) : 0;
    const currentPrice = metricPrice > 0 ? metricPrice : (openOrderPrice > 0 ? openOrderPrice : (lowerPrice + upperPrice) / 2);

    const priceRange = upperPrice - lowerPrice;
    const gridSpacing = gridCount > 0 && priceRange > 0 ? priceRange / gridCount : 0;
    const spacingPercent = lowerPrice > 0 ? (gridSpacing / lowerPrice) * 100 : 0;
    const investmentPerGrid = gridCount > 0 ? totalInvestment / gridCount : 0;

    // Generate grid levels matrix
    const levels = [];
    if (gridCount > 0 && upperPrice > lowerPrice) {
      for (let i = gridCount; i >= 0; i--) {
        const levelPrice = lowerPrice + i * gridSpacing;
        const coinsQty = levelPrice > 0 ? investmentPerGrid / levelPrice : 0;
        const profitPerCycle = coinsQty * gridSpacing;
        const profitPercent = levelPrice > 0 ? (gridSpacing / levelPrice) * 100 : 0;

        // Check if there is an active matching open order at this price level
        const matchingOrder = (bot.openOrders || []).find(o =>
          Math.abs(Number(o.price || 0) - levelPrice) < (gridSpacing * 0.45)
        );

        let role = 'BUY';
        let badgeType = 'buy';
        if (i === gridCount) {
          role = 'Upper Exit / Take Profit';
          badgeType = 'exit';
        } else if (i === 0) {
          role = 'Base Buy Level';
          badgeType = 'base';
        } else if (currentPrice > 0 && levelPrice > currentPrice) {
          role = 'Sell Target';
          badgeType = 'sell';
        } else {
          role = 'Dip Buy Level';
          badgeType = 'buy';
        }

        levels.push({
          index: i,
          price: levelPrice,
          role,
          badgeType,
          coinsQty,
          orderValue: investmentPerGrid,
          profitPerCycle,
          profitPercent,
          matchingOrder,
        });
      }
    }

    const minCoins = levels.length > 1 ? levels[0].coinsQty : 0; // At top price (fewer coins)
    const maxCoins = levels.length > 0 ? levels[levels.length - 1].coinsQty : 0; // At bottom price (more coins)
    const avgProfitPerCycle = levels.length > 1 ? levels[1].profitPerCycle : 0;
    const avgProfitPercent = levels.length > 1 ? levels[1].profitPercent : 0;

    return (
      <div className="grid-insights-card">
        {/* Header with Title and Toggle */}
        <div className="grid-insights-header">
          <div className="title-group">
            <div className="icon-badge">
              <Grid3X3 size={20} />
            </div>
            <div>
              <h3>Grid Sizing & Allocation Matrix</h3>
              <p className="subtitle">
                Exact breakdown of prices, coin quantities, and expected profits per grid step
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="calc-toggle-btn"
              onClick={() => setShowFormulas(!showFormulas)}
              title="How calculations work"
            >
              <Calculator size={15} />
              {showFormulas ? 'Hide Formulas' : 'Explain Math'}
            </button>
            <button
              className="expand-btn"
              onClick={() => setExpandedView(!expandedView)}
            >
              {expandedView ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {/* Highlight Insights Grid */}
        <div className="grid-stats-row">
          <div className="stat-box">
            <div className="stat-icon-wrapper spacing">
              <Layers size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Grid Step Spacing</span>
              <span className="stat-val font-mono">
                ${gridSpacing.toFixed(5)} <span className="stat-sub">({spacingPercent.toFixed(2)}%)</span>
              </span>
              <span className="stat-caption">{gridCount} equal price steps</span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon-wrapper capital">
              <DollarSign size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Capital Per Grid</span>
              <span className="stat-val font-mono">
                ${investmentPerGrid.toFixed(2)} <span className="stat-sub">{quoteAsset}</span>
              </span>
              <span className="stat-caption">${totalInvestment.toFixed(2)} total investment</span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon-wrapper coins">
              <Coins size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Coins Bought / Grid</span>
              <span className="stat-val font-mono">
                {minCoins > 0 && maxCoins > 0 ? (
                  `${minCoins.toFixed(2)} – ${maxCoins.toFixed(2)}`
                ) : (
                  'Calculating...'
                )}
              </span>
              <span className="stat-caption">{baseAsset} per filled buy</span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon-wrapper profit">
              <TrendingUp size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Profit per Cycle</span>
              <span className="stat-val font-mono text-positive">
                +${avgProfitPerCycle.toFixed(4)} <span className="stat-sub">(+{avgProfitPercent.toFixed(2)}%)</span>
              </span>
              <span className="stat-caption">Per Buy $\rightarrow$ Sell roundtrip</span>
            </div>
          </div>
        </div>

        {/* Formula Explanation Popup / Card (Collapsible) */}
        {showFormulas && (
          <div className="formula-explanation-box">
            <div className="formula-title">
              <Info size={16} />
              <span>How the Bot Calculates Every Order & Quantity:</span>
            </div>
            <div className="formula-items">
              <div className="formula-item">
                <strong>1. Grid Step Spacing:</strong>
                <code>(Upper Price - Lower Price) / Grid Count = (${upperPrice} - ${lowerPrice}) / {gridCount} = ${gridSpacing.toFixed(5)}</code>
              </div>
              <div className="formula-item">
                <strong>2. Money per Order:</strong>
                <code>Total Investment / Grid Count = ${totalInvestment} / {gridCount} = ${investmentPerGrid.toFixed(2)} {quoteAsset}</code>
              </div>
              <div className="formula-item">
                <strong>3. Coins Quantity:</strong>
                <code>Money to Spend ($${investmentPerGrid.toFixed(2)}) / Grid Level Price = Exact {baseAsset} to buy</code>
              </div>
              <div className="formula-item">
                <strong>4. Cycle Profit:</strong>
                <code>Coins Quantity × Grid Spacing (${gridSpacing.toFixed(5)}) = Profit in {quoteAsset} upon selling at next level</code>
              </div>
            </div>
          </div>
        )}

        {/* Expanded Grid Levels Table */}
        {expandedView && (
          <div className="grid-table-wrapper">
            <table className="grid-ladder-table">
              <thead>
                <tr>
                  <th>Grid Level</th>
                  <th>Target Price</th>
                  <th>Role / Strategy Zone</th>
                  <th>Order Capital</th>
                  <th>Quantity of Coins</th>
                  <th>Est. Profit / Cycle</th>
                  <th>Live Status</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((lvl) => (
                  <tr
                    key={lvl.index}
                    className={`grid-level-row ${lvl.matchingOrder ? 'has-active-order' : ''} ${lvl.badgeType}`}
                  >
                    <td className="level-index">
                      <span className="index-pill">
                        Grid #{lvl.index}
                        {lvl.index === gridCount && ' (Top)'}
                        {lvl.index === 0 && ' (Base)'}
                      </span>
                    </td>
                    <td className="font-mono price-cell">
                      ${lvl.price.toFixed(5)}
                    </td>
                    <td>
                      <span className={`role-tag ${lvl.badgeType}`}>
                        {lvl.badgeType === 'buy' && <ArrowDownRight size={13} />}
                        {lvl.badgeType === 'sell' && <ArrowUpRight size={13} />}
                        {lvl.badgeType === 'exit' && <Target size={13} />}
                        {lvl.badgeType === 'base' && <Shield size={13} />}
                        {lvl.role}
                      </span>
                    </td>
                    <td className="font-mono">
                      ${lvl.orderValue.toFixed(2)} {quoteAsset}
                    </td>
                    <td className="font-mono font-semibold text-accent">
                      {lvl.coinsQty.toFixed(4)} {baseAsset}
                    </td>
                    <td className="font-mono text-positive">
                      +${lvl.profitPerCycle.toFixed(4)}
                      <span className="profit-sub"> (+{lvl.profitPercent.toFixed(2)}%)</span>
                    </td>
                    <td>
                      {lvl.matchingOrder ? (
                        <span className="order-live-badge">
                          <span className="pulsing-dot" />
                          Open {lvl.matchingOrder.side} ({Number(lvl.matchingOrder.quantity || 0).toFixed(2)})
                        </span>
                      ) : (
                        <span className="order-idle-badge">
                          {lvl.index === gridCount ? 'Target Exit' : 'Ready on Dip'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Stop Loss Guard row if configured */}
                {stopLoss > 0 && (
                  <tr className="grid-level-row stoploss-row">
                    <td className="level-index">
                      <span className="index-pill stoploss">Stop Loss</span>
                    </td>
                    <td className="font-mono price-cell text-negative">
                      ${stopLoss.toFixed(5)}
                    </td>
                    <td>
                      <span className="role-tag stoploss">
                        <Shield size={13} /> Emergency Exit Guard
                      </span>
                    </td>
                    <td colSpan={2} className="text-muted text-xs">
                      Triggers market liquidation of held positions
                    </td>
                    <td colSpan={2}>
                      <span className="stoploss-guard-badge">
                        Protects capital below lower bound (${lowerPrice})
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info bar */}
        <div className="grid-insights-footer">
          <div className="footer-left">
            <span className="footer-pill">
              <strong>Price Range:</strong> ${lowerPrice} – ${upperPrice} {quoteAsset}
            </span>
            <span className="footer-pill">
              <strong>Max Buys / Level:</strong> {maxBuysPerLevel}
            </span>
            {stopLoss > 0 && (
              <span className="footer-pill stoploss">
                <strong>Stop Loss:</strong> ${stopLoss}
              </span>
            )}
            {takeProfit > 0 && (
              <span className="footer-pill takeprofit">
                <strong>Take Profit:</strong> ${takeProfit}
              </span>
            )}
          </div>
          <div className="footer-right">
            <span className="text-xs text-muted">
              Auto-calibrated on market ticks
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. DCA BOT INSIGHTS
  // ─────────────────────────────────────────────────────────────
  if (strategyType === 'DCA') {
    const amountPerBuy = Number(params.amountPerBuy || 0);
    const interval = params.interval || 'daily';
    const totalBudget = Number(params.totalBudget || bot.investedAmount || 0);
    const takeProfitPercent = Number(params.takeProfitPercent || 0);
    const stopLossPercent = Number(params.stopLossPercent || 0);

    return (
      <div className="grid-insights-card">
        <div className="grid-insights-header">
          <div className="title-group">
            <div className="icon-badge dca">
              <Zap size={20} />
            </div>
            <div>
              <h3>DCA Accumulation Strategy</h3>
              <p className="subtitle">Fixed capital investment scheduled regularly over time</p>
            </div>
          </div>
        </div>

        <div className="grid-stats-row">
          <div className="stat-box">
            <div className="stat-icon-wrapper capital">
              <DollarSign size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Amount Per Order</span>
              <span className="stat-val font-mono">${amountPerBuy.toFixed(2)}</span>
              <span className="stat-caption">Fixed USD per execution</span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon-wrapper spacing">
              <Layers size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Interval Frequency</span>
              <span className="stat-val">{interval.replace('_', ' ').toUpperCase()}</span>
              <span className="stat-caption">Recurring DCA schedule</span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon-wrapper coins">
              <Coins size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Est. Total Buys</span>
              <span className="stat-val font-mono">
                {amountPerBuy > 0 ? Math.floor(totalBudget / amountPerBuy) : 0} Cycles
              </span>
              <span className="stat-caption">From ${totalBudget.toFixed(2)} total budget</span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon-wrapper profit">
              <Target size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Targets (TP / SL)</span>
              <span className="stat-val font-mono">
                {takeProfitPercent ? `+${takeProfitPercent}%` : 'Off'} / {stopLossPercent ? `-${stopLossPercent}%` : 'Off'}
              </span>
              <span className="stat-caption">Profit & risk triggers</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. MARTINGALE BOT INSIGHTS
  // ─────────────────────────────────────────────────────────────
  if (strategyType === 'MARTINGALE') {
    const initialBuyAmount = Number(params.initialBuyAmount || 10);
    const multiplier = Number(params.multiplier || 2);
    const maxSafetyOrders = Number(params.maxSafetyOrders || 3);
    const priceDropPercent = Number(params.priceDropPercent || 2);
    const takeProfitPercent = Number(params.takeProfitPercent || 3);

    return (
      <div className="grid-insights-card">
        <div className="grid-insights-header">
          <div className="title-group">
            <div className="icon-badge martingale">
              <Layers size={20} />
            </div>
            <div>
              <h3>Martingale Order Laddering</h3>
              <p className="subtitle">Position scaling and safety order multipliers on dips</p>
            </div>
          </div>
        </div>

        <div className="grid-stats-row">
          <div className="stat-box">
            <div className="stat-icon-wrapper capital">
              <DollarSign size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Initial Base Order</span>
              <span className="stat-val font-mono">${initialBuyAmount.toFixed(2)}</span>
              <span className="stat-caption">First entry position</span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon-wrapper spacing">
              <Layers size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Safety Multiplier</span>
              <span className="stat-val font-mono">{multiplier}x per drop</span>
              <span className="stat-caption">Triggers every -{priceDropPercent}% drop</span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon-wrapper coins">
              <Coins size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Max Safety Orders</span>
              <span className="stat-val font-mono">{maxSafetyOrders} orders</span>
              <span className="stat-caption">Max ladder depth</span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon-wrapper profit">
              <Target size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-title">Take Profit Target</span>
              <span className="stat-val font-mono text-positive">+{takeProfitPercent}%</span>
              <span className="stat-caption">From average entry price</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
