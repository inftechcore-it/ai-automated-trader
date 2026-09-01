import { env } from '../config/env.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export function isConfigured() {
  const configured = !!env.gemini.apiKey;
  console.log('[Gemini] Configured:', configured);
  return configured;
}

export async function analyzeStock(stockData) {
  if (!isConfigured()) {
    console.log('[Gemini] Not configured, skipping AI analysis');
    return null;
  }

  const prompt = buildAnalysisPrompt(stockData);
  console.log('[Gemini] Sending prediction request for:', stockData.symbol);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${env.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini] API error:', response.status, error);
      return null;
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('\n');

    if (!text) {
      console.error('[Gemini] No response text in:', JSON.stringify(data).substring(0, 300));
      return null;
    }

    console.log('[Gemini] Raw response:', text.substring(0, 200));
    const parsed = parseAIResponse(text);

    if (parsed) {
      console.log('[Gemini] Successfully parsed prediction for', stockData.symbol);
    }

    return parsed;
  } catch (err) {
    console.error('[Gemini] Request failed:', err.message);
    return null;
  }
}

export async function researchMarket(marketData) {
  if (!isConfigured()) {
    return null;
  }

  const prompt = buildResearchPrompt(marketData);
  console.log('[Gemini] Sending research request for:', marketData.exchange);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${env.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 3000
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini] Research API error:', response.status, error);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[Gemini] No research response text');
      return null;
    }

    console.log('[Gemini] Research raw response:', text.substring(0, 200));
    return parseAIResponse(text);
  } catch (err) {
    console.error('[Gemini] Research request failed:', err.message);
    return null;
  }
}

function buildAnalysisPrompt(data) {
  const currentPrice = data.currentPrice;
  const rsi = data.indicators.rsi;
  const macdHistogram = data.indicators.macd.histogram;
  const emaCross = data.indicators.ema.cross;
  const trend = data.trend.trend;

  return `You are an expert financial analyst specializing in technical analysis and stock predictions. Analyze this stock and provide actionable trading recommendations.

## Stock Information
- **Symbol**: ${data.symbol}
- **Exchange**: ${data.exchange.toUpperCase()}
- **Current Price**: $${currentPrice.toFixed(2)}
- **Previous Close**: $${data.previousClose.toFixed(2)}
- **Day Change**: ${data.dayChangePercent >= 0 ? '+' : ''}${data.dayChangePercent.toFixed(2)}%

## Technical Indicators
| Indicator | Value | Signal |
|-----------|-------|--------|
| RSI (14) | ${rsi.toFixed(1)} | ${rsi < 30 ? 'OVERSOLD - Buy Signal' : rsi > 70 ? 'OVERBOUGHT - Sell Signal' : 'Neutral'} |
| MACD Histogram | ${macdHistogram.toFixed(4)} | ${macdHistogram > 0 ? 'Bullish' : 'Bearish'} |
| EMA Cross | ${emaCross} | ${emaCross === 'bullish' ? 'Buy Signal' : 'Sell Signal'} |
| Stochastic %K | ${data.indicators.stochastic.k.toFixed(1)} | ${data.indicators.stochastic.k < 20 ? 'Oversold' : data.indicators.stochastic.k > 80 ? 'Overbought' : 'Neutral'} |
| Momentum | ${data.indicators.momentum.toFixed(2)}% | ${data.indicators.momentum > 0 ? 'Positive' : 'Negative'} |
| Volatility | ${data.indicators.volatility.toFixed(2)}% | ${data.indicators.volatility > 3 ? 'High' : 'Normal'} |

## Price Levels
- EMA 9: $${data.indicators.ema.ema9.toFixed(2)}
- EMA 21: $${data.indicators.ema.ema21.toFixed(2)}
- SMA 50: $${data.indicators.sma.sma50.toFixed(2)}
- Bollinger Upper: $${data.indicators.bollinger.upper.toFixed(2)}
- Bollinger Lower: $${data.indicators.bollinger.lower.toFixed(2)}
- VWAP: $${data.indicators.vwap.toFixed(2)}
- ATR: ${data.indicators.atr.toFixed(4)}

## Current Trend
${trend} with ${data.trend.strength.toFixed(0)}% strength

## Your Task
Based on ALL the above technical data, provide a comprehensive trading analysis. Consider:
1. Multiple indicator confluence
2. Risk/reward ratio
3. Realistic price targets based on ATR and support/resistance
4. Current market conditions

Respond with this exact JSON structure:
{
  "decision": "STRONG_BUY",
  "confidence": 75,
  "summary": "Brief 2-3 sentence analysis explaining the recommendation",
  "reasoning": [
    "First key reason for this decision",
    "Second key reason",
    "Third key reason"
  ],
  "riskLevel": "MEDIUM",
  "priceTargets": {
    "3d": {"price": ${(currentPrice * 1.02).toFixed(2)}, "changePercent": 2.0},
    "1w": {"price": ${(currentPrice * 1.05).toFixed(2)}, "changePercent": 5.0},
    "4w": {"price": ${(currentPrice * 1.10).toFixed(2)}, "changePercent": 10.0}
  },
  "stopLoss": ${(currentPrice * 0.95).toFixed(2)},
  "takeProfit": ${(currentPrice * 1.08).toFixed(2)},
  "keyLevels": {
    "support": [${(currentPrice * 0.97).toFixed(2)}, ${(currentPrice * 0.94).toFixed(2)}],
    "resistance": [${(currentPrice * 1.03).toFixed(2)}, ${(currentPrice * 1.06).toFixed(2)}]
  },
  "sentiment": "BULLISH",
  "actionableInsight": "Specific actionable trading recommendation"
}

IMPORTANT:
- decision must be one of: STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
- confidence must be a number between 0-100
- riskLevel must be: LOW, MEDIUM, or HIGH
- sentiment must be: BULLISH, BEARISH, or NEUTRAL
- All prices must be realistic numbers based on current price $${currentPrice.toFixed(2)}
- Provide actual analysis, not placeholder text`;
}

