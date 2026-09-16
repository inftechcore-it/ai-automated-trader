"""
US Equity Market Ingestion Workers:
1. SEC EDGAR RSS Feed (10-K, 10-Q, 8-K Material Events, Form 4 Insider Trades)
2. Benzinga News Feed / FMP Market Headlines
"""
import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import feedparser
import httpx
from bs4 import BeautifulSoup
from src.ingestion.base_ingestor import BaseIngestor
from src.core.config import settings

logger = logging.getLogger("rag.ingestion.us_equity")

def extract_us_tickers(text: str) -> List[str]:
    """Detect common US stock symbols and FAANG/tech leaders"""
    candidates = [
        "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD",
        "SPY", "QQQ", "COIN", "MSTR", "INTC", "NFLX", "DIS", "JPM", "GS"
    ]
    found = []
    text_upper = text.upper()
    for ticker in candidates:
        if re.search(rf"\b{ticker}\b", text_upper) or f"${ticker}" in text_upper:
            found.append(ticker)
    return list(set(found))

def determine_us_sentiment(text: str) -> str:
    text_lower = text.lower()
    if any(k in text_lower for k in ["revenue beats", "guidance raised", "fda approval", "share buyback", "upgraded to buy"]):
        return "BULLISH"
    if any(k in text_lower for k in ["revenue misses", "guidance cut", "sec investigation", "lawsuit", "layoffs", "downgraded"]):
        return "BEARISH"
    if any(k in text_lower for k in ["earnings preview", "fed decision", "cpi", "fomc rate", "split"]):
        return "HIGH_VOLATILITY"
    return "NEUTRAL"


class SecEdgarRssIngestor(BaseIngestor):
    """Ingests real-time SEC EDGAR corporate filings (10-K annual, 10-Q quarterly, 8-K material events)"""
    
    def __init__(self, rss_url: Optional[str] = None):
        super().__init__(source_name="SEC_EDGAR")
        self.rss_url = rss_url or settings.SEC_EDGAR_RSS_URL

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        headers = {
            "User-Agent": "AIBDMCapitalResearch/1.0 (compliance@aibdm-trader.internal)"
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(self.rss_url, headers=headers)
                if res.status_code == 200:
                    feed = feedparser.parse(res.text)
                    return feed.entries
        except Exception as e:
            self.logger.warning(f"Error fetching SEC EDGAR RSS feed: {e}")
        return []

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        title = raw_item.get("title", "").strip()
        if not title:
            return None

        summary = BeautifulSoup(raw_item.get("summary", ""), "html.parser").get_text().strip()
        link = raw_item.get("link")

        # Parse filing type (e.g. 8-K, 10-Q, 10-K, 4)
        filing_match = re.search(r"\b(10-K|10-Q|8-K|Form 4|S-1|13F)\b", title, re.IGNORECASE)
        filing_type = filing_match.group(1).upper() if filing_match else "SEC_FILING"

        symbols = extract_us_tickers(f"{title} {summary}")
        content = f"SEC EDGAR Filing ({filing_type}): {title}\nSummary: {summary}\nLink: {link}"

        published_at = datetime.now(timezone.utc)
        if hasattr(raw_item, "published_parsed") and raw_item.published_parsed:
            try:
                published_at = datetime(*raw_item.published_parsed[:6], tzinfo=timezone.utc)
            except Exception:
                pass

        return {
            "source": "SEC_EDGAR",
            "source_url": link,
            "title": f"SEC Filing: {title[:150]}",
            "summary": summary[:400],
            "content": content,
            "symbols": symbols if symbols else ["US_EQUITY"],
            "market_impact": "HIGH_VOLATILITY" if filing_type in ["8-K", "10-K", "10-Q"] else "NEUTRAL",
            "published_at": published_at,
            "metadata": {
                "filing_type": filing_type,
                "regulator": "SEC_US"
            }
        }


class BenzingaAndFmpNewsIngestor(BaseIngestor):
    """Ingests US market news and earnings summaries from Benzinga / Financial Modeling Prep (FMP) APIs"""
    
    def __init__(self):
        super().__init__(source_name="BENZINGA_FMP")
        self.fmp_key = settings.FMP_API_KEY
        self.fmp_url = f"https://financialmodelingprep.com/api/v3/fmp/articles?page=0&size=20&apikey={self.fmp_key}"

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        if not self.fmp_key:
            return []

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(self.fmp_url)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("content", []) if isinstance(data, dict) else data
        except Exception as e:
            self.logger.warning(f"Error fetching FMP articles: {e}")
        return []

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        title = raw_item.get("title", "").strip()
        if not title:
            return None

        content_raw = raw_item.get("content", raw_item.get("summary", ""))
        content_clean = BeautifulSoup(content_raw, "html.parser").get_text().strip()
        symbols = extract_us_tickers(f"{title} {content_clean}")
        impact = determine_us_sentiment(f"{title} {content_clean}")

        return {
            "source": "BENZINGA",
            "source_url": raw_item.get("link"),
            "title": title,
            "summary": content_clean[:350],
            "content": f"{title}\n\n{content_clean}",
            "symbols": symbols if symbols else ["US_EQUITY"],
            "market_impact": impact,
            "published_at": datetime.now(timezone.utc),
            "metadata": {
                "author": raw_item.get("author"),
                "tickers": raw_item.get("tickers")
            }
        }
