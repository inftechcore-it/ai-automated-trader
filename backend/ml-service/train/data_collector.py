"""
Data Collector - Fetches historical OHLCV data for training
Uses multiple sources with fallbacks
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data" / "raw"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Try yfinance first (more reliable)
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

# CCXT as backup
try:
    import ccxt
    CCXT_AVAILABLE = True
except ImportError:
    CCXT_AVAILABLE = False


# Symbol mapping for yfinance
YFINANCE_SYMBOLS = {
    "BTC/USDT": "BTC-USD",
    "ETH/USDT": "ETH-USD",
    "SOL/USDT": "SOL-USD",
    "XRP/USDT": "XRP-USD",
    "ADA/USDT": "ADA-USD",
    "DOGE/USDT": "DOGE-USD",
    "AVAX/USDT": "AVAX-USD",
    "LINK/USDT": "LINK-USD",
    "DOT/USDT": "DOT-USD",
    "MATIC/USDT": "MATIC-USD",
    "BNB/USDT": "BNB-USD",
    "LTC/USDT": "LTC-USD",
}


def fetch_with_yfinance(symbol: str, days: int = 180, interval: str = "1h") -> pd.DataFrame:
    """Fetch data using yfinance"""
    if not YFINANCE_AVAILABLE:
        return pd.DataFrame()

    yf_symbol = YFINANCE_SYMBOLS.get(symbol, symbol.replace("/", "-"))

    logger.info(f"Fetching {yf_symbol} from Yahoo Finance...")

    try:
        ticker = yf.Ticker(yf_symbol)

        # yfinance interval mapping
        if interval == "1h":
            # Yahoo limits 1h data to ~730 days max, fetch in chunks
            period = f"{min(days, 729)}d"
            df = ticker.history(period=period, interval="1h")
        elif interval == "1d":
            df = ticker.history(period=f"{days}d", interval="1d")
        else:
            df = ticker.history(period=f"{days}d", interval=interval)

        if df.empty:
            return pd.DataFrame()

        # Standardize column names
        df = df.rename(columns={
            'Open': 'open',
            'High': 'high',
            'Low': 'low',
            'Close': 'close',
            'Volume': 'volume'
        })

        df = df[['open', 'high', 'low', 'close', 'volume']]
        df.index.name = 'timestamp'

        logger.info(f"Fetched {len(df)} candles from Yahoo Finance")
        return df

    except Exception as e:
        logger.error(f"yfinance error: {e}")
        return pd.DataFrame()


def fetch_with_ccxt(symbol: str, exchange_id: str = "binance", timeframe: str = "1h", days: int = 180) -> pd.DataFrame:
    """Fetch data using CCXT"""
    if not CCXT_AVAILABLE:
        return pd.DataFrame()

    try:
        exchange_class = getattr(ccxt, exchange_id)
        exchange = exchange_class({
            'enableRateLimit': True,
            'timeout': 30000
        })

        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)

        all_ohlcv = []
        current_ts = int(start_time.timestamp() * 1000)
        end_ts = int(end_time.timestamp() * 1000)

        logger.info(f"Fetching {symbol} from {exchange_id}...")

        while current_ts < end_ts:
            try:
                ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=current_ts, limit=1000)
                if not ohlcv:
                    break
                all_ohlcv.extend(ohlcv)
                current_ts = ohlcv[-1][0] + 1

                if len(ohlcv) < 1000:
                    break

                time.sleep(exchange.rateLimit / 1000)

            except Exception as e:
                logger.warning(f"CCXT fetch error: {e}")
                break

        if not all_ohlcv:
            return pd.DataFrame()

        df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df = df.drop_duplicates(subset=['timestamp'])
        df.set_index('timestamp', inplace=True)
        df = df.sort_index()

        logger.info(f"Fetched {len(df)} candles from {exchange_id}")
        return df

    except Exception as e:
        logger.error(f"CCXT error: {e}")
        return pd.DataFrame()


def fetch_historical_data(
    symbol: str = "BTC/USDT",
    exchange_id: str = "binance",
    timeframe: str = "1h",
    days: int = 180
) -> pd.DataFrame:
    """Fetch historical OHLCV data with fallbacks"""

    # Check cache first
    safe_name = symbol.replace("/", "_")
    cache_path = DATA_DIR / f"{safe_name}_{timeframe}_{days}d.csv"

    if cache_path.exists():
        cache_age = datetime.now() - datetime.fromtimestamp(cache_path.stat().st_mtime)
        if cache_age.days < 1:  # Use cache if less than 1 day old
            logger.info(f"Using cached data for {symbol}")
            df = pd.read_csv(cache_path, index_col='timestamp', parse_dates=True)
            return df

    # Try yfinance first (more reliable, no API key needed)
    df = fetch_with_yfinance(symbol, days, timeframe)

    # Fallback to CCXT
    if df.empty:
        df = fetch_with_ccxt(symbol, exchange_id, timeframe, days)

    # Save to cache
    if not df.empty:
        df.to_csv(cache_path)
        logger.info(f"Saved to cache: {cache_path}")

    return df


def fetch_multiple_symbols(
    symbols: list = None,
    timeframe: str = "1h",
    days: int = 180
) -> dict:
    """Fetch data for multiple symbols"""

    if symbols is None:
        symbols = list(YFINANCE_SYMBOLS.keys())[:5]

    all_data = {}

    for symbol in symbols:
        try:
            df = fetch_historical_data(symbol, timeframe=timeframe, days=days)
            if not df.empty:
                all_data[symbol] = df
        except Exception as e:
            logger.error(f"Failed to fetch {symbol}: {e}")

        time.sleep(1)

    return all_data


def generate_synthetic_data(symbol: str = "SYN/USDT", days: int = 180) -> pd.DataFrame:
    """Generate synthetic data for testing when APIs fail"""

    logger.info(f"Generating synthetic data for {symbol}...")

    n_candles = days * 24  # Hourly candles
    dates = pd.date_range(end=datetime.now(), periods=n_candles, freq='h')

    # Generate realistic price movement
    np.random.seed(42)

    # Start price
    price = 50000 if 'BTC' in symbol else 3000 if 'ETH' in symbol else 100

    prices = [price]
    for i in range(1, n_candles):
        # Random walk with trend and mean reversion
        change = np.random.normal(0, 0.002) + 0.00001  # Slight upward bias
        mean_revert = (prices[0] - prices[-1]) / prices[0] * 0.001
        new_price = prices[-1] * (1 + change + mean_revert)
        prices.append(max(new_price, prices[-1] * 0.9))  # Prevent unrealistic drops

    prices = np.array(prices)

    # Generate OHLCV
    df = pd.DataFrame({
        'open': prices * (1 + np.random.uniform(-0.002, 0.002, n_candles)),
        'high': prices * (1 + np.random.uniform(0, 0.01, n_candles)),
        'low': prices * (1 - np.random.uniform(0, 0.01, n_candles)),
        'close': prices,
        'volume': np.random.uniform(100, 10000, n_candles) * prices / 1000
    }, index=dates)

    df.index.name = 'timestamp'

    logger.info(f"Generated {len(df)} synthetic candles")
    return df


if __name__ == "__main__":
    # Install yfinance if needed
    import subprocess
    subprocess.run(["pip", "install", "yfinance", "-q"], capture_output=True)

    # Test fetch
    df = fetch_historical_data("BTC/USDT", days=30)
    if df.empty:
        df = generate_synthetic_data("BTC/USDT", days=30)

    print(f"Data shape: {df.shape}")
    print(df.tail())
