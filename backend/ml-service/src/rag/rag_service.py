"""
AI-BDM Unified RAG Service Orchestrator
Coordinates Dense & Sparse retrieval, Hybrid Reranking, Gemini LLM Synthesis,
Pre-Trade Guardrails, and Broker Error Diagnostic workflows.
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional
from src.core.db import db
from src.rag.dense_retriever import dense_retriever, ALL_KB_COLLECTIONS
from src.rag.sparse_retriever import sparse_retriever
from src.rag.reranker import reranker
from src.rag.gemini_engine import gemini_engine
from src.rag.guardrail_engine import guardrail_engine

logger = logging.getLogger("rag.service")

class RagService:
    """Unified RAG Service interface for AI-BDM platform"""

    def __init__(self):
        self.dense = dense_retriever
        self.sparse = sparse_retriever
        self.reranker = reranker
        self.gemini = gemini_engine
        self.guardrail = guardrail_engine

    async def execute_query(
        self,
        query: str,
        collections: Optional[List[str]] = None,
        symbol: Optional[str] = None,
        market: Optional[str] = None,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """
        Complete RAG Query Pipeline:
        1. Dense pgvector search (top-15 candidates)
        2. Sparse BM25 keyword search (top-15 candidates)
        3. Reciprocal Rank Fusion (RRF) & Reranking -> top-5 passages
        4. Gemini 1.5 Synthesis -> structured JSON response
        """
        logger.info(f"Executing RAG query: '{query}' [symbol={symbol}, market={market}]")

        # Concurrent Dense & Sparse retrieval
        dense_results, sparse_results = await asyncio.gather(
            self.dense.retrieve(query, collections=collections, top_k_per_collection=4, symbol=symbol, market=market),
            self.sparse.retrieve(query, collections=collections, top_k_per_collection=4)
        )

        # Rerank and extract top_k most relevant passages
        top_passages = self.reranker.fuse_and_rerank(
            query=query,
            dense_results=dense_results,
            sparse_results=sparse_results,
            top_n=top_k,
            max_pool_size=15
        )

        # Synthesize with Gemini LLM Decision Engine
        response = self.gemini.synthesize(
            query=query,
            context_passages=top_passages,
            symbol=symbol,
            market=market
        )

        # Attach retrieval metadata
        response["retrieval_meta"] = {
            "dense_candidates_fetched": len(dense_results),
            "sparse_candidates_fetched": len(sparse_results),
            "passages_used": len(top_passages),
            "collections_queried": collections or ALL_KB_COLLECTIONS
        }
        return response

    async def check_guardrails(
        self,
        symbol: str,
        market: str,
        strategy_type: str,
        exchange: str
    ) -> Dict[str, Any]:
        """Validates pre-trade safety conditions and RMS rule adherence"""
        return await self.guardrail.evaluate_guardrails(
            symbol=symbol,
            market=market,
            strategy_type=strategy_type,
            exchange=exchange
        )

    async def diagnose_error(
        self,
        broker_or_adapter: str,
        error_code: str,
        raw_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dedicated Broker Diagnostic Endpoint:
        Queries kb_broker_diagnostics for resolution steps and recovery action.
        """
        try:
            # 1. Exact match
            query = """
                SELECT * FROM kb_broker_diagnostics
                WHERE broker_or_adapter ILIKE $1 AND error_code ILIKE $2
                LIMIT 1;
            """
            record = await db.fetchrow(query, f"%{broker_or_adapter}%", f"%{error_code}%")

            if not record and raw_message:
                # 2. Vector search if exact code isn't in seed
                vector = self.gemini.api_key and self.dense.embedder.embed_query(raw_message)
                if vector:
                    candidates = await db.vector_similarity_search("kb_broker_diagnostics", vector, top_k=1)
                    if candidates:
                        record = candidates[0]

            if record:
                rec_dict = dict(record)
                return {
                    "found": True,
                    "broker_or_adapter": rec_dict.get("broker_or_adapter"),
                    "error_code": rec_dict.get("error_code"),
                    "error_name": rec_dict.get("error_name"),
                    "description": rec_dict.get("description"),
                    "root_cause": rec_dict.get("root_cause"),
                    "resolution_steps": rec_dict.get("resolution_steps"),
                    "recovery_action": rec_dict.get("recovery_action"),
                    "metadata": rec_dict.get("metadata")
                }
            else:
                return {
                    "found": False,
                    "broker_or_adapter": broker_or_adapter,
                    "error_code": error_code,
                    "description": raw_message or "Unknown exchange error",
                    "recovery_action": "RETRY",
                    "resolution_steps": "Log full exception trace and check adapter connectivity."
                }
        except Exception as e:
            logger.debug(f"DB Error diagnosis lookup falling back to fixtures: {e}")
            try:
                import os, json
                dump_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seeds", "kb_seeds_dump.json")
                if os.path.exists(dump_path):
                    with open(dump_path, "r", encoding="utf-8") as f:
                        dump_data = json.load(f)
                    diagnostics = dump_data.get("kb_broker_diagnostics", [])
                    for diag in diagnostics:
                        if (
                            str(diag.get("error_code")).lower() == str(error_code).lower() or
                            (broker_or_adapter.lower() in str(diag.get("broker_or_adapter", "")).lower() and str(error_code).lower() in str(diag.get("error_code", "")).lower())
                        ):
                            return {
                                "found": True,
                                "broker_or_adapter": diag.get("broker_or_adapter"),
                                "error_code": diag.get("error_code"),
                                "error_name": diag.get("error_name"),
                                "description": diag.get("description"),
                                "root_cause": diag.get("root_cause"),
                                "resolution_steps": diag.get("resolution_steps"),
                                "recovery_action": diag.get("recovery_action"),
                                "metadata": diag.get("metadata")
                            }
            except Exception as fixture_err:
                logger.warning(f"Fixture fallback diagnostic lookup failed: {fixture_err}")

            return {
                "found": False,
                "error": str(e),
                "broker_or_adapter": broker_or_adapter,
                "error_code": error_code,
                "recovery_action": "RETRY",
                "resolution_steps": "Check adapter credentials and network connectivity."
            }

    async def get_collections_overview(self) -> Dict[str, Any]:
        """Returns record counts and metadata across all 8 internal KB collections and external news"""
        overview = {}
        dump_data = {}
        try:
            import os, json
            dump_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seeds", "kb_seeds_dump.json")
            if os.path.exists(dump_path):
                with open(dump_path, "r", encoding="utf-8") as f:
                    dump_data = json.load(f)
        except Exception:
            pass

        for col in ALL_KB_COLLECTIONS:
            try:
                count = await db.fetchval(f"SELECT COUNT(*) FROM {col};")
                overview[col] = {"record_count": count or 0, "status": "ONLINE"}
            except Exception as e:
                fixture_count = len(dump_data.get(col, []))
                overview[col] = {
                    "record_count": fixture_count,
                    "status": "ONLINE" if fixture_count > 0 else "OFFLINE",
                    "note": "Cached Knowledge Base Fixture" if fixture_count > 0 else str(e)
                }
        return overview

rag_service = RagService()
