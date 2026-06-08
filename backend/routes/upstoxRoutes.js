import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/apiResponse.js';
import * as upstoxAdapter from '../services/adapters/upstoxAdapter.js';

const router = Router();

router.get('/status', requireAuth, (req, res) => {
  return ok(res, {
    configured: upstoxAdapter.isConfigured(),
    authenticated: upstoxAdapter.isAuthenticated()
  });
});

router.get('/auth-url', requireAuth, (req, res) => {
  if (!upstoxAdapter.isConfigured()) {
    return fail(res, 400, 'Upstox API not configured', 'UPSTOX_NOT_CONFIGURED');
  }

  const config = upstoxAdapter.getConfig();
  const state = `user_${req.user.id}_${Date.now()}`;
  const authUrl = upstoxAdapter.getAuthUrl(state);

  // Return config info for debugging
  return ok(res, {
    authUrl,
    state,
    debug: {
      clientId: config.clientId,
      redirectUri: config.redirectUri
    }
  });
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?upstox_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?upstox_error=no_code');
  }

  try {
    await upstoxAdapter.exchangeCodeForToken(code);
    return res.redirect('/?upstox_connected=true');
  } catch (err) {
    console.error('[Upstox] Token exchange error:', err.message);
    return res.redirect(`/?upstox_error=${encodeURIComponent(err.message)}`);
  }
});

router.post('/set-token', requireAuth, (req, res) => {
  const { accessToken, expiresIn } = req.body;

  if (!accessToken) {
    return fail(res, 400, 'Access token required', 'TOKEN_REQUIRED');
  }

  upstoxAdapter.setAccessToken(accessToken, expiresIn || 86400);

  return ok(res, { message: 'Token set successfully' });
});

router.post('/disconnect', requireAuth, (req, res) => {
  upstoxAdapter.setAccessToken(null, 0);
  return ok(res, { message: 'Disconnected from Upstox' });
});

export default router;
