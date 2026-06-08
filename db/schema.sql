CREATE DATABASE IF NOT EXISTS trading_system;
USE trading_system;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchange_connections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  exchange_name VARCHAR(80) NOT NULL,
  exchange_type ENUM('stock', 'crypto') NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exchange_connections_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trading_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  exchange_id INT NULL,
  symbol VARCHAR(40) NOT NULL,
  exchange_name VARCHAR(80) NOT NULL,
  mode ENUM('paper', 'live') NOT NULL DEFAULT 'paper',
  status ENUM('active', 'paused', 'stopped') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trading_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_trading_sessions_exchange
    FOREIGN KEY (exchange_id) REFERENCES exchange_connections(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  symbol VARCHAR(40) NOT NULL,
  exchange_name VARCHAR(80) NOT NULL,
  order_type ENUM('market', 'limit') NOT NULL,
  side ENUM('buy', 'sell') NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NULL,
  status ENUM('pending', 'filled', 'cancelled', 'rejected') NOT NULL DEFAULT 'pending',
  mode ENUM('paper', 'live') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  filled_at TIMESTAMP NULL,
  CONSTRAINT fk_orders_session
    FOREIGN KEY (session_id) REFERENCES trading_sessions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS portfolio (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_id INT NOT NULL,
  symbol VARCHAR(40) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  average_buy_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
  current_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
  mode ENUM('paper', 'live') NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_portfolio_session_symbol_mode (session_id, symbol, mode),
  CONSTRAINT fk_portfolio_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_portfolio_session
    FOREIGN KEY (session_id) REFERENCES trading_sessions(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  symbol VARCHAR(40) NOT NULL,
  exchange_name VARCHAR(80) NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_watchlist_user_symbol_exchange (user_id, symbol, exchange_name),
  CONSTRAINT fk_watchlist_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_analysis_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  symbol VARCHAR(40) NOT NULL,
  exchange_name VARCHAR(80) NOT NULL,
  analysis_text TEXT NOT NULL,
  prediction VARCHAR(40) NOT NULL,
  confidence_score DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_analysis_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paper_wallet (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  balance DECIMAL(20, 2) NOT NULL DEFAULT 10000.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_paper_wallet_user_currency (user_id, currency),
  CONSTRAINT fk_paper_wallet_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_orders_user_created_at ON orders(user_id, created_at);
CREATE INDEX idx_orders_session_status ON orders(session_id, status);
CREATE INDEX idx_sessions_user_status ON trading_sessions(user_id, status);
CREATE INDEX idx_watchlist_user ON watchlist(user_id);
