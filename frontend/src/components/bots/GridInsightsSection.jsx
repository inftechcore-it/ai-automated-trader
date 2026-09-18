import { useState } from 'react';
import {
  Grid3X3, Layers, DollarSign, TrendingUp, Shield, Target,
  Info, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle,
  HelpCircle, ChevronDown, ChevronUp, Zap, Coins, Calculator,
  Sparkles, Crosshair, Infinity as InfinityIcon
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
  // 1. GRID BOT / JARVIS / PRECISION GRID / INFINITY GRID INSIGHTS
  // ─────────────────────────────────────────────────────────────
  const isGridBased = ['GRID', 'INFINITY_GRID', 'JARVIS', 'PRECISION_GRID'].includes(strategyType);

  if (isGridBased) {
    const lowerPrice = Number(bot.strategyStatus?.metrics?.lowerPrice || params.lowerPrice || 0);
    const initialUpperPrice = Number(bot.strategyStatus?.metrics?.initialUpperPrice || params.upperPrice || 0);
    const initialLowerPrice = Number(bot.strategyStatus?.metrics?.initialLowerPrice || params.lowerPrice || 0);
    let upperPrice = Number(bot.strategyStatus?.metrics?.upperPrice || params.upperPrice || 0);
    const upperPriceIncrementsCount = Number(bot.strategyStatus?.metrics?.upperPriceIncrementsCount || 0);
    const gridCount = Number(params.gridCount || bot.strategyStatus?.metrics?.gridCount || 10);
    const totalInvestment = Number(params.totalInvestment || bot.investedAmount || bot.invested || 0);
    const maxBuysPerLevel = Number(params.maxBuysPerLevel || bot.strategyStatus?.metrics?.maxBuysPerLevel || 1);
    const stopLoss = Number(params.stopLoss || 0);
    const takeProfit = Number(params.takeProfit || 0);
    const gridSpacingPercent = Number(params.gridSpacingPercent || 1);
    const executionMode = params.executionMode || 'MARKET_ON_TOUCH';

    // For Infinity Grid, derive upper price if not explicitly provided
    if (strategyType === 'INFINITY_GRID' && (!upperPrice || upperPrice <= lowerPrice) && lowerPrice > 0) {
      upperPrice = lowerPrice * Math.pow(1 + gridSpacingPercent / 100, gridCount);
    }

    // Grid spacing calculation
    let gridSpacing = 0;
    if (strategyType === 'JARVIS' && params.incrementStepSpace && Number(params.incrementStepSpace) > 0) {
      gridSpacing = Number(params.incrementStepSpace);
    } else if (strategyType === 'INFINITY_GRID' && lowerPrice > 0) {
      gridSpacing = lowerPrice * (gridSpacingPercent / 100);
    } else if (gridCount > 0 && upperPrice > lowerPrice) {
      gridSpacing = (upperPrice - lowerPrice) / gridCount;
    }

    // Price tolerance calculation for Precision Grid
    let priceTolerance = 0;
    if (strategyType === 'PRECISION_GRID') {
      if (params.priceTolerance && Number(params.priceTolerance) > 0) {
        priceTolerance = Number(params.priceTolerance);
      } else if (bot.strategyStatus?.metrics?.priceTolerance) {
        priceTolerance = Number(bot.strategyStatus.metrics.priceTolerance);
      } else if (gridSpacing > 0) {
        priceTolerance = Math.min(gridSpacing * 0.20, lowerPrice < 1.0 ? 0.0009 : lowerPrice < 100 ? 0.05 : 1.0);
      }
    }

    // Current price from open orders, metrics, or midpoint estimation
    const metricPrice = Number(bot.strategyStatus?.metrics?.currentPrice || 0);
    const openOrderPrice = bot.openOrders?.[0]?.price ? Number(bot.openOrders[0].price) : 0;
    const currentPrice = metricPrice > 0 ? metricPrice : (openOrderPrice > 0 ? openOrderPrice : (lowerPrice + upperPrice) / 2);

    const spacingPercent = lowerPrice > 0 ? (gridSpacing / lowerPrice) * 100 : 0;
    const investmentPerGrid = gridCount > 0 ? totalInvestment / gridCount : 0;

    // Generate grid levels matrix
    const levels = [];
    if (gridCount > 0 && (upperPrice > lowerPrice || gridSpacing > 0)) {
      for (let i = gridCount; i >= 0; i--) {
        const levelPrice = strategyType === 'INFINITY_GRID'
          ? lowerPrice * Math.pow(1 + gridSpacingPercent / 100, i)
          : lowerPrice + i * gridSpacing;

        const coinsQty = levelPrice > 0 ? investmentPerGrid / levelPrice : 0;
        const profitPerCycle = coinsQty * gridSpacing;
        const profitPercent = levelPrice > 0 ? (gridSpacing / levelPrice) * 100 : 0;

        // Check if there is an active matching open order at this price level
        const toleranceWindow = priceTolerance > 0 ? priceTolerance * 1.5 : (gridSpacing * 0.45 || 0.01);
        const matchingOrder = (bot.openOrders || []).find(o =>
          Math.abs(Number(o.price || 0) - levelPrice) <= toleranceWindow
        );

        let role = 'BUY';
        let badgeType = 'buy';
        if (i === gridCount) {
          role = strategyType === 'JARVIS' ? 'Upper Bound (Auto-Surge)' : 'Upper Exit / Take Profit';
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

    const minCoins = levels.length > 1 ? levels[0].coinsQty : (levels[0]?.coinsQty || 0); // At top price (fewer coins)
    const maxCoins = levels.length > 0 ? levels[levels.length - 1].coinsQty : 0; // At bottom price (more coins)
    const avgProfitPerCycle = levels.length > 1 ? levels[1].profitPerCycle : (levels[0]?.profitPerCycle || 0);
    const avgProfitPercent = levels.length > 1 ? levels[1].profitPercent : (levels[0]?.profitPercent || 0);

    // Dynamic Title & Icon based on Strategy
    let title = 'Grid Sizing & Allocation Matrix';
    let subtitle = 'Exact breakdown of prices, coin quantities, and expected profits per grid step';
    let HeaderIcon = Grid3X3;

    if (strategyType === 'JARVIS') {
      title = 'JARVIS Autonomous Grid & Allocation Matrix';
      subtitle = 'Autonomous upper boundary expansion, coin quantities, and profit per grid step';
      HeaderIcon = Sparkles;
    } else if (strategyType === 'PRECISION_GRID') {
      title = 'Precision Grid & Corridor Allocation Matrix';
      subtitle = 'Decimal tolerance corridor breakdown, coin quantities, and instant execution levels';
      HeaderIcon = Zap;
    } else if (strategyType === 'INFINITY_GRID') {
      title = 'Infinity Grid Sizing & Matrix';
      subtitle = 'Upward-extending price steps, coin allocation per level, and profit roundtrips';
      HeaderIcon = InfinityIcon;
    }

    return (
      <div className="grid-insights-card">
        {/* Header with Title and Toggle */}
        <div className="grid-insights-header">
          <div className="title-group">
            <div className={`icon-badge ${strategyType.toLowerCase()}`}>
              <HeaderIcon size={20} />
            </div>
            <div>
              <h3>{title}</h3>
              <p className="subtitle">{subtitle}</p>
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
              aria-label="Toggle Expand"
            >
              {expandedView ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {/* Strategy Specific Interactive Highlight Banners */}
        {strategyType === 'JARVIS' && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
              <ArrowUpRight size={22} style={{ color: '#06b6d4', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>
                  🚀 JARVIS Autonomous Upper Boundary Expansion Active
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px', lineHeight: '1.4' }}>
                  When market price breaks out above <strong style={{ color: '#e2e8f0' }}>${upperPrice.toFixed(5)}</strong>, JARVIS autonomously recalculates: <code style={{ color: '#38bdf8', background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>newUpper = currentPrice + ${gridSpacing.toFixed(5)}</code> without stalling trading.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="footer-pill" style={{ background: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.4)', color: '#38bdf8' }}>
                <strong>Expansions:</strong> {upperPriceIncrementsCount} times
              </span>
              <span className="footer-pill">
                <strong>Step Space:</strong> ${gridSpacing.toFixed(5)}
              </span>
            </div>
          </div>
        )}

        {strategyType === 'PRECISION_GRID' && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
              <Crosshair size={22} style={{ color: '#38bdf8', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>
                  ⚡ Decimal Tolerance Corridor Active: ±${priceTolerance.toFixed(6)}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px', lineHeight: '1.4' }}>
                  Mode: <strong>{executionMode === 'MARKET_ON_TOUCH' ? 'Market on Touch (Instant Fill)' : 'Corridor Limit Orders'}</strong> — Eliminates slow fills and stranded orders when price touches corridor.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="footer-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}>
                <strong>Tolerance Band:</strong> ±${priceTolerance.toFixed(6)}
              </span>
            </div>
          </div>
        )}

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
                <code>(Upper Price - Lower Price) / Grid Count = (${upperPrice.toFixed(5)} - ${lowerPrice.toFixed(5)}) / {gridCount} = ${gridSpacing.toFixed(5)}</code>
              </div>
              <div className="formula-item">
                <strong>2. Money per Order:</strong>
                <code>Total Investment / Grid Count = ${totalInvestment.toFixed(2)} / {gridCount} = ${investmentPerGrid.toFixed(2)} {quoteAsset}</code>
              </div>
              <div className="formula-item">
                <strong>3. Coins Quantity:</strong>
                <code>Money to Spend (${investmentPerGrid.toFixed(2)}) / Grid Level Price = Exact {baseAsset} to buy</code>
              </div>
              <div className="formula-item">
                <strong>4. Cycle Profit:</strong>
                <code>Coins Quantity × Grid Spacing (${gridSpacing.toFixed(5)}) = Profit in {quoteAsset} upon selling at next level</code>
              </div>

              {strategyType === 'JARVIS' && (
                <div className="formula-item" style={{ borderLeft: '3px solid #06b6d4', paddingLeft: '8px' }}>
                  <strong>5. JARVIS Autonomous Upper Surge Equation:</strong>
                  <code>When currentPrice &gt;= ${upperPrice.toFixed(5)}, newUpper = currentPrice + ${gridSpacing.toFixed(5)} (Grid Step Space). Bot dynamically recalibrates without halting.</code>
                </div>
              )}

              {strategyType === 'PRECISION_GRID' && (
                <div className="formula-item" style={{ borderLeft: '3px solid #38bdf8', paddingLeft: '8px' }}>
                  <strong>5. Precision Corridor Execution Equation:</strong>
                  <code>Corridor Band = [Level Price - ${priceTolerance.toFixed(6)}, Level Price + ${priceTolerance.toFixed(6)}]. Any market tick touching this corridor triggers an immediate fill.</code>
                </div>
              )}
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
                  <th>Target Price {strategyType === 'PRECISION_GRID' ? '& Corridor' : ''}</th>
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
                        {lvl.index === gridCount && (strategyType === 'JARVIS' ? ' (Surge Top)' : ' (Top)')}
                        {lvl.index === 0 && ' (Base)'}
                      </span>
                    </td>
                    <td className="font-mono price-cell">
                      ${lvl.price.toFixed(5)}
                      {strategyType === 'PRECISION_GRID' && priceTolerance > 0 && (
                        <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 500, marginTop: '2px' }}>
                          ±${priceTolerance.toFixed(5)} [${(lvl.price - priceTolerance).toFixed(5)} - ${(lvl.price + priceTolerance).toFixed(5)}]
                        </div>
                      )}
                      {strategyType === 'JARVIS' && lvl.index === gridCount && (
                        <div style={{ fontSize: '10px', color: '#06b6d4', fontWeight: 500, marginTop: '2px' }}>
                          🚀 Expands on breakout
                        </div>
                      )}
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
                          {lvl.index === gridCount
                            ? (strategyType === 'JARVIS' ? 'Surge Ready' : 'Target Exit')
                            : 'Ready on Dip'}
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
                        Protects capital below lower bound (${lowerPrice.toFixed(5)})
                      </span>
                    </td>
                  </tr>
                )}

                {/* Take Profit Guard row if configured */}
                {takeProfit > 0 && (
                  <tr className="grid-level-row" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
                    <td className="level-index">
                      <span className="index-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        Take Profit
                      </span>
                    </td>
                    <td className="font-mono price-cell text-positive">
                      ${takeProfit.toFixed(5)}
                    </td>
                    <td>
                      <span className="role-tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        <Target size={13} /> Profit Lock Guard
                      </span>
                    </td>
                    <td colSpan={2} className="text-muted text-xs">
                      Liquidates all positions to cash on target reach
                    </td>
                    <td colSpan={2}>
                      <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 500 }}>
                        Locks profit above upper bound (${upperPrice.toFixed(5)})
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
              <strong>Price Range:</strong> ${lowerPrice.toFixed(5)} – ${upperPrice.toFixed(5)} {quoteAsset}
            </span>
            <span className="footer-pill">
              <strong>Max Buys / Level:</strong> {maxBuysPerLevel}
            </span>
            {strategyType === 'JARVIS' && (
              <>
                <span className="footer-pill" style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: '#06b6d4' }}>
                  <strong>Auto-Surge:</strong> Active
                </span>
                <span className="footer-pill">
                  <strong>Expansions:</strong> {upperPriceIncrementsCount}
                </span>
              </>
            )}
            {strategyType === 'PRECISION_GRID' && (
              <>
                <span className="footer-pill" style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}>
                  <strong>Tolerance:</strong> ±${priceTolerance.toFixed(6)}
                </span>
                <span className="footer-pill">
                  <strong>Execution:</strong> {executionMode}
                </span>
              </>
            )}
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
              Auto-calibrated on live market ticks
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
