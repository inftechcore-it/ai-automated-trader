/**
 * Candlestick Pattern Recognition & Market Behavior Analysis Engine
 * Based on comprehensive Technical Analysis & Groww Candlestick Patterns Guide (38+ patterns)
 */

export const CANDLESTICK_PATTERNS_DB = {
  // BULLISH REVERSAL & BULLISH PATTERNS
  BULLISH_ENGULFING: {
    id: 'BULLISH_ENGULFING',
    name: 'Bullish Engulfing',
    category: 'bullish_reversal',
    candlesCount: 2,
    reliability: 5,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'A small bearish red candle followed by a larger bullish green candle whose body completely engulfs the prior candle body.',
    psychology: 'Sellers dominated early, but intense buying pressure entered, overwhelming sellers and pushing price well above the prior open.',
    howToTrade: 'Enter long on the open of the next candle or after confirmation. Place stop loss below the low of the engulfing green candle. Target 1.5x - 2x risk.',
    icon: 'bullish-engulfing'
  },
  HAMMER: {
    id: 'HAMMER',
    name: 'Hammer',
    category: 'bullish_reversal',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'Small body at the upper end of the trading range with a long lower shadow (at least 2x the body) and little or no upper shadow at the bottom of a downtrend.',
    psychology: 'Bears drove the price down significantly during the session, but bulls aggressively rejected the lower prices and pushed price back near the open.',
    howToTrade: 'Wait for the next candle to close green above the hammer body. Place stop loss just below the hammer low wick. Target next resistance level.',
    icon: 'hammer'
  },
  MORNING_STAR: {
    id: 'MORNING_STAR',
    name: 'Morning Star',
    category: 'bullish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: '3-candle pattern: (1) Long bearish red candle, (2) Small-bodied star gapping down, (3) Strong bullish green candle closing above the 50% midpoint of the first candle.',
    psychology: 'Shows sellers losing momentum (star) and buyers seizing decisive control (third candle), converting downtrend to uptrend.',
    howToTrade: 'Enter buy position upon completion of the 3rd candle. Stop loss below the low of the middle star candle.',
    icon: 'morning-star'
  },
  PIERCING_LINE: {
    id: 'PIERCING_LINE',
    name: 'Piercing Line',
    category: 'bullish_reversal',
    candlesCount: 2,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: '2-candle pattern: (1) Long red candle, (2) Green candle opening lower than previous close/low but closing above 50% of the red candle body.',
    psychology: 'Bears opened strong but bulls mounted a sharp counter-offensive, penetrating deep into bear territory.',
    howToTrade: 'Buy on next candle confirmation. Stop loss below the low of the piercing green candle.',
    icon: 'piercing-line'
  },
  BULLISH_HARAMI: {
    id: 'BULLISH_HARAMI',
    name: 'Bullish Harami',
    category: 'bullish_reversal',
    candlesCount: 2,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'A large bearish red candle followed by a small bullish green candle completely contained inside the previous candle body (an "inside bar").',
    psychology: 'Selling pressure has abruptly stalled; bears could not push prices lower, signaling hesitation and imminent trend reversal.',
    howToTrade: 'Wait for a 3rd bullish confirmation candle closing above the mother candle midpoint. Stop loss below mother candle low.',
    icon: 'bullish-harami'
  },
  THREE_WHITE_SOLDIERS: {
    id: 'THREE_WHITE_SOLDIERS',
    name: 'Three White Soldiers',
    category: 'bullish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'Three consecutive long green candles with higher closes and small wicks, each opening inside or near the previous candle body.',
    psychology: 'Sustained, continuous buying pressure across 3 periods signaling a strong structural bull market shift.',
    howToTrade: 'Enter long with trailing stop below the low of the 2nd or 3rd soldier candle. High win-rate momentum signal.',
    icon: 'three-white-soldiers'
  },
  INVERTED_HAMMER: {
    id: 'INVERTED_HAMMER',
    name: 'Inverted Hammer',
    category: 'bullish_reversal',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'Small body near the session low with a long upper shadow (at least 2x body) and little lower shadow at the bottom of a downtrend.',
    psychology: 'Bulls tested higher price levels aggressively. Even though bears pushed it back down, buying interest has officially entered.',
    howToTrade: 'Wait for a bullish confirmation candle on the next period. Stop loss below the inverted hammer low.',
    icon: 'inverted-hammer'
  },
  DRAGONFLY_DOJI: {
    id: 'DRAGONFLY_DOJI',
    name: 'Dragonfly Doji',
    category: 'bullish_reversal',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'Open, High, and Close are virtually equal at the very top of the candle with an exceptionally long lower shadow.',
    psychology: 'Extreme rejection of lower prices; bears tried to crash the market but bulls absorbed all supply back to the high.',
    howToTrade: 'Buy upon candle close or confirmation. Stop loss at the bottom tip of the long lower wick.',
    icon: 'dragonfly-doji'
  },
  BULLISH_ABANDONED_BABY: {
    id: 'BULLISH_ABANDONED_BABY',
    name: 'Bullish Abandoned Baby',
    category: 'bullish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'Rare 3-candle pattern: (1) Long red candle, (2) Doji gapping down leaving a clean space gap, (3) Green candle gapping up away from the Doji.',
    psychology: 'Total exhaustion gap on the doji followed by explosive gap-up buying. One of the highest probability reversal patterns in technical analysis.',
    howToTrade: 'Immediate buy on the gap-up confirmation. Stop loss just below the abandoned doji low.',
    icon: 'bullish-abandoned-baby'
  },
  THREE_INSIDE_UP: {
    id: 'THREE_INSIDE_UP',
    name: 'Three Inside Up',
    category: 'bullish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: '3-candle confirmed pattern: (1) Large bearish candle, (2) Small bullish candle inside 1st body (Harami), (3) Third bullish candle closing above 1st candle high.',
    psychology: 'Provides explicit confirmation to the Bullish Harami, proving buyers have taken control.',
    howToTrade: 'Enter buy at the close of candle 3. Stop loss below the lowest point of the 3 candles.',
    icon: 'three-inside-up'
  },
  THREE_OUTSIDE_UP: {
    id: 'THREE_OUTSIDE_UP',
    name: 'Three Outside Up',
    category: 'bullish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: '3-candle confirmed pattern: (1) Small bearish candle, (2) Large Bullish Engulfing candle, (3) Bullish candle closing higher than the 2nd candle.',
    psychology: 'Validates the bullish engulfing pattern with strong momentum continuation.',
    howToTrade: 'Enter long on the close of candle 3. Stop loss below candle 2 low.',
    icon: 'three-outside-up'
  },
  MORNING_DOJI_STAR: {
    id: 'MORNING_DOJI_STAR',
    name: 'Morning Doji Star',
    category: 'bullish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'Similar to Morning Star, but the middle star is a Doji, representing total indecision before a strong bullish 3rd candle breakout.',
    psychology: 'Sellers hit a brick wall of indecision, followed by violent buyer takeover.',
    howToTrade: 'Enter long on completion of the 3rd candle with stop loss below the doji star.',
    icon: 'morning-doji-star'
  },
  TWEEZER_BOTTOM: {
    id: 'TWEEZER_BOTTOM',
    name: 'Tweezer Bottom',
    category: 'bullish_reversal',
    candlesCount: 2,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'Two consecutive candles with matching or nearly identical lows at the bottom of a downtrend.',
    psychology: 'Identifies an impenetrable support floor where bears failed twice to push lower.',
    howToTrade: 'Buy when the 2nd candle closes or exceeds the high of the 1st candle. Stop loss just below the double low.',
    icon: 'tweezer-bottom'
  },
  BULLISH_MARUBOZU: {
    id: 'BULLISH_MARUBOZU',
    name: 'Bullish Marubozu',
    category: 'bullish_continuation',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'any',
    description: 'A long green body with virtually no upper or lower wicks (open = low, close = high).',
    psychology: 'Total one-sided buying dominance throughout the entire session.',
    howToTrade: 'Trade in the direction of the marubozu. Stop loss at the low of the candle.',
    icon: 'bullish-marubozu'
  },
  BULLISH_COUNTERATTACK: {
    id: 'BULLISH_COUNTERATTACK',
    name: 'Bullish Counterattack',
    category: 'bullish_reversal',
    candlesCount: 2,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'A long red candle followed by a green candle that opened gap down but rallied aggressively to close at the exact same price as the prior candle close.',
    psychology: 'Bears opened with victory in sight, but bulls completely erased the intraday deficit.',
    howToTrade: 'Buy with confirmation on next candle. Stop loss at the 2nd candle low.',
    icon: 'bullish-counterattack'
  },
  BULLISH_BELT_HOLD: {
    id: 'BULLISH_BELT_HOLD',
    name: 'Bullish Belt Hold',
    category: 'bullish_reversal',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'downtrend',
    description: 'A tall green candle that opens at its absolute low (no lower shadow) and rallies upwards.',
    psychology: 'From the opening bell, buyers never allowed the price to drop even 1 cent below the open.',
    howToTrade: 'Buy on close. Stop loss at the open/low of the candle.',
    icon: 'bullish-belt-hold'
  },
  UPSIDE_TASUKI_GAP: {
    id: 'UPSIDE_TASUKI_GAP',
    name: 'Upside Tasuki Gap',
    category: 'bullish_continuation',
    candlesCount: 3,
    reliability: 4,
    sentiment: 'bullish',
    trendRequired: 'uptrend',
    description: 'In an uptrend: (1) Long green candle, (2) Green candle gapping up, (3) Red candle opening inside 2nd body and dipping into the gap without closing it.',
    psychology: 'Healthy profit-taking retest of the gap zone; buyers defended the gap, signaling trend continuation.',
    howToTrade: 'Buy when price breaks above the 2nd candle high. Stop loss below the gap floor.',
    icon: 'upside-tasuki-gap'
  },
  RISING_THREE_METHODS: {
    id: 'RISING_THREE_METHODS',
    name: 'Rising Three Methods',
    category: 'bullish_continuation',
    candlesCount: 5,
    reliability: 5,
    sentiment: 'bullish',
    trendRequired: 'uptrend',
    description: 'A long green candle, followed by 3 small red candles that remain inside the 1st candle range, followed by a powerful long green candle closing at a new high.',
    psychology: 'Slight consolidation pullback completely absorbed by institutional buyers who launch the next impulsive leg up.',
    howToTrade: 'Enter on close of the 5th breakout candle. Stop loss below the low of the 3 consolidation candles.',
    icon: 'rising-three-methods'
  },

  // BEARISH REVERSAL & BEARISH PATTERNS
  BEARISH_ENGULFING: {
    id: 'BEARISH_ENGULFING',
    name: 'Bearish Engulfing',
    category: 'bearish_reversal',
    candlesCount: 2,
    reliability: 5,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'A small green bullish candle followed by a large red bearish candle whose body completely engulfs the previous candle body.',
    psychology: 'Bulls pushed price higher initially, but sudden overwhelming sell orders submerged all buy liquidity.',
    howToTrade: 'Sell/Short upon close or on next candle open. Stop loss above the engulfing red candle high.',
    icon: 'bearish-engulfing'
  },
  HANGING_MAN: {
    id: 'HANGING_MAN',
    name: 'Hanging Man',
    category: 'bearish_reversal',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'Small body at the top of an uptrend with a long lower shadow (at least 2x the body) and little or no upper shadow.',
    psychology: 'Warning signal that heavy selling pressure occurred during the day; the uptrend is becoming vulnerable and losing support.',
    howToTrade: 'Wait for next candle to close below the hanging man body. Stop loss above the candle high.',
    icon: 'hanging-man'
  },
  EVENING_STAR: {
    id: 'EVENING_STAR',
    name: 'Evening Star',
    category: 'bearish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: '3-candle pattern: (1) Long green candle, (2) Small star body gapping up, (3) Long red candle closing well below the 50% midpoint of the first candle.',
    psychology: 'The exact opposite of Morning Star. Bullish momentum stalled at the top star, followed by violent bearish capitulation.',
    howToTrade: 'Sell/Short upon completion of the 3rd candle. Stop loss above the high of the middle star.',
    icon: 'evening-star'
  },
  DARK_CLOUD_COVER: {
    id: 'DARK_CLOUD_COVER',
    name: 'Dark Cloud Cover',
    category: 'bearish_reversal',
    candlesCount: 2,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: '2-candle pattern: (1) Strong green candle, (2) Red candle opening higher than previous high but closing below 50% of the previous green candle body.',
    psychology: 'Bulls opened with optimism to a new high, but sellers seized the session and forced price deep down into the prior day gains.',
    howToTrade: 'Sell/Short on next candle confirmation. Stop loss above the high of the red candle.',
    icon: 'dark-cloud-cover'
  },
  BEARISH_HARAMI: {
    id: 'BEARISH_HARAMI',
    name: 'Bearish Harami',
    category: 'bearish_reversal',
    candlesCount: 2,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'A large bullish green candle followed by a small bearish red candle completely contained inside the body of the previous candle.',
    psychology: 'Buying momentum has abruptly hit a wall; bulls could not make a higher high, indicating distribution.',
    howToTrade: 'Wait for 3rd confirmation candle closing below mother candle body. Stop loss above mother candle high.',
    icon: 'bearish-harami'
  },
  THREE_BLACK_CROWS: {
    id: 'THREE_BLACK_CROWS',
    name: 'Three Black Crows',
    category: 'bearish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'Three consecutive long red candles with lower closes and small wicks, each opening inside or near the prior candle body.',
    psychology: 'Severe, relentless institutional selling over 3 consecutive periods; complete trend collapse.',
    howToTrade: 'Short position with trailing stop above the 2nd or 3rd crow candle high. High reliability bearish signal.',
    icon: 'three-black-crows'
  },
  SHOOTING_STAR: {
    id: 'SHOOTING_STAR',
    name: 'Shooting Star',
    category: 'bearish_reversal',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'Small body near the session low with a long upper shadow (at least 2x the body) and little lower shadow at the top of an uptrend.',
    psychology: 'Bulls drove price up to new highs, but bears counter-attacked aggressively, forcing the close all the way back down near the open.',
    howToTrade: 'Sell/Short on the next candle confirmation. Stop loss above the upper wick high.',
    icon: 'shooting-star'
  },
  GRAVESTONE_DOJI: {
    id: 'GRAVESTONE_DOJI',
    name: 'Gravestone Doji',
    category: 'bearish_reversal',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'Open, Low, and Close are virtually equal at the very bottom of the candle with an exceptionally long upper shadow.',
    psychology: 'The ultimate symbol of bulls "laying in the grave" — buyers tried to rally, but sellers completely extinguished the move.',
    howToTrade: 'Sell/Short upon candle close or confirmation. Stop loss at the top of the upper wick.',
    icon: 'gravestone-doji'
  },
  BEARISH_ABANDONED_BABY: {
    id: 'BEARISH_ABANDONED_BABY',
    name: 'Bearish Abandoned Baby',
    category: 'bearish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'Rare 3-candle pattern: (1) Long green candle, (2) Doji gapping up leaving a clean space gap, (3) Red candle gapping down below the Doji.',
    psychology: 'Exhaustion gap at peak followed by panic gap-down dumping. High win-rate bearish reversal.',
    howToTrade: 'Immediate short/exit on the gap-down confirmation. Stop loss above the top of the abandoned doji.',
    icon: 'bearish-abandoned-baby'
  },
  THREE_INSIDE_DOWN: {
    id: 'THREE_INSIDE_DOWN',
    name: 'Three Inside Down',
    category: 'bearish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: '3-candle confirmed pattern: (1) Large bullish candle, (2) Small bearish candle inside 1st body (Bearish Harami), (3) Third bearish candle closing below 1st candle low.',
    psychology: 'Confirmed breakdown proving buyers are trapped and sellers are in total control.',
    howToTrade: 'Enter short at the close of candle 3. Stop loss above the highest point of the 3 candles.',
    icon: 'three-inside-down'
  },
  THREE_OUTSIDE_DOWN: {
    id: 'THREE_OUTSIDE_DOWN',
    name: 'Three Outside Down',
    category: 'bearish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: '3-candle confirmed pattern: (1) Small bullish candle, (2) Large Bearish Engulfing candle, (3) Bearish candle closing below the 2nd candle low.',
    psychology: 'Validates bearish engulfing with decisive follow-through selling volume.',
    howToTrade: 'Enter short on close of candle 3. Stop loss above candle 2 high.',
    icon: 'three-outside-down'
  },
  EVENING_DOJI_STAR: {
    id: 'EVENING_DOJI_STAR',
    name: 'Evening Doji Star',
    category: 'bearish_reversal',
    candlesCount: 3,
    reliability: 5,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'Similar to Evening Star, but the middle candle is a Doji, representing total market indecision at peak resistance before a major drop.',
    psychology: 'Bulls ran out of buying fuel at resistance, triggering heavy seller liquidation.',
    howToTrade: 'Sell/Short on close of candle 3 with stop loss above the doji high.',
    icon: 'evening-doji-star'
  },
  TWEEZER_TOP: {
    id: 'TWEEZER_TOP',
    name: 'Tweezer Top',
    category: 'bearish_reversal',
    candlesCount: 2,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'Two consecutive candles with matching or nearly identical highs at the peak of an uptrend.',
    psychology: 'Identifies an immovable ceiling/resistance level where bulls failed twice to break through.',
    howToTrade: 'Sell/Short when the 2nd candle closes red. Stop loss just above the double high.',
    icon: 'tweezer-top'
  },
  BEARISH_MARUBOZU: {
    id: 'BEARISH_MARUBOZU',
    name: 'Bearish Marubozu',
    category: 'bearish_continuation',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'any',
    description: 'A long red body with virtually no upper or lower wicks (open = high, close = low).',
    psychology: 'Total, ruthless seller dominance from open to close.',
    howToTrade: 'Short in the direction of the marubozu. Stop loss at the high of the candle.',
    icon: 'bearish-marubozu'
  },
  BEARISH_COUNTERATTACK: {
    id: 'BEARISH_COUNTERATTACK',
    name: 'Bearish Counterattack',
    category: 'bearish_reversal',
    candlesCount: 2,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'A long green candle followed by a red candle that opened gap up but tumbled to close at the exact same level as the prior green close.',
    psychology: 'Bulls thought they had a gap breakout, but bears immediately intercepted and crushed the advance.',
    howToTrade: 'Sell/Short on next candle confirmation. Stop loss at the 2nd candle high.',
    icon: 'bearish-counterattack'
  },
  BEARISH_BELT_HOLD: {
    id: 'BEARISH_BELT_HOLD',
    name: 'Bearish Belt Hold',
    category: 'bearish_reversal',
    candlesCount: 1,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'uptrend',
    description: 'A tall red candle that opens at its absolute high (no upper shadow) and sells off all session.',
    psychology: 'From the opening tick, sellers slammed the market lower without letting bulls gain any ground.',
    howToTrade: 'Sell/Short on close. Stop loss at the open/high of the candle.',
    icon: 'bearish-belt-hold'
  },
  DOWNSIDE_TASUKI_GAP: {
    id: 'DOWNSIDE_TASUKI_GAP',
    name: 'Downside Tasuki Gap',
    category: 'bearish_continuation',
    candlesCount: 3,
    reliability: 4,
    sentiment: 'bearish',
    trendRequired: 'downtrend',
    description: 'In a downtrend: (1) Long red candle, (2) Red candle gapping down, (3) Green candle opening in 2nd body and rising into the gap without closing it.',
    psychology: 'Weak dead-cat bounce fails to fill the gap; bears retain complete structural control.',
    howToTrade: 'Sell/Short when price breaks below the 2nd candle low. Stop loss above the gap ceiling.',
    icon: 'downside-tasuki-gap'
  },
  FALLING_THREE_METHODS: {
    id: 'FALLING_THREE_METHODS',
    name: 'Falling Three Methods',
    category: 'bearish_continuation',
    candlesCount: 5,
    reliability: 5,
    sentiment: 'bearish',
    trendRequired: 'downtrend',
    description: 'A long red candle, followed by 3 small green candles inside the 1st candle range, followed by a decisive long red candle closing at a new low.',
    psychology: 'Temporary counter-trend correction runs out of steam, and major sellers slam price to fresh lows.',
    howToTrade: 'Enter short on close of the 5th breakdown candle. Stop loss above the 3 consolidation highs.',
    icon: 'falling-three-methods'
  },

  // NEUTRAL & INDECISION PATTERNS
  DOJI: {
    id: 'DOJI',
    name: 'Standard Doji',
    category: 'neutral_indecision',
    candlesCount: 1,
    reliability: 3,
    sentiment: 'neutral',
    trendRequired: 'any',
    description: 'Open and Close are virtually equal with short upper and lower shadows, creating a thin cross or plus sign.',
    psychology: 'Complete equilibrium between buyers and sellers; hesitation and potential turning point ahead.',
    howToTrade: 'Do not trade in isolation. Wait for the subsequent breakout candle to define trend direction.',
    icon: 'doji'
  },
  LONG_LEGGED_DOJI: {
    id: 'LONG_LEGGED_DOJI',
    name: 'Long-Legged Doji',
    category: 'neutral_indecision',
    candlesCount: 1,
    reliability: 3,
    sentiment: 'neutral',
    trendRequired: 'any',
    description: 'Open and Close are virtually identical, with unusually long upper and lower shadows ("Rickshaw Man").',
    psychology: 'Violent tug-of-war where both bulls and bears fought hard but neither could establish dominance.',
    howToTrade: 'Wait for break of either the extreme high (bullish trigger) or extreme low (bearish trigger).',
    icon: 'long-legged-doji'
  },
  SPINNING_TOP: {
    id: 'SPINNING_TOP',
    name: 'Spinning Top',
    category: 'neutral_indecision',
    candlesCount: 1,
    reliability: 3,
    sentiment: 'neutral',
    trendRequired: 'any',
    description: 'Small real body with equal upper and lower shadows extending beyond the body length.',
    psychology: 'Market consolidation and lack of directional conviction.',
    howToTrade: 'Watch for support/resistance confirmation. A spinning top at key levels often precedes a reversal.',
    icon: 'spinning-top'
  },
  HIGH_WAVE: {
    id: 'HIGH_WAVE',
    name: 'High Wave Candle',
    category: 'neutral_indecision',
    candlesCount: 1,
    reliability: 3,
    sentiment: 'neutral',
    trendRequired: 'any',
    description: 'Very small body with unusually elongated upper and lower wicks, showing extreme volatility without direction.',
    psychology: 'Extreme confusion and turmoil in the market before clarity emerges.',
    howToTrade: 'Reduce position size or wait on sidelines until a clean directional bar confirms next trend.',
    icon: 'high-wave'
  }
};

