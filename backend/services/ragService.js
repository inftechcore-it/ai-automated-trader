/**
 * RAG Service - Integration with Python ML Service RAG Endpoints
 * Provides hybrid retrieval, strategy recommendations, pre-trade guardrails,
 * and broker error auto-diagnostics.
 */
import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const ML_SERVICE_URL = env.mlServiceUrl || 'http://localhost:8000';

class RagService {
  constructor() {
    this.client = axios.create({
      baseURL: ML_SERVICE_URL,
      timeout: 25000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Execute multi-asset RAG query with dense/sparse retrieval and Gemini synthesis
   */
  async queryRag({ query, collections, symbol, market, top_k = 5 }) {
    try {
      const response = await this.client.post('/api/v1/rag/query', {
        query,
        collections,
        symbol,
        market,
        top_k,
      });
      return { success: true, ...response.data };
    } catch (error) {
      logger.warn(`[RAG Service] Query failed: ${error.message}`);
      // Return safe fallback
      return {
        success: false,
        analysis: `RAG intelligence service unavailable (${error.message}). Using standard algorithmic analysis.`,
        sentiment_score: 0.0,
        actionable_setup: {
          direction: 'NEUTRAL',
          confidence: 0.5,
          recommended_strategy: 'GRID',
          suggested_parameters: {
            gridCount: 20,
            lowerPrice: null,
            upperPrice: null,
            stopLossPercent: 0.03,
            takeProfitPercent: 0.015,
          },
        },
        citations: [],
        error: error.message,
      };
    }
  }

  /**
   * Pre-trade guardrail risk evaluation
   * Checks breaking news (2h), upcoming macro events (1h), and RMS rules
   */
  async checkGuardrails({ symbol, market = 'CRYPTO', strategy_type = 'GRID', exchange = 'BINANCE' }) {
    try {
      const response = await this.client.post('/api/v1/rag/guardrail-check', {
        symbol,
        market,
        strategy_type,
        exchange,
      });
      return { success: true, ...response.data };
    } catch (error) {
      logger.warn(`[RAG Service] Guardrail check fallback: ${error.message}`);
      return {
        success: false,
        safe_to_trade: true,
        risk_level: 'LOW',
        warning_reason: `Guardrail service fallback (${error.message})`,
        suggested_action: 'PROCEED',
        symbol,
        market,
        strategy_type,
        exchange,
      };
    }
  }

  /**
   * Query kb_broker_diagnostics for root cause & auto-recovery steps
   */
  async diagnoseError({ broker_or_adapter, error_code, raw_message }) {
    try {
      const response = await this.client.post('/api/v1/rag/diagnose-error', {
        broker_or_adapter,
        error_code: String(error_code),
        raw_message,
      });
      return { success: true, ...response.data };
    } catch (error) {
      logger.warn(`[RAG Service] Error diagnosis lookup failed: ${error.message}`);
      return {
        success: false,
        found: false,
        broker_or_adapter,
        error_code,
        recovery_action: 'RETRY',
        resolution_steps: 'Check adapter credentials and network connectivity.',
      };
    }
  }

  /**
   * Fetch status of all 8 internal KB collections + external market news
   */
  async getCollections() {
    try {
      const response = await this.client.get('/api/v1/rag/collections');
      return { success: true, ...response.data };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available_collections: [
          'kb_strategy_playbooks',
          'kb_rms_rules',
          'kb_broker_diagnostics',
          'kb_trade_history',
          'kb_indicators_ta',
          'kb_dex_onchain',
          'kb_arbitrage_playbooks',
          'kb_fundamental_frameworks',
          'external_market_news',
        ],
      };
    }
  }
}

export const ragService = new RagService();
export default ragService;
