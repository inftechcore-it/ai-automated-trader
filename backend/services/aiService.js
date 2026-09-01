import { getHistory, getQuote } from './exchangeService.js';
import * as gemini from './geminiService.js';
import predictionService from './predictionService.js';

// Technical Analysis Functions
function calculateSMA(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function calculateRSI(closes, period = 14) {
  const gains = [];
  const losses = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const rsiValues = [];

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs)));
  }

  return rsiValues;
}

function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);

  const macdLine = emaFast.slice(slowPeriod - fastPeriod).map((val, i) => val - emaSlow[i]);
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.slice(signalPeriod - 1).map((val, i) => val - signalLine[i]);

  return {
    macdLine: macdLine[macdLine.length - 1],
    signalLine: signalLine[signalLine.length - 1],
    histogram: histogram[histogram.length - 1]
  };
}

function calculateBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  const sma = calculateSMA(closes, period);
  const lastSMA = sma[sma.length - 1];

  const recentCloses = closes.slice(-period);
  const variance = recentCloses.reduce((sum, val) => sum + Math.pow(val - lastSMA, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: lastSMA + stdDevMultiplier * stdDev,
    middle: lastSMA,
    lower: lastSMA - stdDevMultiplier * stdDev,
    bandwidth: ((lastSMA + stdDevMultiplier * stdDev) - (lastSMA - stdDevMultiplier * stdDev)) / lastSMA * 100
  };
}

function calculateATR(ohlcv, period = 14) {
  const trueRanges = [];

  for (let i = 1; i < ohlcv.length; i++) {
    const high = ohlcv[i].high;
    const low = ohlcv[i].low;
    const prevClose = ohlcv[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  return atr;
}

function calculateStochastic(ohlcv, period = 14) {
  const highs = ohlcv.slice(-period).map(c => c.high);
  const lows = ohlcv.slice(-period).map(c => c.low);
  const currentClose = ohlcv[ohlcv.length - 1].close;

  const highestHigh = Math.max(...highs);
  const lowestLow = Math.min(...lows);

  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  return { k, d: k };
}

function calculateVWAP(ohlcv) {
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const candle of ohlcv) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;
  }

  return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
}

function calculateTrendStrength(closes) {
  const shortEMA = calculateEMA(closes, 9);
  const longEMA = calculateEMA(closes, 21);

  const lastShort = shortEMA[shortEMA.length - 1];
  const lastLong = longEMA[longEMA.length - 1];

  const diff = ((lastShort - lastLong) / lastLong) * 100;

  if (diff > 2) return { trend: 'STRONG_BULLISH', strength: Math.min(diff * 10, 100) };
  if (diff > 0.5) return { trend: 'BULLISH', strength: diff * 20 };
  if (diff < -2) return { trend: 'STRONG_BEARISH', strength: Math.min(Math.abs(diff) * 10, 100) };
  if (diff < -0.5) return { trend: 'BEARISH', strength: Math.abs(diff) * 20 };
  return { trend: 'NEUTRAL', strength: 50 - Math.abs(diff) * 10 };
}

function calculateVolatility(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

function calculateMomentum(closes, period = 10) {
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - period];
  return ((current - past) / past) * 100;
}

