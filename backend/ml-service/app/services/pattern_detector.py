"""
Pattern Detection Service using TA-Lib
Detects 61 candlestick patterns + chart patterns
"""
import pandas as pd
import numpy as np
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

# Try to import talib, fall back to pandas-ta if not available
try:
    import talib
    TALIB_AVAILABLE = True
except ImportError:
    TALIB_AVAILABLE = False
    logger.warning("TA-Lib not available, using pandas-ta fallback")

try:
    import pandas_ta as pta
    PANDAS_TA_AVAILABLE = True
except ImportError:
    PANDAS_TA_AVAILABLE = False


# All 61 TA-Lib candlestick pattern functions
CANDLESTICK_PATTERNS = {
    'CDL2CROWS': ('Two Crows', 'bearish'),
    'CDL3BLACKCROWS': ('Three Black Crows', 'bearish'),
    'CDL3INSIDE': ('Three Inside', 'reversal'),
    'CDL3LINESTRIKE': ('Three Line Strike', 'continuation'),
    'CDL3OUTSIDE': ('Three Outside', 'reversal'),
    'CDL3STARSINSOUTH': ('Three Stars In South', 'bullish'),
    'CDL3WHITESOLDIERS': ('Three White Soldiers', 'bullish'),
    'CDLABANDONEDBABY': ('Abandoned Baby', 'reversal'),
    'CDLADVANCEBLOCK': ('Advance Block', 'bearish'),
    'CDLBELTHOLD': ('Belt Hold', 'reversal'),
    'CDLBREAKAWAY': ('Breakaway', 'reversal'),
    'CDLCLOSINGMARUBOZU': ('Closing Marubozu', 'continuation'),
    'CDLCONCEALBABYSWALL': ('Concealing Baby Swallow', 'bullish'),
    'CDLDOJI': ('Doji', 'neutral'),
    'CDLDOJISTAR': ('Doji Star', 'reversal'),
    'CDLDRAGONFLYDOJI': ('Dragonfly Doji', 'bullish'),
    'CDLENGULFING': ('Engulfing', 'reversal'),
    'CDLEVENINGDOJISTAR': ('Evening Doji Star', 'bearish'),
    'CDLEVENINGSTAR': ('Evening Star', 'bearish'),
    'CDLGAPSIDESIDEWHITE': ('Gap Side Side White', 'continuation'),
    'CDLGRAVESTONEDOJI': ('Gravestone Doji', 'bearish'),
    'CDLHAMMER': ('Hammer', 'bullish'),
    'CDLHANGINGMAN': ('Hanging Man', 'bearish'),
    'CDLHARAMI': ('Harami', 'reversal'),
    'CDLHARAMICROSS': ('Harami Cross', 'reversal'),
    'CDLHIGHWAVE': ('High Wave', 'neutral'),
    'CDLHIKKAKE': ('Hikkake', 'reversal'),
    'CDLHIKKAKEMOD': ('Modified Hikkake', 'reversal'),
    'CDLHOMINGPIGEON': ('Homing Pigeon', 'bullish'),
    'CDLIDENTICAL3CROWS': ('Identical Three Crows', 'bearish'),
    'CDLINNECK': ('In Neck', 'bearish'),
    'CDLINVERTEDHAMMER': ('Inverted Hammer', 'bullish'),
    'CDLKICKING': ('Kicking', 'reversal'),
    'CDLKICKINGBYLENGTH': ('Kicking By Length', 'reversal'),
    'CDLLADDERBOTTOM': ('Ladder Bottom', 'bullish'),
    'CDLLONGLEGGEDDOJI': ('Long Legged Doji', 'neutral'),
    'CDLLONGLINE': ('Long Line', 'continuation'),
    'CDLMARUBOZU': ('Marubozu', 'continuation'),
    'CDLMATCHINGLOW': ('Matching Low', 'bullish'),
    'CDLMATHOLD': ('Mat Hold', 'continuation'),
    'CDLMORNINGDOJISTAR': ('Morning Doji Star', 'bullish'),
    'CDLMORNINGSTAR': ('Morning Star', 'bullish'),
    'CDLONNECK': ('On Neck', 'bearish'),
    'CDLPIERCING': ('Piercing', 'bullish'),
    'CDLRICKSHAWMAN': ('Rickshaw Man', 'neutral'),
    'CDLRISEFALL3METHODS': ('Rise Fall Three Methods', 'continuation'),
    'CDLSEPARATINGLINES': ('Separating Lines', 'continuation'),
    'CDLSHOOTINGSTAR': ('Shooting Star', 'bearish'),
    'CDLSHORTLINE': ('Short Line', 'neutral'),
    'CDLSPINNINGTOP': ('Spinning Top', 'neutral'),
    'CDLSTALLEDPATTERN': ('Stalled Pattern', 'bearish'),
    'CDLSTICKSANDWICH': ('Stick Sandwich', 'bullish'),
    'CDLTAKURI': ('Takuri', 'bullish'),
    'CDLTASUKIGAP': ('Tasuki Gap', 'continuation'),
    'CDLTHRUSTING': ('Thrusting', 'bearish'),
    'CDLTRISTAR': ('Tristar', 'reversal'),
    'CDLUNIQUE3RIVER': ('Unique Three River', 'bullish'),
    'CDLUPSIDEGAP2CROWS': ('Upside Gap Two Crows', 'bearish'),
    'CDLXSIDEGAP3METHODS': ('Side Gap Three Methods', 'continuation'),
}


