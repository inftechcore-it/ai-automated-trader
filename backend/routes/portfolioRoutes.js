import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { listPortfolio } from '../controllers/portfolioController.js';

const router = Router();

router.get('/', requireAuth, listPortfolio);
router.get('/:mode(paper|live)', requireAuth, listPortfolio);

export default router;