function generateSignals(indicators) {
  const signals = [];

  if (indicators.rsi < 30) {
    signals.push({ type: 'buy', indicator: 'RSI', reason: 'Oversold condition', strength: 'strong' });
  } else if (indicators.rsi > 70) {
    signals.push({ type: 'sell', indicator: 'RSI', reason: 'Overbought condition', strength: 'strong' });
  } else if (indicators.rsi < 40) {
    signals.push({ type: 'buy', indicator: 'RSI', reason: 'Approaching oversold', strength: 'moderate' });
  } else if (indicators.rsi > 60) {
    signals.push({ type: 'sell', indicator: 'RSI', reason: 'Approaching overbought', strength: 'moderate' });
  }

  if (indicators.macd.histogram > 0 && indicators.macd.macdLine > indicators.macd.signalLine) {
    signals.push({ type: 'buy', indicator: 'MACD', reason: 'Bullish crossover', strength: 'moderate' });
  } else if (indicators.macd.histogram < 0 && indicators.macd.macdLine < indicators.macd.signalLine) {
    signals.push({ type: 'sell', indicator: 'MACD', reason: 'Bearish crossover', strength: 'moderate' });
  }

  if (indicators.emaCross === 'bullish') {
    signals.push({ type: 'buy', indicator: 'EMA Cross', reason: 'Golden cross (EMA 9 > EMA 21)', strength: 'strong' });
  } else if (indicators.emaCross === 'bearish') {
    signals.push({ type: 'sell', indicator: 'EMA Cross', reason: 'Death cross (EMA 9 < EMA 21)', strength: 'strong' });
  }

  if (indicators.bollingerPosition === 'below_lower') {
    signals.push({ type: 'buy', indicator: 'Bollinger', reason: 'Price below lower band', strength: 'moderate' });
  } else if (indicators.bollingerPosition === 'above_upper') {
    signals.push({ type: 'sell', indicator: 'Bollinger', reason: 'Price above upper band', strength: 'moderate' });
  }

  if (indicators.stochastic.k < 20) {
    signals.push({ type: 'buy', indicator: 'Stochastic', reason: 'Oversold zone', strength: 'moderate' });
  } else if (indicators.stochastic.k > 80) {
    signals.push({ type: 'sell', indicator: 'Stochastic', reason: 'Overbought zone', strength: 'moderate' });
  }

  if (indicators.momentum > 5) {
    signals.push({ type: 'buy', indicator: 'Momentum', reason: 'Strong upward momentum', strength: 'moderate' });
  } else if (indicators.momentum < -5) {
    signals.push({ type: 'sell', indicator: 'Momentum', reason: 'Strong downward momentum', strength: 'moderate' });
  }

  return signals;
}

function generateFallbackPrediction(indicators, signals, currentPrice, volatility) {
  const buySignals = signals.filter(s => s.type === 'buy');
  const sellSignals = signals.filter(s => s.type === 'sell');

  const buyScore = buySignals.reduce((sum, s) => sum + (s.strength === 'strong' ? 2 : 1), 0);
  const sellScore = sellSignals.reduce((sum, s) => sum + (s.strength === 'strong' ? 2 : 1), 0);

  const netScore = buyScore - sellScore;

  let decision, confidence;

  if (netScore >= 3) {
    decision = 'STRONG_BUY';
    confidence = Math.min(70 + netScore * 5, 95);
  } else if (netScore >= 1) {
    decision = 'BUY';
    confidence = Math.min(55 + netScore * 8, 80);
  } else if (netScore <= -3) {
    decision = 'STRONG_SELL';
    confidence = Math.min(70 + Math.abs(netScore) * 5, 95);
  } else if (netScore <= -1) {
    decision = 'SELL';
    confidence = Math.min(55 + Math.abs(netScore) * 8, 80);
  } else {
    decision = 'HOLD';
    confidence = 50;
  }

  if (indicators.trendStrength.trend.includes('BULLISH') && decision.includes('BUY')) {
    confidence = Math.min(confidence + 10, 95);
  } else if (indicators.trendStrength.trend.includes('BEARISH') && decision.includes('SELL')) {
    confidence = Math.min(confidence + 10, 95);
  }

  const atrMultiplier = volatility > 5 ? 1.5 : volatility > 2 ? 1 : 0.5;
  const priceChange3d = indicators.atr * atrMultiplier * (decision.includes('BUY') ? 1 : -1);
  const priceChange1w = priceChange3d * 2;
  const priceChange4w = priceChange3d * 4;

  return {
    decision,
    confidence: Math.round(confidence),
    summary: `Based on technical analysis, ${signals.length} signals detected. ${buySignals.length} buy signals and ${sellSignals.length} sell signals suggest a ${decision} recommendation.`,
    reasoning: signals.slice(0, 3).map(s => `${s.indicator}: ${s.reason}`),
    predictions: {
      '3d': { price: currentPrice + priceChange3d, change: (priceChange3d / currentPrice) * 100 },
      '1w': { price: currentPrice + priceChange1w, change: (priceChange1w / currentPrice) * 100 },
      '4w': { price: currentPrice + priceChange4w, change: (priceChange4w / currentPrice) * 100 }
    },
    riskLevel: volatility > 5 ? 'HIGH' : volatility > 2 ? 'MEDIUM' : 'LOW',
    sentiment: decision.includes('BUY') ? 'BULLISH' : decision.includes('SELL') ? 'BEARISH' : 'NEUTRAL',
    aiPowered: false
  };
}

