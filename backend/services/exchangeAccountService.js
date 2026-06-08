import { query } from '../config/db.js';
import { decrypt } from '../utils/encryption.js';
import * as binanceAdapter from './adapters/binanceAdapter.js';
import * as krakenAdapter from './adapters/krakenAdapter.js';
import * as cache from './cache.js';

function getAdapter(exchangeName) {
  const name = exchangeName.toLowerCase();
  if (name === 'binance') return binanceAdapter;
  if (name === 'kraken') return krakenAdapter;
  return null;
}

export async function validateCredentials(exchangeName, apiKey, apiSecret) {
  const adapter = getAdapter(exchangeName);
  if (!adapter?.validateCredentials) {
    return { valid: false, error: `${exchangeName} validation not supported yet` };
  }

  try {
    const result = await adapter.validateCredentials(apiKey, apiSecret);
    return result;
  } catch (err) {
    const message = err.response?.data?.msg || err.message || 'Invalid credentials';
    return { valid: false, error: message };
  }
}

export async function getBalances(connectionId, userId) {
  const cacheKey = `balances:${connectionId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [connection] = await query(
    `SELECT exchange_name, api_key_encrypted, api_secret_encrypted
     FROM exchange_connections WHERE id = :id AND user_id = :userId`,
    { id: connectionId, userId }
  );

  if (!connection) {
    throw new Error('Exchange connection not found');
  }

  const adapter = getAdapter(connection.exchange_name);
  if (!adapter?.getBalances) {
    return { balances: [], error: `${connection.exchange_name} balances not supported yet` };
  }

  try {
    const apiKey = decrypt(connection.api_key_encrypted);
    const apiSecret = decrypt(connection.api_secret_encrypted);
    const balances = await adapter.getBalances(apiKey, apiSecret);

    const result = { balances, lastSync: new Date().toISOString() };
    cache.set(cacheKey, result, 60 * 1000); // 1 minute cache
    return result;
  } catch (err) {
    const message = err.response?.data?.msg || err.message || 'Failed to fetch balances';
    return { balances: [], error: message };
  }
}

export async function verifyConnection(connectionId, userId) {
  const [connection] = await query(
    `SELECT exchange_name, api_key_encrypted, api_secret_encrypted
     FROM exchange_connections WHERE id = :id AND user_id = :userId`,
    { id: connectionId, userId }
  );

  if (!connection) {
    throw new Error('Exchange connection not found');
  }

  const adapter = getAdapter(connection.exchange_name);
  if (!adapter?.validateCredentials) {
    return { valid: false, error: `${connection.exchange_name} verification not supported` };
  }

  try {
    const apiKey = decrypt(connection.api_key_encrypted);
    const apiSecret = decrypt(connection.api_secret_encrypted);
    const result = await adapter.validateCredentials(apiKey, apiSecret);

    await query(
      'UPDATE exchange_connections SET last_verified = NOW(), is_active = TRUE WHERE id = :id',
      { id: connectionId }
    );

    return { ...result, lastVerified: new Date().toISOString() };
  } catch (err) {
    const message = err.response?.data?.msg || err.message || 'Verification failed';

    await query(
      'UPDATE exchange_connections SET last_verified = NOW(), is_active = FALSE WHERE id = :id',
      { id: connectionId }
    );

    return { valid: false, error: message };
  }
}

export async function getAllBalances(userId) {
  const connections = await query(
    `SELECT id, exchange_name AS exchangeName, is_active AS isActive
     FROM exchange_connections WHERE user_id = :userId AND is_active = TRUE`,
    { userId }
  );

  const results = await Promise.all(
    connections.map(async (conn) => {
      const { balances, error, lastSync } = await getBalances(conn.id, userId);
      return {
        exchangeId: conn.id,
        exchangeName: conn.exchangeName,
        balances,
        error,
        lastSync
      };
    })
  );

  return results;
}
