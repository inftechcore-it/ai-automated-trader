"""
Model Evaluation - Test consistency and reliability
"""
import pandas as pd
import numpy as np
import joblib
import json
from pathlib import Path
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import logging

from data_collector import fetch_historical_data
from feature_engineering import prepare_features

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent / "data" / "models"


def evaluate_consistency(symbol: str = "BTC/USDT", n_splits: int = 5):
    """Evaluate model consistency using time-series cross-validation"""

    logger.info(f"\n{'='*60}")
    logger.info(f"EVALUATING MODEL CONSISTENCY: {symbol}")
    logger.info(f"{'='*60}\n")

    # Load data
    df = fetch_historical_data(symbol, days=180)
    X, y, _ = prepare_features(df, lookahead=5)

    logger.info(f"Dataset: {len(X)} samples")

    # Load model
    safe_symbol = symbol.replace("/", "_")
    model_path = MODEL_DIR / f"{safe_symbol}_xgboost.joblib"
    scaler_path = MODEL_DIR / f"{safe_symbol}_scaler.joblib"

    if not model_path.exists():
        logger.error(f"Model not found: {model_path}")
        return

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)

    # Time Series Cross-Validation
    tscv = TimeSeriesSplit(n_splits=n_splits)

    fold_accuracies = []
    fold_results = []

    logger.info(f"Running {n_splits}-fold time series cross-validation...\n")

    for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        # Scale
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # Map labels for XGBoost
        y_train_mapped = y_train.map({-1: 0, 0: 1, 1: 2})
        y_test_mapped = y_test.map({-1: 0, 0: 1, 1: 2})

        # Train and predict
        model.fit(X_train_scaled, y_train_mapped)
        y_pred = model.predict(X_test_scaled)

        accuracy = accuracy_score(y_test_mapped, y_pred)
        fold_accuracies.append(accuracy)

        # Per-class accuracy
        from sklearn.metrics import precision_recall_fscore_support
        prec, rec, f1, _ = precision_recall_fscore_support(y_test_mapped, y_pred, average='weighted', zero_division=0)

        fold_results.append({
            'fold': fold + 1,
            'train_size': len(train_idx),
            'test_size': len(test_idx),
            'accuracy': accuracy,
            'precision': prec,
            'recall': rec,
            'f1': f1
        })

        logger.info(f"Fold {fold+1}: Accuracy={accuracy:.2%}, F1={f1:.2%}, Train={len(train_idx)}, Test={len(test_idx)}")

    # Summary statistics
    mean_acc = np.mean(fold_accuracies)
    std_acc = np.std(fold_accuracies)
    min_acc = np.min(fold_accuracies)
    max_acc = np.max(fold_accuracies)

    logger.info(f"\n{'='*40}")
    logger.info("CONSISTENCY METRICS")
    logger.info(f"{'='*40}")
    logger.info(f"Mean Accuracy:     {mean_acc:.2%}")
    logger.info(f"Std Deviation:     {std_acc:.2%}")
    logger.info(f"Min Accuracy:      {min_acc:.2%}")
    logger.info(f"Max Accuracy:      {max_acc:.2%}")
    logger.info(f"Consistency Score: {(1 - std_acc/mean_acc)*100:.1f}%")
    logger.info(f"{'='*40}\n")

    # Interpretation
    if std_acc < 0.05:
        consistency = "HIGH"
        interpretation = "Model performs consistently across different time periods"
    elif std_acc < 0.10:
        consistency = "MODERATE"
        interpretation = "Model has some variance but generally reliable"
    else:
        consistency = "LOW"
        interpretation = "Model performance varies significantly - consider more training data"

    logger.info(f"Consistency Rating: {consistency}")
    logger.info(f"Interpretation: {interpretation}")

    return {
        'symbol': symbol,
        'mean_accuracy': mean_acc,
        'std_deviation': std_acc,
        'consistency_score': (1 - std_acc/mean_acc) * 100,
        'consistency_rating': consistency,
        'fold_results': fold_results
    }


