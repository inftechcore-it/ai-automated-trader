"""
Sparse / BM25 Lexical Keyword Retriever
Performs tokenized term matching, exact error code extraction, and BM25-scored lexical retrieval
across AI-BDM Knowledge Base collections and market news.
"""
import re
import math
import logging
from typing import List, Dict, Any, Optional
from collections import Counter
from src.core.db import db
from src.rag.dense_retriever import ALL_KB_COLLECTIONS

logger = logging.getLogger("rag.sparse_retriever")

class SparseRetriever:
    """Sparse retriever implementing BM25-style term frequency and exact token matching"""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b

    def tokenize(self, text: str) -> List[str]:
        """Simple lowercase token extraction preserving alphanumeric and financial codes"""
        if not text:
            return []
        # Match alphanumeric strings, currency codes, and error codes like AB1004, 0x1771, BTC/USDT
        tokens = re.findall(r"[A-Za-z0-9_\-\./]+", text.lower())
        return [t for t in tokens if len(t) > 1]

    def compute_bm25_score(
        self,
        query_tokens: List[str],
        doc_tokens: List[str],
        avg_doc_len: float = 80.0
    ) -> float:
        """Computes BM25 score for a document against query tokens"""
        if not query_tokens or not doc_tokens:
            return 0.0

        doc_len = len(doc_tokens)
        doc_counts = Counter(doc_tokens)
        score = 0.0

        for token in query_tokens:
            tf = doc_counts.get(token, 0)
            if tf > 0:
                # IDF proxy
                idf = math.log(1.0 + 100.0 / (1.0 + tf))
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / (avg_doc_len or 1.0)))
                score += idf * (numerator / (denominator or 1.0))

        # Normalize score into [0.0, 1.0] range
        normalized = 1.0 - (1.0 / (1.0 + score * 0.2))
        return min(1.0, max(0.0, normalized))

    async def search_collection(
        self,
        collection: str,
        query_tokens: List[str],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Queries table for records containing any query terms and scores them with BM25"""
        if not query_tokens:
            return []

        try:
            # Query the table to retrieve documents matching keywords
            # We construct a flexible ILIKE condition for top terms
            like_terms = [t for t in query_tokens if len(t) >= 3][:4]
            where_clauses = []
            params = []

            for idx, term in enumerate(like_terms, start=1):
                where_clauses.append(f"(title LIKE %s OR content LIKE %s)")
                params.extend([f"%{term}%", f"%{term}%"])

            # Default to limit 20 to score in memory
            where_sql = f"WHERE {' OR '.join(where_clauses)}" if where_clauses else ""
            
            # Specific column adaptation for tables without 'title'
            if collection == "kb_indicators_ta":
                where_sql = where_sql.replace("title", "indicator_name")
            elif collection == "kb_rms_rules":
                where_sql = where_sql.replace("title", "rule_code")
            elif collection == "kb_broker_diagnostics":
                where_sql = where_sql.replace("title", "error_code")
            elif collection == "kb_trade_history":
                where_sql = where_sql.replace("title", "symbol").replace("content", "narrative_summary")

            query = f"SELECT * FROM {collection} {where_sql} LIMIT 25;"
            records = await db.fetch(query, *params) if params else await db.fetch(f"SELECT * FROM {collection} LIMIT 25;")
            
            scored_docs = []
            for r in records:
                r_dict = dict(r)
                title = r_dict.get("title") or r_dict.get("indicator_name") or r_dict.get("rule_code") or r_dict.get("error_name") or r_dict.get("symbol") or "Untitled"
                content = r_dict.get("content") or r_dict.get("narrative_summary") or r_dict.get("description") or r_dict.get("interpretation") or ""
                doc_text = f"{title}\n{content}"
                
                doc_tokens = self.tokenize(doc_text)
                score = self.compute_bm25_score(query_tokens, doc_tokens)

                if score > 0.05:
                    scored_docs.append({
                        "id": str(r_dict.get("id", "")),
                        "collection": collection,
                        "title": title,
                        "content": doc_text,
                        "sparse_score": float(score),
                        "metadata": {
                            k: v for k, v in r_dict.items()
                            if k not in ["embedding", "content"]
                        }
                    })

            scored_docs.sort(key=lambda x: x["sparse_score"], reverse=True)
            return scored_docs[:top_k]
        except Exception as e:
            logger.debug(f"Sparse DB search on collection '{collection}' falling back to cached seed fixtures: {e}")
            return self._search_fallback_fixtures(collection, query_tokens, top_k)

    def _search_fallback_fixtures(self, collection: str, query_tokens: List[str], top_k: int = 5) -> List[Dict[str, Any]]:
        """In-memory BM25 keyword matching over cached KB fixtures when database is local or offline"""
        try:
            import os
            import json

            dump_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seeds", "kb_seeds_dump.json")
            if not os.path.exists(dump_path):
                return []

            with open(dump_path, "r", encoding="utf-8") as f:
                dump_data = json.load(f)

            items = dump_data.get(collection, [])
            if not items:
                return []

            scored = []
            for item in items:
                title = item.get("title") or item.get("indicator_name") or item.get("rule_code") or item.get("error_name") or item.get("symbol") or "Untitled Document"
                content = item.get("content") or item.get("narrative_summary") or item.get("description") or item.get("interpretation") or ""
                summary = item.get("summary") or item.get("root_cause") or ""
                doc_text = f"{title}\n{summary}\n{content}".strip()

                doc_tokens = self.tokenize(doc_text)
                score = self.compute_bm25_score(query_tokens, doc_tokens)

                if score > 0.01:
                    scored.append({
                        "id": str(item.get("id", "")),
                        "collection": collection,
                        "title": title,
                        "content": doc_text,
                        "sparse_score": float(score),
                        "metadata": {k: v for k, v in item.items() if k not in ["content", "summary"]},
                    })

            scored.sort(key=lambda x: x["sparse_score"], reverse=True)
            return scored[:top_k]
        except Exception as err:
            logger.warning(f"Fallback sparse search failed for {collection}: {err}")
            return []

    async def retrieve(
        self,
        query: str,
        collections: Optional[List[str]] = None,
        top_k_per_collection: int = 5
    ) -> List[Dict[str, Any]]:
        """Performs sparse keyword retrieval across target collections"""
        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []

        target_collections = collections or ALL_KB_COLLECTIONS
        valid_targets = [c for c in target_collections if c in ALL_KB_COLLECTIONS] or ALL_KB_COLLECTIONS

        all_results = []
        for col in valid_targets:
            res = await self.search_collection(col, query_tokens, top_k=top_k_per_collection)
            all_results.extend(res)

        all_results.sort(key=lambda x: x.get("sparse_score", 0.0), reverse=True)
        return all_results

sparse_retriever = SparseRetriever()