/**
 * Helper to normalize and validate OHLCV candle object
 */
export function normalizeCandle(c) {
  return {
    time: c.time || c.timestamp || Date.now(),
    open: Number(c.open || 0),
    high: Number(c.high || 0),
    low: Number(c.low || 0),
    close: Number(c.close || 0),
    volume: Number(c.volume || 0)
  };
}

/**
 * Calculate candle properties
 */
function getCandleMetrics(c) {
  const body = Math.abs(c.close - c.open);
  const range = Math.max(0.000001, c.high - c.low);
  const isBullish = c.close >= c.open;
  const upperWick = isBullish ? c.high - c.close : c.high - c.open;
  const lowerWick = isBullish ? c.open - c.low : c.close - c.low;
  const bodyPercent = (body / range) * 100;
  const midpoint = (c.open + c.close) / 2;
  const bodyTop = Math.max(c.open, c.close);
  const bodyBottom = Math.min(c.open, c.close);

  return {
    body,
    range,
    isBullish,
    isBearish: !isBullish,
    upperWick,
    lowerWick,
    bodyPercent,
    midpoint,
    bodyTop,
    bodyBottom
  };
}

/**
 * Determine prevailing trend prior to candle index `idx`
 */
function getPriorTrend(candles, idx, lookback = 5) {
  if (idx < 3) return 'neutral';
  const start = Math.max(0, idx - lookback);
  const slice = candles.slice(start, idx);
  if (slice.length < 2) return 'neutral';

  const first = slice[0].close;
  const last = slice[slice.length - 1].close;
  const pctChange = ((last - first) / first) * 100;

  // Check moving average slope
  let higherCloses = 0;
  let lowerCloses = 0;
  for (let i = 1; i < slice.length; i++) {
    if (slice[i].close > slice[i - 1].close) higherCloses++;
    else if (slice[i].close < slice[i - 1].close) lowerCloses++;
  }

  if (pctChange <= -1.2 || lowerCloses >= slice.length * 0.6) return 'downtrend';
  if (pctChange >= 1.2 || higherCloses >= slice.length * 0.6) return 'uptrend';
  return 'neutral';
}

