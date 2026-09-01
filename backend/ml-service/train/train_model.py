"""
Model Training Pipeline
Trains XGBoost, RandomForest, and ensemble models for price prediction
"""
import pandas as pd
import numpy as np
from pathlib import Path
import joblib
import json
from datetime import datetime
from typing import Dict, Tuple
import logging
import warnings

warnings.filterwarnings('ignore')

from sklearn.model_selection import train_test_split, TimeSeriesSplit, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report, confusion_matrix

try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

from data_collector import fetch_historical_data, fetch_multiple_symbols
from feature_engineering import prepare_features

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent / "data" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def train_single_symbol(
    symbol: str = "BTC/USDT",
    days: int = 180,
    test_size: float = 0.2
) -> Dict:
    """Train models on a single symbol"""

    logger.info(f"Training on {symbol} with {days} days of data...")

    # Fetch data
    df = fetch_historical_data(symbol, days=days)
    if df.empty or len(df) < 500:
        logger.error(f"Insufficient data for {symbol}")
        return {}

    # Prepare features
    X, y, full_df = prepare_features(df, lookahead=5)

    logger.info(f"Dataset: {len(X)} samples, {X.shape[1]} features")
    logger.info(f"Label distribution: {dict(y.value_counts())}")

    # Time-based split (no shuffle for time series)
    split_idx = int(len(X) * (1 - test_size))
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    logger.info(f"Train: {len(X_train)}, Test: {len(X_test)}")

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train models
    models = {}
    results = {}

    # 1. Random Forest
    logger.info("Training Random Forest...")
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=10,
        min_samples_leaf=5,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train_scaled, y_train)
    models['random_forest'] = rf
    results['random_forest'] = evaluate_model(rf, X_test_scaled, y_test, "Random Forest")

    # 2. Gradient Boosting
    logger.info("Training Gradient Boosting...")
    gb = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.1,
        min_samples_split=10,
        random_state=42
    )
    gb.fit(X_train_scaled, y_train)
    models['gradient_boosting'] = gb
    results['gradient_boosting'] = evaluate_model(gb, X_test_scaled, y_test, "Gradient Boosting")

    # 3. XGBoost (if available)
    if XGBOOST_AVAILABLE:
        logger.info("Training XGBoost...")
        xgb = XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=1,
            random_state=42,
            use_label_encoder=False,
            eval_metric='mlogloss'
        )
        # Map labels to 0, 1, 2 for XGBoost
        y_train_xgb = y_train.map({-1: 0, 0: 1, 1: 2})
        y_test_xgb = y_test.map({-1: 0, 0: 1, 1: 2})
        xgb.fit(X_train_scaled, y_train_xgb)
        models['xgboost'] = xgb
        results['xgboost'] = evaluate_model(xgb, X_test_scaled, y_test_xgb, "XGBoost", is_xgb=True)

    # 4. Ensemble (Voting)
    logger.info("Training Ensemble...")
    estimators = [('rf', rf), ('gb', gb)]
    if XGBOOST_AVAILABLE:
        # Create a new XGB with original labels
        xgb_voting = XGBClassifier(
            n_estimators=150,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
            use_label_encoder=False,
            eval_metric='mlogloss'
        )
        xgb_voting.fit(X_train_scaled, y_train.map({-1: 0, 0: 1, 1: 2}))

    ensemble = VotingClassifier(estimators=estimators, voting='soft')
    ensemble.fit(X_train_scaled, y_train)
    models['ensemble'] = ensemble
    results['ensemble'] = evaluate_model(ensemble, X_test_scaled, y_test, "Ensemble")

    # Find best model
    best_model_name = max(results, key=lambda x: results[x]['accuracy'])
    best_model = models[best_model_name]

    logger.info(f"\nBest model: {best_model_name} with {results[best_model_name]['accuracy']:.2%} accuracy")

    # Save models
    safe_symbol = symbol.replace("/", "_")

    for name, model in models.items():
        model_path = MODEL_DIR / f"{safe_symbol}_{name}.joblib"
        joblib.dump(model, model_path)
        logger.info(f"Saved {name} to {model_path}")

    # Save scaler
    scaler_path = MODEL_DIR / f"{safe_symbol}_scaler.joblib"
    joblib.dump(scaler, scaler_path)

    # Save feature names
    feature_path = MODEL_DIR / f"{safe_symbol}_features.json"
    with open(feature_path, 'w') as f:
        json.dump(list(X.columns), f)

    # Save metadata
    metadata = {
        'symbol': symbol,
        'trained_at': datetime.now().isoformat(),
        'samples': len(X),
        'features': X.shape[1],
        'feature_names': list(X.columns),
        'results': results,
        'best_model': best_model_name,
        'label_mapping': {-1: 'SELL', 0: 'HOLD', 1: 'BUY'}
    }
    meta_path = MODEL_DIR / f"{safe_symbol}_metadata.json"
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    return results


