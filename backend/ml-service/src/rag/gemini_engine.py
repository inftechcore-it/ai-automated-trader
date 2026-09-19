"""
Google Gemini Decision & Synthesis Engine
Synthesizes retrieved RAG context into actionable trading recommendations,
sentiment scoring, parameter suggestions, and structured citations.
"""
import os
import json
import logging
import re
from typing import List, Dict, Any, Optional

try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    genai = None
    HAS_GENAI = False

from src.core.config import settings

logger = logging.getLogger("rag.gemini_engine")

SYSTEM_PROMPT = """You are AI-BDM's Advanced Quantitative & Market Intelligence Decision Engine.
Your role is to analyze multi-asset trading queries using the provided RAG Context Passages (Strategy Playbooks, RMS Rules, Broker Diagnostics, Technical Indicators, DEX Mechanics, Arbitrage Models, and Market News).

Provide a rigorous institutional-grade analysis and output valid JSON conforming strictly to the requested schema.

Schema:
{
  "analysis": "Comprehensive Markdown analysis with market dynamics, key risks, indicator signals, and reasoning.",
  "sentiment_score": float between -1.0 (extremely bearish) and 1.0 (extremely bullish),
  "actionable_setup": {
    "direction": "BUY" | "SELL" | "NEUTRAL",
    "confidence": float between 0.0 and 1.0,
    "recommended_strategy": "GRID" | "INFINITY_GRID" | "MARTINGALE" | "SMART_TRADE" | "REBALANCING" | "ARBITRAGE" | "HOLD",
    "suggested_parameters": {
      "gridCount": int or null,
      "lowerPrice": float or null,
      "upperPrice": float or null,
      "stopLossPercent": float or null,
      "takeProfitPercent": float or null,
      "trailingTP": float or null,
      "additionalParams": {}
    }
  }
}
"""

