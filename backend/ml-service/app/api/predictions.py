"""
Prediction API endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.services.predictor import PredictionService
from app.services.data_fetcher import DataFetcher

router = APIRouter()
predictor = PredictionService()
data_fetcher = DataFetcher()


class PredictionResponse(BaseModel):
    symbol: str
    timeframe: str
    signal: str  # BUY, SELL, HOLD
    confidence: float
    price_target: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    indicators: dict
    patterns_detected: List[str]
    reasoning: str
    timestamp: str


@router.get("/{symbol}")
async def get_prediction(
    symbol: str,
    timeframe: str = Query(default="1h", regex="^(1m|5m|15m|1h|4h|1d)$"),
    exchange: str = Query(default="binance")
) -> PredictionResponse:
    """
    Get ML-powered prediction for a symbol
    """
    try:
        # Fetch OHLCV data
        ohlcv = await data_fetcher.fetch_ohlcv(symbol, timeframe, exchange, limit=200)

        if ohlcv is None or len(ohlcv) < 50:
            raise HTTPException(status_code=400, detail=f"Insufficient data for {symbol}")

        # Run prediction
        result = await predictor.predict(symbol, ohlcv, timeframe)

        return PredictionResponse(
            symbol=symbol,
            timeframe=timeframe,
            signal=result["signal"],
            confidence=result["confidence"],
            price_target=result.get("price_target"),
            stop_loss=result.get("stop_loss"),
            take_profit=result.get("take_profit"),
            indicators=result["indicators"],
            patterns_detected=result["patterns"],
            reasoning=result["reasoning"],
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/multi/{symbols}")
async def get_multi_prediction(
    symbols: str,
    timeframe: str = Query(default="1h"),
    exchange: str = Query(default="binance")
):
    """
    Get predictions for multiple symbols (comma-separated)
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",")]
    results = []

    for symbol in symbol_list[:10]:  # Limit to 10 symbols
        try:
            ohlcv = await data_fetcher.fetch_ohlcv(symbol, timeframe, exchange, limit=200)
            if ohlcv is not None and len(ohlcv) >= 50:
                result = await predictor.predict(symbol, ohlcv, timeframe)
                results.append({
                    "symbol": symbol,
                    "signal": result["signal"],
                    "confidence": result["confidence"],
                    "patterns": result["patterns"]
                })
        except Exception:
            continue

    return {"predictions": results, "count": len(results)}
