"""
Configuration Manager for AI-BDM ML & RAG Ingestion Pipeline
Loads settings from environment and .env files
"""
import os
from pathlib import Path
from typing import Optional, Dict, Any
from urllib.parse import urlparse, unquote
from pydantic import Field
from pydantic_settings import BaseSettings

# Locate backend root and backend/.env
CURRENT_DIR = Path(__file__).resolve().parent
ML_SERVICE_DIR = CURRENT_DIR.parent.parent
BACKEND_DIR = ML_SERVICE_DIR.parent
ENV_FILE = BACKEND_DIR / ".env" if (BACKEND_DIR / ".env").exists() else ML_SERVICE_DIR / ".env"

class Settings(BaseSettings):
    # Database Settings (MySQL)
    DATABASE_URL: str = Field(
        default="mysql://db-user:WElcome%40123@3.111.226.32:3306/trading_system",
        description="MySQL connection string"
    )
    MYSQL_DATABASE_URL: Optional[str] = Field(
        default=None,
        description="Optional alias for MySQL connection string"
    )
    DB_HOST: Optional[str] = Field(default=None, description="MySQL Host")
    DB_PORT: int = Field(default=3306, description="MySQL Port")
    DB_USER: Optional[str] = Field(default=None, description="MySQL User")
    DB_PASSWORD: Optional[str] = Field(default=None, description="MySQL Password")
    DB_NAME: Optional[str] = Field(default="trading_system", description="MySQL Database Name")
    
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
    def mysql_connection_params(self) -> Dict[str, Any]:
        """Returns MySQL connection parameters dict for aiomysql/pymysql"""
        if self.DB_HOST and self.DB_USER:
            return {
                "host": self.DB_HOST,
                "port": int(self.DB_PORT or 3306),
                "user": self.DB_USER,
                "password": self.DB_PASSWORD or "",
                "db": self.DB_NAME or "trading_system",
                "charset": "utf8mb4",
                "autocommit": True,
            }
        
        raw_url = self.MYSQL_DATABASE_URL or self.DATABASE_URL
        # Normalize protocol if needed
        if raw_url.startswith("mysql://"):
            parsed = urlparse(raw_url)
            return {
                "host": parsed.hostname or "localhost",
                "port": int(parsed.port or 3306),
                "user": unquote(parsed.username or "root"),
                "password": unquote(parsed.password or ""),
                "db": parsed.path.lstrip("/") or "trading_system",
                "charset": "utf8mb4",
                "autocommit": True,
            }
        return {
            "host": "localhost",
            "port": 3306,
            "user": "root",
            "password": "",
            "db": "trading_system",
            "charset": "utf8mb4",
            "autocommit": True,
        }

settings = Settings()
