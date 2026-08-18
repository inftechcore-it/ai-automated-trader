import { query } from '../config/db.js';
import { ok, fail } from '../utils/apiResponse.js';
import { encrypt } from '../utils/encryption.js';
import { getSupportedExchanges } from '../services/exchangeService.js';
import {
  validateCredentials,
  getBalances,
  verifyConnection,
  getAllBalances
} from '../services/exchangeAccountService.js';

export async function supported(req, res) {
  return ok(res, { exchanges: getSupportedExchanges() });
}

export async function connectExchange(req, res) {
  const { exchangeName, exchangeType, apiKey, apiSecret } = req.body;

  const validation = await validateCredentials(exchangeName, apiKey, apiSecret);

  if (!validation.valid) {
    return fail(res, 400, validation.error || 'Invalid API credentials', 'INVALID_CREDENTIALS');
  }

  const result = await query(
    `INSERT INTO exchange_connections
      (user_id, exchange_name, exchange_type, api_key_encrypted, api_secret_encrypted, last_verified)
     VALUES (:userId, :exchangeName, :exchangeType, :apiKey, :apiSecret, NOW())`,
    {
      userId: req.user.id,
      exchangeName,
      exchangeType,
      apiKey: encrypt(apiKey),
      apiSecret: encrypt(apiSecret)
    }
  );

  return ok(res, {
    id: result.insertId,
    permissions: validation.permissions,
    canTrade: validation.canTrade
  }, 201);
}

export async function connected(req, res) {
  // Get from exchange_connections (old table)
  const oldConnections = await query(
    `SELECT id, exchange_name AS exchangeName, exchange_type AS exchangeType,
            is_active AS isActive, last_verified AS lastVerified, created_at AS createdAt,
            'exchange_connections' AS source
     FROM exchange_connections WHERE user_id = :userId`,
    { userId: req.user.id }
  );

  // Get from exchange_accounts (new broker table)
  const brokerConnections = await query(
    `SELECT id, exchange_name AS exchangeName, exchange_type AS exchangeType,
            is_active AS isActive, last_synced_at AS lastVerified, created_at AS createdAt,
            paper_mode AS paperMode, 'exchange_accounts' AS source
     FROM exchange_accounts WHERE user_id = :userId AND is_active = 1`,
    { userId: req.user.id }
  );

  // Combine and dedupe by exchange name (prefer broker connections)
  const seenExchanges = new Set();
  const allExchanges = [];

  for (const conn of brokerConnections) {
    seenExchanges.add(conn.exchangeName.toLowerCase());
    allExchanges.push(conn);
  }

  for (const conn of oldConnections) {
    if (!seenExchanges.has(conn.exchangeName.toLowerCase())) {
      allExchanges.push(conn);
    }
  }

  // Sort by createdAt desc
  allExchanges.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return ok(res, { exchanges: allExchanges });
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
  // Try to delete from exchange_connections first
  const result = await query('DELETE FROM exchange_connections WHERE id = :id AND user_id = :userId', {
    id: req.params.id,
    userId: req.user.id
  });

  // Also try to delete from exchange_accounts (broker table)
  const brokerResult = await query('UPDATE exchange_accounts SET is_active = 0 WHERE id = :id AND user_id = :userId', {
    id: req.params.id,
    userId: req.user.id
  });

  if (!result.affectedRows && !brokerResult.affectedRows) {
    return fail(res, 404, 'Exchange connection not found', 'EXCHANGE_NOT_FOUND');
  }
  return ok(res);
}

export async function verify(req, res) {
  try {
    const result = await verifyConnection(req.params.id, req.user.id);
    if (!result.valid) {
      return fail(res, 400, result.error, 'VERIFICATION_FAILED');
    }
    return ok(res, result);
  } catch (err) {
    return fail(res, 404, err.message, 'EXCHANGE_NOT_FOUND');
  }
}

export async function balances(req, res) {
  try {
    const result = await getBalances(req.params.id, req.user.id);
    if (result.error) {
      return ok(res, result);
    }
    return ok(res, result);
  } catch (err) {
    return fail(res, 404, err.message, 'EXCHANGE_NOT_FOUND');
  }
}

export async function allBalances(req, res) {
  const result = await getAllBalances(req.user.id);
  return ok(res, { exchanges: result });
}
