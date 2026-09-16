/**
 * RAG Intelligence & Guardrails Express API Routes
 * Exposes /api/rag/query, /api/rag/guardrail-check, /api/rag/diagnose-error, /api/rag/collections
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import { ragService } from '../services/ragService.js';

const router = Router();

/**
 * POST /api/rag/query
 * Execute RAG multi-asset reasoning query with hybrid retrieval & Gemini synthesis
 */
router.post(
  '/query',
  body('query').trim().notEmpty().withMessage('Query is required'),
  body('symbol').optional().trim(),
  body('market').optional().trim(),
  body('collections').optional().isArray(),
  body('top_k').optional().isInt({ min: 1, max: 15 }),
  validate,
  async (req, res) => {
    try {
      const { query, symbol, market, collections, top_k } = req.body;
      const result = await ragService.queryRag({
        query,
        symbol,
        market,
        collections,
        top_k: top_k || 5,
      });
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, `RAG query failed: ${err.message}`);
    }
  }
);

/**
 * POST /api/rag/guardrail-check
 * Pre-trade safety validation: checks news (last 2h), macro events (next 1h), and RMS rules
 */
router.post(
  '/guardrail-check',
  body('symbol').trim().notEmpty().withMessage('Symbol is required'),
  body('exchange').trim().notEmpty().withMessage('Exchange is required'),
  body('strategy_type').optional().trim(),
  body('market').optional().trim(),
  validate,
  async (req, res) => {
    try {
      const { symbol, exchange, strategy_type, market } = req.body;
      const result = await ragService.checkGuardrails({
        symbol,
        exchange,
        strategy_type: strategy_type || 'GRID',
        market: market || 'CRYPTO',
      });
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, `Guardrail check failed: ${err.message}`);
    }
  }
);

/**
 * POST /api/rag/diagnose-error
 * Queries kb_broker_diagnostics to return root cause & auto-recovery actions
 */
router.post(
  '/diagnose-error',
  body('broker_or_adapter').trim().notEmpty().withMessage('Broker or adapter is required'),
  body('error_code').trim().notEmpty().withMessage('Error code is required'),
  body('raw_message').optional().trim(),
  validate,
  async (req, res) => {
    try {
      const { broker_or_adapter, error_code, raw_message } = req.body;
      const result = await ragService.diagnoseError({
        broker_or_adapter,
        error_code,
        raw_message,
      });
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, `Error diagnosis failed: ${err.message}`);
    }
  }
);

/**
 * GET /api/rag/collections
 * Returns list of available Knowledge Base collections and record counts
 */
router.get('/collections', async (req, res) => {
  try {
    const result = await ragService.getCollections();
    return ok(res, result);
  } catch (err) {
    return fail(res, 500, `Failed to fetch collections: ${err.message}`);
  }
});

export default router;
