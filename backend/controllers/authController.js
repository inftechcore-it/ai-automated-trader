import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { ok, fail } from '../utils/apiResponse.js';

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, env.jwtSecret, { expiresIn: '24h' });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.created_at };
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await query(
      'INSERT INTO users (name, email, password_hash) VALUES (:name, :email, :passwordHash)',
      { name, email, passwordHash }
    );
    await query('INSERT INTO paper_wallet (user_id, balance, currency) VALUES (:userId, 10000.00, "USD")', {
      userId: result.insertId
    });
    const [user] = await query('SELECT * FROM users WHERE id = :id', { id: result.insertId });
    return ok(res, { token: signToken(user), user: publicUser(user) }, 201);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return fail(res, 409, 'Email is already registered', 'EMAIL_EXISTS');
    }
    throw error;
  }
}

export async function login(req, res) {
  const { email, password } = req.body;
  const [user] = await query('SELECT * FROM users WHERE email = :email', { email });

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return fail(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return ok(res, { token: signToken(user), user: publicUser(user) });
}

export async function me(req, res) {
  const [user] = await query('SELECT * FROM users WHERE id = :id', { id: req.user.id });
  if (!user) return fail(res, 404, 'User not found', 'USER_NOT_FOUND');
  return ok(res, { user: publicUser(user) });
}
