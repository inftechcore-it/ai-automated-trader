import { Router } from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { listSessions, setSessionStatus, startSession } from '../controllers/sessionController.js';

const router = Router();

router.get('/', requireAuth, listSessions);
router.post(
  '/start',
  requireAuth,
  body('exchangeId').optional({ nullable: true }).isInt(),
  body('exchangeName').trim().notEmpty(),
  body('symbol').trim().notEmpty(),
  body('mode').isIn(['paper', 'live']),
  validate,
  startSession
);
router.post('/:id/:status(pause|stop)', requireAuth, param('id').isInt(), validate, (req, res, next) => {
  req.params.status = req.params.status === 'pause' ? 'paused' : 'stopped';
  return setSessionStatus(req, res, next);
});

export default router;
