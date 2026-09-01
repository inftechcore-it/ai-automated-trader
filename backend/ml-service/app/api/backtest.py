"""
Backtesting API endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.services.backtester import BacktestService
from app.services.data_fetcher import DataFetcher

router = APIRouter()
backtester = BacktestService()
data_fetcher = DataFetcher()


class BacktestRequest(BaseModel):
    symbol: str
    start_date: str
    end_date: str
    initial_capital: float = 10000
    strategy: str = "pattern_based"  # pattern_based, ml_signals, combined


class BacktestResponse(BaseModel):
    symbol: str
    strategy: str
    period: dict
    performance: dict
    trades: List[dict]
    equity_curve: List[dict]


@router.post("/run")
async def run_backtest(request: BacktestRequest) -> BacktestResponse:
    """
    Run a backtest on historical data
    """
    try:
        # Fetch historical data
        ohlcv = await data_fetcher.fetch_historical(
            request.symbol,
            request.start_date,
            request.end_date,
            timeframe="1h"
        )

        if ohlcv is None or len(ohlcv) < 100:
            raise HTTPException(status_code=400, detail="Insufficient historical data")

        # Run backtest
        result = backtester.run(
            ohlcv=ohlcv,
            strategy=request.strategy,
            initial_capital=request.initial_capital
        )

        return BacktestResponse(
            symbol=request.symbol,
            strategy=request.strategy,
            period={
                "start": request.start_date,
                "end": request.end_date,
                "candles": len(ohlcv)
            },
            performance=result["performance"],
            trades=result["trades"][-50:],  # Last 50 trades
            equity_curve=result["equity_curve"]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quick/{symbol}")
async def quick_backtest(
    symbol: str,
    days: int = Query(default=30, ge=7, le=365),
    exchange: str = Query(default="binance")
):
    """
    Quick backtest on recent data
    """
    try:
        ohlcv = await data_fetcher.fetch_ohlcv(symbol, "1h", exchange, limit=days * 24)

        if ohlcv is None or len(ohlcv) < 100:
            raise HTTPException(status_code=400, detail="Insufficient data")

        result = backtester.run(ohlcv, strategy="pattern_based", initial_capital=10000)

        return {
            "symbol": symbol,
            "days": days,
            "total_return": result["performance"]["total_return_pct"],
            "win_rate": result["performance"]["win_rate"],
            "total_trades": result["performance"]["total_trades"],
            "max_drawdown": result["performance"]["max_drawdown_pct"],
            "sharpe_ratio": result["performance"].get("sharpe_ratio", 0)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
