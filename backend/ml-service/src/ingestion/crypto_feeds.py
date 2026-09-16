"""
Crypto Market Ingestion Workers:
1. CryptoPanic API Ingestor
2. CoinDesk RSS Ingestor
3. Binance & Bybit System Status / Maintenance Feeds
"""
import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from src.ingestion.base_ingestor import BaseIngestor
from src.ingestion.feed_utils import fetch_rss_entries, fetch_json_api, clean_html_text
from src.core.config import settings

logger = logging.getLogger("rag.ingestion.crypto")

def extract_crypto_symbols(text: str) -> List[str]:
    """Detect common crypto tickers in headlines/text"""
    candidates = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX", "LINK", "DOT", "MATIC", "CTK", "NEAR", "SUI", "APT", "UNI"]
    found = []
    text_upper = text.upper()
    for symbol in candidates:
        if re.search(rf"\b{symbol}\b", text_upper) or f"${symbol}" in text_upper:
            found.append(symbol)
    return list(set(found))

def determine_sentiment_impact(text: str, votes: Optional[Dict[str, int]] = None) -> str:
    """Classifies sentiment into BULLISH, BEARISH, HIGH_VOLATILITY, or NEUTRAL"""
    if votes:
        positive = votes.get("positive", 0) + votes.get("bullish", 0)
        negative = votes.get("negative", 0) + votes.get("bearish", 0)
        toxic = votes.get("toxic", 0) + votes.get("panic", 0)
        if toxic > 5 or (positive > 10 and negative > 10):
            return "HIGH_VOLATILITY"
        if positive > negative * 1.5:
            return "BULLISH"
        if negative > positive * 1.5:
            return "BEARISH"

    text_lower = text.lower()
    bullish_keywords = ["surge", "rally", "all-time high", "breakout", "approval", "etf approved", "inflows", "bullish", "partnership", "upgrade"]
    bearish_keywords = ["crash", "plunge", "hack", "exploit", "sec lawsuit", "liquidation cascade", "ban", "insolvent", "outage", "scam"]
    volatile_keywords = ["fed rate", "cpi print", "fomc", "halving", "volatility", "options expiry"]

    for kw in volatile_keywords:
        if kw in text_lower:
            return "HIGH_VOLATILITY"
    for kw in bullish_keywords:
        if kw in text_lower:
            return "BULLISH"
    for kw in bearish_keywords:
        if kw in text_lower:
            return "BEARISH"
    return "NEUTRAL"


class CryptoPanicIngestor(BaseIngestor):
    """Ingests real-time aggregated crypto news and social sentiment from CryptoPanic"""
    
    def __init__(self, api_key: Optional[str] = None):
        super().__init__(source_name="CRYPTOPANIC")
        self.api_key = api_key or settings.CRYPTOPANIC_API_KEY
        self.base_url = "https://cryptopanic.com/api/v1/posts/"

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        params = {"public": "true", "metadata": "true"}
        if self.api_key:
            params["auth_token"] = self.api_key

        data = await fetch_json_api(self.base_url, params=params)
        if data and isinstance(data, dict):
            return data.get("results", [])
        return []

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        title = raw_item.get("title", "").strip()
        if not title:
            return None

        symbols = [c.get("code") for c in raw_item.get("currencies", []) if isinstance(c, dict) and c.get("code")]
        if not symbols:
            symbols = extract_crypto_symbols(title)

        votes = raw_item.get("votes", {})
        impact = determine_sentiment_impact(title, votes)

        published_str = raw_item.get("published_at")
        published_at = datetime.now(timezone.utc)
        if published_str:
            try:
                published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
            except Exception:
                pass

        return {
            "source": "CRYPTOPANIC",
            "source_url": raw_item.get("url"),
            "title": title,
            "summary": f"CryptoPanic domain: {raw_item.get('domain')}. Votes: {votes}",
            "content": f"{title}\nSource: {raw_item.get('domain')}\nCurrencies: {', '.join(symbols)}",
            "symbols": symbols,
            "market_impact": impact,
            "published_at": published_at,
            "metadata": {
                "cryptopanic_id": raw_item.get("id"),
                "domain": raw_item.get("domain"),
                "votes": votes
            }
        }


