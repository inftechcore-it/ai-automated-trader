import { query } from '../config/db.js';
import { ok } from '../utils/apiResponse.js';
import { analyzeMarket } from '../services/aiService.js';

export async function analyze(req, res) {
  const result = await analyzeMarket(req.body, req.user);
  return ok(res, { analysis: result });
}

export async function history(req, res) {
  const logs = await query(
    'SELECT * FROM ai_analysis_logs WHERE user_id = :userId ORDER BY created_at DESC LIMIT 50',
    { userId: req.user.id }
  );
  return ok(res, { logs });
}