def evaluate_on_recent_data(symbol: str = "BTC/USDT", test_days: int = 7):
    """Test model on most recent unseen data"""

    logger.info(f"\n{'='*60}")
    logger.info(f"TESTING ON RECENT {test_days} DAYS: {symbol}")
    logger.info(f"{'='*60}\n")

    # Fetch fresh data
    df = fetch_historical_data(symbol, days=test_days + 30)  # Extra for features
    X, y, full_df = prepare_features(df, lookahead=5)

    # Use last test_days * 24 hours
    test_samples = test_days * 24
    X_test = X.iloc[-test_samples:]
    y_test = y.iloc[-test_samples:]

    # Load model and scaler
    safe_symbol = symbol.replace("/", "_")
    model = joblib.load(MODEL_DIR / f"{safe_symbol}_xgboost.joblib")
    scaler = joblib.load(MODEL_DIR / f"{safe_symbol}_scaler.joblib")

    # Scale and predict
    X_test_scaled = scaler.transform(X_test)
    y_test_mapped = y_test.map({-1: 0, 0: 1, 1: 2})
    y_pred = model.predict(X_test_scaled)

    accuracy = accuracy_score(y_test_mapped, y_pred)

    # Confusion matrix
    cm = confusion_matrix(y_test_mapped, y_pred)

    logger.info(f"Test Period: Last {test_days} days ({len(X_test)} candles)")
    logger.info(f"Accuracy on Recent Data: {accuracy:.2%}")
    logger.info(f"\nConfusion Matrix (SELL=0, HOLD=1, BUY=2):")
    logger.info(f"              Predicted")
    logger.info(f"           SELL  HOLD  BUY")
    logger.info(f"Actual SELL  {cm[0,0]:4d}  {cm[0,1]:4d}  {cm[0,2]:4d}")
    logger.info(f"       HOLD  {cm[1,0]:4d}  {cm[1,1]:4d}  {cm[1,2]:4d}")
    logger.info(f"       BUY   {cm[2,0]:4d}  {cm[2,1]:4d}  {cm[2,2]:4d}")

    # Calculate signal quality
    signal_map = {0: 'SELL', 1: 'HOLD', 2: 'BUY'}

    # How many BUY signals were correct?
    buy_signals = (y_pred == 2).sum()
    correct_buys = ((y_pred == 2) & (y_test_mapped == 2)).sum()
    buy_accuracy = correct_buys / buy_signals if buy_signals > 0 else 0

    sell_signals = (y_pred == 0).sum()
    correct_sells = ((y_pred == 0) & (y_test_mapped == 0)).sum()
    sell_accuracy = correct_sells / sell_signals if sell_signals > 0 else 0

    logger.info(f"\nSignal Quality:")
    logger.info(f"  BUY signals:  {buy_signals} total, {correct_buys} correct ({buy_accuracy:.1%} accuracy)")
    logger.info(f"  SELL signals: {sell_signals} total, {correct_sells} correct ({sell_accuracy:.1%} accuracy)")

    return {
        'accuracy': accuracy,
        'buy_accuracy': buy_accuracy,
        'sell_accuracy': sell_accuracy,
        'confusion_matrix': cm.tolist()
    }


def simulate_trading(symbol: str = "BTC/USDT", test_days: int = 30, initial_capital: float = 10000):
    """Simulate trading using model predictions"""

    logger.info(f"\n{'='*60}")
    logger.info(f"SIMULATED TRADING: {symbol}")
    logger.info(f"{'='*60}\n")

    df = fetch_historical_data(symbol, days=test_days + 50)
    X, y, full_df = prepare_features(df, lookahead=5)

    test_samples = test_days * 24
    X_test = X.iloc[-test_samples:]
    prices = full_df['close'].iloc[-test_samples:].values

    # Load model
    safe_symbol = symbol.replace("/", "_")
    model = joblib.load(MODEL_DIR / f"{safe_symbol}_xgboost.joblib")
    scaler = joblib.load(MODEL_DIR / f"{safe_symbol}_scaler.joblib")

    X_test_scaled = scaler.transform(X_test)
    predictions = model.predict(X_test_scaled)

    # Simulate trading
    capital = initial_capital
    position = 0
    entry_price = 0
    trades = []

    for i in range(len(predictions)):
        pred = predictions[i]
        price = prices[i]

        # BUY signal (pred=2) and no position
        if pred == 2 and position == 0:
            position = capital * 0.95 / price  # 95% of capital
            entry_price = price
            capital = capital * 0.05
            trades.append({'type': 'BUY', 'price': price, 'position': position})

        # SELL signal (pred=0) and have position
        elif pred == 0 and position > 0:
            pnl = position * (price - entry_price)
            capital += position * price
            trades.append({'type': 'SELL', 'price': price, 'pnl': pnl})
            position = 0

    # Close any open position
    if position > 0:
        capital += position * prices[-1]

    final_capital = capital
    total_return = (final_capital - initial_capital) / initial_capital * 100

    # Buy & Hold comparison
    buy_hold_return = (prices[-1] - prices[0]) / prices[0] * 100

    logger.info(f"Initial Capital:    ${initial_capital:,.2f}")
    logger.info(f"Final Capital:      ${final_capital:,.2f}")
    logger.info(f"Total Return:       {total_return:+.2f}%")
    logger.info(f"Buy & Hold Return:  {buy_hold_return:+.2f}%")
    logger.info(f"Alpha (vs B&H):     {total_return - buy_hold_return:+.2f}%")
    logger.info(f"Total Trades:       {len(trades)}")

    return {
        'initial_capital': initial_capital,
        'final_capital': final_capital,
        'total_return_pct': total_return,
        'buy_hold_return_pct': buy_hold_return,
        'alpha': total_return - buy_hold_return,
        'total_trades': len(trades)
    }


if __name__ == "__main__":
    # Evaluate BTC model
    print("\n" + "="*70)
    print("MODEL EVALUATION REPORT")
    print("="*70)

    for symbol in ["BTC/USDT", "ETH/USDT", "SOL/USDT"]:
        try:
            # Consistency test
            consistency = evaluate_consistency(symbol, n_splits=5)

            # Recent data test
            recent = evaluate_on_recent_data(symbol, test_days=7)

            # Trading simulation
            trading = simulate_trading(symbol, test_days=30)

        except Exception as e:
            logger.error(f"Error evaluating {symbol}: {e}")