export async function analyzePrediction({ symbol, exchange }) {
  try {
    const [ohlcvDaily, quote] = await Promise.all([
      getHistory(symbol, exchange, '1d', 100),
      getQuote(symbol, exchange)
    ]);

    if (!ohlcvDaily || ohlcvDaily.length < 30) {
      throw new Error('Insufficient historical data for analysis');
    }

    const closes = ohlcvDaily.map(c => c.close);
    const currentPrice = quote.price || closes[closes.length - 1];
    const previousClose = quote.previousClose || closes[closes.length - 2];
    const dayChange = currentPrice - previousClose;
    const dayChangePercent = (dayChange / previousClose) * 100;

    // Calculate all technical indicators
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bollinger = calculateBollingerBands(closes);
    const atr = calculateATR(ohlcvDaily);
    const stochastic = calculateStochastic(ohlcvDaily);
    const vwap = calculateVWAP(ohlcvDaily.slice(-20));
    const trendStrength = calculateTrendStrength(closes);
    const volatility = calculateVolatility(closes);
    const momentum = calculateMomentum(closes);

    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    const emaCross = ema9[ema9.length - 1] > ema21[ema21.length - 1] ? 'bullish' : 'bearish';

    let bollingerPosition = 'middle';
    if (currentPrice < bollinger.lower) bollingerPosition = 'below_lower';
    else if (currentPrice > bollinger.upper) bollingerPosition = 'above_upper';

    const indicators = {
      rsi: rsi[rsi.length - 1] || 50,
      macd: {
        value: macd.macdLine || 0,
        signal: macd.signalLine || 0,
        histogram: macd.histogram || 0
      },
      bollinger,
      bollingerPosition,
      atr,
      stochastic,
      vwap,
      trendStrength,
      emaCross,
      momentum,
      volatility,
      ema: {
        ema9: ema9[ema9.length - 1],
        ema21: ema21[ema21.length - 1],
        cross: emaCross
      },
      sma: {
        sma50: calculateSMA(closes, Math.min(50, closes.length))[0] || currentPrice,
        sma200: calculateSMA(closes, Math.min(200, closes.length))[0] || currentPrice
      }
    };

    const signals = generateSignals(indicators);

    // Prepare data for AI analysis
    const stockData = {
      symbol,
      exchange,
      currentPrice,
      previousClose,
      dayChangePercent,
      indicators,
      trend: trendStrength
    };

    // Try ML Prediction Service first (for crypto)
    let mlPrediction = null;
    if (exchange === 'binance' || exchange === 'crypto') {
      try {
        const mlHealthy = await predictionService.isHealthy();
        if (mlHealthy) {
          console.log('[AI] Using ML model for prediction...');
          mlPrediction = await predictionService.getPrediction(symbol, '1h', exchange);
          console.log('[AI] ML prediction:', mlPrediction?.signal, mlPrediction?.confidence);
        }
      } catch (err) {
        console.log('[AI] ML service unavailable:', err.message);
      }
    }

    // Try Gemini AI analysis
    let aiAnalysis = null;
    let prediction;

    if (gemini.isConfigured()) {
      console.log('[AI] Using Gemini for analysis...');
      aiAnalysis = await gemini.analyzeStock(stockData);
    }

    if (mlPrediction && mlPrediction.signal) {
      // Use ML-powered prediction (for crypto)
      const mlDecision = mlPrediction.signal === 'BUY' ? 'BUY' :
                         mlPrediction.signal === 'SELL' ? 'SELL' : 'HOLD';

      // Combine with technical signals for confidence adjustment
      const technicalConfidence = signals.filter(s =>
        (s.type === 'buy' && mlDecision === 'BUY') ||
        (s.type === 'sell' && mlDecision === 'SELL')
      ).length * 5;

      prediction = {
        decision: mlPrediction.confidence > 0.7 ? `STRONG_${mlDecision}` : mlDecision,
        confidence: Math.round((mlPrediction.confidence * 100) + technicalConfidence),
        summary: `ML Model prediction: ${mlDecision} with ${Math.round(mlPrediction.confidence * 100)}% confidence. ${mlPrediction.reasoning}`,
        reasoning: [
          `ML Signal: ${mlPrediction.signal}`,
          `Patterns detected: ${mlPrediction.patterns?.join(', ') || 'None'}`,
          ...signals.slice(0, 2).map(s => `${s.indicator}: ${s.reason}`)
        ],
        predictions: {
          '3d': { price: mlPrediction.price_target || currentPrice * 1.02, change: ((mlPrediction.price_target || currentPrice * 1.02) - currentPrice) / currentPrice * 100 },
          '1w': { price: currentPrice * (mlDecision === 'BUY' ? 1.05 : mlDecision === 'SELL' ? 0.95 : 1), change: mlDecision === 'BUY' ? 5 : mlDecision === 'SELL' ? -5 : 0 },
          '4w': { price: currentPrice * (mlDecision === 'BUY' ? 1.10 : mlDecision === 'SELL' ? 0.90 : 1), change: mlDecision === 'BUY' ? 10 : mlDecision === 'SELL' ? -10 : 0 }
        },
        riskLevel: volatility > 5 ? 'HIGH' : volatility > 2 ? 'MEDIUM' : 'LOW',
        sentiment: mlDecision === 'BUY' ? 'BULLISH' : mlDecision === 'SELL' ? 'BEARISH' : 'NEUTRAL',
        stopLoss: mlPrediction.stop_loss,
        takeProfit: mlPrediction.take_profit,
        mlPatterns: mlPrediction.patterns,
        mlIndicators: mlPrediction.indicators,
        modelUsed: mlPrediction.model_used,
        aiPowered: true,
        mlPowered: true
      };
      console.log('[AI] ML prediction complete');
    } else if (aiAnalysis) {
      // Use Gemini AI-powered prediction
      prediction = {
        decision: aiAnalysis.decision,
        confidence: aiAnalysis.confidence,
        summary: aiAnalysis.summary,
        reasoning: aiAnalysis.reasoning,
        predictions: {
          '3d': aiAnalysis.priceTargets?.['3d'] || { price: currentPrice * 1.02, change: 2 },
          '1w': aiAnalysis.priceTargets?.['1w'] || { price: currentPrice * 1.05, change: 5 },
          '4w': aiAnalysis.priceTargets?.['4w'] || { price: currentPrice * 1.10, change: 10 }
        },
        riskLevel: aiAnalysis.riskLevel,
        sentiment: aiAnalysis.sentiment,
        stopLoss: aiAnalysis.stopLoss,
        takeProfit: aiAnalysis.takeProfit,
        keyLevels: aiAnalysis.keyLevels,
        actionableInsight: aiAnalysis.actionableInsight,
        aiPowered: true,
        mlPowered: false
      };
      console.log('[AI] Gemini analysis complete');
    } else {
      // Fallback to technical analysis
      console.log('[AI] Using technical analysis fallback');
      prediction = generateFallbackPrediction(indicators, signals, currentPrice, volatility);
    }

    return {
      symbol,
      exchange,
      currentPrice,
      previousClose,
      dayChange,
      dayChangePercent,
      indicators: {
        rsi: indicators.rsi,
        macd: indicators.macd,
        ema: indicators.ema,
        sma: indicators.sma,
        bollinger: indicators.bollinger,
        stochastic: indicators.stochastic,
        atr: indicators.atr,
        vwap: indicators.vwap,
        momentum: indicators.momentum,
        volatility
      },
      trend: trendStrength,
      signals,
      prediction,
      analysisTime: new Date().toISOString(),
      aiPowered: prediction.aiPowered,
      mlPowered: prediction.mlPowered || false
    };
  } catch (err) {
    console.error('[AI] Prediction error:', err.message);
    throw err;
  }
}

