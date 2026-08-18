import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/apiResponse.js';
import * as accountService from '../services/accountService.js';

const router = Router();

// Get complete account summary with all fund categories
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const summary = await accountService.getAccountSummary(req.user.id);
    return ok(res, summary);
  } catch (error) {
    console.error('[Account] Summary error:', error);
    return fail(res, 500, error.message);
  }
});

// Get broker connection status
router.get('/brokers', requireAuth, async (req, res) => {
  try {
    const status = await accountService.getBrokerStatus(req.user.id);
    return ok(res, status);
  } catch (error) {
    return fail(res, 500, error.message);
  }
});

// Get live portfolio from all connected exchanges
router.get('/portfolio', requireAuth, async (req, res) => {
  try {
    const portfolio = await accountService.getLivePortfolio(req.user.id);
    return ok(res, portfolio);
  } catch (error) {
    console.error('[Account] Portfolio error:', error);
    return fail(res, 500, error.message);
  }
});

export default router;
