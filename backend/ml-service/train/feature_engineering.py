"""
Feature Engineering - Extract technical indicators and patterns
"""
import pandas as pd
import numpy as np
from typing import Tuple
import logging

logger = logging.getLogger(__name__)

# Try TA-Lib, fallback to manual calculations
try:
    import talib
    TALIB_AVAILABLE = True
except ImportError:
    TALIB_AVAILABLE = False
    logger.warning("TA-Lib not available, using manual calculations")


def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add technical indicators as features"""

    df = df.copy()
    close = df['close']
    high = df['high']
    low = df['low']
    volume = df['volume']

    # Price-based features
    df['returns'] = close.pct_change()
    df['log_returns'] = np.log(close / close.shift(1))

    # Moving Averages
    for period in [5, 10, 20, 50, 100, 200]:
        df[f'sma_{period}'] = close.rolling(period).mean()
        df[f'ema_{period}'] = close.ewm(span=period).mean()

    # Price relative to MAs
    df['price_sma20_ratio'] = close / df['sma_20']
    df['price_sma50_ratio'] = close / df['sma_50']
    df['sma20_sma50_ratio'] = df['sma_20'] / df['sma_50']

    # RSI
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    df['rsi_oversold'] = (df['rsi'] < 30).astype(int)
    df['rsi_overbought'] = (df['rsi'] > 70).astype(int)

    # MACD
    ema12 = close.ewm(span=12).mean()
    ema26 = close.ewm(span=26).mean()
    df['macd'] = ema12 - ema26
    df['macd_signal'] = df['macd'].ewm(span=9).mean()
    df['macd_histogram'] = df['macd'] - df['macd_signal']
    df['macd_crossover'] = (df['macd'] > df['macd_signal']).astype(int)

    # Bollinger Bands
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    df['bb_upper'] = sma20 + (std20 * 2)
    df['bb_lower'] = sma20 - (std20 * 2)
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / sma20
    df['bb_position'] = (close - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

    # ATR (Average True Range)
    tr = pd.concat([
        high - low,
        abs(high - close.shift()),
        abs(low - close.shift())
    ], axis=1).max(axis=1)
    df['atr'] = tr.rolling(14).mean()
    df['atr_percent'] = df['atr'] / close * 100

    # Volatility
    df['volatility_20'] = close.rolling(20).std() / close.rolling(20).mean() * 100

    # Volume features
    df['volume_sma'] = volume.rolling(20).mean()
    df['volume_ratio'] = volume / df['volume_sma']
    df['volume_trend'] = volume.rolling(5).mean() / volume.rolling(20).mean()

    # Momentum
    df['momentum_10'] = close / close.shift(10) - 1
    df['momentum_20'] = close / close.shift(20) - 1

    # Stochastic
    low_14 = low.rolling(14).min()
    high_14 = high.rolling(14).max()
    df['stoch_k'] = 100 * (close - low_14) / (high_14 - low_14)
    df['stoch_d'] = df['stoch_k'].rolling(3).mean()

    # Williams %R
    df['williams_r'] = -100 * (high_14 - close) / (high_14 - low_14)

    # CCI (Commodity Channel Index)
    typical_price = (high + low + close) / 3
    tp_sma = typical_price.rolling(20).mean()
    tp_mad = typical_price.rolling(20).apply(lambda x: np.abs(x - x.mean()).mean())
    df['cci'] = (typical_price - tp_sma) / (0.015 * tp_mad)

    # ADX (simplified)
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)

    atr14 = tr.rolling(14).mean()
    plus_di = 100 * (plus_dm.rolling(14).mean() / atr14)
    minus_di = 100 * (minus_dm.rolling(14).mean() / atr14)
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
    df['adx'] = dx.rolling(14).mean()

    # OBV (On Balance Volume)
    obv = (np.sign(close.diff()) * volume).cumsum()
    df['obv'] = obv
    df['obv_sma'] = obv.rolling(20).mean()

    # Price patterns (simplified)
    df['higher_high'] = (high > high.shift(1)).astype(int)
    df['lower_low'] = (low < low.shift(1)).astype(int)
    df['higher_close'] = (close > close.shift(1)).astype(int)

    # Trend strength
    df['trend_strength'] = abs(df['sma_20'] - df['sma_50']) / df['sma_50'] * 100

    return df


def add_candlestick_patterns(df: pd.DataFrame) -> pd.DataFrame:
    """Add candlestick pattern features using TA-Lib or manual detection"""

    df = df.copy()
    o = df['open'].values
    h = df['high'].values
    l = df['low'].values
    c = df['close'].values

    if TALIB_AVAILABLE:
        # Use TA-Lib for pattern detection
        patterns = [
            'CDLDOJI', 'CDLHAMMER', 'CDLENGULFING', 'CDLMORNINGSTAR',
            'CDLEVENINGSTAR', 'CDLSHOOTINGSTAR', 'CDLHARAMI', 'CDLPIERCING',
            'CDLDARKCLOUDCOVER', 'CDL3WHITESOLDIERS', 'CDL3BLACKCROWS',
            'CDLINVERTEDHAMMER', 'CDLHANGINGMAN', 'CDLSPINNINGTOP'
        ]

        for pattern in patterns:
            try:
                func = getattr(talib, pattern)
                result = func(o, h, l, c)
                df[pattern.lower()] = result / 100  # Normalize to -1, 0, 1
            except Exception:
                df[pattern.lower()] = 0
    else:
        # Manual pattern detection
        body = c - o
        body_abs = np.abs(body)
        upper_shadow = h - np.maximum(o, c)
        lower_shadow = np.minimum(o, c) - l
        total_range = h - l

        # Doji
        df['cdldoji'] = np.where(
            (total_range > 0) & (body_abs / total_range < 0.1), 1, 0
        )

        # Hammer
        df['cdlhammer'] = np.where(
            (lower_shadow > body_abs * 2) & (upper_shadow < body_abs * 0.5) & (body > 0),
            1, 0
        )

        # Shooting star
        df['cdlshootingstar'] = np.where(
            (upper_shadow > body_abs * 2) & (lower_shadow < body_abs * 0.5) & (body < 0),
            -1, 0
        )

        # Engulfing (simplified)
        prev_body = np.roll(body, 1)
        df['cdlengulfing'] = np.where(
            (prev_body < 0) & (body > 0) & (body_abs > np.abs(prev_body)),
            1,
            np.where(
                (prev_body > 0) & (body < 0) & (body_abs > np.abs(prev_body)),
                -1, 0
            )
        )

    # Aggregate pattern signals
    pattern_cols = [col for col in df.columns if col.startswith('cdl')]
    if pattern_cols:
        df['bullish_patterns'] = df[pattern_cols].apply(lambda x: (x > 0).sum(), axis=1)
        df['bearish_patterns'] = df[pattern_cols].apply(lambda x: (x < 0).sum(), axis=1)
        df['pattern_signal'] = df['bullish_patterns'] - df['bearish_patterns']

    return df


def create_labels(df: pd.DataFrame, lookahead: int = 5, threshold: float = 0.01) -> pd.DataFrame:
    """Create target labels based on future price movement"""

    df = df.copy()

    # Future returns
    df['future_return'] = df['close'].shift(-lookahead) / df['close'] - 1

    # Classification labels (BUY=1, SELL=-1, HOLD=0)
    df['label'] = np.where(
        df['future_return'] > threshold, 1,  # BUY
        np.where(df['future_return'] < -threshold, -1, 0)  # SELL or HOLD
    )

    # Multi-class labels for classification
    df['label_class'] = df['label'].map({1: 'BUY', -1: 'SELL', 0: 'HOLD'})

    return df


def prepare_features(df: pd.DataFrame, lookahead: int = 5) -> Tuple[pd.DataFrame, pd.Series]:
    """Full feature preparation pipeline"""

    # Add all features
    df = add_technical_indicators(df)
    df = add_candlestick_patterns(df)
    df = create_labels(df, lookahead=lookahead)

    # Drop rows with NaN
    df = df.dropna()

    # Feature columns (exclude target and price columns)
    exclude_cols = ['label', 'label_class', 'future_return', 'open', 'high', 'low', 'close', 'volume']
    feature_cols = [col for col in df.columns if col not in exclude_cols]

    X = df[feature_cols]
    y = df['label']

    return X, y, df


if __name__ == "__main__":
    # Test
    from data_collector import fetch_historical_data

    df = fetch_historical_data("BTC/USDT", days=30)
    X, y, full_df = prepare_features(df)

    print(f"Features: {X.shape}")
    print(f"Labels distribution:\n{y.value_counts()}")
    print(f"\nFeature columns:\n{list(X.columns)}")
