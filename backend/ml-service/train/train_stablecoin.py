"""
Stablecoin Arbitrage Model Training
Predicts spread opportunities between exchanges for USDT/USD pairs
"""
import pandas as pd
import numpy as np
from pathlib import Path
import joblib
import json
from datetime import datetime
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, r2_score
import logging

try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

from data_collector import fetch_historical_data

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent / "data" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def create_spread_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create features for spread prediction"""
    df = df.copy()
    close = df['close']
    high = df['high']
    low = df['low']
    volume = df['volume']

    # Price deviation from peg ($1 for USDT)
    df['peg_deviation'] = close - 1.0
    df['peg_deviation_abs'] = abs(close - 1.0)
    df['peg_deviation_pct'] = (close - 1.0) * 100

    # Volatility metrics (key for stablecoin spreads)
    df['range'] = high - low
    df['range_pct'] = (high - low) / close * 100
    df['volatility_5'] = close.rolling(5).std()
    df['volatility_20'] = close.rolling(20).std()

    # High/low deviation
    df['high_deviation'] = high - 1.0
    df['low_deviation'] = low - 1.0

    # Volume features
    df['volume_sma'] = volume.rolling(20).mean()
    df['volume_ratio'] = volume / df['volume_sma']
    df['volume_spike'] = (volume > df['volume_sma'] * 2).astype(int)

    # Momentum
    df['momentum_1h'] = close.diff(1)
    df['momentum_4h'] = close.diff(4)
    df['momentum_24h'] = close.diff(24)

    # Mean reversion indicators
    df['sma_5'] = close.rolling(5).mean()
    df['sma_20'] = close.rolling(20).mean()
    df['distance_from_sma5'] = close - df['sma_5']
    df['distance_from_sma20'] = close - df['sma_20']

    # Bollinger-style bands for stablecoin
    df['bb_upper'] = 1.0 + df['volatility_20'] * 2
    df['bb_lower'] = 1.0 - df['volatility_20'] * 2
    df['bb_position'] = (close - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

    # Time features (spreads vary by time of day)
    if hasattr(df.index, 'hour'):
        df['hour'] = df.index.hour
        df['is_asia_hours'] = ((df['hour'] >= 0) & (df['hour'] < 8)).astype(int)
        df['is_europe_hours'] = ((df['hour'] >= 8) & (df['hour'] < 16)).astype(int)
        df['is_us_hours'] = ((df['hour'] >= 16) & (df['hour'] < 24)).astype(int)

    # Lag features
    for lag in [1, 2, 3, 6, 12]:
        df[f'close_lag_{lag}'] = close.shift(lag)
        df[f'range_lag_{lag}'] = df['range'].shift(lag)

    return df


def create_spread_labels(df: pd.DataFrame, lookahead: int = 1) -> pd.Series:
    """
    Create labels for spread prediction
    We predict the future price range (potential spread opportunity)
    """
    future_range = df['range'].shift(-lookahead)
    return future_range


def train_stablecoin_model(symbol: str = "USDT/USD", days: int = 180):
    """Train model to predict stablecoin spread opportunities"""

    logger.info(f"Training stablecoin spread model for {symbol}...")

    # Fetch data
    df = fetch_historical_data(symbol, days=days)
    if df.empty or len(df) < 500:
        logger.error("Insufficient data")
        return None

    # Create features
    df = create_spread_features(df)

    # Create labels (future price range = spread opportunity)
    df['target'] = create_spread_labels(df, lookahead=1)

    # Drop NaN
    df = df.dropna()

    # Feature columns
    exclude = ['target', 'open', 'high', 'low', 'close', 'volume']
    feature_cols = [c for c in df.columns if c not in exclude]

    X = df[feature_cols]
    y = df['target']

    logger.info(f"Dataset: {len(X)} samples, {len(feature_cols)} features")
    logger.info(f"Target stats: mean={y.mean():.6f}, std={y.std():.6f}, max={y.max():.6f}")

    # Time-based split
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    # Scale
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train models
    models = {}
    results = {}

    # Random Forest
    logger.info("Training Random Forest...")
    rf = RandomForestRegressor(n_estimators=200, max_depth=10, random_state=42, n_jobs=-1)
    rf.fit(X_train_scaled, y_train)
    models['random_forest'] = rf
    rf_pred = rf.predict(X_test_scaled)
    results['random_forest'] = {
        'mae': mean_absolute_error(y_test, rf_pred),
        'r2': r2_score(y_test, rf_pred)
    }
    logger.info(f"  MAE: {results['random_forest']['mae']:.8f}, R2: {results['random_forest']['r2']:.4f}")

    # Gradient Boosting
    logger.info("Training Gradient Boosting...")
    gb = GradientBoostingRegressor(n_estimators=150, max_depth=5, learning_rate=0.1, random_state=42)
    gb.fit(X_train_scaled, y_train)
    models['gradient_boosting'] = gb
    gb_pred = gb.predict(X_test_scaled)
    results['gradient_boosting'] = {
        'mae': mean_absolute_error(y_test, gb_pred),
        'r2': r2_score(y_test, gb_pred)
    }
    logger.info(f"  MAE: {results['gradient_boosting']['mae']:.8f}, R2: {results['gradient_boosting']['r2']:.4f}")

    # XGBoost
    if XGBOOST_AVAILABLE:
        logger.info("Training XGBoost...")
        xgb = XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)
        xgb.fit(X_train_scaled, y_train)
        models['xgboost'] = xgb
        xgb_pred = xgb.predict(X_test_scaled)
        results['xgboost'] = {
            'mae': mean_absolute_error(y_test, xgb_pred),
            'r2': r2_score(y_test, xgb_pred)
        }
        logger.info(f"  MAE: {results['xgboost']['mae']:.8f}, R2: {results['xgboost']['r2']:.4f}")

    # Find best model
    best_model_name = min(results, key=lambda x: results[x]['mae'])
    best_model = models[best_model_name]

    logger.info(f"\nBest model: {best_model_name}")
    logger.info(f"  MAE: {results[best_model_name]['mae']:.8f}")
    logger.info(f"  R2: {results[best_model_name]['r2']:.4f}")

    # Save models
    safe_symbol = symbol.replace("/", "_")

    for name, model in models.items():
        joblib.dump(model, MODEL_DIR / f"{safe_symbol}_{name}.joblib")
        logger.info(f"Saved {name}")

    joblib.dump(scaler, MODEL_DIR / f"{safe_symbol}_scaler.joblib")

    with open(MODEL_DIR / f"{safe_symbol}_features.json", 'w') as f:
        json.dump(feature_cols, f)

    # Save metadata
    metadata = {
        'symbol': symbol,
        'type': 'stablecoin_spread',
        'trained_at': datetime.now().isoformat(),
        'samples': len(X),
        'features': len(feature_cols),
        'feature_names': feature_cols,
        'results': results,
        'best_model': best_model_name,
        'target_description': 'Future 1h price range (spread opportunity)'
    }
    with open(MODEL_DIR / f"{safe_symbol}_metadata.json", 'w') as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"\nModel saved to {MODEL_DIR}")

    return results


def predict_spread_opportunity(symbol: str, current_data: dict) -> dict:
    """
    Predict if there's a spread opportunity
    Returns: predicted spread range and confidence
    """
    safe_symbol = symbol.replace("/", "_")

    # Load model
    model_path = MODEL_DIR / f"{safe_symbol}_xgboost.joblib"
    if not model_path.exists():
        model_path = MODEL_DIR / f"{safe_symbol}_random_forest.joblib"

    if not model_path.exists():
        return {'error': 'Model not found'}

    model = joblib.load(model_path)
    scaler = joblib.load(MODEL_DIR / f"{safe_symbol}_scaler.joblib")

    with open(MODEL_DIR / f"{safe_symbol}_features.json") as f:
        features = json.load(f)

    # Create feature vector from current data
    # This would be called with real-time data
    X = pd.DataFrame([current_data])[features]
    X_scaled = scaler.transform(X)

    predicted_range = model.predict(X_scaled)[0]

    # Interpret prediction
    if predicted_range > 0.001:  # > 0.1% spread expected
        signal = 'HIGH_OPPORTUNITY'
        confidence = min(predicted_range * 1000, 0.95)
    elif predicted_range > 0.0005:  # > 0.05% spread
        signal = 'MEDIUM_OPPORTUNITY'
        confidence = 0.6
    else:
        signal = 'LOW_OPPORTUNITY'
        confidence = 0.3

    return {
        'predicted_spread_range': predicted_range,
        'predicted_spread_pct': predicted_range * 100,
        'signal': signal,
        'confidence': confidence,
        'recommendation': f"Expected spread: {predicted_range*100:.4f}%"
    }


if __name__ == "__main__":
    # Train USDT/USD model
    train_stablecoin_model("USDT/USD", days=180)

    # Also train USDC/USD
    print("\n" + "="*50)
    train_stablecoin_model("USDC/USD", days=180)
