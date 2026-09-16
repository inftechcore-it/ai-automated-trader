"""
Macroeconomic Calendar & Central Bank Event Ingestion Workers:
1. Trading Economics Macro RSS Feed
2. Forex Factory High-Impact Economic Calendar (FOMC, RBI MPC, CPI, NFP)
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import feedparser
import httpx
from bs4 import BeautifulSoup
from src.ingestion.base_ingestor import BaseIngestor
from src.core.config import settings

logger = logging.getLogger("rag.ingestion.macro")

class TradingEconomicsRssIngestor(BaseIngestor):
    """Ingests global macroeconomic indicators, GDP prints, and inflation updates from Trading Economics"""
    
    def __init__(self, rss_url: Optional[str] = None):
        super().__init__(source_name="TRADING_ECONOMICS")
        self.rss_url = rss_url or settings.TRADING_ECONOMICS_RSS

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(self.rss_url, headers={"User-Agent": "Mozilla/5.0"})
                if res.status_code == 200:
                    feed = feedparser.parse(res.text)
                    return feed.entries
        except Exception as e:
            self.logger.warning(f"Error fetching Trading Economics RSS: {e}")
        return []

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        title = raw_item.get("title", "").strip()
        if not title:
            return None

        summary = BeautifulSoup(raw_item.get("summary", ""), "html.parser").get_text().strip()
        link = raw_item.get("link")
        full_text = f"Macro Event: {title}\n\nDetails: {summary}"

        return {
            "source": "TRADING_ECONOMICS",
            "source_url": link,
            "title": f"Macro Indicator: {title}",
            "summary": summary[:350],
            "content": full_text,
            "symbols": ["MACRO_GLOBAL", "USD", "INR"],
            "market_impact": "HIGH_VOLATILITY" if any(k in full_text.lower() for k in ["rate", "cpi", "inflation", "gdp", "fed", "rbi"]) else "NEUTRAL",
            "published_at": datetime.now(timezone.utc),
            "metadata": {"category": "MACRO_INDICATORS"}
        }


class ForexFactoryCalendarRssIngestor(BaseIngestor):
    """Ingests central bank rate decisions (Fed, RBI, ECB) and high-impact macro releases"""
    
    def __init__(self, rss_url: Optional[str] = None):
        super().__init__(source_name="FOREX_FACTORY")
        self.rss_url = rss_url or settings.FOREX_FACTORY_CALENDAR_RSS

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(self.rss_url, headers={"User-Agent": "Mozilla/5.0"})
                if res.status_code == 200:
                    feed = feedparser.parse(res.text)
                    return feed.entries
        except Exception as e:
            self.logger.warning(f"Error fetching Forex Factory RSS: {e}")
        return []

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        title = raw_item.get("title", "").strip()
        if not title:
            return None

        summary = BeautifulSoup(raw_item.get("summary", ""), "html.parser").get_text().strip()
        link = raw_item.get("link")
        full_text = f"Economic Calendar Event: {title}\n\nAnalysis: {summary}"

        impact = "HIGH_VOLATILITY" if any(k in full_text.lower() for k in ["fomc", "rbi", "interest rate", "nfp", "cpi", "payroll"]) else "NEUTRAL"

        return {
            "source": "FOREX_FACTORY",
            "source_url": link,
            "title": f"Economic Event: {title}",
            "summary": summary[:350],
            "content": full_text,
            "symbols": ["MACRO_CALENDAR", "GLOBAL_MARKETS"],
            "market_impact": impact,
            "published_at": datetime.now(timezone.utc),
            "metadata": {"category": "CENTRAL_BANK_CALENDAR"}
        }
