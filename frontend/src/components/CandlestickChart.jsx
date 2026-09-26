import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Eye, Activity, Sliders, Layers,
  Maximize2, Zap, BarChart2, Info, Check, ShieldAlert
} from 'lucide-react';
import { CANDLESTICK_PATTERNS_DB, calculateHeikinAshi } from '../utils/candlestickPatterns.js';

export default function CandlestickChart({
  candles = [],
  detectedPatterns = [],
  symbol = '',
  exchange = '',
  interval = '1h',
  onIntervalChange,
  currencySymbol = '$',
  height = 420,
  showControls = true
}) {
  const [chartType, setChartType] = useState('candlestick'); // 'candlestick' | 'heikin' | 'area' | 'line'
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showEMA9, setShowEMA9] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showRSI, setShowRSI] = useState(false);
  const [showPatterns, setShowPatterns] = useState(true);
  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [hoveredPattern, setHoveredPattern] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(700);

  // Resize listener
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth || 700);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Compute displayed candle data (regular or Heikin-Ashi)
  const displayCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    if (chartType === 'heikin') {
      return calculateHeikinAshi(candles);
    }
    return candles.map(c => ({
      ...c,
      open: Number(c.open || 0),
      high: Number(c.high || 0),
      low: Number(c.low || 0),
      close: Number(c.close || 0),
      volume: Number(c.volume || 0)
    }));
  }, [candles, chartType]);

  // Compute Moving Averages, Bollinger Bands, and RSI
  const technicals = useMemo(() => {
    if (displayCandles.length === 0) return { sma20: [], sma50: [], ema9: [], bbUpper: [], bbLower: [], rsi: [] };
    const closes = displayCandles.map(c => c.close);
    const len = closes.length;

    // SMA
    const calcSMA = (period) => {
      return closes.map((_, i) => {
        if (i < period - 1) return null;
        const slice = closes.slice(i - period + 1, i + 1);
        return slice.reduce((a, b) => a + b, 0) / period;
      });
    };

    // EMA
    const calcEMA = (period) => {
      const k = 2 / (period + 1);
      const res = [];
      let ema = closes[0];
      for (let i = 0; i < len; i++) {
        if (i === 0) {
          res.push(ema);
        } else {
          ema = closes[i] * k + ema * (1 - k);
          res.push(ema);
        }
      }
      return res;
    };

    // Bollinger Bands (20, 2)
    const sma20 = calcSMA(20);
    const bbUpper = [];
    const bbLower = [];
    for (let i = 0; i < len; i++) {
      if (i < 19 || sma20[i] === null) {
        bbUpper.push(null);
        bbLower.push(null);
      } else {
        const slice = closes.slice(i - 19, i + 1);
        const mean = sma20[i];
        const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 20;
        const stdDev = Math.sqrt(variance);
        bbUpper.push(mean + stdDev * 2);
        bbLower.push(mean - stdDev * 2);
      }
    }

    // RSI 14
    const rsi = [];
    for (let i = 0; i < len; i++) {
      if (i < 14) {
        rsi.push(50);
      } else {
        let gains = 0;
        let losses = 0;
        for (let j = i - 13; j <= i; j++) {
          const diff = closes[j] - closes[j - 1];
          if (diff >= 0) gains += diff;
          else losses += Math.abs(diff);
        }
        const avgGain = gains / 14;
        const avgLoss = Math.max(0.0001, losses / 14);
        const rs = avgGain / avgLoss;
        rsi.push(Math.round(100 - (100 / (1 + rs))));
      }
    }

    return {
      sma20,
      sma50: calcSMA(50),
      ema9: calcEMA(9),
      bbUpper,
      bbLower,
      rsi
    };
  }, [displayCandles]);

  // Min, max, scales
  const chartMetrics = useMemo(() => {
    if (displayCandles.length === 0) return { minPrice: 0, maxPrice: 1, maxVolume: 1 };
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;

    displayCandles.forEach((c, i) => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > maxVol) maxVol = c.volume;

      // Include indicators in bounding box if enabled
      if (showBollinger && technicals.bbUpper[i]) {
        if (technicals.bbUpper[i] > max) max = technicals.bbUpper[i];
        if (technicals.bbLower[i] < min) min = technicals.bbLower[i];
      }
    });

    // Add 4% padding
    const padding = (max - min) * 0.05 || max * 0.02 || 1;
    return {
      minPrice: Math.max(0.000001, min - padding),
      maxPrice: max + padding,
      maxVolume: maxVol || 1000
    };
  }, [displayCandles, showBollinger, technicals]);

  // Layout measurements
  const paddingLeft = 10;
  const paddingRight = 65;
  const paddingTop = 25;
  const rsiHeight = showRSI ? 85 : 0;
  const mainChartHeight = height - paddingTop - (showRSI ? 100 : 35);
  const chartWidth = Math.max(200, containerWidth - paddingLeft - paddingRight);
  const candleCount = displayCandles.length || 1;
  const candleSpacing = chartWidth / candleCount;
  const candleWidth = Math.max(3, Math.min(18, candleSpacing * 0.72));

  // Coordinate mapping functions
  const getY = (price) => {
    const { minPrice, maxPrice } = chartMetrics;
    const range = maxPrice - minPrice || 1;
    return paddingTop + mainChartHeight - ((price - minPrice) / range) * mainChartHeight;
  };

  const getX = (index) => {
    return paddingLeft + index * candleSpacing + candleSpacing / 2;
  };

  // Formatters
  const formatPrice = (p) => {
    if (p === undefined || p === null || isNaN(p)) return '0.00';
    if (p >= 1000) return `${currencySymbol}${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    if (p >= 1) return `${currencySymbol}${p.toFixed(2)}`;
    return `${currencySymbol}${p.toFixed(5)}`;
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    if (interval.includes('d') || interval.includes('w')) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Generate path strings for lines and areas
  const getLinePath = (values) => {
    const points = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== null && values[i] !== undefined && !isNaN(values[i])) {
        const x = getX(i);
        const y = getY(values[i]);
        points.push(`${i === 0 || points.length === 0 ? 'M' : 'L'} ${x} ${y}`);
      }
    }
    return points.join(' ');
  };

  const getAreaPath = () => {
    if (displayCandles.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(displayCandles.length - 1);
    const bottomY = getY(chartMetrics.minPrice);
    const linePath = displayCandles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(c.close)}`).join(' ');
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  // Map detected patterns by index for quick marker rendering
  const patternsByIndex = useMemo(() => {
    const map = {};
    if (!detectedPatterns || detectedPatterns.length === 0) return map;
    detectedPatterns.forEach(p => {
      if (p.index !== undefined) {
        if (!map[p.index]) map[p.index] = [];
        map[p.index].push(p);
      }
    });
    return map;
  }, [detectedPatterns]);

  // Handle mouse movement for crosshair and tooltips
  const handleMouseMove = (e) => {
    if (!containerRef.current || displayCandles.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const adjustedX = mouseX - paddingLeft;
    const index = Math.max(0, Math.min(displayCandles.length - 1, Math.floor(adjustedX / candleSpacing)));
    setHoveredCandle(displayCandles[index]);
    setTooltipPos({ x: mouseX, y: mouseY });

    // Check if pattern marker is hovered
    const patterns = patternsByIndex[index];
    if (patterns && patterns.length > 0) {
      setHoveredPattern(patterns[0]);
    } else {
      setHoveredPattern(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
    setHoveredPattern(null);
  };

  // Y-axis Price Ticks
  const priceTicks = useMemo(() => {
    const { minPrice, maxPrice } = chartMetrics;
    const count = 5;
    const step = (maxPrice - minPrice) / (count - 1);
    return Array.from({ length: count }, (_, i) => minPrice + i * step);
  }, [chartMetrics]);

  return (
    <div className="candlestick-chart-wrapper" ref={containerRef} style={{ width: '100%' }}>
      {/* Header Controls */}
      {showControls && (
        <div className="chart-toolbar">
          <div className="toolbar-left">
            {/* Chart Type Selector */}
            <div className="chart-type-tabs">
              <button
                className={`tab-btn ${chartType === 'candlestick' ? 'active' : ''}`}
                onClick={() => setChartType('candlestick')}
                title="Candlestick Chart"
              >
                🕯️ Candles
              </button>
              <button
                className={`tab-btn ${chartType === 'heikin' ? 'active' : ''}`}
                onClick={() => setChartType('heikin')}
                title="Heikin-Ashi Smoothed Candles"
              >
                📊 Heikin-Ashi
              </button>
              <button
                className={`tab-btn ${chartType === 'area' ? 'active' : ''}`}
                onClick={() => setChartType('area')}
                title="Area Chart"
              >
                📈 Area
              </button>
              <button
                className={`tab-btn ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => setChartType('line')}
                title="Line Chart"
              >
                〰️ Line
              </button>
            </div>

            {/* Interval switchers */}
            {onIntervalChange && (
              <div className="interval-tabs">
                {['1m', '5m', '15m', '1h', '4h', '1d', '1w'].map(int => (
                  <button
                    key={int}
                    className={`int-btn ${interval === int ? 'active' : ''}`}
                    onClick={() => onIntervalChange(int)}
                  >
                    {int}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="toolbar-right">
            {/* Indicator Toggles */}
            <div className="indicator-toggles">
              <button
                className={`ind-pill ${showPatterns ? 'active' : ''}`}
                onClick={() => setShowPatterns(!showPatterns)}
                title="Toggle Candlestick Pattern Overlay Markers"
              >
                🎯 Patterns ({detectedPatterns?.length || 0})
              </button>
              <button
                className={`ind-pill ${showSMA20 ? 'active' : ''}`}
                onClick={() => setShowSMA20(!showSMA20)}
                style={{ borderColor: showSMA20 ? '#ffb703' : 'transparent' }}
              >
                SMA 20
              </button>
              <button
                className={`ind-pill ${showSMA50 ? 'active' : ''}`}
                onClick={() => setShowSMA50(!showSMA50)}
                style={{ borderColor: showSMA50 ? '#3a86ff' : 'transparent' }}
              >
                SMA 50
              </button>
              <button
                className={`ind-pill ${showBollinger ? 'active' : ''}`}
                onClick={() => setShowBollinger(!showBollinger)}
                style={{ borderColor: showBollinger ? '#00f5d4' : 'transparent' }}
              >
                Bollinger
              </button>
              <button
                className={`ind-pill ${showRSI ? 'active' : ''}`}
                onClick={() => setShowRSI(!showRSI)}
                style={{ borderColor: showRSI ? '#b5179e' : 'transparent' }}
              >
                RSI (14)
              </button>
              <button
                className={`ind-pill ${showVolume ? 'active' : ''}`}
                onClick={() => setShowVolume(!showVolume)}
              >
                Vol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time OHLC Bar Header */}
      <div className="chart-ohlc-banner">
        {hoveredCandle ? (
          <div className="ohlc-stats">
            <span className="ohlc-time">{formatTime(hoveredCandle.time)}</span>
            <span className="ohlc-item">
              <span className="lbl">O:</span> <span className="val">{formatPrice(hoveredCandle.open)}</span>
            </span>
            <span className="ohlc-item">
              <span className="lbl">H:</span> <span className="val gain">{formatPrice(hoveredCandle.high)}</span>
            </span>
            <span className="ohlc-item">
              <span className="lbl">L:</span> <span className="val loss">{formatPrice(hoveredCandle.low)}</span>
            </span>
            <span className="ohlc-item">
              <span className="lbl">C:</span>{' '}
              <span className={`val ${hoveredCandle.close >= hoveredCandle.open ? 'gain' : 'loss'}`}>
                {formatPrice(hoveredCandle.close)}
              </span>
            </span>
            <span className="ohlc-item">
              <span className="lbl">Chg:</span>{' '}
              <span className={`val ${hoveredCandle.close >= hoveredCandle.open ? 'gain' : 'loss'}`}>
                {(((hoveredCandle.close - hoveredCandle.open) / (hoveredCandle.open || 1)) * 100).toFixed(2)}%
              </span>
            </span>
            {showVolume && hoveredCandle.volume !== undefined && (
              <span className="ohlc-item">
                <span className="lbl">Vol:</span> <span className="val">{hoveredCandle.volume.toLocaleString()}</span>
              </span>
            )}
          </div>
        ) : displayCandles.length > 0 ? (
          <div className="ohlc-stats default">
            <span className="ohlc-title">{symbol} {exchange ? `• ${exchange}` : ''}</span>
            <span className="ohlc-item">
              <span className="lbl">Last:</span>{' '}
              <span className="val bold">
                {formatPrice(displayCandles[displayCandles.length - 1].close)}
              </span>
            </span>
            <span className="ohlc-hint">Hover chart to inspect candlestick data & detected patterns</span>
          </div>
        ) : null}
      </div>

      {/* SVG Canvas Container */}
      <div
        className="chart-svg-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ position: 'relative', height: `${height}px`, width: '100%', cursor: 'crosshair' }}
      >
        <svg
          width="100%"
          height={height}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00ff88" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#00ff88" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="bollingerBandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f5d4" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#00f5d4" stopOpacity={0.08} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <g className="grid-lines">
            {priceTicks.map((price, idx) => {
              const y = getY(price);
              return (
                <g key={`grid-${idx}`}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth + paddingLeft}
                    y2={y}
                    stroke="#1a2333"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  {/* Price Tick Labels on Right */}
                  <text
                    x={chartWidth + paddingLeft + 6}
                    y={y + 4}
                    fill="#62758d"
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    {formatPrice(price).replace(currencySymbol, '')}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Volume bars at bottom of main chart */}
          {showVolume && (
            <g className="volume-bars">
              {displayCandles.map((c, i) => {
                const x = getX(i);
                const isGreen = c.close >= c.open;
                const volHeight = Math.max(2, (c.volume / chartMetrics.maxVolume) * (mainChartHeight * 0.22));
                const volY = paddingTop + mainChartHeight - volHeight;
                return (
                  <rect
                    key={`vol-${i}`}
                    x={x - candleWidth / 2}
                    y={volY}
                    width={candleWidth}
                    height={volHeight}
                    fill={isGreen ? 'rgba(0, 255, 136, 0.18)' : 'rgba(255, 71, 87, 0.18)'}
                  />
                );
              })}
            </g>
          )}

          {/* Bollinger Bands Envelopes */}
          {showBollinger && technicals.bbUpper.length > 0 && (
            <g className="bollinger-bands">
              <path
                d={getLinePath(technicals.bbUpper)}
                fill="none"
                stroke="#00f5d4"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.6"
              />
              <path
                d={getLinePath(technicals.bbLower)}
                fill="none"
                stroke="#00f5d4"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.6"
              />
            </g>
          )}

          {/* Area Chart Mode */}
          {chartType === 'area' && (
            <g className="area-chart">
              <path d={getAreaPath()} fill="url(#areaGradient)" />
              <path
                d={getLinePath(displayCandles.map(c => c.close))}
                fill="none"
                stroke="#00ff88"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Line Chart Mode */}
          {chartType === 'line' && (
            <g className="line-chart">
              <path
                d={getLinePath(displayCandles.map(c => c.close))}
                fill="none"
                stroke="#00d2ff"
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* Candlestick / Heikin-Ashi Mode */}
          {(chartType === 'candlestick' || chartType === 'heikin') && (
            <g className="candlesticks">
              {displayCandles.map((c, i) => {
                const x = getX(i);
                const isGreen = c.close >= c.open;
                const candleColor = isGreen ? '#00ff88' : '#ff4757';
                const bodyTop = Math.min(getY(c.open), getY(c.close));
                const bodyBottom = Math.max(getY(c.open), getY(c.close));
                const bodyHeight = Math.max(2, bodyBottom - bodyTop);
                const highY = getY(c.high);
                const lowY = getY(c.low);

                return (
                  <g key={`candle-${i}`} className="candle-group">
                    {/* Wick */}
                    <line
                      x1={x}
                      y1={highY}
                      x2={x}
                      y2={lowY}
                      stroke={candleColor}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    {/* Real Body */}
                    <rect
                      x={x - candleWidth / 2}
                      y={bodyTop}
                      width={candleWidth}
                      height={bodyHeight}
                      fill={candleColor}
                      rx="1"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Moving Averages */}
          {showSMA20 && technicals.sma20.length > 0 && (
            <path
              d={getLinePath(technicals.sma20)}
              fill="none"
              stroke="#ffb703"
              strokeWidth="1.8"
            />
          )}
          {showSMA50 && technicals.sma50.length > 0 && (
            <path
              d={getLinePath(technicals.sma50)}
              fill="none"
              stroke="#3a86ff"
              strokeWidth="1.8"
            />
          )}
          {showEMA9 && technicals.ema9.length > 0 && (
            <path
              d={getLinePath(technicals.ema9)}
              fill="none"
              stroke="#b5179e"
              strokeWidth="1.8"
            />
          )}

          {/* Candlestick Pattern Overlay Markers */}
          {showPatterns && detectedPatterns && detectedPatterns.map((p, pIdx) => {
            if (p.index === undefined || p.index < 0 || p.index >= displayCandles.length) return null;
            const c = displayCandles[p.index];
            const x = getX(p.index);
            const isBullish = p.sentiment === 'bullish';
            const isBearish = p.sentiment === 'bearish';
            const markerY = isBullish ? getY(c.low) + 16 : getY(c.high) - 16;
            const markerBg = isBullish ? '#00ff88' : (isBearish ? '#ff4757' : '#ffd166');
            const arrowColor = '#0b0f17';

            return (
              <g
                key={`pat-${pIdx}`}
                className="pattern-marker"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPattern(p)}
              >
                {/* Connecting stem line */}
                <line
                  x1={x}
                  y1={isBullish ? getY(c.low) + 2 : getY(c.high) - 2}
                  x2={x}
                  y2={markerY}
                  stroke={markerBg}
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
                {/* Glow ring */}
                <circle
                  cx={x}
                  cy={markerY}
                  r="9"
                  fill={markerBg}
                  fillOpacity="0.2"
                />
                {/* Solid Badge */}
                <circle
                  cx={x}
                  cy={markerY}
                  r="6.5"
                  fill={markerBg}
                />
                {/* Directional Icon */}
                <text
                  x={x}
                  y={markerY + 3.5}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                  fill={arrowColor}
                >
                  {isBullish ? '▲' : (isBearish ? '▼' : '●')}
                </text>
              </g>
            );
          })}

          {/* Interactive Crosshairs */}
          {hoveredCandle && (
            <g className="crosshair">
              {/* Vertical line */}
              <line
                x1={tooltipPos.x}
                y1={paddingTop}
                x2={tooltipPos.x}
                y2={paddingTop + mainChartHeight + rsiHeight}
                stroke="#4a5d78"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              {/* Horizontal line */}
              <line
                x1={paddingLeft}
                y1={tooltipPos.y}
                x2={chartWidth + paddingLeft}
                y2={tooltipPos.y}
                stroke="#4a5d78"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            </g>
          )}

          {/* RSI Sub-Chart Panel */}
          {showRSI && (
            <g className="rsi-panel" transform={`translate(0, ${paddingTop + mainChartHeight + 15})`}>
              {/* Sub-panel background */}
              <rect
                x={paddingLeft}
                y="0"
                width={chartWidth}
                height={rsiHeight - 15}
                fill="rgba(10, 15, 25, 0.6)"
                stroke="#1a2333"
                rx="4"
              />
              {/* RSI 70 & 30 Reference lines */}
              <line
                x1={paddingLeft}
                y1={(1 - 70 / 100) * (rsiHeight - 15)}
                x2={chartWidth + paddingLeft}
                y2={(1 - 70 / 100) * (rsiHeight - 15)}
                stroke="rgba(255, 71, 87, 0.4)"
                strokeDasharray="2 2"
              />
              <line
                x1={paddingLeft}
                y1={(1 - 30 / 100) * (rsiHeight - 15)}
                x2={chartWidth + paddingLeft}
                y2={(1 - 30 / 100) * (rsiHeight - 15)}
                stroke="rgba(0, 255, 136, 0.4)"
                strokeDasharray="2 2"
              />
              <text x={chartWidth + paddingLeft + 5} y="12" fill="#b5179e" fontSize="9">RSI (14)</text>
              <text x={chartWidth + paddingLeft + 5} y={(1 - 70 / 100) * (rsiHeight - 15) + 3} fill="#ff4757" fontSize="8">70</text>
              <text x={chartWidth + paddingLeft + 5} y={(1 - 30 / 100) * (rsiHeight - 15) + 3} fill="#00ff88" fontSize="8">30</text>

              {/* RSI Line */}
              {technicals.rsi.length > 0 && (
                <path
                  d={technicals.rsi.map((val, i) => {
                    const x = getX(i);
                    const y = (1 - (val || 50) / 100) * (rsiHeight - 15);
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#b5179e"
                  strokeWidth="1.8"
                />
              )}
            </g>
          )}
        </svg>

        {/* Candlestick Pattern Hover Tooltip Card */}
        {hoveredPattern && (
          <div
            className="pattern-hover-card"
            style={{
              position: 'absolute',
              left: Math.min(containerWidth - 280, Math.max(15, tooltipPos.x - 130)),
              top: Math.max(10, tooltipPos.y - 140),
              zIndex: 30
            }}
          >
            <div className="pattern-card-header">
              <span className={`pattern-badge ${hoveredPattern.sentiment}`}>
                {hoveredPattern.sentiment === 'bullish' ? '🟢 Bullish Signal' : (hoveredPattern.sentiment === 'bearish' ? '🔴 Bearish Signal' : '🟡 Neutral Indecision')}
              </span>
              <span className="pattern-reliability">
                {'★'.repeat(hoveredPattern.reliability || 4)} ({hoveredPattern.confidence || 85}%)
              </span>
            </div>
            <h4 className="pattern-name">{hoveredPattern.name}</h4>
            <p className="pattern-desc">{hoveredPattern.description}</p>
            <div className="pattern-targets">
              {hoveredPattern.targetPrice && (
                <div className="target-item gain">
                  <span>Target:</span> <strong>{formatPrice(hoveredPattern.targetPrice)}</strong>
                </div>
              )}
              {hoveredPattern.stopLoss && (
                <div className="target-item loss">
                  <span>Stop Loss:</span> <strong>{formatPrice(hoveredPattern.stopLoss)}</strong>
                </div>
              )}
            </div>
            <p className="pattern-psychology">💡 {hoveredPattern.psychology}</p>
          </div>
        )}
      </div>
    </div>
  );
}