function buildResearchPrompt(data) {
  const symbolsData = data.symbols.map(s =>
    `- ${s.symbol}: $${s.price.toFixed(2)} | RSI: ${s.rsi.toFixed(1)} | Trend: ${s.trend} | Day: ${s.dayChange >= 0 ? '+' : ''}${s.dayChange.toFixed(2)}%`
  ).join('\n');

  return `You are a senior market research analyst. Analyze these ${data.exchange.toUpperCase()} stocks and identify the best trading opportunities.

## Market: ${data.exchange.toUpperCase()}
## Analysis Date: ${new Date().toISOString().split('T')[0]}

## Stocks Under Analysis:
${symbolsData}

## Your Task:
1. Evaluate each stock based on RSI levels and trend
2. Identify the TOP opportunities (oversold stocks with bullish potential)
3. Identify stocks to AVOID (overbought or bearish)
4. Assess overall market sentiment

Respond with this exact JSON structure:
{
  "marketSentiment": "BULLISH",
  "marketSummary": "2-3 sentence overview of the market conditions and opportunities",
  "topPicks": [
    {
      "symbol": "AAPL",
      "action": "BUY",
      "confidence": 75,
      "reasoning": "Why this stock is a good buy based on the data",
      "targetPrice": 150.00,
      "riskLevel": "LOW"
    }
  ],
  "avoid": [
    {
      "symbol": "XYZ",
      "reasoning": "Why to avoid this stock"
    }
  ],
  "sectorInsights": "Key observations about sectors or patterns",
  "tradingTips": [
    "First actionable tip",
    "Second tip",
    "Third tip"
  ]
}

IMPORTANT:
- marketSentiment must be: BULLISH, BEARISH, or NEUTRAL
- action must be: STRONG_BUY or BUY
- riskLevel must be: LOW, MEDIUM, or HIGH
- Include 3-5 top picks from the analyzed stocks
- targetPrice should be realistic based on current prices
- Provide actual analysis based on the RSI and trend data provided`;
}