export async function analyzeRnD({ exchange, criteria = {} }) {
  try {
    const symbols = await getPopularSymbols(exchange);
    const analyzedSymbols = [];

    // Analyze each symbol for basic data
    for (const sym of symbols.slice(0, 15)) {
      try {
        const quote = await getQuote(sym.symbol, exchange);
        const ohlcv = await getHistory(sym.symbol, exchange, '1d', 30);

        if (ohlcv && ohlcv.length > 14) {
          const closes = ohlcv.map(c => c.close);
          const rsi = calculateRSI(closes);
          const trend = calculateTrendStrength(closes);

          analyzedSymbols.push({
            symbol: sym.symbol,
            name: sym.name,
            price: quote.price || closes[closes.length - 1],
            rsi: rsi[rsi.length - 1] || 50,
            trend: trend.trend,
            dayChange: quote.changePercent || 0
          });
        }
      } catch (err) {
        // Skip failed symbols
      }
    }

    // Try Gemini AI for market research
    let aiResearch = null;

    if (gemini.isConfigured() && analyzedSymbols.length > 0) {
      console.log('[AI] Using Gemini for market research...');
      aiResearch = await gemini.researchMarket({
        exchange,
        symbols: analyzedSymbols
      });
    }

    if (aiResearch) {
      // Use AI-powered research results
      return {
        exchange,
        criteria,
        summary: {
          totalScanned: symbols.length,
          totalAnalyzed: analyzedSymbols.length,
          opportunities: aiResearch.topPicks?.length || 0,
          buyOpportunities: aiResearch.topPicks?.filter(p => p.action.includes('BUY')).length || 0,
          strongBuys: aiResearch.topPicks?.filter(p => p.action === 'STRONG_BUY').length || 0,
          averageConfidence: aiResearch.topPicks?.length > 0
            ? Math.round(aiResearch.topPicks.reduce((sum, p) => sum + p.confidence, 0) / aiResearch.topPicks.length)
            : 0
        },
        marketSentiment: aiResearch.marketSentiment,
        marketSummary: aiResearch.marketSummary,
        recommendations: (aiResearch.topPicks || []).map(pick => ({
          symbol: pick.symbol,
          name: analyzedSymbols.find(s => s.symbol === pick.symbol)?.name || pick.symbol,
          exchange,
          currentPrice: analyzedSymbols.find(s => s.symbol === pick.symbol)?.price || 0,
          rsi: analyzedSymbols.find(s => s.symbol === pick.symbol)?.rsi || 50,
          trend: { trend: analyzedSymbols.find(s => s.symbol === pick.symbol)?.trend || 'NEUTRAL' },
          decision: pick.action,
          confidence: pick.confidence,
          reasoning: pick.reasoning,
          targetPrice: pick.targetPrice,
          riskLevel: pick.riskLevel,
          potential3d: ((pick.targetPrice - (analyzedSymbols.find(s => s.symbol === pick.symbol)?.price || pick.targetPrice)) / (analyzedSymbols.find(s => s.symbol === pick.symbol)?.price || 1)) * 100 * 0.3,
          potential1w: ((pick.targetPrice - (analyzedSymbols.find(s => s.symbol === pick.symbol)?.price || pick.targetPrice)) / (analyzedSymbols.find(s => s.symbol === pick.symbol)?.price || 1)) * 100 * 0.5
        })),
        avoid: aiResearch.avoid || [],
        sectorInsights: aiResearch.sectorInsights,
        tradingTips: aiResearch.tradingTips || [],
        suggestedQuantities: (aiResearch.topPicks || []).slice(0, 5).map(pick => {
          const price = analyzedSymbols.find(s => s.symbol === pick.symbol)?.price || 100;
          return {
            symbol: pick.symbol,
            currentPrice: price,
            suggestedQty: Math.max(1, Math.floor(10000 * (pick.confidence / 100) / price)),
            investmentRange: {
              min: Math.round(5000 * (pick.confidence / 100)),
              max: Math.round(25000 * (pick.confidence / 100))
            }
          };
        }),
        analysisTime: new Date().toISOString(),
        aiPowered: true
      };
    }

    // Fallback to basic technical analysis
    const opportunities = analyzedSymbols.filter(s => s.rsi < 50 && s.trend.includes('BULLISH'));

    return {
      exchange,
      criteria,
      summary: {
        totalScanned: symbols.length,
        totalAnalyzed: analyzedSymbols.length,
        opportunities: opportunities.length,
        buyOpportunities: opportunities.length,
        strongBuys: opportunities.filter(o => o.rsi < 35).length,
        averageConfidence: 60
      },
      marketSentiment: 'NEUTRAL',
      marketSummary: `Analyzed ${analyzedSymbols.length} stocks on ${exchange}. Found ${opportunities.length} potential opportunities based on RSI and trend analysis.`,
      recommendations: analyzedSymbols.slice(0, 10).map(s => ({
        symbol: s.symbol,
        name: s.name,
        exchange,
        currentPrice: s.price,
        rsi: s.rsi,
        trend: { trend: s.trend },
        decision: s.rsi < 35 ? 'STRONG_BUY' : s.rsi < 50 ? 'BUY' : 'HOLD',
        confidence: Math.max(40, 80 - s.rsi),
        potential3d: s.dayChange * 0.5,
        potential1w: s.dayChange,
        riskLevel: s.rsi < 30 ? 'LOW' : s.rsi > 60 ? 'HIGH' : 'MEDIUM'
      })),
      suggestedQuantities: opportunities.slice(0, 5).map(o => ({
        symbol: o.symbol,
        currentPrice: o.price,
        suggestedQty: Math.max(1, Math.floor(10000 / o.price)),
        investmentRange: { min: 5000, max: 15000 }
      })),
      analysisTime: new Date().toISOString(),
      aiPowered: false
    };
  } catch (err) {
    console.error('[AI] R&D error:', err.message);
    throw err;
  }
}