class GeminiDecisionEngine:
    """Decision & synthesis engine powered by Google Gemini with offline fallback"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = "gemini-1.5-flash"
        self._is_configured = False
        self._setup_client()

    def _setup_client(self):
        if self.api_key and HAS_GENAI:
            try:
                genai.configure(api_key=self.api_key)
                self._model = genai.GenerativeModel(
                    model_name=self.model_name,
                    system_instruction=SYSTEM_PROMPT
                )
                self._is_configured = True
                logger.info(f"Gemini Decision Engine configured with model {self.model_name}")
            except Exception as e:
                logger.warning(f"Could not configure Gemini Decision Engine: {e}")
                self._is_configured = False
        else:
            self._is_configured = False
            logger.info("Gemini Decision Engine running in deterministic fallback mode.")

    def format_context_prompt(
        self,
        query: str,
        context_passages: List[Dict[str, Any]],
        symbol: Optional[str] = None,
        market: Optional[str] = None
    ) -> str:
        """Constructs prompt containing query metadata and numbered context chunks"""
        prompt_parts = [
            f"### Query: {query}",
            f"Target Symbol: {symbol or 'N/A'}",
            f"Market Segment: {market or 'GLOBAL'}\n",
            "### Retrieved RAG Context Passages:"
        ]

        if not context_passages:
            prompt_parts.append("(No relevant context documents found)")
        else:
            for i, chunk in enumerate(context_passages, start=1):
                col = chunk.get("collection", "Unknown")
                title = chunk.get("title", "Untitled")
                content = chunk.get("content", "")
                rel = chunk.get("relevance_score", 0.0)
                prompt_parts.append(
                    f"\n--- Context Document [{i}] ({col} - {title} | Relevance: {rel}) ---\n{content}"
                )

        prompt_parts.append("\nGenerate the complete structured JSON response.")
        return "\n".join(prompt_parts)

    def synthesize(
        self,
        query: str,
        context_passages: List[Dict[str, Any]],
        symbol: Optional[str] = None,
        market: Optional[str] = None
    ) -> Dict[str, Any]:
        """Synthesizes RAG analysis using Gemini or deterministic analysis fallback"""
        prompt = self.format_context_prompt(query, context_passages, symbol, market)
        citations = [
            {
                "id": p.get("id"),
                "collection": p.get("collection"),
                "title": p.get("title"),
                "relevance_score": p.get("relevance_score")
            }
            for p in context_passages
        ]

        if self._is_configured:
            try:
                response = self._model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json", "temperature": 0.2}
                )
                text = response.text.strip()
                # Clean markdown backticks if returned
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]

                parsed = json.loads(text.strip())
                parsed["citations"] = citations
                parsed["model_used"] = self.model_name
                parsed["ai_powered"] = True
                return parsed
            except Exception as e:
                logger.error(f"Gemini API synthesis failed: {e}. Falling back to rule-based synthesis.")

        # Fallback synthesis
        return self._generate_fallback_synthesis(query, context_passages, symbol, market, citations)

    def _generate_fallback_synthesis(
        self,
        query: str,
        context_passages: List[Dict[str, Any]],
        symbol: Optional[str],
        market: Optional[str],
        citations: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generates deterministic quantitative synthesis when Gemini API is unavailable"""
        q_lower = query.lower()
        
        # Determine direction & sentiment
        bullish_terms = ["buy", "bull", "rally", "bounce", "breakout", "accumulate", "long", "support"]
        bearish_terms = ["sell", "bear", "dump", "drop", "breakdown", "short", "resistance", "halt", "revert"]
        
        bull_score = sum(1 for w in bullish_terms if w in q_lower)
        bear_score = sum(1 for w in bearish_terms if w in q_lower)
        
        # Check context passages for sentiment indicators
        for doc in context_passages:
            text = f"{doc.get('title', '')} {doc.get('content', '')}".lower()
            bull_score += sum(1 for w in bullish_terms if w in text) * 0.2
            bear_score += sum(1 for w in bearish_terms if w in text) * 0.2

        if bull_score > bear_score:
            direction = "BUY"
            sentiment_score = round(min(0.85, 0.35 + (bull_score - bear_score) * 0.1), 2)
            confidence = 0.82
        elif bear_score > bull_score:
            direction = "SELL"
            sentiment_score = round(max(-0.85, -0.35 - (bear_score - bull_score) * 0.1), 2)
            confidence = 0.78
        else:
            direction = "NEUTRAL"
            sentiment_score = 0.0
            confidence = 0.65

        # Strategy selection logic
        strategy = "GRID"
        if "infinity" in q_lower or (symbol and "btc" in symbol.lower()):
            strategy = "INFINITY_GRID"
        elif "martingale" in q_lower or "dca" in q_lower:
            strategy = "MARTINGALE"
        elif "arbitrage" in q_lower or (market and "dex" in market.lower()):
            strategy = "ARBITRAGE"
        elif "rebalance" in q_lower:
            strategy = "REBALANCING"
        elif "trailing" in q_lower or "smart" in q_lower:
            strategy = "SMART_TRADE"

        # Suggested parameters from strategy playbooks or safe defaults
        suggested_params = {
            "gridCount": 20,
            "lowerPrice": 0.95,
            "upperPrice": 1.05,
            "stopLossPercent": 0.03,
            "takeProfitPercent": 0.015,
            "trailingTP": 0.005,
            "additionalParams": {
                "gridType": "geometric",
                "volatilityFilter": True,
                "rebalanceThreshold": 0.05
            }
        }

        # Format markdown analysis
        analysis_lines = [
            f"### Market & Strategy Analysis: **{symbol or 'General Asset'}**",
            f"**Market Context**: {market or 'Global Trading Engine'} | **Recommended Bias**: `{direction}` (Sentiment: `{sentiment_score}`)",
            "",
            "#### 1. Key Insights from Knowledge Base:",
        ]
        
        for c in context_passages[:3]:
            analysis_lines.append(f"- **{c.get('title', 'Document')}** ({c.get('collection')}): {c.get('content', '')[:160]}...")

        analysis_lines.extend([
            "",
            f"#### 2. Execution Setup & Recommendations:",
            f"- **Optimal Strategy**: `{strategy}`",
            f"- **Execution Confidence**: `{int(confidence * 100)}%`",
            f"- **Risk Protocol**: Maintain strict stop-loss at `{suggested_params['stopLossPercent'] * 100}%` in compliance with RMS circuit breaker guidelines.",
            "",
            "> *Note: Analysis compiled via AI-BDM Knowledge Base Hybrid Retriever.*"
        ])

        return {
            "analysis": "\n".join(analysis_lines),
            "sentiment_score": sentiment_score,
            "actionable_setup": {
                "direction": direction,
                "confidence": confidence,
                "recommended_strategy": strategy,
                "suggested_parameters": suggested_params
            },
            "citations": citations,
            "model_used": "deterministic-quant-fallback",
            "ai_powered": False
        }

    def calibrate_jarvis(
        self,
        symbol: str,
        current_price: float,
        indicators: Dict[str, Any],
        current_params: Dict[str, Any],
        stage_status: str,
        context_passages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calibrates live 3-Grid progressive JARVIS Bot parameters based on RAG Trade Memory,
        live ATR/RSI/Support/Resistance indicators, and Gemini AI synthesis.
        """
        citations = [
            {
                "id": p.get("id"),
                "collection": p.get("collection"),
                "title": p.get("title"),
                "relevance_score": p.get("relevance_score")
            }
            for p in context_passages
        ]

        if self._is_configured:
            try:
                context_str = "\n".join([
                    f"- [{c.get('collection')}] {c.get('title')}: {c.get('content')[:200]}"
                    for c in context_passages[:5]
                ])

                prompt = f"""You are the JARVIS Autonomous Trading Agent AI Brain.
Target Symbol: {symbol}
Current Price: ${current_price:.6f}
Stage Status: {stage_status}

Live Technical Indicators:
- ATR (14): {indicators.get('atr', 0):.6f}
- RSI (14): {indicators.get('rsi', 50):.2f}
- Bollinger Upper: ${indicators.get('bb_upper', current_price * 1.05):.6f}
- Bollinger Lower: ${indicators.get('bb_lower', current_price * 0.95):.6f}
- Swing Support: ${indicators.get('support', current_price * 0.97):.6f}
- Swing Resistance: ${indicators.get('resistance', current_price * 1.03):.6f}
- Volatility: {indicators.get('volatility', 2.5):.2f}%

Current Bot Parameters:
- Lower Price: ${float(current_params.get('lowerPrice', current_price * 0.95)):.6f}
- Upper Price: ${float(current_params.get('upperPrice', current_price * 1.05)):.6f}
- Grid Count: 3 (Fixed 3 grid spaces / 4 rungs: #0, #1, #2, #3)
- Stop Loss: ${float(current_params.get('stopLoss', current_price * 0.90)):.6f}

Retrieved Past Trade Memory & Strategy Playbooks:
{context_str}

Analyze the market regime and calculate optimal dynamic bounds for the 3-Grid Progressive JARVIS Bot.
The 3 grid spaces span from dynamicLowerPrice (Grid #0) to dynamicUpperPrice (Grid #3) with step = (upper - lower) / 3.
Ensure dynamicLowerPrice <= current_price <= dynamicUpperPrice.
Ensure dynamicStopLoss < dynamicLowerPrice.

Output valid JSON strictly in the following format:
{{
  "command": "AUTO_CALIBRATE_JARVIS",
  "symbol": "{symbol}",
  "recommendations": {{
    "dynamicLowerPrice": float,
    "dynamicUpperPrice": float,
    "dynamicGridSpacing": float,
    "dynamicStopLoss": float,
    "priceTolerance": float,
    "opportunisticDipBuy": boolean
  }},
  "marketRegime": "BULLISH_EXPANSION" | "RANGING_CONSOLIDATION" | "HIGH_VOLATILITY_CHOP" | "BEARISH_CONTRACTION",
  "confidenceScore": float between 0.0 and 1.0,
  "reasoning": "Concise 1-2 sentence explanation of the technical adjustments."
}}
"""
                response = self._model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json", "temperature": 0.2}
                )
                text = response.text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]

                parsed = json.loads(text.strip())
                parsed["citations"] = citations
                parsed["ai_powered"] = True
                return parsed
            except Exception as e:
                logger.error(f"Gemini JARVIS calibration failed: {e}. Using quant auto-tuner fallback.")

        # Deterministic Quant Fallback Calibration
        return self._generate_fallback_jarvis_calibration(symbol, current_price, indicators, current_params, citations)

    def _generate_fallback_jarvis_calibration(
        self,
        symbol: str,
        current_price: float,
        indicators: Dict[str, Any],
        current_params: Dict[str, Any],
        citations: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generates dynamic mathematical calibration based on ATR & Support/Resistance levels"""
        atr = float(indicators.get("atr") or (current_price * 0.02))
        rsi = float(indicators.get("rsi") or 50.0)
        support = float(indicators.get("support") or (current_price - 2.5 * atr))
        resistance = float(indicators.get("resistance") or (current_price + 2.5 * atr))
        volatility = float(indicators.get("volatility") or 2.5)

        # Snap bounds to support/resistance with ATR padding
        dynamic_lower = round(min(current_price * 0.985, support if support < current_price else current_price - 2 * atr), 6)
        dynamic_upper = round(max(current_price * 1.015, resistance if resistance > current_price else current_price + 2 * atr), 6)
        dynamic_spacing = round((dynamic_upper - dynamic_lower) / 3.0, 6)
        dynamic_sl = round(dynamic_lower - (atr * 1.5), 6)

        # Precision corridor: 4th decimal place for sub-$1.0 coins (±0.0009), proportional for higher assets
        p_tolerance = 0.0009 if current_price < 1.0 else round(min(dynamic_spacing * 0.15, 0.05), 6)

        # Market regime classification
        if rsi > 62 and volatility > 3.0:
            regime = "BULLISH_EXPANSION"
            reasoning = f"Bullish momentum detected (RSI: {rsi:.1f}). Expanding upper bound to ${dynamic_upper:.4f} with ATR-calibrated step (${dynamic_spacing:.4f})."
        elif rsi < 38:
            regime = "BEARISH_CONTRACTION"
            reasoning = f"Oversold condition (RSI: {rsi:.1f}). Snapping lower bound to swing support ${dynamic_lower:.4f} and widening stop-loss floor to ${dynamic_sl:.4f}."
        elif volatility > 4.5:
            regime = "HIGH_VOLATILITY_CHOP"
            reasoning = f"Elevated volatility ({volatility:.1f}%). Widening grid spacing to ${dynamic_spacing:.4f} based on ATR to capture wider market swings."
        else:
            regime = "RANGING_CONSOLIDATION"
            reasoning = f"Price consolidating in range [${dynamic_lower:.4f} - ${dynamic_upper:.4f}]. Maintaining 3-grid progressive rungs with ±${p_tolerance:.5f} corridor."

        return {
            "command": "AUTO_CALIBRATE_JARVIS",
            "symbol": symbol,
            "recommendations": {
                "dynamicLowerPrice": dynamic_lower,
                "dynamicUpperPrice": dynamic_upper,
                "dynamicGridSpacing": dynamic_spacing,
                "dynamicStopLoss": dynamic_sl,
                "priceTolerance": p_tolerance,
                "opportunisticDipBuy": rsi < 35
            },
            "marketRegime": regime,
            "confidenceScore": 0.88,
            "reasoning": reasoning,
            "citations": citations,
            "ai_powered": False
        }

gemini_engine = GeminiDecisionEngine()
