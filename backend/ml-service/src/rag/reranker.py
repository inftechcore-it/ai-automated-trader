"""
Hybrid Reranker & Reciprocal Rank Fusion (RRF) Engine
Combines Dense Vector Search and Sparse BM25 candidate pools, reranking top-15 chunks
into the top-5 highest-confidence context passages for LLM synthesis.
"""
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("rag.reranker")

class HybridReranker:
    """Reranker using Reciprocal Rank Fusion (RRF) and semantic overlap scoring"""

    def __init__(self, rrf_k: int = 60, dense_weight: float = 0.7, sparse_weight: float = 0.3):
        self.rrf_k = rrf_k
        self.dense_weight = dense_weight
        self.sparse_weight = sparse_weight

    def fuse_and_rerank(
        self,
        query: str,
        dense_results: List[Dict[str, Any]],
        sparse_results: List[Dict[str, Any]],
        top_n: int = 5,
        max_pool_size: int = 15
    ) -> List[Dict[str, Any]]:
        """
        Fuses dense and sparse retrieval lists using RRF, deduplicates by ID/content hash,
        and returns the top_n most relevant chunks.
        """
        # Dictionary to track unified candidate chunks by unique key
        candidates: Dict[str, Dict[str, Any]] = {}

        # 1. Process Dense Results
        for rank, item in enumerate(dense_results[:max_pool_size], start=1):
            key = f"{item['collection']}:{item['id']}"
            if key not in candidates:
                candidates[key] = {
                    **item,
                    "rrf_score": 0.0,
                    "dense_rank": rank,
                    "sparse_rank": None,
                    "dense_score": item.get("dense_score", 0.0),
                    "sparse_score": 0.0
                }
            candidates[key]["rrf_score"] += self.dense_weight / (self.rrf_k + rank)

        # 2. Process Sparse Results
        for rank, item in enumerate(sparse_results[:max_pool_size], start=1):
            key = f"{item['collection']}:{item['id']}"
            if key not in candidates:
                candidates[key] = {
                    **item,
                    "rrf_score": 0.0,
                    "dense_rank": None,
                    "sparse_rank": rank,
                    "dense_score": 0.0,
                    "sparse_score": item.get("sparse_score", 0.0)
                }
            else:
                candidates[key]["sparse_rank"] = rank
                candidates[key]["sparse_score"] = item.get("sparse_score", 0.0)

            candidates[key]["rrf_score"] += self.sparse_weight / (self.rrf_k + rank)

        # 3. Compute Composite Relevance Score (0.0 to 1.0)
        query_words = set(query.lower().split())
        for key, doc in candidates.items():
            doc_text = f"{doc.get('title', '')} {doc.get('content', '')}".lower()
            overlap_count = sum(1 for w in query_words if len(w) > 2 and w in doc_text)
            overlap_boost = min(0.2, overlap_count * 0.04)

            # Combined normalized score
            dense_comp = doc.get("dense_score", 0.0) * self.dense_weight
            sparse_comp = doc.get("sparse_score", 0.0) * self.sparse_weight
            composite_score = dense_comp + sparse_comp + overlap_boost
            
            doc["relevance_score"] = round(min(1.0, composite_score), 4)

        # 4. Sort and select top_n
        ranked_list = list(candidates.values())
        ranked_list.sort(key=lambda x: (x["rrf_score"], x["relevance_score"]), reverse=True)

        logger.info(
            f"Reranked {len(ranked_list)} candidate chunks from Dense({len(dense_results)}) "
            f"+ Sparse({len(sparse_results)}) -> selected top {min(top_n, len(ranked_list))}"
        )
        return ranked_list[:top_n]

reranker = HybridReranker()
