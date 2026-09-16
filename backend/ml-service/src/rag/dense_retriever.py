"""
Dense Vector Search Retriever
Queries PostgreSQL + pgvector (768 dimensions) with HNSW cosine distance indexing
across AI-BDM Knowledge Base collections and real-time market news.
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional
from src.core.db import db
from src.core.embeddings import embedder

logger = logging.getLogger("rag.dense_retriever")

ALL_KB_COLLECTIONS = [
    "kb_strategy_playbooks",
    "kb_rms_rules",
    "kb_broker_diagnostics",
    "kb_trade_history",
    "kb_indicators_ta",
    "kb_dex_onchain",
    "kb_arbitrage_playbooks",
    "kb_fundamental_frameworks",
    "external_market_news",
]

class DenseRetriever:
    """Retriever for dense vector cosine similarity search in PostgreSQL pgvector"""

    def __init__(self):
        self.embedder = embedder

    async def search_collection(
        self,
        collection: str,
        query_vector: List[float],
        top_k: int = 5,
        filter_sql: Optional[str] = None,
        filter_params: Optional[List[Any]] = None
    ) -> List[Dict[str, Any]]:
        """Searches a single pgvector table and returns ranked records"""
        try:
            records = await db.vector_similarity_search(
                table_name=collection,
                query_vector=query_vector,
                top_k=top_k,
                filter_sql=filter_sql,
                filter_params=filter_params
            )
            
            normalized = []
            for r in records:
                # Extract uniform title & content representation
                title = r.get("title") or r.get("indicator_name") or r.get("rule_code") or r.get("error_name") or r.get("symbol") or "Untitled Document"
                content = r.get("content") or r.get("narrative_summary") or r.get("description") or r.get("interpretation") or ""
                summary = r.get("summary") or r.get("root_cause") or ""
                full_text = f"{summary}\n{content}".strip() if summary else content

                normalized.append({
                    "id": str(r.get("id", "")),
                    "collection": collection,
                    "title": title,
                    "content": full_text,
                    "dense_score": float(r.get("similarity_score", 0.0)),
                    "metadata": {
                        k: v for k, v in r.items()
                        if k not in ["embedding", "similarity_score", "content"]
                    }
                })
            return normalized
        except Exception as e:
            logger.debug(f"Dense vector DB search on collection '{collection}' falling back to cached seed fixtures: {e}")
            return self._search_fallback_fixtures(collection, query_vector, top_k)

    def _search_fallback_fixtures(self, collection: str, query_vector: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        """In-memory cosine similarity search over cached KB fixtures when database is local or offline"""
        try:
            import os
            import json
            import math

            dump_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seeds", "kb_seeds_dump.json")
            if not os.path.exists(dump_path):
                return []

            with open(dump_path, "r", encoding="utf-8") as f:
                dump_data = json.load(f)

            items = dump_data.get(collection, [])
            if not items:
                return []

            def cosine_sim(v1: List[float], v2: List[float]) -> float:
                if not v1 or not v2 or len(v1) != len(v2):
                    return 0.0
                dot = sum(a * b for a, b in zip(v1, v2))
                norm1 = math.sqrt(sum(a * a for a in v1))
                norm2 = math.sqrt(sum(b * b for b in v2))
                return dot / (norm1 * norm2) if norm1 > 0 and norm2 > 0 else 0.0

            scored = []
            for item in items:
                title = item.get("title") or item.get("indicator_name") or item.get("rule_code") or item.get("error_name") or item.get("symbol") or "Untitled Document"
                content = item.get("content") or item.get("narrative_summary") or item.get("description") or item.get("interpretation") or ""
                summary = item.get("summary") or item.get("root_cause") or ""
                full_text = f"{summary}\n{content}".strip() if summary else content

                # Compute embedding for item
                item_vector = self.embedder.embed_text(f"{title}\n{full_text}")
                sim = cosine_sim(query_vector, item_vector)

                scored.append({
                    "id": str(item.get("id", "")),
                    "collection": collection,
                    "title": title,
                    "content": full_text,
                    "dense_score": max(0.0, min(1.0, float(sim))),
                    "metadata": {k: v for k, v in item.items() if k not in ["content", "summary"]},
                })

            scored.sort(key=lambda x: x["dense_score"], reverse=True)
            return scored[:top_k]
        except Exception as err:
            logger.warning(f"Fallback fixture search failed for {collection}: {err}")
            return []

    async def retrieve(
        self,
        query: str,
        collections: Optional[List[str]] = None,
        top_k_per_collection: int = 5,
        symbol: Optional[str] = None,
        market: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Embeds the query text and performs concurrent vector searches across selected collections.
        Returns aggregated top candidate chunks.
        """
        target_collections = collections or ALL_KB_COLLECTIONS
        # Validate collection names
        valid_targets = [c for c in target_collections if c in ALL_KB_COLLECTIONS]
        if not valid_targets:
            valid_targets = ALL_KB_COLLECTIONS

        query_vector = self.embedder.embed_query(query)
        
        tasks = []
        for col in valid_targets:
            filter_sql = None
            filter_params = []
            
            # Optional metadata filter optimization
            if symbol and col in ["kb_trade_history", "kb_fundamental_frameworks"]:
                filter_sql = "symbol ILIKE $1 OR ticker_or_symbol ILIKE $1" if col == "kb_fundamental_frameworks" else "symbol ILIKE $1"
                filter_params = [f"%{symbol}%"]

            tasks.append(
                self.search_collection(
                    collection=col,
                    query_vector=query_vector,
                    top_k=top_k_per_collection,
                    filter_sql=filter_sql,
                    filter_params=filter_params
                )
            )

        results_by_collection = await asyncio.gather(*tasks, return_exceptions=True)
        
        aggregated = []
        for res in results_by_collection:
            if isinstance(res, list):
                aggregated.extend(res)

        # Sort descending by vector similarity
        aggregated.sort(key=lambda x: x.get("dense_score", 0.0), reverse=True)
        return aggregated

dense_retriever = DenseRetriever()
