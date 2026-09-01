# ML Prediction Service

Python-based ML service for chart pattern detection and price predictions.

## Features

- **61 Candlestick Patterns** via TA-Lib (Doji, Hammer, Engulfing, etc.)
- **Chart Patterns** (Double Top/Bottom, Triangles, Support/Resistance)
- **Technical Indicators** (RSI, MACD, Bollinger Bands, ATR, etc.)
- **ML Predictions** (Buy/Sell/Hold signals with confidence scores)
- **Backtesting** (Test strategies on historical data)

## Setup

### Windows

1. Install Python 3.11+
2. Install TA-Lib (download wheel from https://www.lfd.uci.edu/~gohlke/pythonlibs/#ta-lib)
3. Run `start.bat`

### Linux/Mac

```bash
# Install TA-Lib
sudo apt-get install ta-lib  # Ubuntu
brew install ta-lib          # Mac

# Run
chmod +x start.sh
./start.sh
```

### Docker

```bash
docker build -t ml-service .
docker run -p 8000:8000 ml-service
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/predict/{symbol}` | GET | Get ML prediction |
| `/predict/multi/{symbols}` | GET | Predictions for multiple symbols |
| `/patterns/{symbol}` | GET | Detect candlestick & chart patterns |
| `/patterns/scan/market` | GET | Scan market for patterns |
| `/backtest/run` | POST | Run backtest |
| `/backtest/quick/{symbol}` | GET | Quick backtest |

## Example Usage

```bash
# Get prediction
curl http://localhost:8000/predict/BTC/USDT?timeframe=1h

# Detect patterns
curl http://localhost:8000/patterns/ETH/USDT?lookback=100

# Quick backtest
curl http://localhost:8000/backtest/quick/BTC/USDT?days=30
```

## Integration with Node.js Backend

The main backend connects via `ML_SERVICE_URL` environment variable:

```env
ML_SERVICE_URL=http://localhost:8000
```

Routes exposed at `/api/predictions/*`