export async function chatQuery(query, context = {}) {
  if (!isConfigured()) {
    return { error: 'Gemini API not configured' };
  }

  const prompt = buildChatPrompt(query, context);
  console.log('[Gemini] Chat query with Google Search grounding:', query);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${env.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.6,
          topP: 0.95,
          maxOutputTokens: 3500
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini] Chat API error:', error);
      return { error: 'Failed to get response from AI' };
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('\n');

    if (!text) {
      return { error: 'No response from AI' };
    }

    console.log('[Gemini] Chat response length:', text.length);
    return parseAIResponse(text);
  } catch (err) {
    console.error('[Gemini] Chat request failed:', err.message);
    return { error: err.message };
  }
}

function buildChatPrompt(query, context) {
  const exchangeInfo = {
    pionex: { name: 'Pionex', currency: 'USDT', symbol: '$', country: 'Crypto' },
    binance: { name: 'Binance', currency: 'USDT', symbol: '$', country: 'Crypto' },
    kraken: { name: 'Kraken', currency: 'USD', symbol: '$', country: 'Crypto' },
    bybit: { name: 'Bybit', currency: 'USDT', symbol: '$', country: 'Crypto' },
    nasdaq: { name: 'NASDAQ', currency: 'USD', symbol: '$', country: 'US' },
    nyse: { name: 'NYSE', currency: 'USD', symbol: '$', country: 'US' },
    nse: { name: 'NSE', currency: 'INR', symbol: '₹', country: 'India' },
    bse: { name: 'BSE', currency: 'INR', symbol: '₹', country: 'India' }
  };

  const currentExchange = context.exchange?.toLowerCase() || 'pionex';
  const exInfo = exchangeInfo[currentExchange] || exchangeInfo.pionex;
  const today = new Date().toISOString().split('T')[0];

  return `You are an expert AI stock market & crypto trading assistant. You have live Google Search grounding enabled to provide authentic, real-time data, latest news, and current market developments from the internet.

User Query: "${query}"

CONTEXT:
- Selected Market / Exchange: ${exInfo.name} (${currentExchange.toUpperCase()})
- Currency: ${exInfo.currency} (${exInfo.symbol})
- Market Type: ${exInfo.country}
- Today's Date: ${today}

CRITICAL GUIDELINES:
1. Search the live internet for up-to-date real-time market data, recent news, price action, and macroeconomic catalysts as of ${today}.
2. DO NOT return canned or repetitive boilerplate answers. Provide authentic, tailored, real-world data and insights.
3. If the user asks for stock or crypto recommendations:
   - For Pionex, Binance, Bybit, Kraken: Recommend real cryptocurrencies (e.g. BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, etc.) with real approximate prices and reasons.
   - For NSE/BSE: Recommend real Indian stocks with prices in INR (₹).
   - For NASDAQ/NYSE: Recommend real US stocks with prices in USD ($).
4. If the user asks about indicators, market news, trading strategies, or specific coins/stocks, give a rich, comprehensive explanation with live facts.

Respond with a JSON structure or structured format:
{
  "type": "stocks" | "info" | "error",
  "message": "Your thorough, insightful response containing live internet facts, news, and analysis (supports markdown formatting)",
  "stocks": [
    {
      "symbol": "BTC/USDT",
      "name": "Bitcoin",
      "price": 76500,
      "exchange": "${currentExchange}",
      "currency": "${exInfo.currency}",
      "reason": "Authentic market catalyst or technical reason from today"
    }
  ],
  "tips": ["Actionable trading tip 1", "Actionable trading tip 2"],
  "followUp": "Suggested follow-up topic"
}`;
}

function parseAIResponse(text) {
  try {
    let cleaned = text.trim();

    // Check for ```json code block
    const jsonBlockMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/) || cleaned.match(/```\s*(\{[\s\S]*?\})\s*```/);
    if (jsonBlockMatch) {
      cleaned = jsonBlockMatch[1].trim();
    } else {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.message || parsed.decision || parsed.marketSentiment) {
        return parsed;
      }
    } catch {
      // Fall through to text wrapper
    }

    // If response is conversational markdown text from search grounding, wrap it cleanly
    return {
      type: 'info',
      message: text.replace(/```json/g, '').replace(/```/g, '').trim(),
      stocks: [],
      tips: []
    };
  } catch (err) {
    return {
      type: 'info',
      message: text ? text.trim() : 'Analysis completed.',
      stocks: [],
      tips: []
    };
  }
}
