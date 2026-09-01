"""
Data fetching service using CCXT
"""
import ccxt.async_support as ccxt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)


class DataFetcher:
    def __init__(self):
        self.exchanges = {}

    def _get_exchange(self, exchange_id: str):
        if exchange_id not in self.exchanges:
            exchange_class = getattr(ccxt, exchange_id, None)
            if exchange_class is None:
                raise ValueError(f"Unknown exchange: {exchange_id}")
            self.exchanges[exchange_id] = exchange_class({
                'enableRateLimit': True,
                'timeout': 30000
            })
        return self.exchanges[exchange_id]

    async def fetch_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1h",
        exchange_id: str = "binance",
        limit: int = 200
    ) -> Optional[pd.DataFrame]:
        """
        Fetch OHLCV data from exchange
        """
        try:
            exchange = self._get_exchange(exchange_id)

            # Normalize symbol format
            if "/" not in symbol:
                symbol = f"{symbol}/USDT"

            ohlcv = await exchange.fetch_ohlcv(symbol, timeframe, limit=limit)

            if not ohlcv:
                return None

            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)

            return df

        except Exception as e:
            logger.error(f"Error fetching OHLCV for {symbol}: {e}")
            return None

    async def fetch_historical(
        self,
        symbol: str,
        start_date: str,
        end_date: str,
        timeframe: str = "1h",
        exchange_id: str = "binance"
    ) -> Optional[pd.DataFrame]:
        """
        Fetch historical OHLCV data for a date range
        """
        try:
            exchange = self._get_exchange(exchange_id)

            if "/" not in symbol:
                symbol = f"{symbol}/USDT"

            start_ts = int(datetime.fromisoformat(start_date).timestamp() * 1000)
            end_ts = int(datetime.fromisoformat(end_date).timestamp() * 1000)

            all_ohlcv = []
            current_ts = start_ts

            while current_ts < end_ts:
                ohlcv = await exchange.fetch_ohlcv(
                    symbol, timeframe,
                    since=current_ts,
                    limit=1000
                )

                if not ohlcv:
                    break

                all_ohlcv.extend(ohlcv)
                current_ts = ohlcv[-1][0] + 1

                if len(ohlcv) < 1000:
                    break

            if not all_ohlcv:
                return None

            df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df = df[df['timestamp'] <= end_date]
            df.set_index('timestamp', inplace=True)
            df = df.drop_duplicates()

            return df

        except Exception as e:
            logger.error(f"Error fetching historical data: {e}")
            return None

    async def close(self):
        """Close all exchange connections"""
        for exchange in self.exchanges.values():
            await exchange.close()
