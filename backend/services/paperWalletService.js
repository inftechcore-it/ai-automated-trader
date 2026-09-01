import { query, transaction } from '../config/db.js';

const DEFAULT_BALANCE = 100000;
const DEFAULT_CURRENCY = 'USD';

export async function getWallet(userId, currency = DEFAULT_CURRENCY) {
  const [wallet] = await query(
    'SELECT * FROM paper_wallet WHERE user_id = :userId AND currency = :currency',
    { userId, currency }
  );

  if (!wallet) {
    return createWallet(userId, currency);
  }

  return wallet;
}

export async function createWallet(userId, currency = DEFAULT_CURRENCY, initialBalance = DEFAULT_BALANCE) {
  await query(
    'INSERT IGNORE INTO paper_wallet (user_id, balance, currency) VALUES (:userId, :balance, :currency)',
    { userId, balance: initialBalance, currency }
  );

  const [wallet] = await query(
    'SELECT * FROM paper_wallet WHERE user_id = :userId AND currency = :currency',
    { userId, currency }
  );

  return wallet;
}

export async function addFunds(userId, amount, currency = DEFAULT_CURRENCY) {
  if (amount <= 0) {
    throw createError('Amount must be positive', 400, 'INVALID_AMOUNT');
  }

  await query(
    'UPDATE paper_wallet SET balance = balance + :amount WHERE user_id = :userId AND currency = :currency',
    { userId, amount, currency }
  );

  return getWallet(userId, currency);
}

export async function withdrawFunds(userId, amount, currency = DEFAULT_CURRENCY) {
  if (amount <= 0) {
    throw createError('Amount must be positive', 400, 'INVALID_AMOUNT');
  }

  const wallet = await getWallet(userId, currency);

  if (Number(wallet.balance) < amount) {
    throw createError('Insufficient funds', 400, 'INSUFFICIENT_FUNDS');
  }

  await query(
    'UPDATE paper_wallet SET balance = balance - :amount WHERE user_id = :userId AND currency = :currency',
    { userId, amount, currency }
  );

  return getWallet(userId, currency);
}

export async function resetWallet(userId, currency = DEFAULT_CURRENCY) {
  return transaction(async (connection) => {
    // Reset wallet balance
    await connection.execute(
      'UPDATE paper_wallet SET balance = ? WHERE user_id = ? AND currency = ?',
      [DEFAULT_BALANCE, userId, currency]
    );

    // Clear all paper portfolio entries for this user
    await connection.execute(
      "DELETE FROM portfolio WHERE user_id = ? AND mode = 'paper'",
      [userId]
    );

    // Cancel all open paper orders
    await connection.execute(
      "UPDATE orders SET status = 'cancelled' WHERE user_id = ? AND mode = 'paper' AND status IN ('open', 'pending')",
      [userId]
    );

    // Clear pending orders
    await connection.execute(
      'DELETE po FROM pending_orders po JOIN orders o ON po.order_id = o.id WHERE o.user_id = ?',
      [userId]
    );

    const [[wallet]] = await connection.execute(
      'SELECT * FROM paper_wallet WHERE user_id = ? AND currency = ?',
      [userId, currency]
    );

    return wallet;
  });
}

export async function getWalletSummary(userId) {
  const wallet = await getWallet(userId);

  // Get total portfolio value
  const holdings = await query(
    "SELECT symbol, quantity, current_price FROM portfolio WHERE user_id = :userId AND mode = 'paper'",
    { userId }
  );

  let portfolioValue = 0;
  for (const h of holdings) {
    portfolioValue += Number(h.quantity) * Number(h.current_price);
  }

  // Get open orders value (locked funds)
  const openOrders = await query(
    `SELECT side, quantity, price FROM orders
     WHERE user_id = :userId AND mode = 'paper' AND status IN ('open', 'pending')`,
    { userId }
  );

  let lockedFunds = 0;
  for (const o of openOrders) {
    if (o.side === 'buy') {
      lockedFunds += Number(o.quantity) * Number(o.price);
    }
  }

  return {
    balance: Number(wallet.balance),
    portfolioValue,
    lockedFunds,
    totalEquity: Number(wallet.balance) + portfolioValue,
    currency: wallet.currency
  };
}

function createError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}
