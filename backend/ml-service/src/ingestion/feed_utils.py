"""
Feed Utilities with dual-engine parser:
Uses feedparser + httpx + BeautifulSoup if installed,
with built-in fallback to xml.etree.ElementTree and urllib for zero-dependency resilience.
"""
import logging
import re
import xml.etree.ElementTree as ET
from urllib.request import Request, urlopen
from urllib.error import URLError
from typing import List, Dict, Any, Optional

logger = logging.getLogger("rag.ingestion.feed_utils")

try:
    import feedparser
    HAS_FEEDPARSER = True
except ImportError:
    feedparser = None
    HAS_FEEDPARSER = False

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    httpx = None
    HAS_HTTPX = False

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    BeautifulSoup = None
    HAS_BS4 = False


def clean_html_text(html_content: str) -> str:
    """Strips HTML tags safely with BeautifulSoup or regex fallback"""
    if not html_content:
        return ""
    if HAS_BS4:
        return BeautifulSoup(html_content, "html.parser").get_text().strip()
    # Fallback regex strip
    return re.sub(r"<[^>]+>", "", html_content).strip()


async def fetch_rss_entries(feed_url: str, headers: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """
    Fetches and parses an RSS or Atom XML feed.
    Returns list of entry dicts containing 'title', 'summary', 'link', 'published'.
    """
    headers = headers or {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-BDM-RAG/1.0"}
    
    # Engine 1: Async httpx + feedparser
    if HAS_HTTPX and HAS_FEEDPARSER:
        try:
            async with httpx.AsyncClient(headers=headers, timeout=15.0, follow_redirects=True) as client:
                res = await client.get(feed_url)
                if res.status_code == 200:
                    feed = feedparser.parse(res.text)
                    return [
                        {
                            "title": entry.get("title", ""),
                            "summary": entry.get("summary", ""),
                            "link": entry.get("link", ""),
                            "published": entry.get("published", ""),
                            "published_parsed": getattr(entry, "published_parsed", None),
                            "tags": entry.get("tags", [])
                        }
                        for entry in feed.entries
                    ]
        except Exception as e:
            logger.warning(f"httpx+feedparser fetch failed for {feed_url}: {e}. Falling back to standard library parser.")

    # Engine 2: Standard library urllib + ElementTree fallback
    try:
        req = Request(feed_url, headers=headers)
        with urlopen(req, timeout=10) as response:
            xml_bytes = response.read()
            root = ET.fromstring(xml_bytes)
            
            entries = []
            # Check RSS 2.0 channel -> item
            items = root.findall(".//item")
            if not items:
                # Check Atom feed -> entry
                items = root.findall(".//{http://www.w3.org/2005/Atom}entry") or root.findall(".//entry")

            for item in items:
                title = (item.findtext("title") or item.findtext("{http://www.w3.org/2005/Atom}title") or "").strip()
                summary = (item.findtext("description") or item.findtext("summary") or item.findtext("{http://www.w3.org/2005/Atom}summary") or "").strip()
                link = (item.findtext("link") or item.findtext("{http://www.w3.org/2005/Atom}link") or "").strip()
                pub_date = (item.findtext("pubDate") or item.findtext("published") or item.findtext("{http://www.w3.org/2005/Atom}published") or "").strip()

                if title or summary:
                    entries.append({
                        "title": title,
                        "summary": summary,
                        "link": link,
                        "published": pub_date,
                        "published_parsed": None,
                        "tags": []
                    })
            return entries
    except Exception as e:
        logger.error(f"Fallback RSS parser failed for {feed_url}: {e}")
        return []


async def fetch_json_api(url: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> Optional[Any]:
    """Fetches JSON from REST API endpoints with fallback"""
    headers = headers or {"User-Agent": "AI-BDM-RAG/1.0"}
    if HAS_HTTPX:
        try:
            async with httpx.AsyncClient(headers=headers, timeout=15.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            logger.warning(f"httpx fetch_json_api error for {url}: {e}")
            return None

    # Fallback to urllib
    try:
        import json
        import urllib.parse
        full_url = url
        if params:
            full_url = f"{url}?{urllib.parse.urlencode(params)}"
        req = Request(full_url, headers=headers)
        with urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        logger.error(f"Fallback fetch_json_api error for {url}: {e}")
        return None
