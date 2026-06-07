import { query } from '../config/db.js';
import { ok, fail } from '../utils/apiResponse.js';

export async function startSession(req, res) {
  const { exchangeId = null, exchangeName, symbol, mode } = req.body;

  if (mode === 'live' && !exchangeId) {
    return fail(res, 400, 'Live sessions require a connected exchange', 'LIVE_EXCHANGE_REQUIRED');
  }

  const result = await query(
    `INSERT INTO trading_sessions (user_id, exchange_id, exchange_name, symbol, mode, status)
     VALUES (:userId, :exchangeId, :exchangeName, :symbol, :mode, 'active')`,
    { userId: req.user.id, exchangeId, exchangeName, symbol, mode }
  );
  const [session] = await query('SELECT * FROM trading_sessions WHERE id = :id', { id: result.insertId });
  return ok(res, { session }, 201);
}

export async function setSessionStatus(req, res) {
  const { status } = req.params;
  const result = await query(
    'UPDATE trading_sessions SET status = :status WHERE id = :id AND user_id = :userId',
    { status, id: req.params.id, userId: req.user.id }
  );
  if (!result.affectedRows) return fail(res, 404, 'Trading session not found', 'SESSION_NOT_FOUND');
  return ok(res);
}

export async function listSessions(req, res) {
  const sessions = await query(
    'SELECT * FROM trading_sessions WHERE user_id = :userId ORDER BY created_at DESC',
    { userId: req.user.id }
  );
  return ok(res, { sessions });
}
