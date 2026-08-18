-- Exchange Accounts table for storing user API credentials
-- This is the primary table for exchange connections

CREATE TABLE IF NOT EXISTS exchange_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  exchange_name VARCHAR(80) NOT NULL,
  exchange_type ENUM('crypto', 'stock') NOT NULL DEFAULT 'crypto',
  broker_type VARCHAR(40) NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  additional_params JSON NULL,
  paper_mode BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMP NULL,
  last_verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_user_exchange (user_id, exchange_name),
  CONSTRAINT fk_exchange_accounts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX idx_exchange_accounts_user_active ON exchange_accounts(user_id, is_active);
CREATE INDEX idx_exchange_accounts_exchange ON exchange_accounts(exchange_name);
