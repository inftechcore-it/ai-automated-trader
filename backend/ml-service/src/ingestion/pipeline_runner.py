"""
Pipeline Runner and Orchestrator for RAG Ingestion Workers
Can be run as a standalone CLI tool or started as a background daemon.
"""
import sys
import os
import asyncio
import logging
import argparse
from datetime import datetime, timezone
from typing import List, Dict, Any

# Ensure project root is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.dirname(CURRENT_DIR)
ML_SERVICE_DIR = os.path.dirname(SRC_DIR)
if ML_SERVICE_DIR not in sys.path:
    sys.path.insert(0, ML_SERVICE_DIR)

from src.core.db import db
from src.core.config import settings
from src.ingestion.crypto_feeds import CryptoPanicIngestor, CoinDeskRssIngestor, ExchangeSystemStatusIngestor
from src.ingestion.indian_market_feeds import MoneycontrolRssIngestor, NseCorporateAnnouncementsIngestor, SebiPressReleaseIngestor
from src.ingestion.us_equity_feeds import SecEdgarRssIngestor, BenzingaAndFmpNewsIngestor
from src.ingestion.macro_calendar_feeds import TradingEconomicsRssIngestor, ForexFactoryCalendarRssIngestor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("rag.pipeline_runner")

def get_crypto_ingestors():
    return [
        CryptoPanicIngestor(),
        CoinDeskRssIngestor(),
        ExchangeSystemStatusIngestor(),
    ]

def get_indian_ingestors():
    return [
        MoneycontrolRssIngestor(),
        NseCorporateAnnouncementsIngestor(),
        SebiPressReleaseIngestor(),
    ]

def get_us_ingestors():
    return [
        SecEdgarRssIngestor(),
        BenzingaAndFmpNewsIngestor(),
    ]

def get_macro_ingestors():
    return [
        TradingEconomicsRssIngestor(),
        ForexFactoryCalendarRssIngestor(),
    ]

def get_all_ingestors():
    return [
        *get_crypto_ingestors(),
        *get_indian_ingestors(),
        *get_us_ingestors(),
        *get_macro_ingestors(),
    ]

async def run_pipeline(ingestors: List[Any]) -> List[Dict[str, Any]]:
    """Runs a batch ingestion across all provided ingestor workers"""
    logger.info(f"Starting ingestion pipeline for {len(ingestors)} feed workers...")
    results = []
    
    for ingestor in ingestors:
        try:
            stats = await ingestor.run_ingestion_cycle()
            results.append(stats)
        except Exception as e:
            logger.error(f"Worker {ingestor.source_name} encountered an unhandled exception: {e}")
            results.append({"source": ingestor.source_name, "error": str(e)})

    logger.info("=== Ingestion Pipeline Cycle Summary ===")
    for r in results:
        if "error" in r:
            logger.error(f"  ❌ {r.get('source')}: Error - {r.get('error')}")
        else:
            logger.info(
                f"  ✅ {r.get('source')}: Fetched={r.get('fetched')}, "
                f"Inserted={r.get('inserted')}, Skipped={r.get('skipped_duplicates')}, Errors={r.get('errors')}"
            )
    return results

async def test_feed_fetching():
    """Smoke test: Tests network connectivity and parsing without modifying the DB"""
    logger.info("Running feed fetching test...")
    ingestors = get_all_ingestors()
    for ing in ingestors:
        try:
            items = await ing.fetch_raw_data()
            logger.info(f"[{ing.source_name}] Successfully fetched {len(items)} items.")
            if items:
                norm = ing.normalize_item(items[0])
                if norm:
                    logger.info(f"   Sample title: {norm.get('title')[:80]}...")
                    logger.info(f"   Impact: {norm.get('market_impact')}, Symbols: {norm.get('symbols')}")
        except Exception as e:
            logger.error(f"[{ing.source_name}] Test failed: {e}")

async def start_daemon():
    """Runs background daemon with timed intervals"""
    logger.info("Starting continuous RAG ingestion daemon...")
    while True:
        try:
            await run_pipeline(get_all_ingestors())
        except Exception as e:
            logger.error(f"Daemon error: {e}")
        
        logger.info(f"Sleeping for {settings.CRYPTO_INGEST_INTERVAL} seconds...")
        await asyncio.sleep(settings.CRYPTO_INGEST_INTERVAL)

def main():
    parser = argparse.ArgumentParser(description="AI-BDM RAG Ingestion Pipeline Runner")
    parser.add_argument("--all", action="store_true", help="Run all ingestion workers once")
    parser.add_argument("--crypto", action="store_true", help="Run Crypto feeds only")
    parser.add_argument("--india", action="store_true", help="Run Indian market feeds only")
    parser.add_argument("--us", action="store_true", help="Run US equity feeds only")
    parser.add_argument("--macro", action="store_true", help="Run Macro calendar feeds only")
    parser.add_argument("--daemon", action="store_true", help="Run continuous background daemon")
    parser.add_argument("--test-feeds", action="store_true", help="Test feed fetching and parsing")

    args = parser.parse_args()

    if args.test_feeds:
        asyncio.run(test_feed_fetching())
        return

    if args.daemon:
        asyncio.run(start_daemon())
        return

    selected = []
    if args.crypto:
        selected.extend(get_crypto_ingestors())
    if args.india:
        selected.extend(get_indian_ingestors())
    if args.us:
        selected.extend(get_us_ingestors())
    if args.macro:
        selected.extend(get_macro_ingestors())

    if not selected or args.all:
        selected = get_all_ingestors()

    asyncio.run(run_pipeline(selected))

if __name__ == "__main__":
    main()
