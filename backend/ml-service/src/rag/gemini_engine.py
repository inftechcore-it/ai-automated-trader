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

gemini_engine = GeminiDecisionEngine()
