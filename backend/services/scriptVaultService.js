import { query } from '../config/db.js';

// In-memory fallback map in case MySQL connection is unavailable
const memoryVault = new Map();

let tableInitialized = false;

/**
 * Initializes the database table if it doesn't already exist
 */
async function ensureTable() {
  if (tableInitialized) return;
  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS \`user_strategy_scripts\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`user_id\` VARCHAR(64) NOT NULL DEFAULT 'default-user',
        \`name\` VARCHAR(255) NOT NULL,
        \`symbol\` VARCHAR(64) NOT NULL,
        \`timeframe\` VARCHAR(32) NOT NULL DEFAULT '15m',
        \`exchange\` VARCHAR(64) NOT NULL DEFAULT 'Binance',
        \`methodology\` VARCHAR(64) NOT NULL DEFAULT 'HYBRID_ENSEMBLE',
        \`snapshot_image\` LONGTEXT NULL,
        \`patterns_detected\` JSON NULL,
        \`summary\` TEXT NULL,
        \`pine_script\` LONGTEXT NULL,
        \`python_script\` LONGTEXT NULL,
        \`backtest_kpis\` JSON NULL,
        \`trading_parameters\` JSON NULL,
        \`is_archived\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_user_created\` (\`user_id\`, \`created_at\`),
        INDEX \`idx_symbol\` (\`symbol\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await query(createTableSql);
    tableInitialized = true;
  } catch (err) {
    console.warn('[scriptVaultService] Table initialization warning (using memory fallback if needed):', err.message);
  }
}

/**
 * Normalizes a script record from DB or Memory
 */
function normalizeScript(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || row.userId || 'default-user',
    name: row.name,
    symbol: row.symbol,
    timeframe: row.timeframe || '15m',
    exchange: row.exchange || 'Binance',
    methodology: row.methodology || 'HYBRID_ENSEMBLE',
    snapshotImage: row.snapshot_image || row.snapshotImage || null,
    patternsDetected: typeof row.patterns_detected === 'string'
      ? JSON.parse(row.patterns_detected || '[]')
      : (row.patterns_detected || row.patternsDetected || []),
    summary: row.summary || '',
    pineScript: row.pine_script || row.pineScript || '',
    pythonScript: row.python_script || row.pythonScript || '',
    backtestKpis: typeof row.backtest_kpis === 'string'
      ? JSON.parse(row.backtest_kpis || '{}')
      : (row.backtest_kpis || row.backtestKpis || {}),
    tradingParameters: typeof row.trading_parameters === 'string'
      ? JSON.parse(row.trading_parameters || '{}')
      : (row.trading_parameters || row.tradingParameters || {}),
    isArchived: Boolean(row.is_archived ?? row.isArchived ?? false),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : (row.createdAt || new Date().toISOString()),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : (row.updatedAt || new Date().toISOString())
  };
}

/**
 * Saves a generated strategy script to persistent vault storage
 */
export async function saveScript(scriptData) {
  await ensureTable();

  const id = scriptData.id || `strat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const userId = String(scriptData.userId || 'default-user');
  const now = new Date().toISOString();

  const record = {
    id,
    userId,
    name: scriptData.name || `${scriptData.symbol || 'SOL/USDT'} Strategy`,
    symbol: scriptData.symbol || 'SOL/USDT',
    timeframe: scriptData.timeframe || '15m',
    exchange: scriptData.exchange || 'Binance',
    methodology: scriptData.methodology || 'HYBRID_ENSEMBLE',
    snapshotImage: scriptData.snapshotImage || null,
    patternsDetected: scriptData.patternsDetected || [],
    summary: scriptData.summary || '',
    pineScript: scriptData.pineScript || '',
    pythonScript: scriptData.pythonScript || '',
    backtestKpis: scriptData.backtestKpis || {},
    tradingParameters: scriptData.tradingParameters || {},
    isArchived: false,
    createdAt: now,
    updatedAt: now
  };

  // Always keep in memory cache
  memoryVault.set(id, record);

  try {
    const sql = `
      INSERT INTO \`user_strategy_scripts\`
      (\`id\`, \`user_id\`, \`name\`, \`symbol\`, \`timeframe\`, \`exchange\`, \`methodology\`,
       \`snapshot_image\`, \`patterns_detected\`, \`summary\`, \`pine_script\`, \`python_script\`,
       \`backtest_kpis\`, \`trading_parameters\`, \`is_archived\`, \`created_at\`, \`updated_at\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        \`name\` = VALUES(\`name\`),
        \`methodology\` = VALUES(\`methodology\`),
        \`snapshot_image\` = VALUES(\`snapshot_image\`),
        \`patterns_detected\` = VALUES(\`patterns_detected\`),
        \`summary\` = VALUES(\`summary\`),
        \`pine_script\` = VALUES(\`pine_script\`),
        \`python_script\` = VALUES(\`python_script\`),
        \`backtest_kpis\` = VALUES(\`backtest_kpis\`),
        \`trading_parameters\` = VALUES(\`trading_parameters\`),
        \`updated_at\` = NOW();
    `;

    await query(sql, [
      record.id,
      record.userId,
      record.name,
      record.symbol,
      record.timeframe,
      record.exchange,
      record.methodology,
      record.snapshotImage,
      JSON.stringify(record.patternsDetected),
      record.summary,
      record.pineScript,
      record.pythonScript,
      JSON.stringify(record.backtestKpis),
      JSON.stringify(record.tradingParameters)
    ]);
  } catch (err) {
    console.warn('[scriptVaultService] Failed to insert into MySQL, retained in memory vault:', err.message);
  }

  return normalizeScript(record);
}

