-- Migration: Add advanced order types and enhancements
-- Run: mysql -u erpuser -p trading_system < db/migrations/002_advanced_orders.sql

-- Add new order types: stop_loss, take_profit, stop_limit
ALTER TABLE orders
MODIFY COLUMN order_type ENUM('market', 'limit', 'stop_loss', 'take_profit', 'stop_limit') NOT NULL;

-- Add stop price for stop orders
ALTER TABLE orders
ADD COLUMN stop_price DECIMAL(20, 8) NULL AFTER price;

-- Add take profit price
ALTER TABLE orders
ADD COLUMN take_profit_price DECIMAL(20, 8) NULL AFTER stop_price;

-- Add order notes/comments
ALTER TABLE orders
ADD COLUMN notes VARCHAR(255) NULL AFTER take_profit_price;

-- Add filled quantity for partial fills
ALTER TABLE orders
ADD COLUMN filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0 AFTER quantity;

-- Add average fill price
ALTER TABLE orders
ADD COLUMN avg_fill_price DECIMAL(20, 8) NULL AFTER filled_quantity;

-- Add partial fill status
ALTER TABLE orders
MODIFY COLUMN status ENUM('pending', 'open', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired') NOT NULL DEFAULT 'pending';

-- Add expiry for limit orders
ALTER TABLE orders
ADD COLUMN expires_at TIMESTAMP NULL AFTER filled_at;

-- Create pending orders table for stop/limit orders that need monitoring
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
);

CREATE INDEX idx_pending_orders_untriggered ON pending_orders(is_triggered, symbol);

-- Add recent trades table for tracking market activity
CREATE TABLE IF NOT EXISTS recent_trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(40) NOT NULL,
  exchange_name VARCHAR(80) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  side ENUM('buy', 'sell') NOT NULL,
  trade_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_simulated BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_recent_trades_symbol ON recent_trades(symbol, exchange_name, trade_time);
