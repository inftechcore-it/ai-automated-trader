"""
Configuration Manager for AI-BDM ML & RAG Ingestion Pipeline
Loads settings from environment and .env files
"""
import os
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings

# Locate backend root and backend/.env
CURRENT_DIR = Path(__file__).resolve().parent
ML_SERVICE_DIR = CURRENT_DIR.parent.parent
BACKEND_DIR = ML_SERVICE_DIR.parent
ENV_FILE = BACKEND_DIR / ".env" if (BACKEND_DIR / ".env").exists() else ML_SERVICE_DIR / ".env"

class Settings(BaseSettings):
    # Database Settings (PostgreSQL + pgvector)
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/trading_system?schema=public",
        description="PostgreSQL connection string with pgvector"
    )
    POSTGRES_URL: Optional[str] = Field(
        default=None,
        description="Optional alias for PostgreSQL connection string"
    )
    
    # Gemini AI Embeddings (text-embedding-004: 768 dimensions)
    GEMINI_API_KEY: str = Field(
        default="",
        description="Google Gemini API key for text-embedding-004"
    )
    EMBEDDING_MODEL: str = "models/text-embedding-004"
    EMBEDDING_DIMENSIONS: int = 768
    
    # Ingestion Chunking Configuration
    CHUNK_SIZE: int = 600       # Target characters/tokens per chunk
    CHUNK_OVERLAP: int = 100    # Overlap to preserve context across boundaries
    BATCH_SIZE: int = 20        # Vector upsert batch size
    
    # External Feed API Keys & Endpoints
    CRYPTOPANIC_API_KEY: str = Field(default="", description="CryptoPanic developer API key")
    BENZINGA_API_KEY: str = Field(default="", description="Benzinga developer API key")
    FMP_API_KEY: str = Field(default="", description="Financial Modeling Prep API key")
    ALPHA_VANTAGE_API_KEY: str = Field(default="", description="Alpha Vantage API key")
    
    # System Status & Announcement Endpoints
    BINANCE_STATUS_API: str = "https://api.binance.com/sapi/v1/system/status"
    BYBIT_STATUS_API: str = "https://api.bybit.com/v5/market/system-status"
    
    # RSS Feed URLs
    COINDESK_RSS_URL: str = "https://www.coindesk.com/arc/outboundfeeds/rss/"
    MONEYCONTROL_RSS_URL: str = "https://www.moneycontrol.com/rss/MCtopnews.xml"
    MONEYCONTROL_MARKETS_RSS: str = "https://www.moneycontrol.com/rss/marketreports.xml"
    SEBI_PRESS_RSS_URL: str = "https://www.sebi.gov.in/sebirss.xml"
    SEC_EDGAR_RSS_URL: str = "https://www.sec.gov/Archives/edgar/usgaap.rss.xml"
    FOREX_FACTORY_CALENDAR_RSS: str = "https://www.forexfactory.com/news/rss"
    TRADING_ECONOMICS_RSS: str = "https://tradingeconomics.com/rss/news.aspx"
    
    # Ingestion Intervals (in seconds)
    CRYPTO_INGEST_INTERVAL: int = 300     # 5 minutes
    INDIAN_MARKETS_INTERVAL: int = 600    # 10 minutes
    US_EQUITY_INTERVAL: int = 600         # 10 minutes
    MACRO_CALENDAR_INTERVAL: int = 1800   # 30 minutes

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def postgres_connection_url(self) -> str:
        """Returns the active PostgreSQL connection URL"""
        return self.POSTGRES_URL or self.DATABASE_URL

settings = Settings()
