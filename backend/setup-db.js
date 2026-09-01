/**
 * Database Setup Script
 * Creates all required tables and a demo user
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupDatabase() {
  console.log('🔧 Setting up database...\n');

  // Use DB_* env vars for the main trading_system database (not DATABASE_URL which is for Prisma/arbitrage)
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'trading_system',
    multipleStatements: true,
  };

  const connection = await mysql.createConnection(config);

  try {
    // Read schema and extract just the CREATE TABLE statements (skip CREATE DATABASE / USE)
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove CREATE DATABASE and USE statements (we're already connected to the database)
    schema = schema.replace(/CREATE DATABASE.*?;/gi, '');
    schema = schema.replace(/USE\s+\w+;/gi, '');

    console.log('📦 Creating tables...');
    await connection.query(schema);
    console.log('✓ Tables created\n');

    // Check if demo user exists
    const [users] = await connection.query(
      "SELECT id FROM users WHERE email = 'demo@trading.com'"
    );

    if (users.length === 0) {
      // Create demo user
      const passwordHash = await bcrypt.hash('demo123', 10);
      await connection.query(
        "INSERT INTO users (email, password_hash, name) VALUES ('demo@trading.com', ?, 'Demo User')",
        [passwordHash]
      );
      console.log('✓ Demo user created:');
      console.log('  Email: demo@trading.com');
      console.log('  Password: demo123\n');

      // Get user ID and create paper wallet
      const [[user]] = await connection.query(
        "SELECT id FROM users WHERE email = 'demo@trading.com'"
      );
      await connection.query(
        'INSERT INTO paper_wallet (user_id, balance) VALUES (?, 10000.00)',
        [user.id]
      );
      console.log('✓ Paper wallet created with $10,000\n');
    } else {
      console.log('✓ Demo user already exists\n');
    }

    // Run migrations
    console.log('📦 Running migrations...');
    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
    const migrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const migration of migrations) {
      try {
        const sql = fs.readFileSync(path.join(migrationsDir, migration), 'utf8');
        await connection.query(sql);
        console.log(`✓ ${migration}`);
      } catch (err) {
        // Ignore "already exists" errors
        if (!err.message.includes('Duplicate') && !err.message.includes('already exists')) {
          console.log(`⚠ ${migration}: ${err.message}`);
        } else {
          console.log(`✓ ${migration} (already applied)`);
        }
      }
    }

    console.log('\n✅ Database setup complete!');
    console.log('\nYou can now start the server: node server.js');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

setupDatabase();
