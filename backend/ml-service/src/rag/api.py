"""
FastAPI Router for RAG Intelligence & Guardrails API
Exposes /query, /guardrail-check, /diagnose-error, and /collections endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging

from src.rag.rag_service import rag_service
from src.rag.dense_retriever import ALL_KB_COLLECTIONS

logger = logging.getLogger("rag.api")

router = APIRouter(prefix="", tags=["RAG Intelligence & Guardrails"])

# ═══════════════════════════════════════════════════════════════════
# REQUEST & RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════

class RagQueryRequest(BaseModel):
    query: str = Field(..., description="The trader or bot reasoning query", min_length=2)
    collections: Optional[List[str]] = Field(
        default=None,
        description="Target KB collections. Defaults to all 8 collections + external news if omitted."
    )
    symbol: Optional[str] = Field(None, description="Asset symbol (e.g. BTC/USDT, RELIANCE, SOL, AAPL)")
    market: Optional[str] = Field(None, description="Market segment: CRYPTO | INDIA | US | DEX")
    top_k: int = Field(default=5, ge=1, le=15, description="Number of context passages to synthesize")

class GuardrailCheckRequest(BaseModel):
    symbol: str = Field(..., description="Target symbol being evaluated")
    market: str = Field(..., description="Target market: CRYPTO | INDIA | US | DEX")
    strategy_type: str = Field(..., description="Bot strategy: GRID | INFINITY_GRID | DCA | MARTINGALE | ARBITRAGE")
    exchange: str = Field(..., description="Exchange adapter: BINANCE | ANGEL_ONE | UPSTOX | JUPITER_DEX | ALPACA")

class DiagnoseErrorRequest(BaseModel):
    broker_or_adapter: str = Field(..., description="ANGEL_ONE | UPSTOX | BINANCE | BYBIT | JUPITER_DEX | ALPACA")
    error_code: str = Field(..., description="Error code e.g. AB1004, 0x1771, -1013, 40310000")
    raw_message: Optional[str] = Field(None, description="Raw error text or exception message")

# ═══════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.post("/query")
async def rag_query(request: RagQueryRequest):
    """
    POST /api/v1/rag/query
    Retrieves top-15 relevant chunks from Dense (pgvector) and Sparse (BM25) search,
    reranks down to top-5 most relevant passages, and synthesizes structured trading guidance using Gemini.
    """
    try:
        response = await rag_service.execute_query(
            query=request.query,
            collections=request.collections,
            symbol=request.symbol,
            market=request.market,
            top_k=request.top_k
        )
        return response
    except Exception as e:
        logger.error(f"RAG query endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")

@router.post("/guardrail-check")
async def rag_guardrail_check(request: GuardrailCheckRequest):
    """
    POST /api/v1/rag/guardrail-check
    Pre-trade safety validation: checks news (last 2h), upcoming macro events (next 1h),
    and cross-references kb_rms_rules & broker diagnostics before dispatching orders.
    """
    try:
        result = await rag_service.check_guardrails(
            symbol=request.symbol,
            market=request.market,
            strategy_type=request.strategy_type,
            exchange=request.exchange
        )
        return result
    except Exception as e:
        logger.error(f"RAG guardrail endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Guardrail check failed: {str(e)}")

@router.post("/diagnose-error")
async def rag_diagnose_error(request: DiagnoseErrorRequest):
    """
    POST /api/v1/rag/diagnose-error
    Queries kb_broker_diagnostics to return root cause, human-readable explanation,
    and automatic recovery action (REAUTHENTICATE, RETRY, ADJUST_PARAM, PAUSE_BOT).
    """
    try:
        result = await rag_service.diagnose_error(
            broker_or_adapter=request.broker_or_adapter,
            error_code=request.error_code,
            raw_message=request.raw_message
        )
        return result
    except Exception as e:
        logger.error(f"Error diagnosis endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Broker diagnostic lookup failed: {str(e)}")

@router.get("/collections")
async def list_collections():
    """
    GET /api/v1/rag/collections
    Returns list of all available Knowledge Base collections and record counts.
    """
    try:
        overview = await rag_service.get_collections_overview()
        return {
            "available_collections": ALL_KB_COLLECTIONS,
            "status": overview
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
