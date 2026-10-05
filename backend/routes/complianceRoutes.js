import { Router } from 'express';
import { ok, fail } from '../utils/apiResponse.js';
import complianceService from '../services/complianceService.js';

const router = Router();

/**
 * POST /api/compliance/shariah-screen
 * Performs real-time Shariah compliance screening with Google Search Grounding across Islamic finance portals
 */
router.post('/shariah-screen', async (req, res) => {
  try {
    const {
      symbol = 'KPIL',
      exchange = 'NSE',
      assetType = 'stock'
    } = req.body;

    if (!symbol) {
      return fail(res, 400, 'Symbol is required for compliance screening');
    }

    const result = await complianceService.screenShariahCompliance({
      symbol: String(symbol).trim(),
      exchange: String(exchange || 'NSE').trim(),
      assetType
    });

    return ok(res, result);
  } catch (error) {
    console.error('[complianceRoutes] Screening error:', error);
    return fail(res, 500, error.message || 'Compliance screening failed');
  }
});

/**
 * GET /api/compliance/popular
 * Returns pre-screened benchmark assets
 */
router.get('/popular', async (req, res) => {
  try {
    const assets = complianceService.getPopularScreenedAssets();
    return ok(res, { assets });
  } catch (error) {
    console.error('[complianceRoutes] Popular assets error:', error);
    return fail(res, 500, error.message);
  }
});

export default router;