async function getPopularSymbols(exchange) {
  const exLower = exchange?.toLowerCase();

  const popularByExchange = {
    binance: [
      { symbol: 'BTC/USDT', name: 'Bitcoin' },
      { symbol: 'ETH/USDT', name: 'Ethereum' },
      { symbol: 'BNB/USDT', name: 'Binance Coin' },
      { symbol: 'SOL/USDT', name: 'Solana' },
      { symbol: 'XRP/USDT', name: 'Ripple' },
      { symbol: 'ADA/USDT', name: 'Cardano' },
      { symbol: 'DOGE/USDT', name: 'Dogecoin' },
      { symbol: 'AVAX/USDT', name: 'Avalanche' },
      { symbol: 'DOT/USDT', name: 'Polkadot' },
      { symbol: 'MATIC/USDT', name: 'Polygon' },
      { symbol: 'LINK/USDT', name: 'Chainlink' },
      { symbol: 'UNI/USDT', name: 'Uniswap' },
      { symbol: 'ATOM/USDT', name: 'Cosmos' },
      { symbol: 'LTC/USDT', name: 'Litecoin' },
      { symbol: 'NEAR/USDT', name: 'NEAR Protocol' }
    ],
    nasdaq: [
      { symbol: 'AAPL', name: 'Apple' },
      { symbol: 'MSFT', name: 'Microsoft' },
      { symbol: 'GOOGL', name: 'Alphabet' },
      { symbol: 'AMZN', name: 'Amazon' },
      { symbol: 'NVDA', name: 'NVIDIA' },
      { symbol: 'META', name: 'Meta Platforms' },
      { symbol: 'TSLA', name: 'Tesla' },
      { symbol: 'AMD', name: 'AMD' },
      { symbol: 'NFLX', name: 'Netflix' },
      { symbol: 'INTC', name: 'Intel' },
      { symbol: 'CSCO', name: 'Cisco' },
      { symbol: 'ADBE', name: 'Adobe' },
      { symbol: 'PYPL', name: 'PayPal' },
      { symbol: 'CRM', name: 'Salesforce' },
      { symbol: 'QCOM', name: 'Qualcomm' }
    ],
    nyse: [
      { symbol: 'JPM', name: 'JPMorgan Chase' },
      { symbol: 'V', name: 'Visa' },
      { symbol: 'JNJ', name: 'Johnson & Johnson' },
      { symbol: 'WMT', name: 'Walmart' },
      { symbol: 'MA', name: 'Mastercard' },
      { symbol: 'PG', name: 'Procter & Gamble' },
      { symbol: 'HD', name: 'Home Depot' },
      { symbol: 'BAC', name: 'Bank of America' },
      { symbol: 'DIS', name: 'Disney' },
      { symbol: 'KO', name: 'Coca-Cola' },
      { symbol: 'PFE', name: 'Pfizer' },
      { symbol: 'VZ', name: 'Verizon' },
      { symbol: 'T', name: 'AT&T' },
      { symbol: 'IBM', name: 'IBM' },
      { symbol: 'GS', name: 'Goldman Sachs' }
    ],
    nse: [
      { symbol: 'RELIANCE', name: 'Reliance Industries' },
      { symbol: 'TCS', name: 'Tata Consultancy Services' },
      { symbol: 'INFY', name: 'Infosys' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank' },
      { symbol: 'ICICIBANK', name: 'ICICI Bank' },
      { symbol: 'SBIN', name: 'State Bank of India' },
      { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
      { symbol: 'ITC', name: 'ITC Limited' },
      { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
      { symbol: 'LT', name: 'Larsen & Toubro' },
      { symbol: 'WIPRO', name: 'Wipro' },
      { symbol: 'HCLTECH', name: 'HCL Technologies' },
      { symbol: 'AXISBANK', name: 'Axis Bank' },
      { symbol: 'MARUTI', name: 'Maruti Suzuki' },
      { symbol: 'TATASTEEL', name: 'Tata Steel' }
    ]
  };

  return popularByExchange[exLower] || popularByExchange.nasdaq;
}

export async function analyzeMarket(params, user) {
  return analyzePrediction(params);
}
