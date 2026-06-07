import { query } from '../config/db.js';
import { ok, fail } from '../utils/apiResponse.js';
import { encrypt } from '../utils/encryption.js';
import { supportedExchanges } from '../services/exchangeService.js';

export async function supported(req, res) {
  return ok(res, { exchanges: supportedExchanges });
}

export async function connectExchange(req, res) {
  const { exchangeName, exchangeType, apiKey, apiSecret } = req.body;
  const result = await query(
    `INSERT INTO exchange_connections
      (user_id, exchange_name, exchange_type, api_key_encrypted, api_secret_encrypted)
     VALUES (:userId, :exchangeName, :exchangeType, :apiKey, :apiSecret)`,
    {
      userId: req.user.id,
      exchangeName,
      exchangeType,
      apiKey: encrypt(apiKey),
      apiSecret: encrypt(apiSecret)
    }
  );
  return ok(res, { id: result.insertId }, 201);
}

export async function connected(req, res) {
  const exchanges = await query(
    `SELECT id, exchange_name AS exchangeName, exchange_type AS exchangeType, is_active AS isActive, created_at AS createdAt
     FROM exchange_connections WHERE user_id = :userId ORDER BY created_at DESC`,
    { userId: req.user.id }
  );
  return ok(res, { exchanges });
}

export async function updateExchange(req, res) {
  const { isActive } = req.body;
  const result = await query(
    'UPDATE exchange_connections SET is_active = :isActive WHERE id = :id AND user_id = :userId',
    { id: req.params.id, userId: req.user.id, isActive }
  );
  if (!result.affectedRows) return fail(res, 404, 'Exchange connection not found', 'EXCHANGE_NOT_FOUND');
  return ok(res);
}

export async function disconnect(req, res) {
  const result = await query('DELETE FROM exchange_connections WHERE id = :id AND user_id = :userId', {
    id: req.params.id,
    userId: req.user.id
  });
  if (!result.affectedRows) return fail(res, 404, 'Exchange connection not found', 'EXCHANGE_NOT_FOUND');
  return ok(res);
}
