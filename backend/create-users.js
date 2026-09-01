import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const users = [
  { email: 'admin@inftechcore.com', name: 'Admin User', password: 'Admin@123' },
  { email: 'superuser@inftechcore.com', name: 'Super User', password: 'Super@123' }
];

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'trading_system',
};

async function createUsers() {
  const conn = await mysql.createConnection(config);

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);
    try {
      await conn.query(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        [user.email, hash, user.name]
      );

      const [[newUser]] = await conn.query('SELECT id FROM users WHERE email = ?', [user.email]);
      await conn.query('INSERT INTO paper_wallet (user_id, balance) VALUES (?, 10000.00)', [newUser.id]);

      console.log(`✓ Created: ${user.email} / ${user.password}`);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log(`⚠ Already exists: ${user.email}`);
      } else {
        console.log(`✗ Error: ${e.message}`);
      }
    }
  }

  await conn.end();
  console.log('\nDone!');
}

createUsers();