/**
 * Lists scripts from persistent storage with filtering and search
 */
export async function listScripts({
  userId = 'default-user',
  search = '',
  symbol = '',
  minWinRate = 0,
  methodology = '',
  limit = 50,
  offset = 0
} = {}) {
  await ensureTable();

  let dbScripts = [];
  try {
    let sql = 'SELECT * FROM `user_strategy_scripts` WHERE `is_archived` = 0';
    const params = [];

    if (userId && userId !== 'all') {
      sql += ' AND (`user_id` = ? OR `user_id` = "default-user")';
      params.push(String(userId));
    }

    if (symbol) {
      sql += ' AND UPPER(`symbol`) LIKE ?';
      params.push(`%${symbol.toUpperCase().replace('/', '')}%`);
    }

    if (methodology) {
      sql += ' AND `methodology` = ?';
      params.push(methodology);
    }

    if (search) {
      sql += ' AND (`name` LIKE ? OR `symbol` LIKE ? OR `summary` LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY `created_at` DESC LIMIT ? OFFSET ?';
    params.push(Number(limit) || 50, Number(offset) || 0);

    const rows = await query(sql, params);
    if (Array.isArray(rows) && rows.length > 0) {
      dbScripts = rows.map(normalizeScript);
    }
  } catch (err) {
    console.warn('[scriptVaultService] DB query failed, falling back to memory vault:', err.message);
  }

  // If DB returned nothing or failed, query memory vault
  let combined = [...dbScripts];
  if (combined.length === 0 && memoryVault.size > 0) {
    combined = Array.from(memoryVault.values())
      .filter(s => !s.isArchived)
      .map(normalizeScript);

    if (search) {
      const q = search.toLowerCase();
      combined = combined.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q) ||
        (s.summary && s.summary.toLowerCase().includes(q))
      );
    }

    if (symbol) {
      const symNorm = symbol.toUpperCase().replace('/', '');
      combined = combined.filter(s => s.symbol.toUpperCase().replace('/', '').includes(symNorm));
    }

    if (methodology) {
      combined = combined.filter(s => s.methodology === methodology);
    }
  }

  // Filter by minWinRate if specified
  if (minWinRate > 0) {
    combined = combined.filter(s => {
      const wr = s.backtestKpis?.winRate || 0;
      return Number(wr) >= Number(minWinRate);
    });
  }

  return {
    scripts: combined,
    total: combined.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Retrieves a single script by ID
 */
export async function getScriptById(id, userId = 'default-user') {
  await ensureTable();

  // Check memory first
  if (memoryVault.has(id)) {
    return normalizeScript(memoryVault.get(id));
  }

  try {
    const rows = await query('SELECT * FROM `user_strategy_scripts` WHERE `id` = ? LIMIT 1', [id]);
    if (rows && rows.length > 0) {
      const script = normalizeScript(rows[0]);
      memoryVault.set(id, script);
      return script;
    }
  } catch (err) {
    console.warn('[scriptVaultService] Get script by ID failed:', err.message);
  }

  return null;
}

/**
 * Deletes / archives a strategy script
 */
export async function deleteScript(id, userId = 'default-user') {
  await ensureTable();

  if (memoryVault.has(id)) {
    memoryVault.delete(id);
  }

  try {
    await query('DELETE FROM `user_strategy_scripts` WHERE `id` = ?', [id]);
    return { success: true, id };
  } catch (err) {
    console.warn('[scriptVaultService] Delete failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Updates strategy details in vault
 */
export async function updateScript(id, updates = {}, userId = 'default-user') {
  await ensureTable();

  const existing = await getScriptById(id, userId);
  if (!existing) {
    throw new Error(`Strategy script ${id} not found`);
  }

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  memoryVault.set(id, updated);

  try {
    const sql = `
      UPDATE \`user_strategy_scripts\`
      SET \`name\` = ?, \`summary\` = ?, \`trading_parameters\` = ?, \`updated_at\` = NOW()
      WHERE \`id\` = ?;
    `;
    await query(sql, [
      updated.name,
      updated.summary,
      JSON.stringify(updated.tradingParameters),
      id
    ]);
  } catch (err) {
    console.warn('[scriptVaultService] Update script failed in DB:', err.message);
  }

  return normalizeScript(updated);
}

export default {
  saveScript,
  listScripts,
  getScriptById,
  deleteScript,
  updateScript
};
