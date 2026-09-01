/**
 * Prediction API Routes
 * Proxies requests to the Python ML service
 */
import { Router } from 'express';
import predictionService from '../services/predictionService.js';

const router = Router();

// Health check for ML service
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await predictionService.isHealthy();
    res.json({
      service: 'ml-prediction',
      status: isHealthy ? 'healthy' : 'unavailable',
      message: isHealthy ? 'ML service is running' : 'ML service is not available'
    });
  } catch (error) {
    res.status(503).json({
      service: 'ml-prediction',
      status: 'error',
      message: error.message
    });
  }
});

// Get prediction for a symbol
router.get('/predict/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h', exchange = 'binance' } = req.query;

    const prediction = await predictionService.getPrediction(symbol, timeframe, exchange);
    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get predictions for multiple symbols
router.get('/predict/multi/:symbols', async (req, res) => {
  try {
    const symbols = req.params.symbols.split(',');
    const { timeframe = '1h', exchange = 'binance' } = req.query;

    const predictions = await predictionService.getMultiPredictions(symbols, timeframe, exchange);
    res.json({ success: true, data: { predictions } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Detect patterns for a symbol
router.get('/patterns/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h', exchange = 'binance', lookback = '100' } = req.query;

    const patterns = await predictionService.detectPatterns(
      symbol, timeframe, exchange, parseInt(lookback, 10)
    );
    res.json({ success: true, data: patterns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scan market for significant patterns
router.get('/patterns/scan', async (req, res) => {
  try {
    const { exchange = 'binance', timeframe = '1h', min_strength = '50' } = req.query;

    const results = await predictionService.scanMarketPatterns(
      exchange, timeframe, parseInt(min_strength, 10)
    );
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run backtest
router.post('/backtest', async (req, res) => {
  try {
    const results = await predictionService.runBacktest(req.body);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Quick backtest
router.get('/backtest/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days = '30', exchange = 'binance' } = req.query;

    const results = await predictionService.quickBacktest(
      symbol, parseInt(days, 10), exchange
    );
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