def evaluate_model(model, X_test, y_test, name: str, is_xgb: bool = False) -> Dict:
    """Evaluate model performance"""

    y_pred = model.predict(X_test)

    # Map XGBoost predictions back
    if is_xgb:
        y_test_eval = y_test
        y_pred_eval = y_pred
    else:
        y_test_eval = y_test
        y_pred_eval = y_pred

    accuracy = accuracy_score(y_test_eval, y_pred_eval)
    precision = precision_score(y_test_eval, y_pred_eval, average='weighted', zero_division=0)
    recall = recall_score(y_test_eval, y_pred_eval, average='weighted', zero_division=0)
    f1 = f1_score(y_test_eval, y_pred_eval, average='weighted', zero_division=0)

    logger.info(f"\n{name} Results:")
    logger.info(f"  Accuracy:  {accuracy:.2%}")
    logger.info(f"  Precision: {precision:.2%}")
    logger.info(f"  Recall:    {recall:.2%}")
    logger.info(f"  F1 Score:  {f1:.2%}")

    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1_score': f1
    }


def train_multi_symbol(symbols: list = None, days: int = 180) -> Dict:
    """Train models on multiple symbols"""

    if symbols is None:
        symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT"]

    all_results = {}

    for symbol in symbols:
        try:
            results = train_single_symbol(symbol, days)
            all_results[symbol] = results
        except Exception as e:
            logger.error(f"Failed to train {symbol}: {e}")
            continue

    # Summary
    logger.info("\n" + "="*50)
    logger.info("TRAINING SUMMARY")
    logger.info("="*50)

    for symbol, results in all_results.items():
        if results:
            best = max(results.items(), key=lambda x: x[1]['accuracy'])
            logger.info(f"{symbol}: Best={best[0]}, Accuracy={best[1]['accuracy']:.2%}")

    return all_results


def train_universal_model(days: int = 180) -> Dict:
    """Train a universal model on combined data from multiple symbols"""

    symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT"]

    logger.info("Training universal model on multiple symbols...")

    all_X = []
    all_y = []

    for symbol in symbols:
        try:
            df = fetch_historical_data(symbol, days=days)
            if df.empty or len(df) < 200:
                continue

            X, y, _ = prepare_features(df, lookahead=5)
            X['symbol'] = symbol  # Add symbol as feature
            all_X.append(X)
            all_y.append(y)

            logger.info(f"Added {len(X)} samples from {symbol}")
        except Exception as e:
            logger.error(f"Error with {symbol}: {e}")

    if not all_X:
        logger.error("No data collected")
        return {}

    # Combine all data
    X_combined = pd.concat(all_X, ignore_index=True)
    y_combined = pd.concat(all_y, ignore_index=True)

    # Encode symbol
    X_combined = pd.get_dummies(X_combined, columns=['symbol'], drop_first=True)

    logger.info(f"Combined dataset: {len(X_combined)} samples, {X_combined.shape[1]} features")

    # Time-based split
    split_idx = int(len(X_combined) * 0.8)
    X_train, X_test = X_combined.iloc[:split_idx], X_combined.iloc[split_idx:]
    y_train, y_test = y_combined.iloc[:split_idx], y_combined.iloc[split_idx:]

    # Scale
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train ensemble
    logger.info("Training universal ensemble model...")

    rf = RandomForestClassifier(n_estimators=300, max_depth=12, class_weight='balanced', random_state=42, n_jobs=-1)
    gb = GradientBoostingClassifier(n_estimators=200, max_depth=6, learning_rate=0.05, random_state=42)

    estimators = [('rf', rf), ('gb', gb)]

    if XGBOOST_AVAILABLE:
        xgb = XGBClassifier(n_estimators=250, max_depth=8, learning_rate=0.05, random_state=42, use_label_encoder=False, eval_metric='mlogloss')
        xgb.fit(X_train_scaled, y_train.map({-1: 0, 0: 1, 1: 2}))

    ensemble = VotingClassifier(estimators=estimators, voting='soft')
    ensemble.fit(X_train_scaled, y_train)

    # Evaluate
    results = evaluate_model(ensemble, X_test_scaled, y_test, "Universal Ensemble")

    # Save
    joblib.dump(ensemble, MODEL_DIR / "universal_ensemble.joblib")
    joblib.dump(scaler, MODEL_DIR / "universal_scaler.joblib")

    with open(MODEL_DIR / "universal_features.json", 'w') as f:
        json.dump(list(X_combined.columns), f)

    logger.info(f"Universal model saved with {results['accuracy']:.2%} accuracy")

    return results


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--universal":
        train_universal_model(days=180)
    elif len(sys.argv) > 1 and sys.argv[1] == "--multi":
        train_multi_symbol(days=180)
    else:
        # Default: train BTC model
        train_single_symbol("BTC/USDT", days=180)
