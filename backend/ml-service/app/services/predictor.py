"""
ML Prediction Service
Uses trained models for predictions, falls back to rule-based when model unavailable
"""
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional
import logging
import joblib
import json

from app.services.pattern_detector import PatternDetector

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent.parent / "data" / "models"

# Try TA-Lib
try:
    import talib
    TALIB_AVAILABLE = True
except ImportError:
    TALIB_AVAILABLE = False


class PredictionService:
    def __init__(self):
        self.pattern_detector = PatternDetector()
        self.models = {}
        self.scalers = {}
        self.features = {}
        self._load_models()

    def _load_models(self):
        """Load trained models from disk"""
        if not MODEL_DIR.exists():
            logger.warning("No models directory found")
            return

        # Find all model files
        for model_file in MODEL_DIR.glob("*_xgboost.joblib"):
            try:
                symbol = model_file.stem.replace("_xgboost", "").replace("_", "/")
                self.models[symbol] = joblib.load(model_file)

                # Load scaler
                scaler_file = MODEL_DIR / f"{model_file.stem.replace('_xgboost', '_scaler')}.joblib"
                if scaler_file.exists():
                    self.scalers[symbol] = joblib.load(scaler_file)

                # Load feature names
                feature_file = MODEL_DIR / f"{model_file.stem.replace('_xgboost', '_features')}.json"
                if feature_file.exists():
                    with open(feature_file) as f:
                        self.features[symbol] = json.load(f)

                logger.info(f"Loaded model for {symbol}")

            except Exception as e:
                logger.error(f"Error loading model {model_file}: {e}")

        logger.info(f"Loaded {len(self.models)} models")

    async def predict(self, symbol: str, df: pd.DataFrame, timeframe: str) -> Dict:
        """Generate prediction using trained model or rule-based fallback"""

        # Normalize symbol
        symbol_key = symbol.replace("-", "/").upper()
        if "USDT" not in symbol_key and "USD" not in symbol_key:
            symbol_key = f"{symbol_key}/USDT"

        # Calculate technical indicators
        indicators = self._calculate_indicators(df)

        # Detect patterns
        patterns = self.pattern_detector.detect_candlestick_patterns(df)
        chart_patterns = self.pattern_detector.detect_chart_patterns(df)

        # Try ML prediction first
        if symbol_key in self.models:
            try:
                ml_result = self._ml_predict(symbol_key, df)
                signal = ml_result['signal']
                confidence = ml_result['confidence']
                reasoning = f"ML Model: {ml_result['reasoning']}"
            except Exception as e:
                logger.warning(f"ML prediction failed, using rules: {e}")
                signal, confidence, reasoning = self._rule_based_predict(indicators, patterns, chart_patterns)
        else:
            # Fallback to rule-based
            signal, confidence, reasoning = self._rule_based_predict(indicators, patterns, chart_patterns)

        # Calculate targets
        current_price = float(df['close'].iloc[-1])
        atr = indicators.get('atr', current_price * 0.02)

        if signal == 'BUY':
            stop_loss = current_price - (atr * 2)
            take_profit = current_price + (atr * 3)
            price_target = current_price + (atr * 2)
        elif signal == 'SELL':
            stop_loss = current_price + (atr * 2)
            take_profit = current_price - (atr * 3)
            price_target = current_price - (atr * 2)
        else:
            stop_loss = None
            take_profit = None
            price_target = None

        return {
            'signal': signal,
            'confidence': confidence,
            'price_target': price_target,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'indicators': indicators,
            'patterns': [p['name'] for p in patterns[:5]],
            'chart_patterns': [cp['name'] for cp in chart_patterns],
            'reasoning': reasoning,
            'model_used': symbol_key in self.models
        }

    def _ml_predict(self, symbol: str, df: pd.DataFrame) -> Dict:
        """Use trained ML model for prediction"""

        # Extract features
        features_df = self._extract_features(df)

        if features_df.empty:
            raise ValueError("Could not extract features")

        # Get the last row for prediction
        X = features_df.iloc[[-1]]

        # Ensure we have the right features
        expected_features = self.features.get(symbol, list(X.columns))

        # Add missing features with 0
        for feat in expected_features:
            if feat not in X.columns:
                X[feat] = 0

        # Select only expected features in correct order
        X = X[[f for f in expected_features if f in X.columns]]

        # Scale features
        if symbol in self.scalers:
            X_scaled = self.scalers[symbol].transform(X)
        else:
            X_scaled = X.values

        # Predict
        model = self.models[symbol]
        pred = model.predict(X_scaled)[0]
        proba = model.predict_proba(X_scaled)[0]

        # Map prediction to signal (XGBoost uses 0, 1, 2)
        signal_map = {0: 'SELL', 1: 'HOLD', 2: 'BUY'}
        signal = signal_map.get(pred, 'HOLD')

        confidence = float(max(proba))

        # Get feature importances
        if hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_
            top_features = sorted(
                zip(expected_features[:len(importances)], importances),
                key=lambda x: x[1],
                reverse=True
            )[:3]
            reasoning = f"Top factors: {', '.join([f[0] for f in top_features])}"
        else:
            reasoning = f"ML model prediction with {confidence:.0%} confidence"

        return {
            'signal': signal,
            'confidence': confidence,
            'reasoning': reasoning
        }

    def _extract_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract features matching training pipeline"""

        df = df.copy()
        close = df['close']
        high = df['high']
        low = df['low']
        volume = df['volume']

        # Price features
        df['returns'] = close.pct_change()
        df['log_returns'] = np.log(close / close.shift(1))

        # Moving Averages
        for period in [5, 10, 20, 50, 100, 200]:
            df[f'sma_{period}'] = close.rolling(period).mean()
            df[f'ema_{period}'] = close.ewm(span=period).mean()

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

        # ATR
        tr = pd.concat([high - low, abs(high - close.shift()), abs(low - close.shift())], axis=1).max(axis=1)
        df['atr'] = tr.rolling(14).mean()
        df['atr_percent'] = df['atr'] / close * 100

        # Volatility
        df['volatility_20'] = close.rolling(20).std() / close.rolling(20).mean() * 100

        # Volume
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

        # CCI
        typical_price = (high + low + close) / 3
        tp_sma = typical_price.rolling(20).mean()
        tp_mad = typical_price.rolling(20).apply(lambda x: np.abs(x - x.mean()).mean())
        df['cci'] = (typical_price - tp_sma) / (0.015 * tp_mad)

        # ADX
        plus_dm = high.diff()
        minus_dm = -low.diff()
        plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
        minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)
        atr14 = tr.rolling(14).mean()
        plus_di = 100 * (plus_dm.rolling(14).mean() / atr14)
        minus_di = 100 * (minus_dm.rolling(14).mean() / atr14)
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
        df['adx'] = dx.rolling(14).mean()

        # OBV
        obv = (np.sign(close.diff()) * volume).cumsum()
        df['obv'] = obv
        df['obv_sma'] = obv.rolling(20).mean()

        # Price patterns
        df['higher_high'] = (high > high.shift(1)).astype(int)
        df['lower_low'] = (low < low.shift(1)).astype(int)
        df['higher_close'] = (close > close.shift(1)).astype(int)

        df['trend_strength'] = abs(df['sma_20'] - df['sma_50']) / df['sma_50'] * 100

        # Candlestick patterns
        o, h, l, c = df['open'].values, high.values, low.values, close.values
        body = c - o
        body_abs = np.abs(body)
        total_range = h - l

        df['cdldoji'] = np.where((total_range > 0) & (body_abs / total_range < 0.1), 1, 0)
        df['cdlhammer'] = 0
        df['cdlshootingstar'] = 0
        df['cdlengulfing'] = 0

        df['bullish_patterns'] = df[[col for col in df.columns if col.startswith('cdl')]].apply(lambda x: (x > 0).sum(), axis=1)
        df['bearish_patterns'] = df[[col for col in df.columns if col.startswith('cdl')]].apply(lambda x: (x < 0).sum(), axis=1)
        df['pattern_signal'] = df['bullish_patterns'] - df['bearish_patterns']

        # Remove original OHLCV
        exclude = ['open', 'high', 'low', 'close', 'volume']
        feature_cols = [c for c in df.columns if c not in exclude]

        return df[feature_cols].dropna()

    def _calculate_indicators(self, df: pd.DataFrame) -> Dict:
        """Calculate indicators for response"""
        indicators = {}
        close = df['close']
        high = df['high']
        low = df['low']
        volume = df['volume']

        indicators['current_price'] = float(close.iloc[-1])
        indicators['sma_20'] = float(close.rolling(20).mean().iloc[-1])
        indicators['sma_50'] = float(close.rolling(50).mean().iloc[-1]) if len(df) >= 50 else None
        indicators['ema_12'] = float(close.ewm(span=12).mean().iloc[-1])
        indicators['ema_26'] = float(close.ewm(span=26).mean().iloc[-1])

        # MACD
        macd = close.ewm(span=12).mean() - close.ewm(span=26).mean()
        signal_line = macd.ewm(span=9).mean()
        indicators['macd'] = float(macd.iloc[-1])
        indicators['macd_signal'] = float(signal_line.iloc[-1])
        indicators['macd_histogram'] = float(macd.iloc[-1] - signal_line.iloc[-1])

        # RSI
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        indicators['rsi'] = float(100 - (100 / (1 + rs.iloc[-1])))

        # Bollinger
        sma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        indicators['bb_upper'] = float(sma20.iloc[-1] + (std20.iloc[-1] * 2))
        indicators['bb_lower'] = float(sma20.iloc[-1] - (std20.iloc[-1] * 2))
        indicators['bb_middle'] = float(sma20.iloc[-1])

        # ATR
        tr = pd.concat([high - low, abs(high - close.shift()), abs(low - close.shift())], axis=1).max(axis=1)
        indicators['atr'] = float(tr.rolling(14).mean().iloc[-1])

        # Volume
        indicators['volume_sma'] = float(volume.rolling(20).mean().iloc[-1])
        indicators['volume_ratio'] = float(volume.iloc[-1] / indicators['volume_sma'])

        # Trend
        if len(df) >= 50:
            indicators['trend'] = 'bullish' if close.iloc[-1] > indicators['sma_50'] else 'bearish'
        else:
            indicators['trend'] = 'bullish' if close.iloc[-1] > indicators['sma_20'] else 'bearish'

        return indicators

    def _rule_based_predict(self, indicators: Dict, patterns: List, chart_patterns: List) -> tuple:
        """Rule-based prediction fallback"""
        score = 0
        reasons = []

        # Pattern signals
        bullish = sum(1 for p in patterns if p['type'] == 'bullish')
        bearish = sum(1 for p in patterns if p['type'] == 'bearish')

        if bullish > bearish:
            score += (bullish - bearish) * 10
            reasons.append(f"{bullish} bullish patterns")
        elif bearish > bullish:
            score -= (bearish - bullish) * 10
            reasons.append(f"{bearish} bearish patterns")

        # Chart patterns
        for cp in chart_patterns:
            if cp['type'] == 'bullish':
                score += 15
                reasons.append(f"{cp['name']}")
            elif cp['type'] == 'bearish':
                score -= 15
                reasons.append(f"{cp['name']}")

        # RSI
        rsi = indicators.get('rsi', 50)
        if rsi < 30:
            score += 20
            reasons.append(f"RSI oversold ({rsi:.0f})")
        elif rsi > 70:
            score -= 20
            reasons.append(f"RSI overbought ({rsi:.0f})")

        # MACD
        macd_hist = indicators.get('macd_histogram', 0)
        if macd_hist > 0:
            score += 10
            reasons.append("MACD bullish")
        else:
            score -= 10

        # Determine signal
        if score >= 30:
            signal = 'BUY'
            confidence = min(0.85, 0.5 + (score / 100))
        elif score <= -30:
            signal = 'SELL'
            confidence = min(0.85, 0.5 + (abs(score) / 100))
        else:
            signal = 'HOLD'
            confidence = 0.5

        reasoning = "; ".join(reasons[:3]) if reasons else "No strong signals"

        return signal, round(confidence, 2), reasoning
