import { query } from '../config/db.js';
import { ok } from '../utils/apiResponse.js';

export async function listPortfolio(req, res) {
  const modeFilter = req.params.mode ? 'AND mode = :mode' : '';
  const holdings = await query(
    `SELECT *, (quantity * current_price) AS market_value,
      ((current_price - average_buy_price) * quantity) AS pnl
     FROM portfolio WHERE user_id = :userId ${modeFilter} ORDER BY updated_at DESC`,
    { userId: req.user.id, mode: req.params.mode }
  );
  return ok(res, { holdings });
}