class CoinDeskRssIngestor(BaseIngestor):
    """Ingests editorial news and market analysis from CoinDesk RSS Feed"""
    
    def __init__(self, feed_url: Optional[str] = None):
        super().__init__(source_name="COINDESK")
        self.feed_url = feed_url or settings.COINDESK_RSS_URL

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        return await fetch_rss_entries(self.feed_url)

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        title = raw_item.get("title", "").strip()
        if not title:
            return None

        summary = clean_html_text(raw_item.get("summary", ""))
        link = raw_item.get("link")

        symbols = extract_crypto_symbols(f"{title} {summary}")
        impact = determine_sentiment_impact(f"{title} {summary}")

        published_at = datetime.now(timezone.utc)
        pub_parsed = raw_item.get("published_parsed")
        if pub_parsed:
            try:
                published_at = datetime(*pub_parsed[:6], tzinfo=timezone.utc)
            except Exception:
                pass

        return {
            "source": "COINDESK",
            "source_url": link,
            "title": title,
            "summary": summary[:400],
            "content": f"{title}\n\n{summary}",
            "symbols": symbols if symbols else ["CRYPTO_GENERAL"],
            "market_impact": impact,
            "published_at": published_at,
            "metadata": {
                "categories": [tag.get("term") for tag in raw_item.get("tags", []) if isinstance(tag, dict)]
            }
        }


class ExchangeSystemStatusIngestor(BaseIngestor):
    """Ingests Binance and Bybit live system operational health, maintenance, and API status"""
    
    def __init__(self):
        super().__init__(source_name="EXCHANGE_STATUS")

    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        results = []
        # 1. Binance Status
        binance_data = await fetch_json_api(settings.BINANCE_STATUS_API)
        if binance_data:
            results.append({"exchange": "BINANCE", "data": binance_data})

        # 2. Bybit Status
        bybit_data = await fetch_json_api(settings.BYBIT_STATUS_API)
        if bybit_data:
            results.append({"exchange": "BYBIT", "data": bybit_data})

        return results

    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        exchange = raw_item.get("exchange")
        data = raw_item.get("data", {})

        if exchange == "BINANCE":
            status_code = data.get("status", 0)
            msg = data.get("msg", "Normal")
            is_healthy = (status_code == 0)
            title = f"Binance System Status: {msg} (Code: {status_code})"
            impact = "NEUTRAL" if is_healthy else "HIGH_VOLATILITY"
            content = f"Binance API Gateway Health Status: {msg}. Operational code: {status_code}."
            return {
                "source": "BINANCE_STATUS",
                "source_url": "https://www.binance.com/en/support/announcement",
                "title": title,
                "summary": msg,
                "content": content,
                "symbols": ["ALL_BINANCE_PAIRS"],
                "market_impact": impact,
                "published_at": datetime.now(timezone.utc),
                "metadata": {"status_code": status_code, "raw": data}
            }

        elif exchange == "BYBIT":
            ret_code = data.get("retCode", 0)
            ret_msg = data.get("retMsg", "OK")
            title = f"Bybit System Status: {ret_msg}"
            impact = "NEUTRAL" if ret_code == 0 else "HIGH_VOLATILITY"
            return {
                "source": "BYBIT_STATUS",
                "source_url": "https://status.bybit.com",
                "title": title,
                "summary": ret_msg,
                "content": f"Bybit V5 Market Status: {ret_msg} (retCode {ret_code})",
                "symbols": ["ALL_BYBIT_PAIRS"],
                "market_impact": impact,
                "published_at": datetime.now(timezone.utc),
                "metadata": {"raw": data}
            }

        return None
