import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ok, fail } from '../utils/apiResponse.js';
import * as walletService from '../services/paperWalletService.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    return ok(res, { wallet });
  } catch (error) {
    return fail(res, error.status || 500, error.publicMessage || 'Failed to get wallet', error.code);
  }
});

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const summary = await walletService.getWalletSummary(req.user.id);
    return ok(res, summary);
  } catch (error) {
    return fail(res, error.status || 500, error.publicMessage || 'Failed to get wallet summary', error.code);
  }
});

router.post(
  '/add-funds',
  requireAuth,
  body('amount').isFloat({ gt: 0 }),
  validate,
  async (req, res) => {
    try {
      const wallet = await walletService.addFunds(req.user.id, req.body.amount);
      return ok(res, { wallet, message: `Added $${req.body.amount.toLocaleString()} to paper wallet` });
    } catch (error) {
      return fail(res, error.status || 500, error.publicMessage || 'Failed to add funds', error.code);
    }
  }
);

router.post('/reset', requireAuth, async (req, res) => {
  try {
    const wallet = await walletService.resetWallet(req.user.id);
    return ok(res, { wallet, message: 'Paper wallet reset to $100,000' });
  } catch (error) {
    return fail(res, error.status || 500, error.publicMessage || 'Failed to reset wallet', error.code);
  }
});

export default router;
