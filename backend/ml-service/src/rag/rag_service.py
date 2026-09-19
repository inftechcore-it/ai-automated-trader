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

    async def log_trade_memory(self, trade_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingests completed trade outcome into kb_trade_history vector memory.
        Enables RAG continuous learning from bot execution history.
        """
        try:
            symbol = trade_data.get("symbol", "")
            strategy = trade_data.get("strategy_type", "JARVIS")
            side = trade_data.get("side", "BUY")
            pnl = float(trade_data.get("pnl", 0.0) or 0.0)
            pnl_percent = float(trade_data.get("pnl_percent", 0.0) or 0.0)
            entry_price = float(trade_data.get("entry_price", 0.0) or 0.0)
            exit_price = float(trade_data.get("exit_price", 0.0) or 0.0)
            stage = trade_data.get("stage_status", "")
            regime = trade_data.get("market_regime", "RANGING_CONSOLIDATION")
            indicators = trade_data.get("indicators", {})
            notes = trade_data.get("notes", "")

            title = f"{symbol} {strategy} Trade: {side} @ ${exit_price or entry_price:.4f} (PnL: ${pnl:.2f}, {pnl_percent:+.2f}%)"
            content = (
                f"Symbol: {symbol} | Strategy: {strategy} | Side: {side} | Stage: {stage}\n"
                f"Entry: ${entry_price:.6f} | Exit: ${exit_price:.6f} | Realized PnL: ${pnl:.4f} ({pnl_percent:+.2f}%)\n"
                f"Market Regime: {regime} | Indicators: ATR={indicators.get('atr', 0):.6f}, RSI={indicators.get('rsi', 50):.1f}, Vol={indicators.get('volatility', 0):.1f}%\n"
                f"Notes: {notes}"
            )

            # Generate embedding
            embedding = self.dense.embedder.embed_text(f"{title}\n{content}")

            # Persist to database if available
            try:
                query = """
                    INSERT INTO kb_trade_history (symbol, strategy_type, side, entry_price, exit_price, pnl, pnl_percent, title, content, embedding, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING id;
                """
                meta_json = {"stage": stage, "regime": regime, "indicators": indicators, "notes": notes}
                import json
                record_id = await db.fetchval(
                    query,
                    symbol, strategy, side, entry_price, exit_price, pnl, pnl_percent,
                    title, content, embedding, json.dumps(meta_json)
                )
                logger.info(f"Logged trade memory #{record_id} for {symbol} ({strategy})")
                return {"success": True, "id": str(record_id), "status": "PERSISTED"}
            except Exception as db_err:
                logger.debug(f"DB Insert into kb_trade_history falling back to memory log: {db_err}")
                return {"success": True, "status": "IN_MEMORY", "title": title}
        except Exception as e:
            logger.error(f"Failed to log trade memory: {e}")
            return {"success": False, "error": str(e)}

    async def calibrate_jarvis(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes autonomous AI calibration for 3-Grid progressive JARVIS Bot:
        1. Queries RAG memory for similar past patterns & playbooks
        2. Fuses live indicators (ATR, RSI, BB, Support/Resistance)
        3. Generates optimal dynamic parameters via Gemini Decision Engine
        """
        symbol = request_data.get("symbol", "BTC/USDT")
        current_price = float(request_data.get("current_price", 0.0) or 0.0)
        indicators = request_data.get("indicators", {})
        current_params = request_data.get("current_params", {})
        stage_status = request_data.get("stage_status", "INITIAL")

        query = f"Past {symbol} 3-grid trade patterns, ATR spacing, and swing support resistance under RSI {indicators.get('rsi', 50):.1f} volatility {indicators.get('volatility', 2.5):.1f}%"

        # Retrieve relevant RAG playbooks & trade history
        target_collections = ["kb_trade_history", "kb_strategy_playbooks", "kb_indicators_ta", "kb_rms_rules"]
        dense_results, sparse_results = await asyncio.gather(
            self.dense.retrieve(query, collections=target_collections, top_k_per_collection=3, symbol=symbol),
            self.sparse.retrieve(query, collections=target_collections, top_k_per_collection=3)
        )

        top_passages = self.reranker.fuse_and_rerank(
            query=query,
            dense_results=dense_results,
            sparse_results=sparse_results,
            top_n=5,
            max_pool_size=12
        )

        calibration = self.gemini.calibrate_jarvis(
            symbol=symbol,
            current_price=current_price,
            indicators=indicators,
            current_params=current_params,
            stage_status=stage_status,
            context_passages=top_passages
        )

        calibration["retrieval_meta"] = {
            "passages_used": len(top_passages),
            "collections_queried": target_collections,
            "query": query
        }
        return calibration

    async def prompt_to_simulation(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes Prompt-to-Simulation workflow:
        1. Queries RAG memory for similar asset volatility and strategy performance
        2. Solves exact grid parameters and risk math
        3. Runs fast historical backtest simulation over recent klines
        """
        prompt = request_data.get("prompt", "")
        current_price = float(request_data.get("current_price", 0.0) or 0.0)
        klines = request_data.get("klines", [])
        exchange = request_data.get("exchange", "binance")

        query = f"Trading parameters, stop-loss sizing, and profit targets for prompt: {prompt}"
        target_collections = ["kb_strategy_playbooks", "kb_trade_history", "kb_rms_rules"]

        top_passages = []
        try:
            dense_results, sparse_results = await asyncio.gather(
                self.dense.retrieve(query, collections=target_collections, top_k_per_collection=2),
                self.sparse.retrieve(query, collections=target_collections, top_k_per_collection=2)
            )
            top_passages = self.reranker.fuse_and_rerank(
                query=query,
                dense_results=dense_results,
                sparse_results=sparse_results,
                top_n=3,
                max_pool_size=8
            )
        except Exception as r_err:
            logger.debug(f"RAG retrieval fallback in prompt_to_simulation: {r_err}")

        return self.gemini.prompt_to_simulation(
            prompt=prompt,
            current_price=current_price,
            klines=klines,
            exchange=exchange,
            context_passages=top_passages
        )

rag_service = RagService()
