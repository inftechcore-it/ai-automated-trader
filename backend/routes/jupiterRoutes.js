import express from 'express';
import * as jupiterAdapter from '../services/adapters/jupiterAdapter.js';

const router = express.Router();

// GET /api/jupiter/status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    exchange: 'Jupiter',
    type: 'dex',
    network: 'Solana',
    configured: jupiterAdapter.isConfigured(),
    config: jupiterAdapter.getConfig()
  });
});

// GET /api/jupiter/quote?symbol=SOL/USDC
router.get('/quote', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'SOL/USDC';
    const quote = await jupiterAdapter.getQuote(symbol);
    res.json({ success: true, quote });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/jupiter/price/:mintOrSymbol
router.get('/price/:mintOrSymbol', async (req, res) => {
  try {
    const { mintOrSymbol } = req.params;
    const priceData = await jupiterAdapter.getPrice(mintOrSymbol);
    res.json({ success: true, data: priceData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/jupiter/prices?ids=SOL,USDC,JUP,BONK
router.get('/prices', async (req, res) => {
  try {
    const ids = (req.query.ids || 'SOL,USDC,JUP,BONK,RAY,WIF').split(',').map(s => s.trim());
    const prices = await jupiterAdapter.getPrices(ids);
    res.json({ success: true, prices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/jupiter/tokens/search?query=JUP
router.get('/tokens/search', async (req, res) => {
  try {
    const query = req.query.query || '';
    const tokens = await jupiterAdapter.searchTokens(query);
    res.json({ success: true, tokens });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/jupiter/swap/order
router.post('/swap/order', async (req, res) => {
  try {
    const { inputMint, outputMint, amount, userPublicKey, slippageBps, swapMode } = req.body;
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({ success: false, error: 'inputMint, outputMint, and amount are required' });
    }

    const swapOrder = await jupiterAdapter.createSwapOrder({
      inputMint,
      outputMint,
      amount,
      userPublicKey,
      slippageBps,
      swapMode
    });

    res.json({ success: true, order: swapOrder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/jupiter/swap/execute
router.post('/swap/execute', async (req, res) => {
  try {
    const { signedTransaction } = req.body;
    if (!signedTransaction) {
      return res.status(400).json({ success: false, error: 'signedTransaction is required' });
    }

    const result = await jupiterAdapter.executeSwap({ signedTransaction });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
