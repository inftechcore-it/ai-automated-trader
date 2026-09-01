import mysql from 'mysql2/promise';

const config = {
  host: '98.130.107.169',
  port: 3306,
  user: 'erpuser',
  password: 'erpdb',
  database: 'trading_system'
};

async function runMigration() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('Running migration 002: Advanced orders...\n');

    // Check if migration already applied by checking for stop_price column
    const [cols] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'trading_system' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'stop_price'"
    );

    if (cols.length > 0) {
      console.log('Migration already applied (stop_price column exists)');
      await connection.end();
      return;
    }

    // Modify order_type enum
    console.log('1. Adding new order types...');
    await connection.execute(`
      ALTER TABLE orders
      MODIFY COLUMN order_type ENUM('market', 'limit', 'stop_loss', 'take_profit', 'stop_limit') NOT NULL
    `);

    // Add stop_price column
    console.log('2. Adding stop_price column...');
    await connection.execute(`
      ALTER TABLE orders
      ADD COLUMN stop_price DECIMAL(20, 8) NULL AFTER price
    `);

    // Add take_profit_price column
    console.log('3. Adding take_profit_price column...');
    await connection.execute(`
      ALTER TABLE orders
      ADD COLUMN take_profit_price DECIMAL(20, 8) NULL AFTER stop_price
    `);

    // Add notes column
    console.log('4. Adding notes column...');
    await connection.execute(`
      ALTER TABLE orders
      ADD COLUMN notes VARCHAR(255) NULL AFTER take_profit_price
    `);

    // Add filled_quantity column
    console.log('5. Adding filled_quantity column...');
    await connection.execute(`
      ALTER TABLE orders
      ADD COLUMN filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0 AFTER quantity
    `);

    // Add avg_fill_price column
    console.log('6. Adding avg_fill_price column...');
    await connection.execute(`
      ALTER TABLE orders
      ADD COLUMN avg_fill_price DECIMAL(20, 8) NULL AFTER filled_quantity
    `);

    // Modify status enum
    console.log('7. Updating status enum...');
    await connection.execute(`
      ALTER TABLE orders
      MODIFY COLUMN status ENUM('pending', 'open', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired') NOT NULL DEFAULT 'pending'
    `);

    // Add expires_at column
    console.log('8. Adding expires_at column...');
    await connection.execute(`
      ALTER TABLE orders
      ADD COLUMN expires_at TIMESTAMP NULL AFTER filled_at
    `);

    // Create pending_orders table
    console.log('9. Creating pending_orders table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS pending_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT NOT NULL,
        symbol VARCHAR(40) NOT NULL,
        exchange_name VARCHAR(80) NOT NULL,
        trigger_price DECIMAL(20, 8) NOT NULL,
        trigger_condition ENUM('above', 'below') NOT NULL,
        is_triggered BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        triggered_at TIMESTAMP NULL,
        CONSTRAINT fk_pending_orders_order
          FOREIGN KEY (order_id) REFERENCES orders(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_pending_orders_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    // Create index on pending_orders
    console.log('10. Creating pending_orders index...');
    try {
      await connection.execute(`
        CREATE INDEX idx_pending_orders_untriggered ON pending_orders(is_triggered, symbol)
      `);
    } catch (e) {
      if (!e.message.includes('Duplicate')) throw e;
    }

    // Create recent_trades table
    console.log('11. Creating recent_trades table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS recent_trades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        symbol VARCHAR(40) NOT NULL,
        exchange_name VARCHAR(80) NOT NULL,
        price DECIMAL(20, 8) NOT NULL,
        quantity DECIMAL(20, 8) NOT NULL,
        side ENUM('buy', 'sell') NOT NULL,
        trade_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_simulated BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    // Create index on recent_trades
    console.log('12. Creating recent_trades index...');
    try {
      await connection.execute(`
        CREATE INDEX idx_recent_trades_symbol ON recent_trades(symbol, exchange_name, trade_time)
      `);
    } catch (e) {
      if (!e.message.includes('Duplicate')) throw e;
    }

    console.log('\n✓ Migration 002 completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
