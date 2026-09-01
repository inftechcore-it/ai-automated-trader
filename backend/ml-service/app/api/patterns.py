"""
Pattern Detection API endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.services.pattern_detector import PatternDetector
from app.services.data_fetcher import DataFetcher

router = APIRouter()
detector = PatternDetector()
data_fetcher = DataFetcher()


class PatternResult(BaseModel):
    name: str
    type: str  # bullish, bearish, neutral
    strength: int  # -100 to 100
    description: str
    candle_index: int


class PatternResponse(BaseModel):
    symbol: str
    timeframe: str
    patterns: List[PatternResult]
    chart_patterns: List[dict]
    summary: dict
    timestamp: str


@router.get("/{symbol}")
async def detect_patterns(
    symbol: str,
    timeframe: str = Query(default="1h"),
    exchange: str = Query(default="binance"),
    lookback: int = Query(default=100, ge=20, le=500)
) -> PatternResponse:
    """
    Detect candlestick and chart patterns for a symbol
    """
    try:
        ohlcv = await data_fetcher.fetch_ohlcv(symbol, timeframe, exchange, limit=lookback)

        if ohlcv is None or len(ohlcv) < 20:
            raise HTTPException(status_code=400, detail=f"Insufficient data for {symbol}")

        # Detect candlestick patterns (TA-Lib)
        candlestick_patterns = detector.detect_candlestick_patterns(ohlcv)

        # Detect chart patterns (Head & Shoulders, Triangles, etc.)
        chart_patterns = detector.detect_chart_patterns(ohlcv)

        # Summary
        bullish = sum(1 for p in candlestick_patterns if p["strength"] > 0)
        bearish = sum(1 for p in candlestick_patterns if p["strength"] < 0)

        return PatternResponse(
            symbol=symbol,
            timeframe=timeframe,
            patterns=[PatternResult(**p) for p in candlestick_patterns],
            chart_patterns=chart_patterns,
            summary={
                "total_patterns": len(candlestick_patterns),
                "bullish_count": bullish,
                "bearish_count": bearish,
                "bias": "bullish" if bullish > bearish else "bearish" if bearish > bullish else "neutral",
                "chart_patterns_count": len(chart_patterns)
            },
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scan/market")
async def scan_market_patterns(
    exchange: str = Query(default="binance"),
    timeframe: str = Query(default="1h"),
    min_strength: int = Query(default=50, ge=0, le=100)
):
    """
    Scan top trading pairs for significant patterns
    """
    top_symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT",
                   "DOGE/USDT", "AVAX/USDT", "LINK/USDT", "DOT/USDT", "MATIC/USDT"]

    results = []
    for symbol in top_symbols:
        try:
            ohlcv = await data_fetcher.fetch_ohlcv(symbol, timeframe, exchange, limit=100)
            if ohlcv is not None and len(ohlcv) >= 20:
                patterns = detector.detect_candlestick_patterns(ohlcv)
                significant = [p for p in patterns if abs(p["strength"]) >= min_strength]
                if significant:
                    results.append({
                        "symbol": symbol,
                        "patterns": significant,
                        "count": len(significant)
                    })
        except Exception:
            continue

    return {"scan_results": results, "symbols_scanned": len(top_symbols)}
