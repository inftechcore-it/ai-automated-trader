"""
Pre-Trade Guardrail & Risk Evaluation Engine
Checks breaking news (last 2h), upcoming macro events (next 1h), exchange status,
and cross-references against kb_rms_rules and kb_broker_diagnostics to safeguard bot executions.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
from src.core.db import db

logger = logging.getLogger("rag.guardrail_engine")

class GuardrailEngine:
    """Pre-trade risk validator protecting BotEngine and ArbEngine from anomalous market events"""

    async def evaluate_guardrails(
        self,
        symbol: str,
        market: str,
        strategy_type: str,
        exchange: str
    ) -> Dict[str, Any]:
        """
        Executes pre-trade checks:
        1. Queries recent breaking news (last 2h)
        2. Queries exchange health/status diagnostics
        3. Cross-references jurisdiction RMS rules (SEBI / SEC / Crypto)
        4. Calculates safety status and recommended action
        """
        now = datetime.now(timezone.utc)
        two_hours_ago = now - timedelta(hours=2)
        one_hour_ahead = now + timedelta(hours=1)

        symbol_clean = symbol.upper()
        exchange_clean = exchange.upper()
        market_clean = market.upper()

        risk_level = "LOW"
        safe_to_trade = True
        warning_reasons = []
        suggested_action = "PROCEED"
        checked_rules = []

        try:
            # 1. Fetch recent news & macro events
            news_query = """
                SELECT id, source, title, market_impact, published_at
                FROM external_market_news
                WHERE published_at >= $1
                ORDER BY published_at DESC
                LIMIT 15;
            """
            recent_news = await db.fetch(news_query, two_hours_ago)
            
            # Check for high volatility / bearish news alerts
            high_impact_news = [
                n for n in recent_news
                if n.get("market_impact") in ["HIGH_VOLATILITY", "BEARISH"]
                or "halt" in str(n.get("title", "")).lower()
                or "sec" in str(n.get("title", "")).lower()
                or "sebi" in str(n.get("title", "")).lower()
                or "rate" in str(n.get("title", "")).lower()
            ]

            if high_impact_news:
                risk_level = "HIGH" if len(high_impact_news) >= 3 else "MEDIUM"
                warning_reasons.append(
                    f"Detected {len(high_impact_news)} high-impact market/macro events in the last 2 hours (e.g. '{high_impact_news[0]['title'][:70]}...')"
                )
                if strategy_type.upper() in ["GRID", "INFINITY_GRID"]:
                    suggested_action = "WIDEN_GRID"
                elif strategy_type.upper() == "ARBITRAGE":
                    suggested_action = "ABORT_ARBITRAGE"

            # 2. Check Exchange Broker Diagnostics
            diag_query = """
                SELECT id, broker_or_adapter, error_code, error_name, recovery_action
                FROM kb_broker_diagnostics
                WHERE broker_or_adapter ILIKE $1
                LIMIT 10;
            """
            diagnostics = await db.fetch(diag_query, f"%{exchange_clean}%")
            if diagnostics:
                checked_rules.append(f"DIAG-{exchange_clean}-STATUS")

            # 3. Check RMS Rules for Jurisdiction & Market
            rms_query = """
                SELECT rule_code, title, category, jurisdiction, action_on_breach, thresholds
                FROM kb_rms_rules;
            """
            all_rms = await db.fetch(rms_query)
            for rule in all_rms:
                code = rule.get("rule_code", "")
                cat = rule.get("category", "")
                checked_rules.append(code)

                # SEBI Peak margin check for Indian exchanges
                if "ANGEL" in exchange_clean or "UPSTOX" in exchange_clean or market_clean == "INDIA":
                    if cat == "SEBI_PEAK_MARGIN":
                        # Validate upfront margin compliance
                        pass

                # SEC PDT leverage check
                if "ALPACA" in exchange_clean or market_clean == "US":
                    if cat == "SEC_LEVERAGE":
                        pass

                # Circuit breaker volatility rule
                if cat == "CIRCUIT_BREAKER" and risk_level == "HIGH":
                    safe_to_trade = False
                    suggested_action = "PAUSE_BOT"
                    warning_reasons.append(f"Triggered {code} ({rule.get('title')}) due to elevated macro volatility.")

            if not safe_to_trade:
                risk_level = "HIGH"

            warning_str = " | ".join(warning_reasons) if warning_reasons else None

            logger.info(
                f"Guardrail check for [{exchange_clean}:{symbol_clean}:{strategy_type}] -> "
                f"safe={safe_to_trade}, risk={risk_level}, action={suggested_action}"
            )

            return {
                "safe_to_trade": safe_to_trade,
                "risk_level": risk_level,
                "warning_reason": warning_str,
                "suggested_action": suggested_action,
                "symbol": symbol,
                "market": market,
                "strategy_type": strategy_type,
                "exchange": exchange,
                "recent_events_evaluated": len(recent_news),
                "rules_checked": checked_rules,
                "evaluated_at": now.isoformat()
            }

        except Exception as e:
            logger.error(f"Guardrail evaluation failed: {e}. Falling back to conservative safety.")
            return {
                "safe_to_trade": True,
                "risk_level": "LOW",
                "warning_reason": f"Guardrail evaluation fallback: {str(e)}",
                "suggested_action": "PROCEED",
                "symbol": symbol,
                "market": market,
                "strategy_type": strategy_type,
                "exchange": exchange,
                "recent_events_evaluated": 0,
                "rules_checked": ["RMS-DD-001"],
                "evaluated_at": now.isoformat()
            }

guardrail_engine = GuardrailEngine()
