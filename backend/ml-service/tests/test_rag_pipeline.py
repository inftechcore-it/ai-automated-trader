"""
Unit and Integration Test Suite for Phase 2 RAG Intelligence Pipeline
Tests Dense/Sparse Retrieval, RRF Reranking, Gemini Decision Engine, Guardrail Evaluation, and FastAPI Endpoints.
"""
import unittest
import asyncio
import json
from unittest.mock import AsyncMock, patch, MagicMock

# Ensure project root is in sys.path
import os
import sys
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ML_SERVICE_DIR = os.path.dirname(CURRENT_DIR)
if ML_SERVICE_DIR not in sys.path:
    sys.path.insert(0, ML_SERVICE_DIR)

from src.rag.sparse_retriever import SparseRetriever
from src.rag.reranker import HybridReranker
from src.rag.gemini_engine import GeminiDecisionEngine
from src.rag.guardrail_engine import GuardrailEngine
from src.rag.rag_service import RagService


class TestRagPipeline(unittest.TestCase):

    def setUp(self):
        self.sparse = SparseRetriever()
        self.reranker = HybridReranker()
        self.gemini = GeminiDecisionEngine(api_key="mock_test_key")
        self.guardrail = GuardrailEngine()

    def test_sparse_retriever_tokenization_and_bm25(self):
        query = "Spot Grid arithmetic lower price 1.20 BTC/USDT"
        tokens = self.sparse.tokenize(query)
        self.assertIn("spot", tokens)
        self.assertIn("grid", tokens)
        self.assertIn("btc/usdt", tokens)

        doc_matching = ["spot", "grid", "trading", "playbook", "arithmetic", "spacing"]
        doc_unrelated = ["apple", "nasdaq", "quarterly", "earnings"]

        score_matching = self.sparse.compute_bm25_score(tokens, doc_matching)
        score_unrelated = self.sparse.compute_bm25_score(tokens, doc_unrelated)

        self.assertGreater(score_matching, score_unrelated)
        self.assertGreater(score_matching, 0.0)

    def test_hybrid_reranker_rrf_fusion(self):
        query = "Angel One SmartAPI AB1004 session expired"
        dense_results = [
            {"id": "diag_1", "collection": "kb_broker_diagnostics", "title": "Angel One Token Expired AB1004", "content": "JWT expired", "dense_score": 0.88},
            {"id": "diag_2", "collection": "kb_broker_diagnostics", "title": "Upstox Token Expired", "content": "OAuth expired", "dense_score": 0.75},
        ]
        sparse_results = [
            {"id": "diag_1", "collection": "kb_broker_diagnostics", "title": "Angel One Token Expired AB1004", "content": "JWT expired", "sparse_score": 0.92},
            {"id": "rule_1", "collection": "kb_rms_rules", "title": "SEBI Peak Margin", "content": "Margin limits", "sparse_score": 0.30},
        ]

        top_passages = self.reranker.fuse_and_rerank(
            query=query,
            dense_results=dense_results,
            sparse_results=sparse_results,
            top_n=2
        )

        self.assertEqual(len(top_passages), 2)
        # diag_1 is top in both dense & sparse, so it must rank 1st with highest RRF score
        self.assertEqual(top_passages[0]["id"], "diag_1")
        self.assertGreater(top_passages[0]["rrf_score"], top_passages[1]["rrf_score"])
        self.assertIn("relevance_score", top_passages[0])

    def test_gemini_engine_synthesis_fallback(self):
        query = "Recommend strategy and grid levels for BTC/USDT in sideways market"
        mock_context = [
            {
                "id": "strat_spot_grid",
                "collection": "kb_strategy_playbooks",
                "title": "Spot Grid Trading Strategy Playbook",
                "content": "Arithmetic spacing works best for sideways range bound markets.",
                "relevance_score": 0.94
            }
        ]

        # Explicitly run fallback synthesis
        result = self.gemini._generate_fallback_synthesis(
            query=query,
            context_passages=mock_context,
            symbol="BTC/USDT",
            market="CRYPTO",
            citations=[{"id": "strat_spot_grid", "collection": "kb_strategy_playbooks", "title": "Spot Grid", "relevance_score": 0.94}]
        )

        self.assertIn("analysis", result)
        self.assertIn("sentiment_score", result)
        self.assertIn("actionable_setup", result)
        self.assertIn("citations", result)

        setup = result["actionable_setup"]
        self.assertIn(setup["direction"], ["BUY", "SELL", "NEUTRAL"])
        self.assertGreaterEqual(setup["confidence"], 0.0)
        self.assertLessEqual(setup["confidence"], 1.0)
        self.assertIn("suggested_parameters", setup)
        self.assertIn("gridCount", setup["suggested_parameters"])

    def test_guardrail_engine_safe_evaluation(self):
        async def run_test():
            with patch("src.core.db.db.fetch", new_callable=AsyncMock) as mock_fetch:
                # Mock no recent negative news and standard RMS rules
                mock_fetch.side_effect = [
                    [],  # recent_news
                    [{"id": "1", "broker_or_adapter": "BINANCE", "error_code": "0", "error_name": "OK", "recovery_action": "NONE"}],  # diagnostics
                    [{"rule_code": "RMS-DD-001", "title": "Daily Drawdown", "category": "DRAWDOWN", "action_on_breach": "PAUSE_BOT"}]  # rms_rules
                ]

                result = await self.guardrail.evaluate_guardrails(
                    symbol="BTC/USDT",
                    market="CRYPTO",
                    strategy_type="GRID",
                    exchange="BINANCE"
                )

                self.assertTrue(result["safe_to_trade"])
                self.assertEqual(result["risk_level"], "LOW")
                self.assertEqual(result["suggested_action"], "PROCEED")
                self.assertIsNone(result["warning_reason"])

        asyncio.run(run_test())

    def test_guardrail_engine_high_volatility_widen_grid(self):
        async def run_test():
            with patch("src.core.db.db.fetch", new_callable=AsyncMock) as mock_fetch:
                # Mock breaking high volatility news
                mock_fetch.side_effect = [
                    [
                        {"id": "news_1", "source": "COINDESK", "title": "Federal Reserve unexpected rate hike announcement triggers market volatility", "market_impact": "HIGH_VOLATILITY", "published_at": "2026-09-16"},
                        {"id": "news_2", "source": "CRYPTOPANIC", "title": "Major liquidation cascade across derivatives exchanges", "market_impact": "HIGH_VOLATILITY", "published_at": "2026-09-16"},
                        {"id": "news_3", "source": "SEC", "title": "SEC issues sudden regulatory notice", "market_impact": "BEARISH", "published_at": "2026-09-16"}
                    ],
                    [],  # diagnostics
                    [{"rule_code": "RMS-CB-VOLATILITY", "title": "Circuit Breaker", "category": "CIRCUIT_BREAKER", "action_on_breach": "COOL_OFF"}]
                ]

                result = await self.guardrail.evaluate_guardrails(
                    symbol="BTC/USDT",
                    market="CRYPTO",
                    strategy_type="GRID",
                    exchange="BINANCE"
                )

                self.assertEqual(result["risk_level"], "HIGH")
                self.assertTrue("volatility" in str(result["warning_reason"]).lower() or "circuit breaker" in str(result["warning_reason"]).lower())
                self.assertIn(result["suggested_action"], ["WIDEN_GRID", "PAUSE_BOT"])

        asyncio.run(run_test())

    def test_diagnose_broker_error_lookup(self):
        async def run_test():
            service = RagService()
            with patch("src.core.db.db.fetchrow", new_callable=AsyncMock) as mock_fetchrow:
                mock_fetchrow.return_value = {
                    "broker_or_adapter": "ANGEL_ONE",
                    "error_code": "AB1004",
                    "error_name": "Invalid Session / JWT Token Expired",
                    "description": "Session token expired",
                    "root_cause": "Daily 24-hr token expiry",
                    "resolution_steps": "Call generateSession() with MPIN and TOTP",
                    "recovery_action": "REAUTHENTICATE",
                    "metadata": {"http_status": 401}
                }

                diagnosis = await service.diagnose_error(
                    broker_or_adapter="ANGEL_ONE",
                    error_code="AB1004"
                )

                self.assertTrue(diagnosis["found"])
                self.assertEqual(diagnosis["recovery_action"], "REAUTHENTICATE")
                self.assertEqual(diagnosis["error_code"], "AB1004")

        asyncio.run(run_test())

    def test_fastapi_endpoints(self):
        from starlette.testclient import TestClient
        from fastapi import FastAPI
        from src.rag.api import router as rag_router

        test_app = FastAPI()
        test_app.include_router(rag_router, prefix="/api/v1/rag")

        @test_app.get("/")
        def root():
            return {"endpoints": ["/api/v1/rag/query", "/api/v1/rag/guardrail-check", "/api/v1/rag/diagnose-error", "/api/v1/rag/collections"]}

        with TestClient(test_app) as client:
            # 1. Root discovery
            res_root = client.get("/")
            self.assertEqual(res_root.status_code, 200)
            self.assertIn("/api/v1/rag/query", res_root.json()["endpoints"])

            # 2. Collections endpoint
            with patch("src.rag.rag_service.rag_service.get_collections_overview", new_callable=AsyncMock) as mock_overview:
                mock_overview.return_value = {
                    "kb_strategy_playbooks": {"record_count": 5, "status": "ONLINE"}
                }
                res_col = client.get("/api/v1/rag/collections")
                self.assertEqual(res_col.status_code, 200)
                data = res_col.json()
                self.assertIn("available_collections", data)
                self.assertIn("kb_strategy_playbooks", data["available_collections"])

            # 3. Guardrail check endpoint
            with patch("src.rag.rag_service.rag_service.check_guardrails", new_callable=AsyncMock) as mock_guard:
                mock_guard.return_value = {
                    "safe_to_trade": True,
                    "risk_level": "LOW",
                    "warning_reason": None,
                    "suggested_action": "PROCEED",
                    "symbol": "BTC/USDT",
                    "market": "CRYPTO",
                    "strategy_type": "GRID",
                    "exchange": "BINANCE"
                }
                res_guard = client.post(
                    "/api/v1/rag/guardrail-check",
                    json={"symbol": "BTC/USDT", "market": "CRYPTO", "strategy_type": "GRID", "exchange": "BINANCE"}
                )
                self.assertEqual(res_guard.status_code, 200)
                self.assertTrue(res_guard.json()["safe_to_trade"])
                self.assertEqual(res_guard.json()["suggested_action"], "PROCEED")

            # 4. Diagnose error endpoint
            with patch("src.rag.rag_service.rag_service.diagnose_error", new_callable=AsyncMock) as mock_diag:
                mock_diag.return_value = {
                    "found": True,
                    "broker_or_adapter": "ANGEL_ONE",
                    "error_code": "AB1004",
                    "recovery_action": "REAUTHENTICATE"
                }
                res_diag = client.post(
                    "/api/v1/rag/diagnose-error",
                    json={"broker_or_adapter": "ANGEL_ONE", "error_code": "AB1004"}
                )
                self.assertEqual(res_diag.status_code, 200)
                self.assertEqual(res_diag.json()["recovery_action"], "REAUTHENTICATE")

            # 5. Query endpoint
            with patch("src.rag.rag_service.rag_service.execute_query", new_callable=AsyncMock) as mock_exec:
                mock_exec.return_value = {
                    "analysis": "Optimal Spot Grid Strategy with arithmetic 20 grids.",
                    "sentiment_score": 0.45,
                    "actionable_setup": {
                        "direction": "BUY",
                        "confidence": 0.85,
                        "recommended_strategy": "GRID",
                        "suggested_parameters": {"gridCount": 20}
                    },
                    "citations": []
                }
                res_query = client.post(
                    "/api/v1/rag/query",
                    json={"query": "Recommend strategy for BTC/USDT", "symbol": "BTC/USDT", "market": "CRYPTO"}
                )
                self.assertEqual(res_query.status_code, 200)
                self.assertEqual(res_query.json()["actionable_setup"]["direction"], "BUY")


if __name__ == "__main__":
    unittest.main()
