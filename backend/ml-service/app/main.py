"""
ML Prediction Service - FastAPI Application
Provides chart pattern detection, technical analysis, and price predictions
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.api import predictions, patterns, backtest, health
from app.services.model_manager import ModelManager
from src.rag.api import router as rag_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

model_manager = ModelManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading ML models & initializing RAG engine...")
    await model_manager.load_models()
    yield
    logger.info("Shutting down ML service...")

app = FastAPI(
    title="AI-BDM Prediction & RAG Intelligence Service",
    description="ML-powered chart pattern detection, price prediction, and RAG multi-asset trading engine",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(predictions.router, prefix="/predict", tags=["Predictions"])
app.include_router(patterns.router, prefix="/patterns", tags=["Patterns"])
app.include_router(backtest.router, prefix="/backtest", tags=["Backtest"])
app.include_router(rag_router, prefix="/api/v1/rag", tags=["RAG Intelligence & Guardrails"])
app.include_router(rag_router, prefix="/rag", tags=["RAG Intelligence & Guardrails (Short URL)"])

@app.get("/")
async def root():
    return {
        "service": "AI-BDM ML Prediction & RAG Intelligence Service",
        "version": "1.0.0",
        "endpoints": [
            "/predict",
            "/patterns",
            "/backtest",
            "/health",
            "/api/v1/rag/query",
            "/api/v1/rag/guardrail-check",
            "/api/v1/rag/diagnose-error",
            "/api/v1/rag/collections"
        ]
    }

