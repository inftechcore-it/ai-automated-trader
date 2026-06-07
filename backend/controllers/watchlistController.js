import { query } from '../config/db.js';
import { ok, fail } from '../utils/apiResponse.js';

export async function listWatchlist(req, res) {
  const items = await query('SELECT * FROM watchlist WHERE user_id = :userId ORDER BY added_at DESC', {
    userId: req.user.id
  });
  return ok(res, { items });
}

export async function addWatchlistItem(req, res) {
  const { symbol, exchangeName } = req.body;
  const result = await query(
    'INSERT INTO watchlist (user_id, symbol, exchange_name) VALUES (:userId, :symbol, :exchangeName)',
    { userId: req.user.id, symbol, exchangeName }
  );
  return ok(res, { id: result.insertId }, 201);
}

export async function deleteWatchlistItem(req, res) {
  const result = await query('DELETE FROM watchlist WHERE id = :id AND user_id = :userId', {
    id: req.params.id,
    userId: req.user.id
  });
  if (!result.affectedRows) return fail(res, 404, 'Watchlist item not found', 'WATCHLIST_ITEM_NOT_FOUND');
  return ok(res);
}
