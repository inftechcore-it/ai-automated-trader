"""
Backtesting Service
Tests trading strategies on historical data
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
import logging

from app.services.pattern_detector import PatternDetector
from app.services.predictor import PredictionService

logger = logging.getLogger(__name__)


class BacktestService:
    def __init__(self):
        self.pattern_detector = PatternDetector()

    def run(
        self,
        ohlcv: pd.DataFrame,
        strategy: str = "pattern_based",
        initial_capital: float = 10000,
        position_size: float = 0.1,  # 10% per trade
        stop_loss_pct: float = 0.02,  # 2%
        take_profit_pct: float = 0.03  # 3%
    ) -> Dict:
        """
        Run backtest on OHLCV data
        """
        capital = initial_capital
        position = 0
        entry_price = 0
        trades = []
        equity_curve = []

        for i in range(50, len(ohlcv)):
            current_price = ohlcv['close'].iloc[i]
            current_time = ohlcv.index[i] if hasattr(ohlcv.index[i], 'isoformat') else str(i)

            # Track equity
            current_equity = capital + (position * current_price)
            equity_curve.append({
                'timestamp': str(current_time),
                'equity': current_equity
            })

            # Check exit conditions for open position
            if position > 0:
                pnl_pct = (current_price - entry_price) / entry_price

                # Stop loss or take profit
                if pnl_pct <= -stop_loss_pct or pnl_pct >= take_profit_pct:
                    pnl = position * (current_price - entry_price)
                    capital += position * current_price
                    trades.append({
                        'type': 'SELL',
                        'price': current_price,
                        'quantity': position,
                        'pnl': pnl,
                        'pnl_pct': pnl_pct * 100,
                        'reason': 'stop_loss' if pnl_pct <= -stop_loss_pct else 'take_profit',
                        'timestamp': str(current_time)
                    })
                    position = 0
                    entry_price = 0
                    continue

            # Generate signal based on strategy
            window_df = ohlcv.iloc[i-50:i+1].copy()
            signal = self._generate_signal(window_df, strategy)

            # Execute signal
            if signal == 'BUY' and position == 0:
                # Calculate position size
                trade_amount = capital * position_size
                quantity = trade_amount / current_price
                position = quantity
                entry_price = current_price
                capital -= trade_amount

                trades.append({
                    'type': 'BUY',
                    'price': current_price,
                    'quantity': quantity,
                    'pnl': 0,
                    'pnl_pct': 0,
                    'reason': 'signal',
                    'timestamp': str(current_time)
                })

            elif signal == 'SELL' and position > 0:
                pnl = position * (current_price - entry_price)
                pnl_pct = (current_price - entry_price) / entry_price
                capital += position * current_price

                trades.append({
                    'type': 'SELL',
                    'price': current_price,
                    'quantity': position,
                    'pnl': pnl,
                    'pnl_pct': pnl_pct * 100,
                    'reason': 'signal',
                    'timestamp': str(current_time)
                })
                position = 0
                entry_price = 0

        # Close any open position at end
        if position > 0:
            final_price = ohlcv['close'].iloc[-1]
            pnl = position * (final_price - entry_price)
            capital += position * final_price
            trades.append({
                'type': 'SELL',
                'price': final_price,
                'quantity': position,
                'pnl': pnl,
                'pnl_pct': ((final_price - entry_price) / entry_price) * 100,
                'reason': 'end_of_backtest',
                'timestamp': str(ohlcv.index[-1])
            })

        # Calculate performance metrics
        performance = self._calculate_performance(trades, initial_capital, capital, equity_curve)

        return {
            'performance': performance,
            'trades': trades,
            'equity_curve': equity_curve[::max(1, len(equity_curve)//100)]  # Sample 100 points
        }

    def _generate_signal(self, df: pd.DataFrame, strategy: str) -> str:
        """Generate trading signal based on strategy"""
        if strategy == "pattern_based":
            return self._pattern_based_signal(df)
        elif strategy == "indicator_based":
            return self._indicator_based_signal(df)
        else:
            return self._combined_signal(df)

    def _pattern_based_signal(self, df: pd.DataFrame) -> str:
        """Signal based on candlestick patterns"""
        patterns = self.pattern_detector.detect_candlestick_patterns(df)

        # Count recent patterns (last 3 candles)
        recent_patterns = [p for p in patterns if p['candle_index'] >= len(df) - 3]

        bullish = sum(1 for p in recent_patterns if p['strength'] > 0)
        bearish = sum(1 for p in recent_patterns if p['strength'] < 0)

        if bullish >= 2:
            return 'BUY'
        elif bearish >= 2:
            return 'SELL'

        return 'HOLD'

    def _indicator_based_signal(self, df: pd.DataFrame) -> str:
        """Signal based on technical indicators"""
        close = df['close']

        # Simple RSI-based signal
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs.iloc[-1]))

        # MACD
        ema12 = close.ewm(span=12).mean()
        ema26 = close.ewm(span=26).mean()
        macd = ema12 - ema26
        signal_line = macd.ewm(span=9).mean()

        if rsi < 30 and macd.iloc[-1] > signal_line.iloc[-1]:
            return 'BUY'
        elif rsi > 70 and macd.iloc[-1] < signal_line.iloc[-1]:
            return 'SELL'

        return 'HOLD'

    def _combined_signal(self, df: pd.DataFrame) -> str:
        """Combined pattern + indicator signal"""
        pattern_signal = self._pattern_based_signal(df)
        indicator_signal = self._indicator_based_signal(df)

        if pattern_signal == indicator_signal:
            return pattern_signal

        return 'HOLD'

    def _calculate_performance(
        self,
        trades: List[Dict],
        initial_capital: float,
        final_capital: float,
        equity_curve: List[Dict]
    ) -> Dict:
        """Calculate backtest performance metrics"""
        if not trades:
            return {
                'total_return_pct': 0,
                'total_trades': 0,
                'win_rate': 0,
                'avg_win': 0,
                'avg_loss': 0,
                'max_drawdown_pct': 0,
                'profit_factor': 0,
                'sharpe_ratio': 0
            }

        # Filter completed trades (sells)
        sell_trades = [t for t in trades if t['type'] == 'SELL']

        if not sell_trades:
            return {
                'total_return_pct': 0,
                'total_trades': 0,
                'win_rate': 0,
                'avg_win': 0,
                'avg_loss': 0,
                'max_drawdown_pct': 0,
                'profit_factor': 0,
                'sharpe_ratio': 0
            }

        wins = [t for t in sell_trades if t['pnl'] > 0]
        losses = [t for t in sell_trades if t['pnl'] <= 0]

        total_return_pct = ((final_capital - initial_capital) / initial_capital) * 100
        win_rate = len(wins) / len(sell_trades) * 100 if sell_trades else 0
        avg_win = np.mean([t['pnl'] for t in wins]) if wins else 0
        avg_loss = abs(np.mean([t['pnl'] for t in losses])) if losses else 0

        # Max drawdown
        equity_values = [e['equity'] for e in equity_curve]
        peak = equity_values[0]
        max_drawdown = 0
        for eq in equity_values:
            if eq > peak:
                peak = eq
            drawdown = (peak - eq) / peak
            max_drawdown = max(max_drawdown, drawdown)

        # Profit factor
        gross_profit = sum(t['pnl'] for t in wins) if wins else 0
        gross_loss = abs(sum(t['pnl'] for t in losses)) if losses else 1
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

        # Sharpe ratio (simplified)
        returns = [t['pnl_pct'] for t in sell_trades]
        sharpe_ratio = 0
        if len(returns) > 1:
            avg_return = np.mean(returns)
            std_return = np.std(returns)
            if std_return > 0:
                sharpe_ratio = (avg_return / std_return) * np.sqrt(252)  # Annualized

        return {
            'total_return_pct': round(total_return_pct, 2),
            'total_trades': len(sell_trades),
            'win_rate': round(win_rate, 2),
            'wins': len(wins),
            'losses': len(losses),
            'avg_win': round(avg_win, 2),
            'avg_loss': round(avg_loss, 2),
            'max_drawdown_pct': round(max_drawdown * 100, 2),
            'profit_factor': round(profit_factor, 2),
            'sharpe_ratio': round(sharpe_ratio, 2)
        }