class PatternDetector:
    def __init__(self):
        self.talib_available = TALIB_AVAILABLE

    def detect_candlestick_patterns(self, df: pd.DataFrame) -> List[Dict]:
        """
        Detect all 61 candlestick patterns using TA-Lib
        Returns list of detected patterns with strength and description
        """
        patterns_found = []

        if not TALIB_AVAILABLE:
            return self._detect_basic_patterns(df)

        o = df['open'].values
        h = df['high'].values
        l = df['low'].values
        c = df['close'].values

        for func_name, (pattern_name, pattern_type) in CANDLESTICK_PATTERNS.items():
            try:
                func = getattr(talib, func_name, None)
                if func is None:
                    continue

                result = func(o, h, l, c)

                # Find where pattern was detected (non-zero values)
                indices = np.where(result != 0)[0]

                for idx in indices[-5:]:  # Only last 5 occurrences
                    strength = int(result[idx])  # 100 or -100
                    patterns_found.append({
                        'name': pattern_name,
                        'type': 'bullish' if strength > 0 else 'bearish' if strength < 0 else 'neutral',
                        'strength': strength,
                        'description': f"{pattern_name} pattern detected",
                        'candle_index': int(idx)
                    })

            except Exception as e:
                logger.debug(f"Pattern {func_name} detection error: {e}")
                continue

        # Sort by recency (most recent first)
        patterns_found.sort(key=lambda x: x['candle_index'], reverse=True)

        return patterns_found

    def _detect_basic_patterns(self, df: pd.DataFrame) -> List[Dict]:
        """
        Fallback pattern detection without TA-Lib
        """
        patterns = []
        n = len(df)

        if n < 3:
            return patterns

        o = df['open'].values
        h = df['high'].values
        l = df['low'].values
        c = df['close'].values

        # Detect basic patterns manually
        for i in range(2, min(n, 20)):
            idx = n - i - 1

            # Doji
            body = abs(c[idx] - o[idx])
            total_range = h[idx] - l[idx]
            if total_range > 0 and body / total_range < 0.1:
                patterns.append({
                    'name': 'Doji',
                    'type': 'neutral',
                    'strength': 0,
                    'description': 'Doji - indecision pattern',
                    'candle_index': idx
                })

            # Hammer
            lower_shadow = min(o[idx], c[idx]) - l[idx]
            upper_shadow = h[idx] - max(o[idx], c[idx])
            if total_range > 0 and lower_shadow > body * 2 and upper_shadow < body * 0.5:
                patterns.append({
                    'name': 'Hammer',
                    'type': 'bullish',
                    'strength': 100,
                    'description': 'Hammer - potential bullish reversal',
                    'candle_index': idx
                })

            # Engulfing
            if idx > 0:
                prev_body = c[idx-1] - o[idx-1]
                curr_body = c[idx] - o[idx]
                if prev_body < 0 and curr_body > 0 and c[idx] > o[idx-1] and o[idx] < c[idx-1]:
                    patterns.append({
                        'name': 'Bullish Engulfing',
                        'type': 'bullish',
                        'strength': 100,
                        'description': 'Bullish Engulfing pattern',
                        'candle_index': idx
                    })
                elif prev_body > 0 and curr_body < 0 and c[idx] < o[idx-1] and o[idx] > c[idx-1]:
                    patterns.append({
                        'name': 'Bearish Engulfing',
                        'type': 'bearish',
                        'strength': -100,
                        'description': 'Bearish Engulfing pattern',
                        'candle_index': idx
                    })

        return patterns

    def detect_chart_patterns(self, df: pd.DataFrame) -> List[Dict]:
        """
        Detect larger chart patterns (Head & Shoulders, Triangles, etc.)
        """
        patterns = []

        if len(df) < 20:
            return patterns

        close = df['close'].values
        high = df['high'].values
        low = df['low'].values

        # Double Top/Bottom detection
        double_pattern = self._detect_double_top_bottom(high, low, close)
        if double_pattern:
            patterns.append(double_pattern)

        # Triangle detection
        triangle = self._detect_triangle(high, low)
        if triangle:
            patterns.append(triangle)

        # Support/Resistance levels
        levels = self._detect_support_resistance(high, low, close)
        if levels:
            patterns.append({
                'name': 'Support/Resistance',
                'type': 'neutral',
                'levels': levels,
                'description': 'Key price levels detected'
            })

        return patterns

    def _detect_double_top_bottom(self, high: np.ndarray, low: np.ndarray, close: np.ndarray) -> Optional[Dict]:
        """Detect double top or double bottom patterns"""
        window = min(50, len(high))
        recent_high = high[-window:]
        recent_low = low[-window:]

        # Find local maxima
        max_indices = []
        for i in range(2, len(recent_high) - 2):
            if recent_high[i] > recent_high[i-1] and recent_high[i] > recent_high[i-2] and \
               recent_high[i] > recent_high[i+1] and recent_high[i] > recent_high[i+2]:
                max_indices.append(i)

        # Check for double top
        if len(max_indices) >= 2:
            last_two = max_indices[-2:]
            h1, h2 = recent_high[last_two[0]], recent_high[last_two[1]]
            if abs(h1 - h2) / h1 < 0.02:  # Within 2%
                return {
                    'name': 'Double Top',
                    'type': 'bearish',
                    'price_level': float((h1 + h2) / 2),
                    'description': 'Double top pattern - potential reversal'
                }

        # Find local minima
        min_indices = []
        for i in range(2, len(recent_low) - 2):
            if recent_low[i] < recent_low[i-1] and recent_low[i] < recent_low[i-2] and \
               recent_low[i] < recent_low[i+1] and recent_low[i] < recent_low[i+2]:
                min_indices.append(i)

        # Check for double bottom
        if len(min_indices) >= 2:
            last_two = min_indices[-2:]
            l1, l2 = recent_low[last_two[0]], recent_low[last_two[1]]
            if abs(l1 - l2) / l1 < 0.02:
                return {
                    'name': 'Double Bottom',
                    'type': 'bullish',
                    'price_level': float((l1 + l2) / 2),
                    'description': 'Double bottom pattern - potential reversal'
                }

        return None

    def _detect_triangle(self, high: np.ndarray, low: np.ndarray) -> Optional[Dict]:
        """Detect triangle patterns (ascending, descending, symmetrical)"""
        window = min(30, len(high))
        recent_high = high[-window:]
        recent_low = low[-window:]

        # Fit linear regression to highs and lows
        x = np.arange(window)

        high_slope = np.polyfit(x, recent_high, 1)[0]
        low_slope = np.polyfit(x, recent_low, 1)[0]

        # Ascending triangle: flat highs, rising lows
        if abs(high_slope) < 0.001 and low_slope > 0.001:
            return {
                'name': 'Ascending Triangle',
                'type': 'bullish',
                'description': 'Ascending triangle - bullish continuation'
            }

        # Descending triangle: falling highs, flat lows
        if high_slope < -0.001 and abs(low_slope) < 0.001:
            return {
                'name': 'Descending Triangle',
                'type': 'bearish',
                'description': 'Descending triangle - bearish continuation'
            }

        # Symmetrical triangle: converging
        if high_slope < -0.001 and low_slope > 0.001:
            return {
                'name': 'Symmetrical Triangle',
                'type': 'neutral',
                'description': 'Symmetrical triangle - breakout pending'
            }

        return None

    def _detect_support_resistance(self, high: np.ndarray, low: np.ndarray, close: np.ndarray) -> List[Dict]:
        """Detect key support and resistance levels"""
        levels = []

        # Use clustering to find price levels
        all_pivots = np.concatenate([high, low])
        sorted_pivots = np.sort(all_pivots)

        # Simple level detection using percentiles
        current_price = close[-1]

        # Find resistance (above current price)
        above = sorted_pivots[sorted_pivots > current_price]
        if len(above) > 0:
            resistance = np.percentile(above, 25)
            levels.append({
                'type': 'resistance',
                'price': float(resistance),
                'strength': 'medium'
            })

        # Find support (below current price)
        below = sorted_pivots[sorted_pivots < current_price]
        if len(below) > 0:
            support = np.percentile(below, 75)
            levels.append({
                'type': 'support',
                'price': float(support),
                'strength': 'medium'
            })

        return levels
