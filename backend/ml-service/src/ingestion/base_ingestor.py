"""
Base Ingestor Class
Provides common ingestion logic: deduplication, text normalization, chunking,
embedding generation, and batch upsert into MySQL vector tables.
"""
import abc
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from src.core.db import db
from src.core.embeddings import embedder
from src.core.config import settings

logger = logging.getLogger("rag.ingestion.base")

class BaseIngestor(abc.ABC):
    """Abstract Base Class for Data Ingestion Workers"""
    
    def __init__(self, source_name: str):
        self.source_name = source_name
        self.logger = logging.getLogger(f"rag.ingestion.{source_name.lower()}")

    @abc.abstractmethod
    async def fetch_raw_data(self) -> List[Dict[str, Any]]:
        """Fetch raw items from external API or RSS feed"""
        pass

    @abc.abstractmethod
    def normalize_item(self, raw_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Transforms raw feed entry into canonical schema:
        {
            "source": str,
            "source_url": Optional[str],
            "title": str,
            "summary": Optional[str],
            "content": str,
            "symbols": List[str],
            "market_impact": Optional[str], # BULLISH, BEARISH, NEUTRAL, HIGH_VOLATILITY
            "published_at": datetime,
            "metadata": Dict[str, Any]
        }
        """
        pass

    def compute_content_hash(self, title: str, content: str) -> str:
        """Generates SHA-256 hash for deduplication"""
        payload = f"{self.source_name}:{title.strip()}:{content.strip()[:500]}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def chunk_text(self, text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
        """Splits text into overlapping chunks if it exceeds chunk_size"""
        if not text or len(text) <= chunk_size:
            return [text] if text else []
            
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += chunk_size - overlap
        return chunks

    async def run_ingestion_cycle(self) -> Dict[str, Any]:
        """Executes a single fetch -> normalize -> deduplicate -> embed -> persist cycle"""
        self.logger.info(f"Starting ingestion cycle for source: {self.source_name}")
        stats = {
            "source": self.source_name,
            "fetched": 0,
            "inserted": 0,
            "skipped_duplicates": 0,
            "errors": 0
        }

        try:
            raw_items = await self.fetch_raw_data()
            stats["fetched"] = len(raw_items)
            self.logger.info(f"Fetched {len(raw_items)} raw items from {self.source_name}")

            for raw_item in raw_items:
                try:
                    normalized = self.normalize_item(raw_item)
                    if not normalized:
                        continue

                    title = normalized.get("title", "").strip()
                    content = normalized.get("content", "").strip()
                    if not title and not content:
                        continue

                    content_hash = self.compute_content_hash(title, content)

                    # Check if already indexed in database
                    exists_query = "SELECT id FROM external_market_news WHERE content_hash = %s LIMIT 1;"
                    existing = await db.fetchrow(exists_query, content_hash)
                    if existing:
                        stats["skipped_duplicates"] += 1
                        continue

                    # Generate embedding for combined context (Title + Summary + Content)
                    text_for_embedding = f"{title}\n\n{normalized.get('summary', '')}\n\n{content}"
                    vector = embedder.embed_text(text_for_embedding)

                    # Insert record into MySQL
                    insert_query = """
                        INSERT INTO external_market_news (
                            id, source, source_url, content_hash, title, summary,
                            content, symbols, market_impact, published_at, embedding,
                            metadata, created_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s,
                            %s, %s
                        )
                        ON DUPLICATE KEY UPDATE
                            title = VALUES(title),
                            summary = VALUES(summary),
                            content = VALUES(content),
                            symbols = VALUES(symbols),
                            market_impact = VALUES(market_impact),
                            embedding = VALUES(embedding),
                            metadata = VALUES(metadata);
                    """

                    item_id = f"news_{uuid.uuid4().hex[:16]}"
                    published_at = normalized.get("published_at") or datetime.now(timezone.utc)
                    symbols_json = json.dumps(normalized.get("symbols") or [])
                    metadata_json = json.dumps(normalized.get("metadata") or {})

                    await db.execute(
                        insert_query,
                        item_id,
                        normalized.get("source", self.source_name),
                        normalized.get("source_url"),
                        content_hash,
                        title,
                        normalized.get("summary"),
                        content,
                        symbols_json,
                        normalized.get("market_impact", "NEUTRAL"),
                        published_at,
                        json.dumps(vector),
                        metadata_json,
                        datetime.now(timezone.utc)
                    )
                    stats["inserted"] += 1

                except Exception as item_err:
                    self.logger.error(f"Error processing item from {self.source_name}: {item_err}")
                    stats["errors"] += 1

            self.logger.info(
                f"Completed cycle for {self.source_name}: "
                f"{stats['inserted']} inserted, {stats['skipped_duplicates']} duplicates skipped, {stats['errors']} errors."
            )
            return stats

        except Exception as e:
            self.logger.error(f"Failed ingestion cycle for {self.source_name}: {e}")
            stats["errors"] += 1
            return stats
