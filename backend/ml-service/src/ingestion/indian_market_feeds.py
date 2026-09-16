"""
Indian Market Ingestion Workers:
1. Moneycontrol RSS (Top News, Markets, Economy)
2. NSE / BSE Corporate Announcements & Filings
3. SEBI Press Releases & Regulatory Circulars
"""
import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from src.ingestion.base_ingestor import BaseIngestor
from src.ingestion.feed_utils import fetch_rss_entries, fetch_json_api, clean_html_text
from src.core.config import settings

logger = logging.getLogger("rag.ingestion.indian_markets")

def extract_indian_symbols(text: str) -> List[str]:
    """Detect common Indian NSE/BSE stock tickers and indices"""
    candidates = [
        "NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK",
        "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK", "LT", "HINDUNILVR", "TATAMOTORS",
        "TATASTEEL", "BAJFINANCE", "ADANIENT", "MARUTI", "SUNPHARMA", "AXISBANK"
    ]
    found = []
    text_upper = text.upper()
    for symbol in candidates:
        if re.search(rf"\b{symbol}\b", text_upper):
            found.append(symbol)
    return list(set(found))

def determine_indian_sentiment(text: str) -> str:
    text_lower = text.lower()
    if any(k in text_lower for k in ["rbi rate cut", "profit surges", "q3 beats estimates", "q4 beats estimates", "record high", "dividend announced"]):
        return "BULLISH"
    if any(k in text_lower for k in ["rbi rate hike", "loss widens", "sebi penalty", "investigation", "fraud", "scam", "downgrade", "margin shortfall"]):
        return "BEARISH"
    if any(k in text_lower for k in ["rbi policy", "budget", "election", "cpi inflation", "fed meeting"]):
        return "HIGH_VOLATILITY"
    return "NEUTRAL"


class MoneycontrolRssIngestor(BaseIngestor):
    """Ingests Indian market news, corporate earnings, and macro events from Moneycontrol"""
    
    def __init__(self, urls: Optional[List[str]] = None):
        super().__init__(source_name="MONEYCONTROL")
        self.urls = urls or [settings.MONEYCONTROL_RSS_URL, settings.MONEYCONTROL_MARKETS_RSS]

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        all_entries = []
        for url in self.urls:
            entries = await fetch_rss_entries(url)
            all_entries.extend(entries)
        return all_entries

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        title = raw_item.get("title", "").strip()
        if not title:
            return None

        summary = clean_html_text(raw_item.get("summary", ""))
        link = raw_item.get("link")

        full_text = f"{title}\n\n{summary}"
        symbols = extract_indian_symbols(full_text)
        impact = determine_indian_sentiment(full_text)

        return {
            "source": "MONEYCONTROL",
            "source_url": link,
            "title": title,
            "summary": summary[:400],
            "content": full_text,
            "symbols": symbols if symbols else ["NSE_INDIA"],
            "market_impact": impact,
            "published_at": datetime.now(timezone.utc),
            "metadata": {
                "market": "INDIA_NSE_BSE",
                "publisher": "Moneycontrol"
            }
        }


class NseCorporateAnnouncementsIngestor(BaseIngestor):
    """Ingests NSE / BSE corporate announcements, board meetings, and regulatory filings"""
    
    def __init__(self):
        super().__init__(source_name="NSE_ANNOUNCEMENTS")
        self.endpoint = "https://www.nseindia.com/api/corporate-announcements"

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json, text/plain, */*"
        }
        data = await fetch_json_api(self.endpoint, headers=headers)
        if data:
            return data if isinstance(data, list) else data.get("data", [])
        return []

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        symbol = raw_item.get("symbol", "").strip()
        company = raw_item.get("companyName", raw_item.get("sm_name", symbol))
        subject = raw_item.get("desc", raw_item.get("subject", "")).strip()
        details = raw_item.get("attchmntText", subject).strip()

        if not subject and not details:
            return None

        title = f"NSE Announcement: {company} ({symbol}) - {subject[:100]}"
        content = f"Company: {company}\nSymbol: {symbol}\nSubject: {subject}\nDetails:\n{details}"
        impact = determine_indian_sentiment(content)

        return {
            "source": "NSE_ANNOUNCEMENTS",
            "source_url": raw_item.get("attchmntFile", "https://www.nseindia.com"),
            "title": title,
            "summary": subject[:300],
            "content": content,
            "symbols": [symbol] if symbol else ["NSE_INDIA"],
            "market_impact": impact,
            "published_at": datetime.now(timezone.utc),
            "metadata": {
                "company_name": company,
                "broadcast_date": raw_item.get("an_dt")
            }
        }


class SebiPressReleaseIngestor(BaseIngestor):
    """Ingests SEBI regulatory press releases, circulars, and market compliance updates"""
    
    def __init__(self, rss_url: Optional[str] = None):
        super().__init__(source_name="SEBI_PRESS")
        self.rss_url = rss_url or settings.SEBI_PRESS_RSS_URL

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        return await fetch_rss_entries(self.rss_url)

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        title = raw_item.get("title", "").strip()
        if not title:
            return None

        summary = clean_html_text(raw_item.get("summary", ""))
        link = raw_item.get("link")
        full_text = f"SEBI Regulatory Notice: {title}\n\nSummary:\n{summary}"

        return {
            "source": "SEBI_PRESS",
            "source_url": link,
            "title": f"SEBI Circular: {title}",
            "summary": summary[:350],
            "content": full_text,
            "symbols": ["SEBI_REGULATION", "NSE_BSE_BROKERS"],
            "market_impact": "HIGH_VOLATILITY" if "margin" in full_text.lower() or "penalty" in full_text.lower() else "NEUTRAL",
            "published_at": datetime.now(timezone.utc),
            "metadata": {"regulator": "SEBI_INDIA"}
        }