/**
 * Detect Candlestick Patterns on a series of OHLCV candles
 * @param {Array} rawCandles - Array of OHLCV candles
 * @returns {Array} List of detected patterns with index, timestamp, pattern details, and trading signals
 */
export function detectCandlestickPatterns(rawCandles) {
  if (!rawCandles || rawCandles.length < 2) return [];
  const candles = rawCandles.map(normalizeCandle);
  const detected = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const m = getCandleMetrics(c);
    const trend = getPriorTrend(candles, i, 5);

    // 1-CANDLE PATTERNS
    // Doji variations
    const isDoji = m.bodyPercent <= 8 || m.body / (c.close || 1) <= 0.0015;
    if (isDoji) {
      if (m.lowerWick >= m.range * 0.65 && m.upperWick <= m.range * 0.15 && (trend === 'downtrend' || trend === 'neutral')) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.DRAGONFLY_DOJI,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'downtrend' ? 88 : 75,
          targetPrice: +(c.close + m.range * 1.5).toFixed(4),
          stopLoss: +(c.low * 0.998).toFixed(4)
        });
      } else if (m.upperWick >= m.range * 0.65 && m.lowerWick <= m.range * 0.15 && (trend === 'uptrend' || trend === 'neutral')) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.GRAVESTONE_DOJI,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'uptrend' ? 88 : 75,
          targetPrice: +(c.close - m.range * 1.5).toFixed(4),
          stopLoss: +(c.high * 1.002).toFixed(4)
        });
      } else if (m.upperWick >= m.range * 0.35 && m.lowerWick >= m.range * 0.35) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.LONG_LEGGED_DOJI,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 70,
          targetPrice: +(c.close + (trend === 'downtrend' ? m.range : -m.range)).toFixed(4),
          stopLoss: +(trend === 'downtrend' ? c.low : c.high).toFixed(4)
        });
      } else {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.DOJI,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 65,
          targetPrice: +(c.close + (trend === 'downtrend' ? m.range : -m.range)).toFixed(4),
          stopLoss: +(trend === 'downtrend' ? c.low : c.high).toFixed(4)
        });
      }
    }

    // Hammer & Inverted Hammer (Downtrend)
    if (trend === 'downtrend' || i >= 2) {
      // Hammer: small body at top, lower wick >= 2 * body, little upper wick
      if (m.lowerWick >= m.body * 2 && m.upperWick <= m.body * 0.6 && m.bodyPercent >= 10 && m.bodyPercent <= 45) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.HAMMER,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'downtrend' ? 90 : 75,
          targetPrice: +(c.close + m.range * 1.8).toFixed(4),
          stopLoss: +(c.low * 0.997).toFixed(4)
        });
      }
      // Inverted Hammer: small body at bottom, upper wick >= 2 * body, little lower wick
      if (m.upperWick >= m.body * 2 && m.lowerWick <= m.body * 0.6 && m.bodyPercent >= 10 && m.bodyPercent <= 45) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.INVERTED_HAMMER,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'downtrend' ? 85 : 70,
          targetPrice: +(c.close + m.range * 1.6).toFixed(4),
          stopLoss: +(c.low * 0.997).toFixed(4)
        });
      }
    }

    // Hanging Man & Shooting Star (Uptrend)
    if (trend === 'uptrend' || i >= 2) {
      // Hanging Man: small body at top, lower wick >= 2 * body
      if (m.lowerWick >= m.body * 2 && m.upperWick <= m.body * 0.5 && m.bodyPercent >= 10 && m.bodyPercent <= 45) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.HANGING_MAN,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'uptrend' ? 85 : 70,
          targetPrice: +(c.close - m.range * 1.6).toFixed(4),
          stopLoss: +(c.high * 1.003).toFixed(4)
        });
      }
      // Shooting Star: small body at bottom, upper wick >= 2 * body
      if (m.upperWick >= m.body * 2 && m.lowerWick <= m.body * 0.5 && m.bodyPercent >= 10 && m.bodyPercent <= 45) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.SHOOTING_STAR,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'uptrend' ? 92 : 78,
          targetPrice: +(c.close - m.range * 1.8).toFixed(4),
          stopLoss: +(c.high * 1.003).toFixed(4)
        });
      }
    }

    // Marubozu & Belt Hold
    if (m.bodyPercent >= 88) {
      if (m.isBullish) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BULLISH_MARUBOZU,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 86,
          targetPrice: +(c.close + m.body * 1.2).toFixed(4),
          stopLoss: +(c.open * 0.997).toFixed(4)
        });
      } else {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BEARISH_MARUBOZU,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 86,
          targetPrice: +(c.close - m.body * 1.2).toFixed(4),
          stopLoss: +(c.open * 1.003).toFixed(4)
        });
      }
    } else if (m.bodyPercent >= 70) {
      if (m.isBullish && m.lowerWick <= m.range * 0.05 && trend === 'downtrend') {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BULLISH_BELT_HOLD,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 80,
          targetPrice: +(c.close + m.body * 1.3).toFixed(4),
          stopLoss: +(c.open * 0.998).toFixed(4)
        });
      } else if (m.isBearish && m.upperWick <= m.range * 0.05 && trend === 'uptrend') {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BEARISH_BELT_HOLD,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 80,
          targetPrice: +(c.close - m.body * 1.3).toFixed(4),
          stopLoss: +(c.open * 1.002).toFixed(4)
        });
      }
    }

    // Spinning Top & High Wave
    if (m.bodyPercent >= 10 && m.bodyPercent <= 30 && m.upperWick >= m.range * 0.3 && m.lowerWick >= m.range * 0.3) {
      if (m.range >= (candles[Math.max(0, i - 1)]?.high - candles[Math.max(0, i - 1)]?.low) * 1.5) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.HIGH_WAVE,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 68,
          targetPrice: +(c.close + (trend === 'downtrend' ? m.range : -m.range)).toFixed(4),
          stopLoss: +(trend === 'downtrend' ? c.low : c.high).toFixed(4)
        });
      } else {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.SPINNING_TOP,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 65,
          targetPrice: +(c.close + (trend === 'downtrend' ? m.range : -m.range)).toFixed(4),
          stopLoss: +(trend === 'downtrend' ? c.low : c.high).toFixed(4)
        });
      }
    }

    // 2-CANDLE PATTERNS
    if (i >= 1) {
      const prev = candles[i - 1];
      const prevM = getCandleMetrics(prev);

      // Bullish Engulfing: prev is bearish, curr is bullish, curr body engulfs prev body
      if (prevM.isBearish && m.isBullish && c.open <= prev.close && c.close >= prev.open && m.body > prevM.body) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BULLISH_ENGULFING,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'downtrend' ? 94 : 82,
          targetPrice: +(c.close + m.range * 1.5).toFixed(4),
          stopLoss: +(Math.min(c.low, prev.low) * 0.997).toFixed(4)
        });
      }

      // Bearish Engulfing: prev is bullish, curr is bearish, curr body engulfs prev body
      if (prevM.isBullish && m.isBearish && c.open >= prev.close && c.close <= prev.open && m.body > prevM.body) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BEARISH_ENGULFING,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'uptrend' ? 94 : 82,
          targetPrice: +(c.close - m.range * 1.5).toFixed(4),
          stopLoss: +(Math.max(c.high, prev.high) * 1.003).toFixed(4)
        });
      }

      // Piercing Line: prev bearish, curr bullish opens below prev low/close and closes above prev midpoint
      if (prevM.isBearish && m.isBullish && c.open <= prev.close && c.close > prevM.midpoint && c.close < prev.open) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.PIERCING_LINE,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'downtrend' ? 88 : 76,
          targetPrice: +(c.close + prevM.range * 1.4).toFixed(4),
          stopLoss: +(c.low * 0.997).toFixed(4)
        });
      }

      // Dark Cloud Cover: prev bullish, curr bearish opens above prev high/close and closes below prev midpoint
      if (prevM.isBullish && m.isBearish && c.open >= prev.close && c.close < prevM.midpoint && c.close > prev.open) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.DARK_CLOUD_COVER,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'uptrend' ? 88 : 76,
          targetPrice: +(c.close - prevM.range * 1.4).toFixed(4),
          stopLoss: +(c.high * 1.003).toFixed(4)
        });
      }

      // Bullish Harami: prev large bearish, curr small bullish inside prev body
      if (prevM.isBearish && m.isBullish && c.open >= prev.close && c.close <= prev.open && m.body <= prevM.body * 0.6) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BULLISH_HARAMI,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'downtrend' ? 84 : 72,
          targetPrice: +(prev.open + prevM.range * 0.5).toFixed(4),
          stopLoss: +(prev.low * 0.997).toFixed(4)
        });
      }

      // Bearish Harami: prev large bullish, curr small bearish inside prev body
      if (prevM.isBullish && m.isBearish && c.open <= prev.close && c.close >= prev.open && m.body <= prevM.body * 0.6) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BEARISH_HARAMI,
          index: i,
          time: c.time,
          price: c.close,
          confidence: trend === 'uptrend' ? 84 : 72,
          targetPrice: +(prev.open - prevM.range * 0.5).toFixed(4),
          stopLoss: +(prev.high * 1.003).toFixed(4)
        });
      }

      // Tweezer Bottom: matching lows
      const lowDiff = Math.abs(c.low - prev.low) / Math.max(c.low, 0.0001);
      if (lowDiff <= 0.0015 && prevM.isBearish && m.isBullish && trend === 'downtrend') {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.TWEEZER_BOTTOM,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 85,
          targetPrice: +(c.close + prevM.range * 1.5).toFixed(4),
          stopLoss: +(Math.min(c.low, prev.low) * 0.997).toFixed(4)
        });
      }

      // Tweezer Top: matching highs
      const highDiff = Math.abs(c.high - prev.high) / Math.max(c.high, 0.0001);
      if (highDiff <= 0.0015 && prevM.isBullish && m.isBearish && trend === 'uptrend') {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.TWEEZER_TOP,
          index: i,
          time: c.time,
          price: c.close,
          confidence: 85,
          targetPrice: +(c.close - prevM.range * 1.5).toFixed(4),
          stopLoss: +(Math.max(c.high, prev.high) * 1.003).toFixed(4)
        });
      }

      // Counterattack Lines
      const closeDiff = Math.abs(c.close - prev.close) / Math.max(c.close, 0.0001);
      if (closeDiff <= 0.002) {
        if (prevM.isBearish && m.isBullish && c.open < prev.close && trend === 'downtrend') {
          detected.push({
            ...CANDLESTICK_PATTERNS_DB.BULLISH_COUNTERATTACK,
            index: i,
            time: c.time,
            price: c.close,
            confidence: 80,
            targetPrice: +(c.close + m.range * 1.3).toFixed(4),
            stopLoss: +(c.low * 0.997).toFixed(4)
          });
        } else if (prevM.isBullish && m.isBearish && c.open > prev.close && trend === 'uptrend') {
          detected.push({
            ...CANDLESTICK_PATTERNS_DB.BEARISH_COUNTERATTACK,
            index: i,
            time: c.time,
            price: c.close,
            confidence: 80,
            targetPrice: +(c.close - m.range * 1.3).toFixed(4),
            stopLoss: +(c.high * 1.003).toFixed(4)
          });
        }
      }
    }

    // 3-CANDLE PATTERNS
    if (i >= 2) {
      const c1 = candles[i - 2];
      const c2 = candles[i - 1];
      const c3 = candles[i];
      const m1 = getCandleMetrics(c1);
      const m2 = getCandleMetrics(c2);
      const m3 = getCandleMetrics(c3);

      // Morning Star & Morning Doji Star
      if (m1.isBearish && m3.isBullish && m2.body <= m1.body * 0.45 && c2.close < c1.close && c3.close >= m1.midpoint) {
        const isDojiStar = m2.bodyPercent <= 10;
        const patternObj = isDojiStar ? CANDLESTICK_PATTERNS_DB.MORNING_DOJI_STAR : CANDLESTICK_PATTERNS_DB.MORNING_STAR;
        detected.push({
          ...patternObj,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 93,
          targetPrice: +(c3.close + m1.range * 1.6).toFixed(4),
          stopLoss: +(c2.low * 0.997).toFixed(4)
        });
      }

      // Evening Star & Evening Doji Star
      if (m1.isBullish && m3.isBearish && m2.body <= m1.body * 0.45 && c2.close > c1.close && c3.close <= m1.midpoint) {
        const isDojiStar = m2.bodyPercent <= 10;
        const patternObj = isDojiStar ? CANDLESTICK_PATTERNS_DB.EVENING_DOJI_STAR : CANDLESTICK_PATTERNS_DB.EVENING_STAR;
        detected.push({
          ...patternObj,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 93,
          targetPrice: +(c3.close - m1.range * 1.6).toFixed(4),
          stopLoss: +(c2.high * 1.003).toFixed(4)
        });
      }

      // Bullish Abandoned Baby (Gap down doji, gap up green)
      if (m1.isBearish && m3.isBullish && m2.bodyPercent <= 8 && c2.high < c1.low && c3.low > c2.high) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BULLISH_ABANDONED_BABY,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 96,
          targetPrice: +(c3.close + m1.range * 2.0).toFixed(4),
          stopLoss: +(c2.low * 0.997).toFixed(4)
        });
      }

      // Bearish Abandoned Baby (Gap up doji, gap down red)
      if (m1.isBullish && m3.isBearish && m2.bodyPercent <= 8 && c2.low > c1.high && c3.high < c2.low) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.BEARISH_ABANDONED_BABY,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 96,
          targetPrice: +(c3.close - m1.range * 2.0).toFixed(4),
          stopLoss: +(c2.high * 1.003).toFixed(4)
        });
      }

      // Three White Soldiers: 3 consecutive bullish candles with higher closes
      if (m1.isBullish && m2.isBullish && m3.isBullish &&
          c2.close > c1.close && c3.close > c2.close &&
          c2.open > c1.open && c3.open > c2.open &&
          m1.upperWick <= m1.range * 0.25 && m2.upperWick <= m2.range * 0.25 && m3.upperWick <= m3.range * 0.25) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.THREE_WHITE_SOLDIERS,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 95,
          targetPrice: +(c3.close + m3.range * 1.8).toFixed(4),
          stopLoss: +(c2.low * 0.997).toFixed(4)
        });
      }

      // Three Black Crows: 3 consecutive bearish candles with lower closes
      if (m1.isBearish && m2.isBearish && m3.isBearish &&
          c2.close < c1.close && c3.close < c2.close &&
          c2.open < c1.open && c3.open < c2.open &&
          m1.lowerWick <= m1.range * 0.25 && m2.lowerWick <= m2.range * 0.25 && m3.lowerWick <= m3.range * 0.25) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.THREE_BLACK_CROWS,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 95,
          targetPrice: +(c3.close - m3.range * 1.8).toFixed(4),
          stopLoss: +(c2.high * 1.003).toFixed(4)
        });
      }

      // Three Inside Up: (1) Bearish, (2) Bullish inside c1, (3) Bullish close > c1.open
      if (m1.isBearish && m2.isBullish && m3.isBullish &&
          c2.open >= c1.close && c2.close <= c1.open && c3.close > c1.open) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.THREE_INSIDE_UP,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 90,
          targetPrice: +(c3.close + m1.range * 1.5).toFixed(4),
          stopLoss: +(Math.min(c1.low, c2.low) * 0.997).toFixed(4)
        });
      }

      // Three Inside Down: (1) Bullish, (2) Bearish inside c1, (3) Bearish close < c1.open
      if (m1.isBullish && m2.isBearish && m3.isBearish &&
          c2.open <= c1.close && c2.close >= c1.open && c3.close < c1.open) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.THREE_INSIDE_DOWN,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 90,
          targetPrice: +(c3.close - m1.range * 1.5).toFixed(4),
          stopLoss: +(Math.max(c1.high, c2.high) * 1.003).toFixed(4)
        });
      }

      // Three Outside Up: (1) Bearish, (2) Bullish Engulfing c1, (3) Bullish close > c2.close
      if (m1.isBearish && m2.isBullish && m3.isBullish &&
          c2.open <= c1.close && c2.close >= c1.open && c3.close > c2.close) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.THREE_OUTSIDE_UP,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 92,
          targetPrice: +(c3.close + m2.range * 1.5).toFixed(4),
          stopLoss: +(c2.low * 0.997).toFixed(4)
        });
      }

      // Three Outside Down: (1) Bullish, (2) Bearish Engulfing c1, (3) Bearish close < c2.close
      if (m1.isBullish && m2.isBearish && m3.isBearish &&
          c2.open >= c1.close && c2.close <= c1.open && c3.close < c2.close) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.THREE_OUTSIDE_DOWN,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 92,
          targetPrice: +(c3.close - m2.range * 1.5).toFixed(4),
          stopLoss: +(c2.high * 1.003).toFixed(4)
        });
      }

      // Upside Tasuki Gap: (1) Green, (2) Gap up Green, (3) Red opens in c2 and closes in gap
      if (m1.isBullish && m2.isBullish && m3.isBearish &&
          c2.open > c1.close && c3.open > c2.open && c3.open < c2.close && c3.close < c2.open && c3.close > c1.close) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.UPSIDE_TASUKI_GAP,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 82,
          targetPrice: +(c2.high + m1.range).toFixed(4),
          stopLoss: +(c1.close * 0.997).toFixed(4)
        });
      }

      // Downside Tasuki Gap: (1) Red, (2) Gap down Red, (3) Green opens in c2 and closes in gap
      if (m1.isBearish && m2.isBearish && m3.isBullish &&
          c2.open < c1.close && c3.open < c2.open && c3.open > c2.close && c3.close > c2.open && c3.close < c1.close) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.DOWNSIDE_TASUKI_GAP,
          index: i,
          time: c3.time,
          price: c3.close,
          confidence: 82,
          targetPrice: +(c2.low - m1.range).toFixed(4),
          stopLoss: +(c1.close * 1.003).toFixed(4)
        });
      }
    }

    // 5-CANDLE PATTERNS
    if (i >= 4) {
      const c1 = candles[i - 4];
      const c2 = candles[i - 3];
      const c3 = candles[i - 2];
      const c4 = candles[i - 1];
      const c5 = candles[i];
      const m1 = getCandleMetrics(c1);
      const m5 = getCandleMetrics(c5);

      // Rising Three Methods: (1) Long green, (2,3,4) Small red within c1 range, (5) Long green closing > c1 high
      if (m1.isBullish && m5.isBullish && m1.bodyPercent >= 60 && m5.bodyPercent >= 60 &&
          c2.close < c2.open && c3.close < c3.open && c4.close < c4.open &&
          c2.low >= c1.low && c3.low >= c1.low && c4.low >= c1.low &&
          c2.high <= c1.high && c3.high <= c1.high && c4.high <= c1.high &&
          c5.close > c1.high) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.RISING_THREE_METHODS,
          index: i,
          time: c5.time,
          price: c5.close,
          confidence: 94,
          targetPrice: +(c5.close + m1.range * 1.8).toFixed(4),
          stopLoss: +(c1.low * 0.997).toFixed(4)
        });
      }

      // Falling Three Methods: (1) Long red, (2,3,4) Small green within c1 range, (5) Long red closing < c1 low
      if (m1.isBearish && m5.isBearish && m1.bodyPercent >= 60 && m5.bodyPercent >= 60 &&
          c2.close > c2.open && c3.close > c3.open && c4.close > c4.open &&
          c2.high <= c1.high && c3.high <= c1.high && c4.high <= c1.high &&
          c2.low >= c1.low && c3.low >= c1.low && c4.low >= c1.low &&
          c5.close < c1.low) {
        detected.push({
          ...CANDLESTICK_PATTERNS_DB.FALLING_THREE_METHODS,
          index: i,
          time: c5.time,
          price: c5.close,
          confidence: 94,
          targetPrice: +(c5.close - m1.range * 1.8).toFixed(4),
          stopLoss: +(c1.high * 1.003).toFixed(4)
        });
      }
    }
  }

  return detected;
}

