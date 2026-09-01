/**
 * Prediction Service - Integration with Python ML Service
 * Provides chart pattern detection and ML-powered predictions
 */
import axios from 'axios';
import { env } from '../config/env.js';

const ML_SERVICE_URL = env.mlServiceUrl || 'http://localhost:8000';

class PredictionService {
  constructor() {
    this.client = axios.create({
      baseURL: ML_SERVICE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Check if ML service is available
   */
  async isHealthy() {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get prediction for a symbol
   */
  async getPrediction(symbol, timeframe = '1h', exchange = 'binance') {
    try {
      const response = await this.client.get(`/predict/${encodeURIComponent(symbol)}`, {
        params: { timeframe, exchange }
      });
      return response.data;
    } catch (error) {
      console.error(`Prediction error for ${symbol}:`, error.message);
      throw new Error(`Failed to get prediction: ${error.message}`);
    }
  }

  /**
   * Get predictions for multiple symbols
   */
  async getMultiPredictions(symbols, timeframe = '1h', exchange = 'binance') {
    try {
      const symbolStr = symbols.join(',');
      const response = await this.client.get(`/predict/multi/${encodeURIComponent(symbolStr)}`, {
        params: { timeframe, exchange }
      });
      return response.data.predictions;
    } catch (error) {
      console.error('Multi-prediction error:', error.message);
      throw new Error(`Failed to get predictions: ${error.message}`);
    }
  }

  /**
   * Detect patterns for a symbol
   */
  async detectPatterns(symbol, timeframe = '1h', exchange = 'binance', lookback = 100) {
    try {
      const response = await this.client.get(`/patterns/${encodeURIComponent(symbol)}`, {
        params: { timeframe, exchange, lookback }
      });
      return response.data;
    } catch (error) {
      console.error(`Pattern detection error for ${symbol}:`, error.message);
      throw new Error(`Failed to detect patterns: ${error.message}`);
    }
  }

  /**
   * Scan market for significant patterns
   */
  async scanMarketPatterns(exchange = 'binance', timeframe = '1h', minStrength = 50) {
    try {
      const response = await this.client.get('/patterns/scan/market', {
        params: { exchange, timeframe, min_strength: minStrength }
      });
      return response.data;
    } catch (error) {
      console.error('Market scan error:', error.message);
      throw new Error(`Failed to scan market: ${error.message}`);
    }
  }

  /**
   * Run backtest on historical data
   */
  async runBacktest(params) {
    try {
      const response = await this.client.post('/backtest/run', params);
      return response.data;
    } catch (error) {
      console.error('Backtest error:', error.message);
      throw new Error(`Failed to run backtest: ${error.message}`);
    }
  }

  /**
   * Quick backtest on recent data
   */
  async quickBacktest(symbol, days = 30, exchange = 'binance') {
    try {
      const response = await this.client.get(`/backtest/quick/${encodeURIComponent(symbol)}`, {
        params: { days, exchange }
      });
      return response.data;
    } catch (error) {
      console.error(`Quick backtest error for ${symbol}:`, error.message);
      throw new Error(`Failed to run quick backtest: ${error.message}`);
    }
  }
}

export const predictionService = new PredictionService();
export default predictionService;
