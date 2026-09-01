import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { prediction, research, history, analyze, chat } from '../controllers/aiController.js';

const router = Router();

router.get('/history', requireAuth, history);

// Prediction analysis
router.post(
  '/prediction',
  requireAuth,
  body('symbol').trim().notEmpty().withMessage('Symbol is required'),
  body('exchange').trim().notEmpty().withMessage('Exchange is required'),
  validate,
  prediction
);

// R&D / Market research
router.post(
  '/research',
  requireAuth,
  body('exchange').trim().notEmpty().withMessage('Exchange is required'),
  validate,
  research
);

// AI Chat endpoint
router.post(
  '/chat',
  requireAuth,
  body('message').trim().notEmpty().withMessage('Message is required'),
  validate,
  chat
);

// Legacy endpoint
router.post(
  '/analyze',
  requireAuth,
  body('symbol').trim().notEmpty(),
  body('exchange').trim().notEmpty(),
  body('interval').optional().trim(),
  validate,
  analyze
);

export default router;
