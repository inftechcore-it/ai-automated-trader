-- Migration 003: Live Trading Support
-- Run this after 002_advanced_orders.sql

-- Add external order ID to track orders on broker exchanges
-- Using a procedure to safely add column if it doesn't exist
DROP PROCEDURE IF EXISTS add_external_order_id;
DELIMITER //
CREATE PROCEDURE add_external_order_id()
BEGIN
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'external_order_id') THEN
    ALTER TABLE orders ADD COLUMN external_order_id VARCHAR(100) NULL;
    ALTER TABLE orders ADD INDEX idx_external_order (external_order_id);
  END IF;
END //
DELIMITER ;
CALL add_external_order_id();
DROP PROCEDURE add_external_order_id;

-- Add broker columns to exchange_accounts
DROP PROCEDURE IF EXISTS add_broker_columns;
DELIMITER //
CREATE PROCEDURE add_broker_columns()
BEGIN
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exchange_accounts' AND COLUMN_NAME = 'broker_type') THEN
    ALTER TABLE exchange_accounts ADD COLUMN broker_type VARCHAR(50) DEFAULT 'api';
  END IF;
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exchange_accounts' AND COLUMN_NAME = 'paper_mode') THEN
    ALTER TABLE exchange_accounts ADD COLUMN paper_mode BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exchange_accounts' AND COLUMN_NAME = 'last_synced_at') THEN
    ALTER TABLE exchange_accounts ADD COLUMN last_synced_at TIMESTAMP NULL;
  END IF;
END //
DELIMITER ;
CALL add_broker_columns();
DROP PROCEDURE add_broker_columns;

-- Create table for tracking live order status syncs
CREATE TABLE IF NOT EXISTS order_sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  external_order_id VARCHAR(100) NOT NULL,
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  filled_quantity DECIMAL(18, 8) DEFAULT 0,
  avg_fill_price DECIMAL(18, 8),
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Create table for broker API credentials
CREATE TABLE IF NOT EXISTS broker_credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  broker_name VARCHAR(50) NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  encrypted_api_secret TEXT NOT NULL,
  additional_config JSON,
  is_paper BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_broker (user_id, broker_name, is_paper),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