/**
 * Calculate Technical Indicators (RSI, SMA, EMA, Bollinger, ATR, Support/Resistance)
 */
export function calculateTechnicalMetrics(candles) {
  if (!candles || candles.length < 5) {
    return {
      rsi: 50,
      sma20: 0,
      sma50: 0,
      ema9: 0,
      ema21: 0,
      support: 0,
      resistance: 0,
      atr: 0,
      trend: 'NEUTRAL'
    };
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const len = closes.length;
  const currentPrice = closes[len - 1];

  // Simple Moving Average
  const getSMA = (period) => {
    if (len < period) return closes.reduce((a, b) => a + b, 0) / len;
    const slice = closes.slice(len - period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  // Exponential Moving Average
  const getEMA = (period) => {
    if (len < period) return getSMA(period);
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < len; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  };

  // RSI 14
  let rsi = 50;
  if (len >= 14) {
    let gains = 0;
    let losses = 0;
    for (let i = len - 14; i < len; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / 14;
    const avgLoss = Math.max(0.00001, losses / 14);
    const rs = avgGain / avgLoss;
    rsi = Math.round(100 - (100 / (1 + rs)));
  }

  // Support & Resistance (Pivot highs and lows over last 30 bars)
  const windowSlice = candles.slice(Math.max(0, len - 30));
  const minLow = Math.min(...windowSlice.map(c => c.low));
  const maxHigh = Math.max(...windowSlice.map(c => c.high));

  // ATR (Average True Range)
  let trSum = 0;
  const atrPeriod = Math.min(14, len - 1);
  for (let i = len - atrPeriod; i < len; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trSum += tr;
  }
  const atr = atrPeriod > 0 ? trSum / atrPeriod : currentPrice * 0.02;

  const sma20 = getSMA(20);
  const sma50 = getSMA(50);
  const ema9 = getEMA(9);
  const ema21 = getEMA(21);

  let trend = 'NEUTRAL';
  if (currentPrice > sma20 && ema9 > ema21) trend = 'BULLISH';
  else if (currentPrice < sma20 && ema9 < ema21) trend = 'BEARISH';

  return {
    rsi,
    sma20: +sma20.toFixed(4),
    sma50: +sma50.toFixed(4),
    ema9: +ema9.toFixed(4),
    ema21: +ema21.toFixed(4),
    support: +minLow.toFixed(4),
    resistance: +maxHigh.toFixed(4),
    atr: +atr.toFixed(4),
    trend
  };
}

/**
 * Full Market Behavior and Real-Time Candlestick Prediction Engine
 * @param {Array} rawCandles - Array of OHLCV candles
 * @param {Object} options - Symbol & Exchange metadata
 */
export function analyzeMarketBehavior(rawCandles, options = {}) {
  if (!rawCandles || rawCandles.length < 2) {
    return {
      prediction: 'NEUTRAL',
      confidence: 50,
      score: 0,
      summary: 'Insufficient historical candlestick data for pattern recognition.',
      recentPatterns: [],
      latestPattern: null,
      targetPrice: 0,
      stopLoss: 0,
      riskReward: '1:1.5',
      indicators: {}
    };
  }

  const candles = rawCandles.map(normalizeCandle);
  const lastIndex = candles.length - 1;
  const currentPrice = candles[lastIndex].close;
  const indicators = calculateTechnicalMetrics(candles);
  const allPatterns = detectCandlestickPatterns(candles);

  // Look for patterns detected in the last 3 candles (active recent signals)
  const activePatterns = allPatterns.filter(p => p.index >= lastIndex - 2);
  const latestPattern = activePatterns.length > 0 ? activePatterns[activePatterns.length - 1] : (allPatterns.length > 0 ? allPatterns[allPatterns.length - 1] : null);

  // Score calculation (-100 to +100)
  let score = 0;

  // Technical Indicators weighting (40% weight)
  if (indicators.trend === 'BULLISH') score += 20;
  if (indicators.trend === 'BEARISH') score -= 20;
  if (indicators.rsi < 35) score += 20; // Oversold bounce
  else if (indicators.rsi > 70) score -= 20; // Overbought pullback

  // Candlestick Pattern weighting (60% weight)
  if (latestPattern) {
    const isRecent = latestPattern.index >= lastIndex - 1;
    const factor = isRecent ? 1.0 : 0.6;
    if (latestPattern.sentiment === 'bullish') {
      score += Math.round((latestPattern.confidence || 80) * 0.6 * factor);
    } else if (latestPattern.sentiment === 'bearish') {
      score -= Math.round((latestPattern.confidence || 80) * 0.6 * factor);
    }
  }

  // Bound score between -100 and +100
  score = Math.max(-100, Math.min(100, score));

  // Determine overall prediction
  let prediction = 'NEUTRAL';
  if (score >= 45) prediction = 'STRONG_BUY';
  else if (score >= 15) prediction = 'BUY';
  else if (score <= -45) prediction = 'STRONG_SELL';
  else if (score <= -15) prediction = 'SELL';

  const confidence = Math.min(96, Math.max(55, Math.abs(score) + 20));

  // Target and Stop Loss
  let targetPrice = currentPrice;
  let stopLoss = currentPrice;

  if (latestPattern && latestPattern.targetPrice && latestPattern.stopLoss) {
    targetPrice = latestPattern.targetPrice;
    stopLoss = latestPattern.stopLoss;
  } else if (score > 0) {
    targetPrice = +(currentPrice + indicators.atr * 2.0).toFixed(4);
    stopLoss = +(Math.max(indicators.support, currentPrice - indicators.atr * 1.0)).toFixed(4);
  } else if (score < 0) {
    targetPrice = +(currentPrice - indicators.atr * 2.0).toFixed(4);
    stopLoss = +(Math.min(indicators.resistance, currentPrice + indicators.atr * 1.0)).toFixed(4);
  } else {
    targetPrice = +(currentPrice * 1.02).toFixed(4);
    stopLoss = +(currentPrice * 0.98).toFixed(4);
  }

  const potentialReward = Math.abs(targetPrice - currentPrice);
  const potentialRisk = Math.max(0.0001, Math.abs(currentPrice - stopLoss));
  const rrRatio = (potentialReward / potentialRisk).toFixed(1);
  const riskReward = `1:${rrRatio}`;

  // Summary message formulation
  let summary = '';
  if (latestPattern && latestPattern.index >= lastIndex - 2) {
    const sentimentWord = latestPattern.sentiment === 'bullish' ? 'bullish momentum' : (latestPattern.sentiment === 'bearish' ? 'bearish pressure' : 'market indecision');
    summary = `Detected ${latestPattern.name} pattern at $${latestPattern.price}. Indicates ${sentimentWord} with ${latestPattern.confidence}% historical reliability. RSI is currently at ${indicators.rsi} in ${indicators.trend.toLowerCase()} trend structure.`;
  } else if (indicators.trend === 'BULLISH') {
    summary = `Market maintaining strong bullish structure above 20-period SMA ($${indicators.sma20}). RSI is ${indicators.rsi}. Recommended entry with target $${targetPrice} and stop loss $${stopLoss}.`;
  } else if (indicators.trend === 'BEARISH') {
    summary = `Market exhibiting bearish distribution below moving averages with resistance at $${indicators.resistance}. Recommended caution or short with target $${targetPrice} and stop loss $${stopLoss}.`;
  } else {
    summary = `Price is consolidating near $${currentPrice} between support $${indicators.support} and resistance $${indicators.resistance}. Awaiting breakout confirmation.`;
  }

  return {
    symbol: options.symbol || '',
    exchange: options.exchange || '',
    currentPrice,
    prediction,
    confidence,
    score,
    summary,
    recentPatterns: allPatterns.slice(-6),
    latestPattern,
    targetPrice,
    stopLoss,
    riskReward,
    indicators,
    marketBehavior: {
      trend: indicators.trend,
      rsi: indicators.rsi,
      support: indicators.support,
      resistance: indicators.resistance,
      volatility: indicators.atr / currentPrice > 0.03 ? 'High' : 'Moderate',
      activeSignalsCount: allPatterns.length
    }
  };
}
